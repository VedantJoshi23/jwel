import { BadRequestException } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { StorageProviderPort } from '../storage/ports/storage-provider.port';

function imageFile(overrides: Partial<{ buffer: Buffer; mimetype: string; originalname: string }> = {}) {
  return {
    buffer: Buffer.from('fake-image-bytes'),
    mimetype: 'image/jpeg',
    originalname: 'diwali.jpg',
    ...overrides,
  };
}

describe('UploadsService', () => {
  let storage: { upload: jest.Mock; delete: jest.Mock; resolveUrl: jest.Mock };
  let service: UploadsService;

  beforeEach(() => {
    storage = {
      upload: jest.fn().mockResolvedValue({ storageRef: 'local:banners/uuid.jpg' }),
      delete: jest.fn(),
      resolveUrl: jest.fn((ref: string) => `https://cdn.example/${ref}`),
    };
    service = new UploadsService(storage as unknown as StorageProviderPort);
  });

  describe('folder allowlist', () => {
    // This is a path-traversal boundary, not a tidiness rule:
    // FilesystemStorageProvider does join(uploadsDir, folder), so a folder
    // taken from the request URL could write outside the uploads directory.
    it.each([
      ['parent traversal', '../../etc'],
      ['absolute path', '/etc'],
      ['nested traversal', 'banners/../../../root'],
      ['an unlisted folder', 'products'],
    ])('rejects %s and never reaches the storage port', async (_label, folder) => {
      await expect(service.uploadImage(folder, imageFile())).rejects.toThrow(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it.each(['banners', 'collections'])('accepts the allowlisted folder "%s"', async (folder) => {
      await expect(service.uploadImage(folder, imageFile())).resolves.toBeDefined();
      expect(storage.upload).toHaveBeenCalledWith(expect.objectContaining({ folder }));
    });
  });

  describe('file validation', () => {
    // Re-checked here even though the controller's ParseFilePipe checks the
    // same things — a service callable from anywhere shouldn't depend on one
    // route having got its pipe configuration right.
    it.each(['application/pdf', 'text/html', 'image/svg+xml'])(
      'rejects the mime type %s',
      async (mimetype) => {
        await expect(service.uploadImage('banners', imageFile({ mimetype }))).rejects.toThrow(
          /Unsupported file type/,
        );
        expect(storage.upload).not.toHaveBeenCalled();
      },
    );

    it('rejects a file over the 8 MB cap', async () => {
      const tooBig = imageFile({ buffer: Buffer.alloc(8 * 1024 * 1024 + 1) });
      await expect(service.uploadImage('banners', tooBig)).rejects.toThrow(/8 MB/);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('accepts a file exactly at the cap', async () => {
      const atLimit = imageFile({ buffer: Buffer.alloc(8 * 1024 * 1024) });
      await expect(service.uploadImage('banners', atLimit)).resolves.toBeDefined();
    });
  });

  describe('response', () => {
    it('returns the opaque ref to persist and a resolved url to display', async () => {
      const result = await service.uploadImage('banners', imageFile());

      // The ref is what Banner.imageRef/Collection.heroImageRef store; the
      // url exists so the admin form can show what was just uploaded without
      // a second round trip.
      expect(result).toEqual({
        storageRef: 'local:banners/uuid.jpg',
        url: 'https://cdn.example/local:banners/uuid.jpg',
      });
    });
  });
});
