/**
 * What the document endpoint accepts. Kept beside the client so the file
 * picker offers exactly what the server will store, rather than letting a
 * trader choose a file that is rejected after the upload.
 */
export const ALLOWED_UPLOAD_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
] as const

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export function formatBytes(bytes: number): string {
  return bytes >= 1_000_000
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`
}
