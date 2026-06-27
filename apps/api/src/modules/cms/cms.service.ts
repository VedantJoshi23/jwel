import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertBannerDto } from './dto/upsert-banner.dto';

@Injectable()
export class CmsService {
  constructor(private readonly prisma: PrismaService) {}

  // Public surface: only banners that are flagged active AND inside their
  // optional scheduling window — lets marketing queue up a banner ahead of a
  // launch date without a same-day deploy/toggle.
  listActiveBanners() {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { sortOrder: 'asc' },
    });
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
