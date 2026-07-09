import { v2 as cloudinary } from 'cloudinary';
import { config } from './config';
import { withTimeout } from './http';

cloudinary.config({
  cloud_name: config.cloudinaryCloudName,
  api_key: config.cloudinaryApiKey,
  api_secret: config.cloudinaryApiSecret,
});

const UPLOAD_TIMEOUT_MS = 20_000;

// Upload an image buffer, returns the secure URL. upload_stream's callback has no
// timeout of its own — if Cloudinary hangs (bad creds, network stall), the request
// hung forever and the client's "Отправка..." button never re-enabled. Bounded here
// so a stuck upload surfaces as a clean error instead.
export function uploadImage(
  buffer: Buffer,
  folder: string,
  publicId?: string,
): Promise<string> {
  const upload = new Promise<string>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder, public_id: publicId, resource_type: 'image' },
        (err, result) => {
          if (err || !result) return reject(err ?? new Error('Upload failed'));
          resolve(result.secure_url);
        },
      )
      .end(buffer);
  });
  return withTimeout(upload, UPLOAD_TIMEOUT_MS, 'Cloudinary upload');
}

export { cloudinary };
