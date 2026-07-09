import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { S3StorageProvider } from './s3-storage.provider';

jest.mock('@aws-sdk/client-s3', () => {
  const send = jest.fn().mockResolvedValue({});
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send })),
    PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  };
});

function fakeConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    AWS_S3_BUCKET: 'jwel-media',
    AWS_REGION: 'ap-south-1',
    ...overrides,
  };
  return {
    getOrThrow: jest.fn((key: string) => {
      if (!(key in values)) throw new Error(`Missing config: ${key}`);
      return values[key];
    }),
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('S3StorageProvider', () => {
  it('uploads via PutObjectCommand with an s3: prefixed storageRef', async () => {
    const provider = new S3StorageProvider(fakeConfig());
    const { storageRef } = await provider.upload({
      buffer: Buffer.from('x'),
      mimeType: 'image/png',
      originalFilename: 'photo.png',
      folder: 'products',
    });

    expect(storageRef).toMatch(/^s3:products\/[0-9a-f-]+\.png$/);
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({ Bucket: 'jwel-media', ContentType: 'image/png' }),
    );
  });

  it('resolveUrl uses the plain S3 URL when no CDN is configured', () => {
    const provider = new S3StorageProvider(fakeConfig());
    expect(provider.resolveUrl('s3:products/abc.png')).toBe(
      'https://jwel-media.s3.ap-south-1.amazonaws.com/products/abc.png',
    );
  });

  it('resolveUrl prefers CDN_BASE_URL when configured', () => {
    const provider = new S3StorageProvider(fakeConfig({ CDN_BASE_URL: 'https://cdn.jwel.example' }));
    expect(provider.resolveUrl('s3:products/abc.png')).toBe('https://cdn.jwel.example/products/abc.png');
  });

  it('resolveUrl treats a storageRef with no s3: prefix as already a bare key', () => {
    const provider = new S3StorageProvider(fakeConfig());
    expect(provider.resolveUrl('products/already-bare-key.png')).toBe(
      'https://jwel-media.s3.ap-south-1.amazonaws.com/products/already-bare-key.png',
    );
  });

  it('delete issues a DeleteObjectCommand for the stripped key', async () => {
    const provider = new S3StorageProvider(fakeConfig());
    await provider.delete('s3:products/abc.png');
    expect(DeleteObjectCommand).toHaveBeenCalledWith({ Bucket: 'jwel-media', Key: 'products/abc.png' });
  });

  it('throws if required AWS config is missing rather than silently defaulting', () => {
    const config = { getOrThrow: jest.fn(() => { throw new Error('Missing config: AWS_S3_BUCKET'); }) } as unknown as ConfigService;
    expect(() => new S3StorageProvider(config)).toThrow('Missing config');
  });
});
