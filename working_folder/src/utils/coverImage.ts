export const NOT_FOUND_MARKER = '__NOT_FOUND__';

export const coverImageCacheKey = (id: string, service = 'THUMBNAIL') =>
  `${service}::${id}`;
