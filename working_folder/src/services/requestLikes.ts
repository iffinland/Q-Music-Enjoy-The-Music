import { deleteQdnResource, fetchQdnResource } from '../utils/qortalApi';
import { objectToBase64 } from '../utils/toBase64';
import { SongRequest } from '../state/features/requestsSlice';
import { cachedSearchQdnResources } from './resourceCache';
import { qdnClient } from '../state/api/client';

const REQUEST_LIKE_PREFIX = 'enjoymusic_request_like_';
const LIKE_FETCH_LIMIT = 50;

const hashRequestId = (requestId: string): string => {
  let hash = 0;
  for (let i = 0; i < requestId.length; i += 1) {
    hash = (hash * 31 + requestId.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

export const buildRequestLikeIdentifier = (requestId: string): string => {
  const tail = requestId.slice(-16);
  const fingerprint = `${hashRequestId(requestId)}_${tail}`;
  return `${REQUEST_LIKE_PREFIX}${fingerprint}`;
};

export const fetchRequestLikers = async (requestId: string): Promise<string[]> => {
  const likers = new Set<string>();
  let offset = 0;

  try {
    while (true) {
      const results = await cachedSearchQdnResources({
        mode: 'ALL',
        service: 'DOCUMENT',
        identifier: buildRequestLikeIdentifier(requestId),
        limit: LIKE_FETCH_LIMIT,
        offset,
        includeMetadata: false,
        includeStatus: false,
        excludeBlocked: true,
      });

      if (!Array.isArray(results) || results.length === 0) {
        break;
      }

      results.forEach((entry) => {
        if (entry && typeof entry.name === 'string' && entry.name.trim().length > 0) {
          likers.add(entry.name.trim());
        }
      });

      if (results.length < LIKE_FETCH_LIMIT) {
        break;
      }

      offset += LIKE_FETCH_LIMIT;
    }
  } catch (error) {
    console.error('Failed to fetch request likers', error);
  }

  return Array.from(likers).sort((a, b) => a.localeCompare(b));
};

export const hasUserLikedRequest = async (
  username: string,
  requestId: string,
): Promise<boolean> => {
  try {
    await fetchQdnResource({
      name: username,
      service: 'DOCUMENT',
      identifier: buildRequestLikeIdentifier(requestId),
    });
    return true;
  } catch (error) {
    return false;
  }
};

export const likeRequest = async (username: string, request: SongRequest): Promise<void> => {
  const identifier = buildRequestLikeIdentifier(request.id);
  const payload = {
    requestId: request.id,
    requestPublisher: request.publisher,
    requestTitle: request.title,
    requestArtist: request.artist,
    likedAt: Date.now(),
  };

  const data64 = await objectToBase64(payload);

  await qdnClient.publishResource({
    name: username,
    service: 'DOCUMENT',
    identifier,
    data64,
    encoding: 'base64',
    title: `Like request: ${request.title || request.id}`.slice(0, 55),
    description: `${request.artist} — ${request.title}`.slice(0, 4000),
  });
};

export const unlikeRequest = async (username: string, requestId: string): Promise<void> => {
  await deleteQdnResource({
    name: username,
    service: 'DOCUMENT',
    identifier: buildRequestLikeIdentifier(requestId),
  });
};
