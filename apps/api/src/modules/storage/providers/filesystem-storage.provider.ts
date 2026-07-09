import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { StorageProviderPort, UploadFileInput, UploadFileResult } from '../ports/storage-provider.port';

/**
 * Dev/test adapter — writes to a local directory served back over HTTP by
 * `main.ts` (guarded to only mount when this adapter is active). Never used
 * in production; exists so product photography, and everything downstream of
 * it, can be developed and demoed without a real AWS account.
 */
@Injectable()
export class FilesystemStorageProvider implements StorageProviderPort {
  private readonly logger = new Logger(FilesystemStorageProvider.name);
  private readonly uploadsDir: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    this.uploadsDir = config.get<string>('UPLOADS_DIR', join(process.cwd(), 'uploads'));
    this.publicBaseUrl = config.get<string>('PUBLIC_BASE_URL', 'http://localhost:4000');
  }

  async upload(input: UploadFileInput): Promise<UploadFileResult> {
    const dir = join(this.uploadsDir, input.folder);
    await mkdir(dir, { recursive: true });

    const filename = `${randomUUID()}${extname(input.originalFilename)}`;
    await writeFile(join(dir, filename), input.buffer);

    const storageRef = `local:${input.folder}/${filename}`;
    this.logger.log(`Stored ${storageRef} at ${join(dir, filename)}`);
    return { storageRef };
  }

  async delete(storageRef: string): Promise<void> {
    const key = this.stripPrefix(storageRef);
    try {
      await unlink(join(this.uploadsDir, key));
    } catch (error) {
      this.logger.warn(`Could not delete ${storageRef}: ${(error as Error).message}`);
    }
  }

  resolveUrl(storageRef: string): string {
    const key = this.stripPrefix(storageRef);
    return `${this.publicBaseUrl}/uploads/${key}`;
  }

  private stripPrefix(storageRef: string): string {
    return storageRef.startsWith('local:') ? storageRef.slice('local:'.length) : storageRef;
  }
}
