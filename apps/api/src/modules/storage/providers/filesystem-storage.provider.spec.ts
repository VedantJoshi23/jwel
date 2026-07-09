import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { FilesystemStorageProvider } from './filesystem-storage.provider';

describe('FilesystemStorageProvider', () => {
  let uploadsDir: string;
  let provider: FilesystemStorageProvider;

  beforeEach(async () => {
    uploadsDir = await mkdtemp(join(tmpdir(), 'jwel-storage-test-'));
    const config = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'UPLOADS_DIR') return uploadsDir;
        if (key === 'PUBLIC_BASE_URL') return 'http://localhost:4000';
        return fallback;
      }),
    };
    provider = new FilesystemStorageProvider(config as unknown as ConfigService);
  });

  afterEach(async () => {
    await rm(uploadsDir, { recursive: true, force: true });
  });

  it('writes the uploaded buffer to <uploadsDir>/<folder>/<uuid><ext> and returns a local: storageRef', async () => {
    const { storageRef } = await provider.upload({
      buffer: Buffer.from('fake-image-bytes'),
      mimeType: 'image/png',
      originalFilename: 'photo.png',
      folder: 'products',
    });

    expect(storageRef).toMatch(/^local:products\/[0-9a-f-]+\.png$/);
    const key = storageRef.slice('local:'.length);
    const written = await readFile(join(uploadsDir, key));
    expect(written.toString()).toBe('fake-image-bytes');
  });

  it('resolveUrl builds a URL under PUBLIC_BASE_URL/uploads/', async () => {
    const { storageRef } = await provider.upload({
      buffer: Buffer.from('x'),
      mimeType: 'image/jpeg',
      originalFilename: 'a.jpg',
      folder: 'products',
    });
    const key = storageRef.slice('local:'.length);
    expect(provider.resolveUrl(storageRef)).toBe(`http://localhost:4000/uploads/${key}`);
  });

  it('resolveUrl treats a storageRef with no local: prefix as already a bare key', () => {
    expect(provider.resolveUrl('products/already-bare-key.png')).toBe(
      'http://localhost:4000/uploads/products/already-bare-key.png',
    );
  });

  it('delete removes the file; a second delete does not throw', async () => {
    const { storageRef } = await provider.upload({
      buffer: Buffer.from('x'),
      mimeType: 'image/png',
      originalFilename: 'a.png',
      folder: 'products',
    });
    await provider.delete(storageRef);
    const key = storageRef.slice('local:'.length);
    await expect(readFile(join(uploadsDir, key))).rejects.toThrow();
    await expect(provider.delete(storageRef)).resolves.toBeUndefined();
  });
});
