import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { StorageProviderPort, UploadFileInput, UploadFileResult } from '../ports/storage-provider.port';

/**
 * Production adapter. Credentials come from the standard AWS SDK credential
 * chain (env vars / IAM role) — never read from ConfigService directly here,
 * so nothing provider-specific about *how* credentials are supplied leaks
 * into this class. `CDN_BASE_URL` is optional: if a CloudFront distribution
 * is fronting the bucket, resolveUrl serves through that instead of the raw
 * S3 URL — swappable without touching any stored storageRef, since the key
 * (not the URL) is what's persisted.
 */
@Injectable()
export class S3StorageProvider implements StorageProviderPort {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly cdnBaseUrl?: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('AWS_S3_BUCKET');
    this.region = config.getOrThrow<string>('AWS_REGION');
    this.cdnBaseUrl = config.get<string>('CDN_BASE_URL');
    this.client = new S3Client({ region: this.region });
  }

  async upload(input: UploadFileInput): Promise<UploadFileResult> {
    const key = `${input.folder}/${randomUUID()}${extname(input.originalFilename)}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.mimeType,
      }),
    );

    const storageRef = `s3:${key}`;
    this.logger.log(`Uploaded ${storageRef} to bucket ${this.bucket}`);
    return { storageRef };
  }

  async delete(storageRef: string): Promise<void> {
    const key = this.stripPrefix(storageRef);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  resolveUrl(storageRef: string): string {
    const key = this.stripPrefix(storageRef);
    if (this.cdnBaseUrl) {
      return `${this.cdnBaseUrl}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  private stripPrefix(storageRef: string): string {
    return storageRef.startsWith('s3:') ? storageRef.slice('s3:'.length) : storageRef;
  }
}
