import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { ProductsModule } from '../products/products.module';

@Module({
  // ADR-0008: Reviews commands Catalog. A compile-time import in this
  // direction only — Catalog's return path is the event, so there is no cycle.
  imports: [ProductsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
