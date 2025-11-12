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

const buildShareQuery = (
  entries: Record<string, string>,
  options: { autoplay?: boolean } = {},
) => {
  const params = new URLSearchParams(entries);
  if (options.autoplay !== false) {
    params.set('autoplay', '1');
  }
  return params.toString();
};

export const buildSongShareUrl = (name: string, identifier: string): string => {
  const base = normalizeBase(getQdnBase());
  const query = buildShareQuery({
    type: 'song',
    play: identifier,
    publisher: name,
  });
  return `qortal://${base}//?${query}`;
};

export const buildPlaylistShareUrl = (name: string, identifier: string): string => {
  const base = normalizeBase(getQdnBase());
  const query = buildShareQuery({
    type: 'playlist',
    playlist: identifier,
    playlistPublisher: name,
  });
  return `qortal://${base}//?${query}`;
};

export const buildPodcastShareUrl = (name: string, identifier: string): string => {
  const base = normalizeBase(getQdnBase());
  const query = buildShareQuery({
    type: 'podcast',
    podcast: identifier,
    podcastPublisher: name,
  });
  return `qortal://${base}//?${query}`;
};

export const buildAudiobookShareUrl = (name: string, identifier: string): string => {
  const base = normalizeBase(getQdnBase());
  const query = buildShareQuery({
    type: 'audiobook',
    audiobook: identifier,
    audiobookPublisher: name,
  });
  return `qortal://${base}//?${query}`;
};

export const buildVideoShareUrl = (name: string, identifier: string): string => {
  const base = normalizeBase(getQdnBase());
  const query = buildShareQuery({
    type: 'video',
    video: identifier,
    videoPublisher: name,
  });
  return `qortal://${base}//?${query}`;
};

export const buildDiscussionShareUrl = (threadId: string, replyId?: string | null): string => {
  const base = normalizeBase(getQdnBase());
  const query = buildShareQuery(
    {
      type: 'discussions',
      thread: threadId,
      ...(replyId ? { reply: replyId } : {}),
    },
    { autoplay: false },
  );
  return `qortal://${base}//?${query}`;
};
