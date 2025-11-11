import { Video } from '../types';
import { fetchQdnResource, getQdnResourceUrl } from '../utils/qortalApi';
import { shouldHideQdnResource } from '../utils/qdnResourceFilters';
import { cachedSearchQdnResources } from './resourceCache';

const VIDEO_IDENTIFIER_PREFIX = 'enjoymusic_video_';
const VIDEO_LIKE_IDENTIFIER_PREFIX = 'video_like_';
const FETCH_LIMIT = 50;
const MAX_FETCH_BATCHES = 10;

const normalizeTitle = (identifier: string): string =>
  identifier.replace(VIDEO_IDENTIFIER_PREFIX, '').replace(/[_-]+/g, ' ').trim();

const stripVideoLabel = (input: string): string => {
  const trimmed = input.trim();
  if (trimmed.toLowerCase().startsWith('video:')) {
    return trimmed.slice(6).trim();
  }
  return trimmed;
};

const isLikeArtifact = (entry: any): boolean => {
  const identifier =
    typeof entry?.identifier === 'string' ? entry.identifier.toLowerCase() : '';
  if (identifier.startsWith(VIDEO_LIKE_IDENTIFIER_PREFIX)) return true;
  const title = typeof entry?.metadata?.title === 'string' ? entry.metadata.title.trim().toLowerCase() : '';
  const description = typeof entry?.metadata?.description === 'string' ? entry.metadata.description.trim().toLowerCase() : '';
  if (title.startsWith('like:')) return true;
  if (description.includes('video like for')) return true;
  return false;
};

const isDeletedOrDraft = (entry: any): boolean => {
  const status = entry?.status?.status || entry?.status;
  if (!status) return false;
  const normalized = typeof status === 'string' ? status.toUpperCase() : '';
  return normalized === 'DELETED' || normalized === 'DRAFT';
};

export const buildVideoMeta = (item: any): Video | null => {
  if (!item || !item.identifier) {
    return null;
  }

  const titleFromMetadata: string | undefined =
    item?.metadata?.title || item?.metadata?.name;

  const description: string | undefined = item?.metadata?.description;
  const normalizedTitle =
    typeof titleFromMetadata === 'string'
      ? stripVideoLabel(titleFromMetadata)
      : undefined;

  return {
    id: item.identifier,
    title: normalizedTitle?.trim() || normalizeTitle(item.identifier),
    description: description?.trim(),
    created: item.created,
    updated: item.updated,
    publisher: item.name,
    status: item.status,
    service: item.service || 'VIDEO',
    size: item.size,
    type: item.metadata?.type || item.mimeType || item.contentType,
  };
};

const applyDocumentMetadata = (video: Video, parsedDocument: any) => {
  if (!parsedDocument || typeof parsedDocument !== 'object') return;

  const metadata =
    parsedDocument.metadata && typeof parsedDocument.metadata === 'object'
      ? parsedDocument.metadata
      : {};

  const originalTitle =
    typeof parsedDocument.originalTitle === 'string'
      ? parsedDocument.originalTitle.trim()
      : '';
  const documentTitle =
    typeof parsedDocument.title === 'string'
      ? stripVideoLabel(parsedDocument.title)
      : '';
  if (originalTitle) {
    video.title = originalTitle;
  } else if (documentTitle) {
    video.title = documentTitle;
  }

  const originalDescription =
    typeof parsedDocument.originalDescription === 'string'
      ? parsedDocument.originalDescription.trim()
      : '';
  const documentDescription =
    typeof parsedDocument.description === 'string'
      ? parsedDocument.description.trim()
      : '';
  if (originalDescription) {
    video.description = originalDescription;
  } else if (documentDescription) {
    video.description = documentDescription;
  }

  const originalAuthor =
    typeof parsedDocument.originalAuthor === 'string'
      ? parsedDocument.originalAuthor.trim()
      : '';
  const metadataAuthor =
    typeof (metadata as any).author === 'string'
      ? (metadata as any).author.trim()
      : '';
  if (originalAuthor) {
    video.author = originalAuthor;
  } else if (metadataAuthor) {
    video.author = metadataAuthor;
  }

  if (typeof (metadata as any).genre === 'string') {
    video.genre = (metadata as any).genre;
  }

  if (typeof (metadata as any).mood === 'string') {
    video.mood = (metadata as any).mood;
  }

  if (typeof (metadata as any).language === 'string') {
    video.language = (metadata as any).language;
  }

  if (typeof (metadata as any).notes === 'string') {
    video.notes = (metadata as any).notes;
  }

  if (
    parsedDocument.video &&
    typeof parsedDocument.video === 'object' &&
    parsedDocument.video
  ) {
    if (typeof parsedDocument.video.filename === 'string' && !video.videoFilename) {
      video.videoFilename = parsedDocument.video.filename;
    }
    if (typeof parsedDocument.video.mimeType === 'string' && !video.videoMimeType) {
      video.videoMimeType = parsedDocument.video.mimeType;
    }
  }

  if (typeof parsedDocument.coverImage === 'string' && parsedDocument.coverImage.trim().length > 0 && !video.coverImage) {
    video.coverImage = parsedDocument.coverImage.trim();
  }

  if (typeof parsedDocument.durationSeconds === 'number') {
    video.durationSeconds = parsedDocument.durationSeconds;
  }
};

const hydrateVideoFromDocument = async (video: Video) => {
  try {
    const document = await fetchQdnResource({
      name: video.publisher,
      service: 'DOCUMENT',
      identifier: video.id,
    }).catch(() => null);
    if (!document) return;

    let parsed = document;
    if (typeof document === 'string') {
      try {
        parsed = JSON.parse(document);
      } catch (error) {
        console.error('Failed to parse video document', error);
        return;
      }
    }

    applyDocumentMetadata(video, parsed);
  } catch (error) {
    console.error('Failed to hydrate video document', error);
  }
};

const hydrateVideos = async (videos: Video[], concurrency = 6) => {
  const queue = [...videos];
  const workers: Promise<void>[] = [];

  for (let i = 0; i < concurrency; i += 1) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const next = queue.shift();
          if (!next) break;
          await hydrateVideoFromDocument(next);
        }
      })(),
    );
  }

  await Promise.all(workers);
};

export interface FetchVideosOptions {
  hydrate?: boolean;
  hydrateCount?: number;
}

export const fetchVideos = async (options: FetchVideosOptions = {}): Promise<Video[]> => {
  const { hydrate = true, hydrateCount = 32 } = options;
  const aggregated: Video[] = [];
  const seen = new Set<string>();

  let offset = 0;
  let batches = 0;

  while (batches < MAX_FETCH_BATCHES) {
    const payload = await cachedSearchQdnResources({
      mode: 'ALL',
      service: 'DOCUMENT',
      query: VIDEO_IDENTIFIER_PREFIX,
      limit: FETCH_LIMIT,
      offset,
      reverse: true,
      includeMetadata: true,
      excludeBlocked: true,
      includeStatus: true,
    });

    if (!Array.isArray(payload) || payload.length === 0) {
      break;
    }

    for (const entry of payload) {
      if (isDeletedOrDraft(entry)) continue;
      if (isLikeArtifact(entry)) continue;
      if (shouldHideQdnResource(entry)) continue;
      const video = buildVideoMeta(entry);
      if (!video) continue;
      if (seen.has(video.id)) continue;
      // Ensure the document belongs to the publisher (guards against like artifacts)
      if (typeof entry?.name === 'string' && typeof video.publisher === 'string') {
        if (entry.name.trim().toLowerCase() !== video.publisher.trim().toLowerCase()) {
          continue;
        }
      }
      if (seen.has(video.id)) continue;
      aggregated.push(video);
      seen.add(video.id);
    }

    if (payload.length < FETCH_LIMIT) {
      break;
    }

    offset += payload.length;
    batches += 1;
  }

  if (hydrate && aggregated.length > 0 && hydrateCount > 0) {
    const subset = aggregated.slice(0, Math.min(hydrateCount, aggregated.length));
    await hydrateVideos(subset, 3);
  }
  return aggregated;
};

export const enjoyMusicVideoIdentifier = VIDEO_IDENTIFIER_PREFIX;

export const enrichVideosWithDocuments = async (videos: Video[], concurrency = 6, maxItems?: number) => {
  const target = typeof maxItems === 'number' ? videos.slice(0, maxItems) : videos;
  await hydrateVideos(target, concurrency);
};

export const fetchVideoByIdentifier = async (
  publisher: string,
  identifier: string,
): Promise<Video | null> => {
  try {
    const [videoResults, document, thumbnailUrl] = await Promise.all([
      cachedSearchQdnResources({
        mode: 'ALL',
        service: 'VIDEO',
        name: publisher,
        identifier,
        limit: 1,
        offset: 0,
        reverse: true,
        includeMetadata: true,
        includeStatus: true,
        excludeBlocked: true,
        exactMatchNames: true,
      }),
      fetchQdnResource({
        name: publisher,
        service: 'DOCUMENT',
        identifier,
      }).catch(() => null),
      getQdnResourceUrl('THUMBNAIL', publisher, identifier).catch(() => null),
    ]);

    if (!Array.isArray(videoResults) || videoResults.length === 0) {
      return null;
    }

    const [rawVideo] = videoResults;
    if (shouldHideQdnResource(rawVideo)) {
      return null;
    }

    const meta = buildVideoMeta(rawVideo);
    if (!meta) {
      return null;
    }

    if (thumbnailUrl) {
      meta.coverImage = thumbnailUrl;
    }

    let parsedDocument: any = document;
    if (typeof document === 'string') {
      try {
        parsedDocument = JSON.parse(document);
      } catch (error) {
        console.error('Failed to parse video document', error);
        parsedDocument = null;
      }
    }

    if (parsedDocument && typeof parsedDocument === 'object') {
      applyDocumentMetadata(meta, parsedDocument);
    }

    return meta;
  } catch (error) {
    console.error('Failed to fetch video metadata', error);
    return null;
  }
};

export const fetchVideosByPublisher = async (
  publisher: string,
  options: { limit?: number } = {},
): Promise<Video[]> => {
  if (!publisher) return [];

  const limit = Math.max(1, options.limit ?? 100);
  const results = await cachedSearchQdnResources({
    mode: 'ALL',
    service: 'DOCUMENT',
    name: publisher,
    identifier: VIDEO_IDENTIFIER_PREFIX,
    limit,
    offset: 0,
    reverse: true,
    includeMetadata: true,
    includeStatus: true,
    excludeBlocked: true,
    exactMatchNames: true,
  });

  if (!Array.isArray(results) || results.length === 0) {
    return [];
  }

  const enriched = await Promise.all(
    results
      .filter(
        (entry) =>
          typeof entry?.identifier === 'string' &&
          entry.identifier.startsWith(VIDEO_IDENTIFIER_PREFIX) &&
          !shouldHideQdnResource(entry) &&
          !isDeletedOrDraft(entry) &&
          !isLikeArtifact(entry),
      )
      .slice(0, limit)
      .map(async (entry) => {
        const base = buildVideoMeta(entry);
        if (!base) return null;
        try {
          const detailed = await fetchVideoByIdentifier(entry.name, entry.identifier);
          if (detailed?.coverImage) {
            return detailed;
          }
          return detailed || base;
        } catch (error) {
          return base;
        }
      }),
  );

  return enriched.filter((video): video is Video => Boolean(video));
};

export const fetchVideoByGlobalIdentifier = async (identifier: string): Promise<Video | null> => {
  if (!identifier) return null;

  const lookup = await cachedSearchQdnResources({
    mode: 'ALL',
    service: 'DOCUMENT',
    identifier,
    limit: 1,
    offset: 0,
    reverse: true,
    includeMetadata: true,
    includeStatus: true,
    excludeBlocked: true,
  });

  if (!Array.isArray(lookup) || lookup.length === 0) {
    return null;
  }

  const [entry] = lookup;
  if (!entry?.identifier || shouldHideQdnResource(entry) || isLikeArtifact(entry) || isDeletedOrDraft(entry)) {
    return null;
  }

  return fetchVideoByIdentifier(entry.name, entry.identifier);
};
