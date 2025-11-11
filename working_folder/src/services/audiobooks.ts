import { Audiobook } from '../types';
import { fetchQdnResource, getQdnResourceUrl, getQdnResourceStatus } from '../utils/qortalApi';
import { shouldHideQdnResource } from '../utils/qdnResourceFilters';
import { cachedSearchQdnResources } from './resourceCache';

const AUDIOBOOK_IDENTIFIER_PREFIX = 'enjoymusic_audiobooks_';
const FETCH_LIMIT = 25;
const MAX_FETCH_BATCHES = 4;

const normalizeTitle = (identifier: string): string =>
  identifier.replace(AUDIOBOOK_IDENTIFIER_PREFIX, '').replace(/[_-]+/g, ' ').trim();

export const buildAudiobookMeta = (item: any): Audiobook | null => {
  if (!item || !item.identifier) {
    return null;
  }

  const titleFromMetadata: string | undefined =
    item?.metadata?.title || item?.metadata?.name;

  const description: string | undefined = item?.metadata?.description;
  const author: string | undefined =
    typeof item?.metadata?.author === 'string'
      ? item.metadata.author.trim()
      : undefined;

  return {
    id: item.identifier,
    title: titleFromMetadata?.trim() || normalizeTitle(item.identifier),
    description: description?.trim(),
    created: item.created,
    updated: item.updated,
    publisher: item.name,
    status: item.status,
    service: item.service || 'AUDIO',
    size: item.size,
    type: item.metadata?.type || item.mimeType || item.contentType,
    category: typeof item?.metadata?.category === 'string' ? item.metadata.category : undefined,
    author,
  };
};

interface FetchAudiobooksOptions {
  limit?: number;
  detailBatchSize?: number;
}

export const fetchAudiobooks = async (options: FetchAudiobooksOptions = {}): Promise<Audiobook[]> => {
  const targetLimit = Math.max(1, options.limit ?? 30);
  const detailBatchSize = Math.max(0, Math.min(targetLimit, options.detailBatchSize ?? Math.min(30, targetLimit)));

  const aggregated: Audiobook[] = [];
  const rawEntries: Array<{ entry: any; index: number }> = [];
  const seen = new Set<string>();

  let offset = 0;
  let batches = 0;
  let shouldStop = false;

  while (batches < MAX_FETCH_BATCHES && !shouldStop) {
    const nextBatchSize = Math.min(FETCH_LIMIT, Math.max(1, targetLimit - aggregated.length));
    const payload = await cachedSearchQdnResources({
      mode: 'ALL',
      service: 'DOCUMENT',
      query: AUDIOBOOK_IDENTIFIER_PREFIX,
      limit: nextBatchSize,
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
      const identifier = typeof entry?.identifier === 'string' ? entry.identifier : '';
      if (!identifier.startsWith(AUDIOBOOK_IDENTIFIER_PREFIX)) {
        continue;
      }

      if (shouldHideQdnResource(entry)) continue;
      const audiobook = buildAudiobookMeta(entry);
      if (!audiobook) continue;
      if (seen.has(audiobook.id)) continue;
      aggregated.push(audiobook);
      rawEntries.push({ entry, index: aggregated.length - 1 });
      seen.add(audiobook.id);
      if (aggregated.length >= targetLimit) {
        shouldStop = true;
        break;
      }
    }

    if (payload.length < FETCH_LIMIT) {
      break;
    }

    offset += payload.length;
    batches += 1;
  }

  const detailTargets = rawEntries.slice(0, detailBatchSize);
  await Promise.all(
    detailTargets.map(async ({ entry, index }) => {
      try {
        const [document, thumbnailUrl, audioStatus] = await Promise.all([
          fetchQdnResource({
            name: entry.name,
            service: entry.service,
            identifier: entry.identifier,
          }),
          getQdnResourceUrl('THUMBNAIL', entry.name, entry.identifier).catch(() => null),
          getQdnResourceStatus({
            name: entry.name,
            service: 'AUDIO',
            identifier: entry.identifier,
          }).catch(() => null),
        ]);

        if (!document || !aggregated[index]) return;

        let parsed: any = document;
        if (typeof document === 'string') {
          try {
            parsed = JSON.parse(document);
          } catch (parseError) {
            console.error('Failed to parse audiobook document', parseError);
            parsed = null;
          }
        }

        if (!parsed || typeof parsed !== 'object') return;

        const coverImageFromDocument =
          typeof parsed.coverImage === 'string' && parsed.coverImage.trim().length > 0
            ? parsed.coverImage
            : undefined;

        const audioInfo =
          parsed.audio && typeof parsed.audio === 'object'
            ? parsed.audio
            : undefined;

        const resolvedCoverImage =
          coverImageFromDocument ||
          (typeof thumbnailUrl === 'string' && thumbnailUrl.trim().length > 0
            ? thumbnailUrl
            : aggregated[index].coverImage);

        const resolvedAudioFilename =
          audioInfo?.filename ||
          parsed.audioFilename ||
          aggregated[index].audioFilename;

        const resolvedAudioMimeType =
          audioInfo?.mimeType ||
          parsed.audioMimeType ||
          aggregated[index].audioMimeType;
        const resolvedSize =
          (typeof audioInfo?.size === 'number' && audioInfo.size > 0
            ? audioInfo.size
            : null) ??
          (audioStatus && typeof (audioStatus as any).size === 'number' && (audioStatus as any).size > 0
            ? ((audioStatus as any).size as number)
            : audioStatus && typeof (audioStatus as any).dataSize === 'number' && (audioStatus as any).dataSize > 0
            ? ((audioStatus as any).dataSize as number)
            : aggregated[index].size);
        const resolvedCategory =
          typeof parsed.category === 'string' && parsed.category.trim().length > 0
            ? parsed.category.trim()
            : aggregated[index].category;
        const metadataAuthor =
          parsed.metadata && typeof parsed.metadata === 'object' && typeof parsed.metadata.author === 'string'
            ? parsed.metadata.author.trim()
            : '';
        const resolvedAuthor =
          (typeof parsed.author === 'string' && parsed.author.trim().length > 0
            ? parsed.author.trim()
            : metadataAuthor) || aggregated[index].author;

        aggregated[index] = {
          ...aggregated[index],
          title: parsed.title || aggregated[index].title,
          description: parsed.description || aggregated[index].description,
          coverImage: resolvedCoverImage,
          audioFilename: resolvedAudioFilename,
          audioMimeType: resolvedAudioMimeType,
          size: resolvedSize,
          category: resolvedCategory,
          author: resolvedAuthor,
        };
      } catch (error) {
        console.error('Failed to fetch audiobook document', error);
      }
    })
  );

  return aggregated;
};

export const enjoyMusicAudiobookIdentifier = AUDIOBOOK_IDENTIFIER_PREFIX;

export const fetchAudiobookByIdentifier = async (
  publisher: string,
  identifier: string,
): Promise<Audiobook | null> => {
  try {
    const [audioResults, document, thumbnailUrl] = await Promise.all([
      cachedSearchQdnResources({
        mode: 'ALL',
        service: 'AUDIO',
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

    if (!Array.isArray(audioResults) || audioResults.length === 0) {
      return null;
    }

    const [rawAudio] = audioResults;
    if (shouldHideQdnResource(rawAudio)) {
      return null;
    }

    const meta = buildAudiobookMeta(rawAudio);
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
        console.error('Failed to parse audiobook document', error);
        parsedDocument = null;
      }
    }

    if (parsedDocument && typeof parsedDocument === 'object') {
      if (typeof parsedDocument.title === 'string' && parsedDocument.title.trim().length > 0) {
        meta.title = parsedDocument.title.trim();
      }

      if (typeof parsedDocument.description === 'string') {
        meta.description = parsedDocument.description.trim();
      }

      if (typeof parsedDocument.category === 'string' && parsedDocument.category.trim().length > 0) {
        meta.category = parsedDocument.category.trim();
      }

      const metadataAuthor =
        parsedDocument.metadata && typeof parsedDocument.metadata === 'object' && typeof parsedDocument.metadata.author === 'string'
          ? parsedDocument.metadata.author.trim()
          : '';
      if (typeof parsedDocument.author === 'string' && parsedDocument.author.trim().length > 0) {
        meta.author = parsedDocument.author.trim();
      } else if (metadataAuthor) {
        meta.author = metadataAuthor;
      }

      const audioInfo = parsedDocument.audio && typeof parsedDocument.audio === 'object'
        ? parsedDocument.audio
        : undefined;

      if (audioInfo?.filename) {
        meta.audioFilename = audioInfo.filename;
      }

      if (audioInfo?.mimeType) {
        meta.audioMimeType = audioInfo.mimeType;
      }

      if (typeof parsedDocument.coverImage === 'string' && parsedDocument.coverImage.trim().length > 0) {
        meta.coverImage = parsedDocument.coverImage.trim();
      }
    }

    return meta;
  } catch (error) {
    console.error('Failed to fetch audiobook metadata', error);
    return null;
  }
};

export const fetchAudiobooksByPublisher = async (
  publisher: string,
  options: { limit?: number } = {},
): Promise<Audiobook[]> => {
  if (!publisher) return [];

  const limit = Math.max(1, options.limit ?? 100);
  const results = await cachedSearchQdnResources({
    mode: 'ALL',
    service: 'DOCUMENT',
    name: publisher,
    identifier: AUDIOBOOK_IDENTIFIER_PREFIX,
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
          entry.identifier.startsWith(AUDIOBOOK_IDENTIFIER_PREFIX) &&
          !shouldHideQdnResource(entry),
      )
      .slice(0, limit)
      .map(async (entry) => {
        const base = buildAudiobookMeta(entry);
        if (!base) return null;
        try {
          const detailed = await fetchAudiobookByIdentifier(entry.name, entry.identifier);
          return detailed || base;
        } catch (error) {
          return base;
        }
      }),
  );

  return enriched.filter((audiobook): audiobook is Audiobook => Boolean(audiobook));
};

export const fetchAudiobookByGlobalIdentifier = async (identifier: string): Promise<Audiobook | null> => {
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
  if (!entry?.identifier || shouldHideQdnResource(entry)) {
    return null;
  }

  return fetchAudiobookByIdentifier(entry.name, entry.identifier);
};
