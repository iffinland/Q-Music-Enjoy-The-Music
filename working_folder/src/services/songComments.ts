import ShortUniqueId from 'short-unique-id';
import { searchQdnResources, fetchQdnResource } from '../utils/qortalApi';
import { objectToBase64 } from '../utils/toBase64';

const COMMENT_PREFIX = 'enjoymusic_song_comment_';
const FETCH_LIMIT = 50;
const COMMENT_CACHE_TTL = 10_000;
const MAX_COMMENTS = 200;
const ensureQortalRequest = () => {
  const fn = (window as any)?.qortalRequest;
  if (typeof fn !== 'function') {
    throw new Error('Qortal API is not available. Please open Qortal and try again.');
  }
  return fn as (payload: Record<string, unknown>) => Promise<any>;
};

export interface SongComment {
  id: string;
  songIdentifier: string;
  songPublisher: string;
  author: string;
  message: string;
  created: number;
  updated?: number;
}

const uid = new ShortUniqueId();

type CommentCacheEntry = {
  timestamp: number;
  promise: Promise<SongComment[]>;
};

const commentCache = new Map<string, CommentCacheEntry>();

const buildCommentCacheKey = (publisher: string, identifier: string) =>
  `${publisher?.toLowerCase() ?? ''}:${identifier}`;

export interface FetchSongCommentsOptions {
  force?: boolean;
  max?: number;
}

export const invalidateSongCommentsCache = (songPublisher: string, songIdentifier: string) => {
  const cacheKey = buildCommentCacheKey(songPublisher, songIdentifier);
  commentCache.delete(cacheKey);
};

export const fetchSongComments = async (
  songPublisher: string,
  songIdentifier: string,
  options: FetchSongCommentsOptions = {},
): Promise<SongComment[]> => {
  const { force = false, max } = options;
  const maxComments = max && max > 0 ? Math.min(max, MAX_COMMENTS) : MAX_COMMENTS;
  const cacheKey = buildCommentCacheKey(songPublisher, songIdentifier);
  const now = Date.now();

  if (!force) {
    const cached = commentCache.get(cacheKey);
    if (cached && now - cached.timestamp < COMMENT_CACHE_TTL) {
      return cached.promise;
    }
  } else {
    commentCache.delete(cacheKey);
  }

  const promise = (async () => {
    const prefix = `${COMMENT_PREFIX}${songIdentifier}_`;
    const aggregated: SongComment[] = [];
    let offset = 0;
    let totalFetched = 0;

    while (totalFetched < MAX_COMMENTS) {
      const page = await searchQdnResources({
        mode: 'ALL',
        service: 'DOCUMENT',
        query: prefix,
        limit: Math.min(FETCH_LIMIT, maxComments - totalFetched),
        offset,
        reverse: true,
        includeMetadata: true,
        excludeBlocked: true,
      });

      if (!Array.isArray(page) || page.length === 0) {
        break;
      }

      const legacyEntries: any[] = [];

      for (const entry of page) {
        const identifier = typeof entry?.identifier === 'string' ? entry.identifier : '';
        if (!identifier) continue;
        totalFetched += 1;

        const created = entry.updated ?? entry.created ?? Date.now();
        const metaAuthor =
          typeof entry?.metadata?.author === 'string' && entry.metadata.author.trim().length > 0
            ? entry.metadata.author.trim()
            : entry.name;
        const metaMessage =
          typeof entry?.metadata?.description === 'string' && entry.metadata.description.trim().length > 0
            ? entry.metadata.description
            : null;

        if (metaMessage) {
          aggregated.push({
            id: identifier,
            songIdentifier,
            songPublisher: songPublisher,
            author: metaAuthor || entry.name,
            message: metaMessage,
            created,
            updated: created,
          });
        } else {
          legacyEntries.push(entry);
        }
      }

      if (legacyEntries.length > 0) {
        await Promise.all(
          legacyEntries.map(async (entry) => {
            try {
              const data = await fetchQdnResource({
                name: entry.name,
                service: entry.service,
                identifier: entry.identifier,
              });

              if (!data || typeof data !== 'object') return;
              if (data.songIdentifier !== songIdentifier) return;

              const created = data.created ?? entry.created ?? Date.now();
              const updated = data.updated ?? created;

              aggregated.push({
                id: entry.identifier,
                songIdentifier: data.songIdentifier,
                songPublisher: data.songPublisher,
                author: data.author || entry.name,
                message: data.message || '',
                created,
                updated,
              });
            } catch (error) {
              console.error('Failed to fetch song comment', error);
            }
          }),
        );
      }

      if (page.length < FETCH_LIMIT || totalFetched >= MAX_COMMENTS) {
        break;
      }

      offset += page.length;
    }

    return aggregated.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
  })();

  commentCache.set(cacheKey, { timestamp: now, promise });
  promise.catch(() => {
    const existing = commentCache.get(cacheKey);
    if (existing?.promise === promise) {
      commentCache.delete(cacheKey);
    }
  });

  return promise;
};

interface PublishCommentPayload {
  publisher: string;
  identifier: string;
  author: string;
  message: string;
  songTitle?: string;
}

export const publishSongComment = async ({
  publisher,
  identifier,
  author,
  message,
  songTitle,
}: PublishCommentPayload) => {
  const uniqueId = uid(8);
  const commentIdentifier = `${COMMENT_PREFIX}${identifier}_${uniqueId}`;
  const timestamp = Date.now();

  const payload = {
    id: commentIdentifier,
    songIdentifier: identifier,
    songPublisher: publisher,
    author,
    message,
    created: timestamp,
    updated: timestamp,
  };

  const data64 = await objectToBase64(payload);
  const filename = `${commentIdentifier}.json`;

  const qortalRequest = ensureQortalRequest();

  await qortalRequest({
    action: 'PUBLISH_QDN_RESOURCE',
    name: author,
    service: 'DOCUMENT',
    identifier: commentIdentifier,
    data64,
    encoding: 'base64',
    filename,
    title: `Comment on ${songTitle || identifier}`.slice(0, 55),
    description: message.slice(0, 4000),
  });

  invalidateSongCommentsCache(publisher, identifier);

  return {
    ...payload,
    author,
  };
};

export const deleteSongComment = async (
  author: string,
  identifier: string,
  songPublisher?: string,
  songIdentifier?: string,
) => {
  await qortalRequest({
    action: 'DELETE_QDN_RESOURCE',
    name: author,
    service: 'DOCUMENT',
    identifier,
  });

  if (songPublisher && songIdentifier) {
    invalidateSongCommentsCache(songPublisher, songIdentifier);
  }
};

export const updateSongComment = async (
  comment: SongComment,
  message: string,
) => {
  const timestamp = Date.now();
  const payload = {
    ...comment,
    message,
    updated: timestamp,
  };

  const data64 = await objectToBase64(payload);
  const filename = `${comment.id}.json`;

  await qortalRequest({
    action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
    resources: [
      {
        name: comment.author,
        service: 'DOCUMENT',
        data64,
        identifier: comment.id,
        filename,
        title: `Comment update ${comment.songIdentifier}`.slice(0, 55),
        description: message.slice(0, 4000),
        encoding: 'base64',
      },
    ],
  });

  invalidateSongCommentsCache(comment.songPublisher, comment.songIdentifier);

  return payload;
};
