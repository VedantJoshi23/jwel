import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { STORAGE_PROVIDER, StorageProviderPort } from '../storage/ports/storage-provider.port';
import {
  MAX_IMAGE_BYTES,
  UploadFolder,
  isAllowedImageMimeType,
  isUploadFolder,
} from '../../common/media/image-upload.constraints';

export interface UploadedImage {
  /** Opaque — this is what the caller persists (Banner.imageRef, Collection.heroImageRef). */
  storageRef: string;
  /** Resolved for immediate display in the admin form, so the operator can see what they uploaded. */
  url: string;
}

@Injectable()
export class UploadsService {
  constructor(@Inject(STORAGE_PROVIDER) private readonly storage: StorageProviderPort) {}

  async uploadImage(
    folder: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ): Promise<UploadedImage> {
    // Re-validated here rather than trusting the controller's ParseFilePipe,
    // the same reasoning ProductsService.addMedia already documents: a
    // service method callable from anywhere shouldn't depend on one specific
    // route having got its pipe configuration right. SECURITY.md §6 requires
    // the server-side check regardless.
    if (!isUploadFolder(folder)) {
      throw new BadRequestException(`Unknown upload folder: ${folder}`);
    }
    if (!isAllowedImageMimeType(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
    if (file.buffer.byteLength > MAX_IMAGE_BYTES) {
      throw new BadRequestException('File exceeds the 8 MB upload limit');
    }

    const { storageRef } = await this.storage.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalFilename: file.originalname,
      folder: folder as UploadFolder,
    });

    return { storageRef, url: this.storage.resolveUrl(storageRef) };
  }
}
