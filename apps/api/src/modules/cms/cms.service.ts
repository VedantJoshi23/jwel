import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertBannerDto } from './dto/upsert-banner.dto';
import { STORAGE_PROVIDER, StorageProviderPort } from '../storage/ports/storage-provider.port';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class CmsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProviderPort,
    private readonly settings: SettingsService,
  ) {}

  // Public surface, same discipline as `listActiveBanners`: filters server-
  // side rather than shipping the raw `active` flag for the client to
  // interpret, so a storefront that forgets to check it can't show a
  // deactivated announcement. `null` (not an empty string) is the "nothing to
  // show" case — SiteHeader renders nothing at all when this is null, the
  // same contract PromoBanners already uses for an empty banner feed.
  async getAnnouncement(): Promise<{ text: string } | null> {
    const [text, active] = await Promise.all([
      this.settings.get('announcement.text'),
      this.settings.get('announcement.active'),
    ]);
    return active ? { text } : null;
  }

  // Public surface: only banners that are flagged active AND inside their
  // optional scheduling window — lets marketing queue up a banner ahead of a
  // launch date without a same-day deploy/toggle.
  //
  // Resolves `imageRef` into a loadable `imageUrl` here rather than leaving
  // that to the client. The ref is deliberately opaque (storage-provider.port
  // calls it that, and its shape differs between the S3 and filesystem
  // adapters), so only the API — which knows which adapter is active — can
  // turn it into a URL. `imageRef` is still returned alongside: the admin
  // surface edits refs, not URLs.
  async listActiveBanners() {
    const now = new Date();
    const banners = await this.prisma.banner.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { sortOrder: 'asc' },
    });

    return banners.map((banner) => ({
      ...banner,
      imageUrl: this.storage.resolveUrl(banner.imageRef),
    }));
  }

  adminListBanners() {
    return this.prisma.banner.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async adminCreateBanner(dto: UpsertBannerDto) {
    return this.prisma.banner.create({
      data: {
        title: dto.title,
        imageRef: dto.imageRef,
        linkUrl: dto.linkUrl,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });
  }

  async adminUpdateBanner(id: string, dto: UpsertBannerDto) {
    await this.findOrThrow(id);
    return this.prisma.banner.update({
      where: { id },
      data: {
        title: dto.title,
        imageRef: dto.imageRef,
        linkUrl: dto.linkUrl,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });
  }

  async adminDeleteBanner(id: string): Promise<void> {
    await this.findOrThrow(id);
    // Hard delete, unlike Product/Category/User/Coupon — a banner has no
    // historical references from other tables (no order/audit trail points
    // at it), so there's nothing a soft delete would need to preserve.
    await this.prisma.banner.delete({ where: { id } });
  }

  private async findOrThrow(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) {
      throw new NotFoundException('Banner not found');
    }
    return banner;
  }
}
