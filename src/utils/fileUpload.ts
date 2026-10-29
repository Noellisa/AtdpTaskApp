/**
 * File & Image Upload Utilities for ATDP Workforce Flow
 * Handles client-side image compression for profile pictures and
 * file-to-DataURL / Blob URL conversion for task attachments and HR documents.
 */

export interface ProcessedFileUpload {
  fileName: string;
  fileSize: string;
  mimeType: string;
  fileUrl: string;
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '1 KB';
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${Math.max(1, Math.round(kb))} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * Compresses and crops an image file into a compact square JPEG Data URL
 * suitable for storing in Firestore and localStorage.
 */
export function compressProfileImage(
  file: File,
  maxSizePx = 240,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;

        canvas.width = maxSizePx;
        canvas.height = maxSizePx;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(typeof reader.result === 'string' ? reader.result : '');
          return;
        }
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, maxSizePx, maxSizePx);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Reads any uploaded document or task deliverable file.
 * Files up to 250KB are stored as persistent base64 Data URLs;
 * larger files use a session Blob URL so Firestore document limits are respected.
 */
export function processUploadedFile(file: File): Promise<ProcessedFileUpload> {
  return new Promise((resolve) => {
    const fileSize = formatBytes(file.size);
    const mimeType = file.type || 'application/octet-stream';

    if (file.size <= 250 * 1024) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl =
          typeof reader.result === 'string'
            ? reader.result
            : URL.createObjectURL(file);
        resolve({
          fileName: file.name,
          fileSize,
          mimeType,
          fileUrl: dataUrl,
        });
      };
      reader.onerror = () => {
        resolve({
          fileName: file.name,
          fileSize,
          mimeType,
          fileUrl: URL.createObjectURL(file),
        });
      };
      reader.readAsDataURL(file);
    } else {
      resolve({
        fileName: file.name,
        fileSize,
        mimeType,
        fileUrl: URL.createObjectURL(file),
      });
    }
  });
}

/**
 * Triggers a clean browser download or opens a file URL.
 * If the document was created with metadata only, generates a downloadable summary file.
 */
export function downloadOrOpenFile(
  fileName: string,
  fileUrl?: string,
  fallbackText?: string
): void {
  const safeName = fileName.trim() || 'ATDP_Document.txt';

  if (fileUrl && (fileUrl.startsWith('data:') || fileUrl.startsWith('blob:'))) {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  if (fileUrl && /^https?:\/\//i.test(fileUrl) && !fileUrl.includes('atdp.org/uploads/')) {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // Fallback: generate a downloadable file with the document details
  const content =
    fallbackText ||
    `ATDP Workforce Flow — Official Document Record\nFile Name: ${safeName}\nGenerated: ${new Date().toUTCString()}\n`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = safeName.endsWith('.txt') ? safeName : `${safeName}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
}

/**
 * Generates a formatted Google Meet link code (xxx-xxxx-xxx) or returns the instant Meet creation link.
 */
export function generateGoogleMeetRoomCode(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz';
  const pick = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `https://meet.google.com/${pick(3)}-${pick(4)}-${pick(3)}`;
}
