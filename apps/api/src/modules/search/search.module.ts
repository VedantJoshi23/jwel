import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { ES_CLIENT, createEsClient } from './es-client.provider';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ProductsModule],
  controllers: [SearchController],
  providers: [
    SearchService,
    { provide: ES_CLIENT, useFactory: createEsClient, inject: [ConfigService] },
  ],
  exports: [SearchService],
})
export class SearchModule {}
