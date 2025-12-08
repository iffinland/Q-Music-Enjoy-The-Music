import { Audiobook } from '../types';
import { deleteQdnResource, fetchQdnResource } from '../utils/qortalApi';
import { objectToBase64 } from '../utils/toBase64';
import { cachedSearchQdnResources } from './resourceCache';

const AUDIOBOOK_LIKE_PREFIX = 'audiobook_like_';
const LIKE_FETCH_LIMIT = 50;

export const buildAudiobookLikeIdentifier = (audiobookId: string): string =>
  `${AUDIOBOOK_LIKE_PREFIX}${audiobookId}`;

export const fetchAudiobookLikeCount = async (audiobookId: string): Promise<number> => {
  let offset = 0;
  let total = 0;

  try {
    while (true) {
      const results = await cachedSearchQdnResources({
        mode: 'ALL',
        service: 'DOCUMENT',
        identifier: buildAudiobookLikeIdentifier(audiobookId),
        limit: LIKE_FETCH_LIMIT,
        offset,
        includeMetadata: false,
        includeStatus: false,
        excludeBlocked: true,
      });

      if (!Array.isArray(results) || results.length === 0) {
        break;
      }

      total += results.length;

      if (results.length < LIKE_FETCH_LIMIT) {
        break;
      }

      offset += LIKE_FETCH_LIMIT;
    }
  } catch (error) {
    console.error('Failed to fetch audiobook like count', error);
  }

  return total;
};

export const fetchAudiobookLikeUsers = async (
  audiobookId: string,
  limit = 25,
): Promise<string[]> => {
  const users = new Set<string>();
  let offset = 0;

  try {
    while (users.size < limit) {
      const results = await cachedSearchQdnResources({
        mode: 'ALL',
        service: 'DOCUMENT',
        identifier: buildAudiobookLikeIdentifier(audiobookId),
        limit: LIKE_FETCH_LIMIT,
        offset,
        includeMetadata: false,
        includeStatus: false,
        excludeBlocked: true,
      });

      if (!Array.isArray(results) || results.length === 0) {
        break;
      }

      results.forEach((entry: any) => {
        if (typeof entry?.name === 'string' && entry.name.trim().length > 0) {
          users.add(entry.name);
        }
      });

      if (results.length < LIKE_FETCH_LIMIT) {
        break;
      }

      offset += LIKE_FETCH_LIMIT;
    }
  } catch (error) {
    console.error('Failed to fetch audiobook like users', error);
  }

  return Array.from(users).slice(0, limit);
};

export const hasUserLikedAudiobook = async (
  username: string,
  audiobookId: string,
): Promise<boolean> => {
  try {
    await fetchQdnResource({
      name: username,
      service: 'DOCUMENT',
      identifier: buildAudiobookLikeIdentifier(audiobookId),
    });
    return true;
  } catch (error) {
    return false;
  }
};

export const likeAudiobook = async (username: string, audiobook: Audiobook): Promise<void> => {
  const identifier = buildAudiobookLikeIdentifier(audiobook.id);
  const payload = {
    audiobookId: audiobook.id,
    audiobookPublisher: audiobook.publisher,
    title: audiobook.title,
    likedAt: Date.now(),
  };

  const data64 = await objectToBase64(payload);

  await qortalRequest({
    action: 'PUBLISH_QDN_RESOURCE',
    name: username,
    service: 'DOCUMENT',
    identifier,
    data64,
    encoding: 'base64',
    title: `Like: ${audiobook.title || audiobook.id}`.slice(0, 55),
    description: `Audiobook like for ${audiobook.publisher}/${audiobook.id}`.slice(0, 4000),
  });
};

export const unlikeAudiobook = async (username: string, audiobookId: string): Promise<void> => {
  await deleteQdnResource({
    name: username,
    service: 'DOCUMENT',
    identifier: buildAudiobookLikeIdentifier(audiobookId),
  });
};
