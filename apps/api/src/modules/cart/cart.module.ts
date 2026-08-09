import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  // Cart resolves each line's image ref to a URL, the same way Catalog does.
  imports: [StorageModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
