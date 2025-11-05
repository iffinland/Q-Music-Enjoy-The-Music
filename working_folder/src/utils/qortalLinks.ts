const getQdnBase = (): string => {
  if (typeof window === 'undefined') {
    return 'APP/Q-Music';
  }

  const base = (window as any)?._qdnBase;
  if (!base || typeof base !== 'string') {
    return 'APP/Q-Music';
  }

  return base;
};

const normalizeBase = (base: string): string => {
  let trimmed = (base || '').trim();
  if (!trimmed) {
    return 'APP/Q-Music';
  }

  trimming: {
    trimmed = trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!trimmed) break trimming;

    trimmed = trimmed.replace(/^render\//i, '');
    trimmed = trimmed.replace(/^render\//i, '');

    if (!trimmed) break trimming;

    return trimmed;
  }

  return 'APP/Q-Music';
};

const safeSegment = (segment: string | undefined | null) =>
  encodeURIComponent(segment ?? '').replace(/%20/g, '+');

export const buildQortalResourceUrl = (service: string, name: string, identifier: string): string => {
  const base = normalizeBase(getQdnBase());
  const resourcePath = `//arbitrary/${safeSegment(service)}/${safeSegment(name)}/${safeSegment(
    identifier,
  )}`;

  return `qortal://${base}${resourcePath}`;
};

export const buildSongShareUrl = (name: string, identifier: string): string => {
  const base = normalizeBase(getQdnBase());
  const params = new URLSearchParams({
    type: 'song',
    play: identifier,
    publisher: name,
  });

  return `qortal://${base}//?${params.toString()}`;
};

export const buildPlaylistShareUrl = (name: string, identifier: string): string => {
  const base = normalizeBase(getQdnBase());
  const params = new URLSearchParams({
    type: 'playlist',
    playlist: identifier,
    playlistPublisher: name,
  });

  return `qortal://${base}//?${params.toString()}`;
};

export const buildPodcastShareUrl = (name: string, identifier: string): string => {
  const base = normalizeBase(getQdnBase());
  const params = new URLSearchParams({
    type: 'podcast',
    podcast: identifier,
    podcastPublisher: name,
  });

  return `qortal://${base}//?${params.toString()}`;
};

export const buildAudiobookShareUrl = (name: string, identifier: string): string => {
  const base = normalizeBase(getQdnBase());
  const params = new URLSearchParams({
    type: 'audiobook',
    audiobook: identifier,
    audiobookPublisher: name,
  });

  return `qortal://${base}//?${params.toString()}`;
};

export const buildVideoShareUrl = (name: string, identifier: string): string => {
  const base = normalizeBase(getQdnBase());
  const params = new URLSearchParams({
    type: 'video',
    video: identifier,
    videoPublisher: name,
  });

  return `qortal://${base}//?${params.toString()}`;
};
