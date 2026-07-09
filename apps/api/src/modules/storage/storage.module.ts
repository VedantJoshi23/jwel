import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { STORAGE_PROVIDER } from './ports/storage-provider.port';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { FilesystemStorageProvider } from './providers/filesystem-storage.provider';

// Unlike Payments (Stripe live + Razorpay stub both wired simultaneously,
// selected per-request), only one Storage adapter is ever active per
// deployment — selected once at bootstrap by `STORAGE_PROVIDER`, defaulting
// to `filesystem` so a fresh checkout with no AWS credentials configured
// still boots and works locally.
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('STORAGE_PROVIDER', 'filesystem');
        if (provider === 's3') {
          return new S3StorageProvider(config);
        }
        return new FilesystemStorageProvider(config);
      },
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
