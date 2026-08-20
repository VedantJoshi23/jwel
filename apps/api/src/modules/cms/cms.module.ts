import { Module } from '@nestjs/common';
import { CmsService } from './cms.service';
import { CmsController } from './cms.controller';
import { StorageModule } from '../storage/storage.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [StorageModule, SettingsModule],
  controllers: [CmsController],
  providers: [CmsService],
})
export class CmsModule {}
