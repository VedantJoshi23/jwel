import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartService } from './cart.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageProviderPort } from '../storage/ports/storage-provider.port';

/**
 * DOM-SHOPPING Invariants 9, 11 and 16 — the shareable cart.
 */
describe('CartService — sharing', () => {
  let prisma: any;
  let service: CartService;

  const line = (over: Record<string, unknown> = {}) => ({
    variantId: 'v1',
    quantity: 2,
    giftWrap: false,
    giftNote: null,
    variant: {
      metal: 'GOLD',
      size: '16',
      basePriceMinorUnits: 250000,
      product: { name: 'Gold Ring', slug: 'gold-ring', status: 'PUBLISHED', deletedAt: null },
    },
    ...over,
  });

  beforeEach(() => {
    prisma = {
      productVariant: { count: jest.fn().mockResolvedValue(1) },
      cartShare: {
        create: jest.fn().mockResolvedValue({ token: 'tok-abc' }),
        findUnique: jest.fn(),
      },
    };
    // Resolves each line's image ref to a URL — see withResolvedMedia.
    const storage = { resolveUrl: (ref: string) => `https://cdn.test/${ref}` };
    service = new CartService(prisma as unknown as PrismaService, storage as unknown as StorageProviderPort);
  });

  describe('createShare', () => {
    it('returns a token and nothing else', async () => {
      const result = await service.createShare({ items: [{ variantId: 'v1', quantity: 2 }] });
      expect(result).toEqual({ token: 'tok-abc' });
    });

    it('stores no price — Invariant 11 resolves that at open time', async () => {
      await service.createShare({ items: [{ variantId: 'v1', quantity: 2 }] });

      const created = prisma.cartShare.create.mock.calls[0][0].data;
      expect(JSON.stringify(created)).not.toMatch(/price/i);
      expect(created.items.create[0]).toEqual({
        variantId: 'v1',
        quantity: 2,
        giftWrap: false,
        giftNote: undefined,
      });
    });

    it('records no owner — the surest way to honour Invariant 9', async () => {
      await service.createShare({ items: [{ variantId: 'v1', quantity: 1 }] });
      const created = prisma.cartShare.create.mock.calls[0][0].data;
      expect(created).not.toHaveProperty('userId');
      expect(JSON.stringify(created)).not.toMatch(/user/i);
    });

    it('keeps gift configuration, which is half of what a share means', async () => {
      await service.createShare({
        items: [{ variantId: 'v1', quantity: 1, giftWrap: true, giftNote: 'For Diya' }],
      });
      expect(prisma.cartShare.create.mock.calls[0][0].data.items.create[0]).toMatchObject({
        giftWrap: true,
        giftNote: 'For Diya',
      });
    });

    it('keeps the same variant twice when the configuration differs (Invariant 1)', async () => {
      // Wrapped and unwrapped are two lines, which is why the snapshot table
      // carries no unique on (shareId, variantId).
      prisma.productVariant.count.mockResolvedValue(1);
      await service.createShare({
        items: [
          { variantId: 'v1', quantity: 1, giftWrap: true },
          { variantId: 'v1', quantity: 1, giftWrap: false },
        ],
      });
      expect(prisma.cartShare.create.mock.calls[0][0].data.items.create).toHaveLength(2);
    });

    it('refuses a variant that does not exist, rather than minting a dead link', async () => {
      prisma.productVariant.count.mockResolvedValue(0);
      await expect(
        service.createShare({ items: [{ variantId: 'ghost', quantity: 1 }] }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.cartShare.create).not.toHaveBeenCalled();
    });

    it('does not refuse a variant that merely became unavailable', async () => {
      // Availability is an open-time fact (Invariant 11). A piece selling out
      // between share and open must mark that line, not 404 the whole link.
      prisma.productVariant.count.mockResolvedValue(1);
      await expect(
        service.createShare({ items: [{ variantId: 'v1', quantity: 1 }] }),
      ).resolves.toEqual({ token: 'tok-abc' });
    });
  });

  describe('getShare', () => {
    it('404s on an unknown token', async () => {
      prisma.cartShare.findUnique.mockResolvedValue(null);
      await expect(service.getShare('nope')).rejects.toThrow(NotFoundException);
    });

    it('returns the frozen lines with live prices', async () => {
      prisma.cartShare.findUnique.mockResolvedValue({ items: [line()] });

      const { items } = await service.getShare('tok-abc');

      expect(items[0]).toMatchObject({
        variantId: 'v1',
        quantity: 2,
        productName: 'Gold Ring',
        unitPriceMinorUnits: 250000,
        available: true,
      });
    });

    it('exposes nothing about the sender', async () => {
      prisma.cartShare.findUnique.mockResolvedValue({ items: [line()] });
      const result = await service.getShare('tok-abc');
      expect(Object.keys(result)).toEqual(['items']);
      expect(JSON.stringify(result)).not.toMatch(/userId|email/i);
    });

    it('marks an unpublished line unavailable instead of dropping it', async () => {
      // The recipient should see that the sender meant to send it and that
      // they cannot have it — a silently shorter cart explains nothing.
      prisma.cartShare.findUnique.mockResolvedValue({
        items: [line({ variant: { ...line().variant, product: { ...line().variant.product, status: 'ARCHIVED' } } })],
      });

      const { items } = await service.getShare('tok-abc');

      expect(items).toHaveLength(1);
      expect(items[0].available).toBe(false);
    });

    it('marks a soft-deleted line unavailable', async () => {
      prisma.cartShare.findUnique.mockResolvedValue({
        items: [
          line({
            variant: {
              ...line().variant,
              product: { ...line().variant.product, deletedAt: new Date() },
            },
          }),
        ],
      });
      expect((await service.getShare('tok-abc')).items[0].available).toBe(false);
    });
  });
});
