export const ALLOWED_PUBLIC_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_PUBLIC_IMAGE_SIZE = 5 * 1024 * 1024;
export const PUBLIC_IMAGE_ACCEPT = ALLOWED_PUBLIC_IMAGE_TYPES.join(',');
export const INVALID_IMAGE_FORMAT_MESSAGE = 'Formato não permitido. Envie uma imagem JPG, PNG ou WEBP.';
export const TEMPORARY_FAILURE_MESSAGE = 'Não foi possível concluir agora. Tente novamente em instantes.';

const EXT_BY_MIME: Record<(typeof ALLOWED_PUBLIC_IMAGE_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function validatePublicImageFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  if (!ALLOWED_PUBLIC_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_PUBLIC_IMAGE_TYPES)[number])) {
    return INVALID_IMAGE_FORMAT_MESSAGE;
  }

  if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    return INVALID_IMAGE_FORMAT_MESSAGE;
  }

  if (file.size > MAX_PUBLIC_IMAGE_SIZE) {
    return 'Cada foto pode ter no maximo 5MB.';
  }

  return null;
}

export function publicImageExtension(file: File) {
  return EXT_BY_MIME[file.type as (typeof ALLOWED_PUBLIC_IMAGE_TYPES)[number]] ?? 'jpg';
}
