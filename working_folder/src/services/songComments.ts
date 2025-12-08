import ShortUniqueId from 'short-unique-id';
import { searchQdnResources, fetchQdnResource } from '../utils/qortalApi';
import { objectToBase64 } from '../utils/toBase64';

type CommentKind = 'song' | 'podcast' | 'audiobook';

const COMMENT_PREFIXES: Record<CommentKind, string> = {
  song: 'enjoymusic_song_comment_',
  podcast: 'enjoymusic_podcast_comment_',
  audiobook: 'enjoymusic_audiobook_comment_',
};
const FETCH_LIMIT = 50;
const COMMENT_CACHE_TTL = 10_000;

export interface SongComment {
  id: string;
  songIdentifier: string;
  songPublisher: string;
  author: string;
  message: string;
  created: number;
  updated?: number;
  parentCommentId?: string | null;
  deleted?: boolean;
  kind?: CommentKind;
}

const uid = new ShortUniqueId();

type CommentCacheEntry = {
  timestamp: number;
  promise: Promise<SongComment[]>;
};

const commentCache = new Map<string, CommentCacheEntry>();

const buildCommentCacheKey = (publisher: string, identifier: string, kind: CommentKind) =>
  `${kind}:${publisher?.toLowerCase() ?? ''}:${identifier}`;

const resolveKind = (kind?: CommentKind): CommentKind => {
  if (kind === 'podcast' || kind === 'audiobook') return kind;
  return 'song';
};

const publishCommentResource = async (
  name: string,
  identifier: string,
  payload: Record<string, unknown>,
  title: string,
  description: string,
) => {
  const data64 = await objectToBase64(payload);

  await qortalRequest({
    action: 'PUBLISH_QDN_RESOURCE',
    name,
    service: 'DOCUMENT',
    identifier,
    data64,
    encoding: 'base64',
    title: title.slice(0, 55),
    description: description.slice(0, 4000),
  });
};

export interface FetchSongCommentsOptions {
  force?: boolean;
  kind?: CommentKind;
}

export const invalidateSongCommentsCache = (
  songPublisher: string,
  songIdentifier: string,
  kind: CommentKind = 'song',
) => {
  const cacheKey = buildCommentCacheKey(songPublisher, songIdentifier, kind);
  commentCache.delete(cacheKey);
};

export const fetchSongComments = async (
  songPublisher: string,
  songIdentifier: string,
  options: FetchSongCommentsOptions = {},
): Promise<SongComment[]> => {
  const { force = false } = options;
  const kind = resolveKind(options.kind);
  const cacheKey = buildCommentCacheKey(songPublisher, songIdentifier, kind);
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
    const identifierPrefix = `${COMMENT_PREFIXES[kind]}${songIdentifier}_`;
    const aggregated: SongComment[] = [];
    let offset = 0;

    while (true) {
      const page = await searchQdnResources({
        mode: 'ALL',
        service: 'DOCUMENT',
        identifier: identifierPrefix,
        limit: FETCH_LIMIT,
        offset,
        reverse: true,
        includeMetadata: false,
        excludeBlocked: true,
      });

      if (!Array.isArray(page) || page.length === 0) {
        break;
      }

      for (const entry of page) {
        try {
          const data = await fetchQdnResource({
            name: entry.name,
            service: entry.service,
            identifier: entry.identifier,
          });

          if (!data || typeof data !== 'object') continue;
          if (data.songIdentifier !== songIdentifier) continue;
          if (data.songPublisher !== songPublisher) continue;
          if (data.deleted) continue;

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
            parentCommentId: data.parentCommentId ?? null,
            kind,
          });
        } catch (error) {
          console.error('Failed to fetch song comment', error);
        }
      }

      if (page.length < FETCH_LIMIT) {
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
  parentCommentId?: string | null;
  kind?: CommentKind;
}

export const publishSongComment = async ({
  publisher,
  identifier,
  author,
  message,
  songTitle,
  parentCommentId = null,
  kind,
}: PublishCommentPayload) => {
  const resolvedKind = resolveKind(kind);
  const uniqueId = uid(8);
  const commentIdentifier = `${COMMENT_PREFIXES[resolvedKind]}${identifier}_${uniqueId}`;
  const timestamp = Date.now();

  const payload = {
    id: commentIdentifier,
    songIdentifier: identifier,
    songPublisher: publisher,
    author,
    message,
    created: timestamp,
    updated: timestamp,
    parentCommentId,
    kind: resolvedKind,
  };
  await publishCommentResource(
    author,
    commentIdentifier,
    payload as Record<string, unknown>,
    `Comment on ${songTitle || identifier}`,
    message,
  );

  invalidateSongCommentsCache(publisher, identifier, resolvedKind);

  return {
    ...payload,
    author,
  };
};

export const updateSongComment = async (
  comment: SongComment,
  message: string,
  kind?: CommentKind,
) => {
  const resolvedKind = resolveKind(kind ?? comment.kind);
  const timestamp = Date.now();
  const payload = {
    ...comment,
    message,
    updated: timestamp,
  };

  await publishCommentResource(
    comment.author,
    comment.id,
    payload as Record<string, unknown>,
    `Comment update ${comment.songIdentifier}`,
    message,
  );

  invalidateSongCommentsCache(comment.songPublisher, comment.songIdentifier, resolvedKind);

  return payload;
};

export const deleteSongComment = async (comment: SongComment, kind?: CommentKind) => {
  const resolvedKind = resolveKind(kind ?? comment.kind);
  const timestamp = Date.now();
  const payload = {
    ...comment,
    deleted: true,
    updated: timestamp,
  };

  await publishCommentResource(
    comment.author || comment.songPublisher,
    comment.id,
    payload as Record<string, unknown>,
    `Comment deleted ${comment.songIdentifier}`,
    'Deleted comment',
  );

  invalidateSongCommentsCache(comment.songPublisher, comment.songIdentifier, resolvedKind);
};

export const fetchPodcastComments = (
  publisher: string,
  identifier: string,
  options: FetchSongCommentsOptions = {},
) => fetchSongComments(publisher, identifier, { ...options, kind: 'podcast' });

export const publishPodcastComment = (payload: PublishCommentPayload) =>
  publishSongComment({ ...payload, kind: 'podcast' });

export const updatePodcastComment = (comment: SongComment, message: string) =>
  updateSongComment(comment, message, 'podcast');

export const deletePodcastComment = (comment: SongComment) =>
  deleteSongComment(comment, 'podcast');

export const fetchAudiobookComments = (
  publisher: string,
  identifier: string,
  options: FetchSongCommentsOptions = {},
) => fetchSongComments(publisher, identifier, { ...options, kind: 'audiobook' });

export const publishAudiobookComment = (payload: PublishCommentPayload) =>
  publishSongComment({ ...payload, kind: 'audiobook' });

export const updateAudiobookComment = (comment: SongComment, message: string) =>
  updateSongComment(comment, message, 'audiobook');

export const deleteAudiobookComment = (comment: SongComment) =>
  deleteSongComment(comment, 'audiobook');
