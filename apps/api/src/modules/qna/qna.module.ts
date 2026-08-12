import { Module } from '@nestjs/common';
import { QnaService } from './qna.service';
import { QnaController } from './qna.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  // StorageModule only, for resolving the admin list's product image URL —
  // the same reason RecommendationsModule imports it. No ProductsModule/
  // UsersModule: DOM-PRODUCT-QA §7 allows reading Catalog/Identity but there
  // is no cross-domain *write* here (unlike Reviews commanding Catalog to
  // recompute ratings), so this module reads Product/User directly via
  // Prisma includes — the same pattern ReviewsService.adminListPending
  // already uses for its own product/user include.
  imports: [StorageModule],
  controllers: [QnaController],
  providers: [QnaService],
  exports: [QnaService],
})
export class QnaModule {}
