import { Module } from '@nestjs/common';
import { CmsService } from './cms.service';
import { CmsController } from './cms.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [CmsController],
  providers: [CmsService],
})
export class CmsModule {}
