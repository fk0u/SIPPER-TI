export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

export interface FileValidationResult {
  valid: File[];
  errors: string[];
}

/** Validasi ukuran & tipe berkas; mengumpulkan semua error, bukan hanya yang terakhir. */
export function validateAttachmentFiles(files: Iterable<File>): FileValidationResult {
  const valid: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!(ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
      errors.push(`"${file.name}": format tidak didukung (gunakan JPG, PNG, WebP, atau PDF).`);
    } else if (file.size > MAX_ATTACHMENT_BYTES) {
      errors.push(`"${file.name}": melebihi batas ukuran maksimal 5MB.`);
    } else {
      valid.push(file);
    }
  }

  return { valid, errors };
}

/** Nama berkas aman untuk path storage. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(-80);
  return cleaned || 'lampiran';
}

export function formatFileSize(size?: number): string {
  if (size === undefined || size === null) return '-';
  if (size === 0) return '0 KB';
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}
