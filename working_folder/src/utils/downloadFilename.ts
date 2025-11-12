const sanitizeSegment = (value?: string | null): string => {
  if (!value) return '';
  const sanitized = value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return sanitized.length > 0 ? sanitized : '';
};

const extensionFromFilename = (filename?: string | null): string | null => {
  if (!filename) return null;
  const name = filename.split('/').pop() ?? filename;
  const match = name.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : null;
};

const extensionFromMimeType = (mimeType?: string | null): string | null => {
  if (!mimeType) return null;
  const normalized = mimeType.toLowerCase();
  const map: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/aac': 'aac',
    'audio/x-aac': 'aac',
    'audio/flac': 'flac',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/aiff': 'aiff',
    'audio/x-aiff': 'aiff',
  };

  return map[normalized] || null;
};

const extensionFromUrl = (url?: string | null): string | null => {
  if (!url) return null;
  const extract = (input: string): string | null => {
    const trimmed = input.split(/[?#]/)[0];
    const match = trimmed.match(/\.([a-z0-9]+)$/i);
    return match ? match[1].toLowerCase() : null;
  };

  try {
    const parsed = new URL(url);
    const ext = extract(parsed.pathname);
    if (ext) return ext;
  } catch {
    // Ignore invalid URL formats and fall back to manual parsing.
  }

  return extract(url);
};

const stripTrailingExtension = (filename: string, extension: string): string => {
  const suffix = `.${extension}`;
  if (filename.toLowerCase().endsWith(suffix.toLowerCase())) {
    return filename.slice(0, -suffix.length);
  }
  return filename;
};

export interface BuildDownloadFilenameParams {
  preferredFilename?: string | null;
  title?: string | null;
  fallbackId?: string | null;
  resolvedUrl?: string | null;
  mimeType?: string | null;
  defaultExtension?: string;
}

export const buildDownloadFilename = ({
  preferredFilename,
  title,
  fallbackId,
  resolvedUrl,
  mimeType,
  defaultExtension = 'mp3',
}: BuildDownloadFilenameParams): string => {
  const sanitizedPreferred = sanitizeSegment(preferredFilename);
  const preferredExtension = extensionFromFilename(preferredFilename);

  if (sanitizedPreferred && preferredExtension) {
    return sanitizedPreferred;
  }

  const baseSource =
    sanitizedPreferred ||
    sanitizeSegment(title) ||
    sanitizeSegment(fallbackId) ||
    'download';

  const extension =
    preferredExtension ||
    extensionFromUrl(resolvedUrl) ||
    extensionFromMimeType(mimeType) ||
    defaultExtension ||
    'mp3';

  const sanitizedBase =
    baseSource.length > 0 ? stripTrailingExtension(baseSource, extension) : 'download';

  return `${sanitizedBase || 'download'}.${extension}`;
};

export const deriveAudioExtension = ({
  filename,
  resolvedUrl,
  mimeType,
  defaultExtension = 'mp3',
}: {
  filename?: string | null;
  resolvedUrl?: string | null;
  mimeType?: string | null;
  defaultExtension?: string;
}): string => {
  return (
    extensionFromFilename(filename) ||
    extensionFromUrl(resolvedUrl) ||
    extensionFromMimeType(mimeType) ||
    defaultExtension
  );
};
