import { apiUpload } from './client';

/** Must stay in step with UPLOAD_FOLDERS in the API's image-upload.constraints. */
export type UploadFolder = 'banners' | 'collections';

export interface UploadedImage {
  /** Opaque ref to persist on the record (Banner.imageRef, Collection.heroImageRef). */
  storageRef: string;
  /** Resolved URL, so the form can show what was just uploaded without a refetch. */
  url: string;
}

export function adminUploadImage(token: string, folder: UploadFolder, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<UploadedImage>(`/admin/uploads/${folder}`, formData, token);
}
