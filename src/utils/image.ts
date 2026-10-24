/**
 * Image utility: crops a File or Blob to a square 1:1 canvas,
 * then compresses to WebP (or JPEG fallback) targeting < 200 KB.
 */

/**
 * Reads a File and returns a data URL for preview.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target!.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Crops a source image (data URL or object URL) to a centred square
 * and returns a compressed data URL (WebP preferred, JPEG fallback).
 * @param src    - data URL or object URL of the source image
 * @param size   - output size in px (default 600)
 * @param quality - compression quality 0–1 (default 0.82)
 */
export function cropToSquare(
  src: string,
  size = 600,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Centre-crop: take the largest centred square from source
      const { naturalWidth: w, naturalHeight: h } = img;
      const side = Math.min(w, h);
      const sx = (w - side) / 2;
      const sy = (h - side) / 2;

      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

      // Prefer WebP, fall back to JPEG
      const type = canvas.toDataURL('image/webp', 0.01).startsWith('data:image/webp')
        ? 'image/webp'
        : 'image/jpeg';

      resolve(canvas.toDataURL(type, quality));
    };
    img.onerror = reject;
    img.src = src;
  });
}

/** Returns file size in KB from a data URL */
export function dataUrlSizeKB(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.round((base64.length * 3) / 4 / 1024);
}

/** Validates an uploaded file is image and ≤ 5 MB */
export function validateImageFile(file: File): string | null {
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!ALLOWED.includes(file.type)) {
    return 'Only JPG, PNG, WebP, or GIF images are allowed.';
  }
  if (file.size > 5 * 1024 * 1024) {
    return 'Image must be under 5 MB.';
  }
  return null;
}
