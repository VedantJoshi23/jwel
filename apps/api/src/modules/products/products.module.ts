import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { BulkImportService } from './bulk-import.service';
import { ProductsController } from './products.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [ProductsController],
  providers: [ProductsService, BulkImportService],
  exports: [ProductsService],
})
export class ProductsModule {}
