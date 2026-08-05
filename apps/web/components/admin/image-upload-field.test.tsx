import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageUploadField } from './image-upload-field';
import { ApiError } from '@/lib/api/client';

const uploadMock = vi.fn();
vi.mock('@/lib/api/admin-uploads', () => ({
  adminUploadImage: (...args: unknown[]) => uploadMock(...args),
}));

function renderField(props: Partial<React.ComponentProps<typeof ImageUploadField>> = {}) {
  const onChange = vi.fn();
  render(
    <ImageUploadField
      label="Banner image"
      folder="banners"
      token="token-1"
      value={null}
      previewUrl={null}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange };
}

function jpeg() {
  return new File(['bytes'], 'diwali.jpg', { type: 'image/jpeg' });
}

describe('ImageUploadField', () => {
  beforeEach(() => {
    uploadMock.mockReset();
    uploadMock.mockResolvedValue({ storageRef: 'local:banners/x.jpg', url: 'https://cdn/x.jpg' });
  });
  afterEach(() => vi.clearAllMocks());

  it('uploads the picked file to the configured folder', async () => {
    renderField({ folder: 'collections' });
    await userEvent.upload(screen.getByLabelText('Banner image'), jpeg());

    await waitFor(() => expect(uploadMock).toHaveBeenCalledWith('token-1', 'collections', expect.any(File)));
  });

  // The whole point of the component: the operator picks a file, the opaque
  // ref is produced for them rather than typed by hand.
  it('reports the storage ref and preview url back to the form', async () => {
    const { onChange } = renderField();
    await userEvent.upload(screen.getByLabelText('Banner image'), jpeg());

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('local:banners/x.jpg', 'https://cdn/x.jpg'),
    );
  });

  it('shows the current image when one is already set', () => {
    renderField({ value: 'local:banners/x.jpg', previewUrl: 'https://cdn/x.jpg' });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn/x.jpg');
  });

  it('clears both the ref and the preview when removed', async () => {
    const { onChange } = renderField({ value: 'local:banners/x.jpg', previewUrl: 'https://cdn/x.jpg' });
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onChange).toHaveBeenCalledWith(null, null);
  });

  // "Unsupported file type: application/pdf" or "File exceeds the 8 MB upload
  // limit" tells the operator what to do; "Upload failed" does not.
  it("surfaces the API's own message on failure", async () => {
    uploadMock.mockRejectedValue(new ApiError('File exceeds the 8 MB upload limit', 400));
    renderField();
    await userEvent.upload(screen.getByLabelText('Banner image'), jpeg());

    expect(await screen.findByRole('alert')).toHaveTextContent('File exceeds the 8 MB upload limit');
  });

  it('does not report a ref to the form when the upload failed', async () => {
    uploadMock.mockRejectedValue(new ApiError('Unsupported file type: application/pdf', 400));
    const { onChange } = renderField();
    await userEvent.upload(screen.getByLabelText('Banner image'), jpeg());

    await screen.findByRole('alert');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('falls back to a generic message for a non-API failure', async () => {
    uploadMock.mockRejectedValue(new Error('network down'));
    renderField();
    await userEvent.upload(screen.getByLabelText('Banner image'), jpeg());

    expect(await screen.findByRole('alert')).toHaveTextContent('Upload failed');
  });

  it('disables the picker when there is no auth token', () => {
    renderField({ token: null });
    expect(screen.getByLabelText('Banner image')).toBeDisabled();
  });

  it('accepts only the image types the API allows', () => {
    renderField();
    expect(screen.getByLabelText('Banner image')).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/webp',
    );
  });
});
