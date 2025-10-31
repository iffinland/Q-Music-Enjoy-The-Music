import { Video } from '../types';
import { searchQdnResources, fetchQdnResource, getQdnResourceUrl } from '../utils/qortalApi';
import { shouldHideQdnResource } from '../utils/qdnResourceFilters';

const VIDEO_IDENTIFIER_PREFIX = 'enjoymusic_video_';
const FETCH_LIMIT = 50;
const MAX_FETCH_BATCHES = 10;

const normalizeTitle = (identifier: string): string =>
  identifier.replace(VIDEO_IDENTIFIER_PREFIX, '').replace(/[_-]+/g, ' ').trim();

export const buildVideoMeta = (item: any): Video | null => {
  if (!item || !item.identifier) {
    return null;
  }

  const titleFromMetadata: string | undefined =
    item?.metadata?.title || item?.metadata?.name;

  const description: string | undefined = item?.metadata?.description;

  return {
    id: item.identifier,
    title: titleFromMetadata?.trim() || normalizeTitle(item.identifier),
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

export const fetchVideos = async (): Promise<Video[]> => {
  const aggregated: Video[] = [];
  const rawEntries: Array<{ entry: any; index: number }> = [];
  const seen = new Set<string>();

  let offset = 0;
  let batches = 0;

  while (batches < MAX_FETCH_BATCHES) {
    const payload = await searchQdnResources({
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
      if (shouldHideQdnResource(entry)) continue;
      const video = buildVideoMeta(entry);
      if (!video) continue;
      if (seen.has(video.id)) continue;
      aggregated.push(video);
      rawEntries.push({ entry, index: aggregated.length - 1 });
      seen.add(video.id);
    }

    if (payload.length < FETCH_LIMIT) {
      break;
    }

    offset += payload.length;
    batches += 1;
  }

  return aggregated;
};

export const enjoyMusicVideoIdentifier = VIDEO_IDENTIFIER_PREFIX;

export const fetchVideoByIdentifier = async (
  publisher: string,
  identifier: string,
): Promise<Video | null> => {
  try {
    const [videoResults, document, thumbnailUrl] = await Promise.all([
      searchQdnResources({
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
      const metadata =
        parsedDocument.metadata && typeof parsedDocument.metadata === 'object'
          ? parsedDocument.metadata
          : {};

      if (typeof parsedDocument.title === 'string' && parsedDocument.title.trim().length > 0) {
        meta.title = parsedDocument.title.trim();
      }

      if (typeof parsedDocument.description === 'string') {
        meta.description = parsedDocument.description.trim();
      }

      const videoInfo =
        parsedDocument.video && typeof parsedDocument.video === 'object'
          ? parsedDocument.video
          : undefined;

      if (videoInfo?.filename) {
        meta.videoFilename = videoInfo.filename;
      }

      if (videoInfo?.mimeType) {
        meta.videoMimeType = videoInfo.mimeType;
      }

      if (typeof parsedDocument.coverImage === 'string' && parsedDocument.coverImage.trim().length > 0) {
        meta.coverImage = parsedDocument.coverImage.trim();
      }

      if (typeof parsedDocument.durationSeconds === 'number') {
        meta.durationSeconds = parsedDocument.durationSeconds;
      }

      if (metadata && typeof metadata === 'object') {
        if (typeof (metadata as any).author === 'string') {
          meta.author = (metadata as any).author;
        }
        if (typeof (metadata as any).genre === 'string') {
          meta.genre = (metadata as any).genre;
        }
        if (typeof (metadata as any).mood === 'string') {
          meta.mood = (metadata as any).mood;
        }
        if (typeof (metadata as any).language === 'string') {
          meta.language = (metadata as any).language;
        }
        if (typeof (metadata as any).notes === 'string') {
          meta.notes = (metadata as any).notes;
        }
      }
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
  const results = await searchQdnResources({
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
          !shouldHideQdnResource(entry),
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

  const lookup = await searchQdnResources({
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
  if (!entry?.identifier || shouldHideQdnResource(entry)) {
    return null;
  }

  return fetchVideoByIdentifier(entry.name, entry.identifier);
};
