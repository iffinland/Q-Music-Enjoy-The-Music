import { Podcast } from '../types';
import { deleteQdnResource, fetchQdnResource } from '../utils/qortalApi';
import { objectToBase64 } from '../utils/toBase64';
import { cachedSearchQdnResources } from './resourceCache';

const PODCAST_LIKE_PREFIX = 'podcast_like_';
const LIKE_FETCH_LIMIT = 50;
const MAX_IDENTIFIER_LENGTH = 64;

const makeDeterministicSuffix = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
};

export const buildPodcastLikeIdentifier = (podcastId: string): string => {
  const baseId = (podcastId || '').trim();
  const candidate = `${PODCAST_LIKE_PREFIX}${baseId}`;

  if (candidate.length <= MAX_IDENTIFIER_LENGTH) {
    return candidate;
  }

  const suffix = makeDeterministicSuffix(baseId);
  const maxIdPortionLength = Math.max(
    1,
    MAX_IDENTIFIER_LENGTH - PODCAST_LIKE_PREFIX.length - suffix.length - 1,
  );
  const trimmed = baseId.slice(0, maxIdPortionLength);
  return `${PODCAST_LIKE_PREFIX}${trimmed}_${suffix}`;
};

export const fetchPodcastLikeCount = async (podcastId: string): Promise<number> => {
  let offset = 0;
  let total = 0;

  try {
    while (true) {
      const results = await cachedSearchQdnResources({
        mode: 'ALL',
        service: 'DOCUMENT',
        identifier: buildPodcastLikeIdentifier(podcastId),
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
    console.error('Failed to fetch podcast like count', error);
  }

  return total;
};

export const fetchPodcastLikeUsers = async (
  podcastId: string,
  limit = 25,
): Promise<string[]> => {
  const users = new Set<string>();
  let offset = 0;

  try {
    while (users.size < limit) {
      const results = await cachedSearchQdnResources({
        mode: 'ALL',
        service: 'DOCUMENT',
        identifier: buildPodcastLikeIdentifier(podcastId),
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
    console.error('Failed to fetch podcast like users', error);
  }

  return Array.from(users).slice(0, limit);
};

export const hasUserLikedPodcast = async (
  username: string,
  podcastId: string,
): Promise<boolean> => {
  try {
    await fetchQdnResource({
      name: username,
      service: 'DOCUMENT',
      identifier: buildPodcastLikeIdentifier(podcastId),
    });
    return true;
  } catch (error) {
    return false;
  }
};

export const likePodcast = async (username: string, podcast: Podcast): Promise<void> => {
  const identifier = buildPodcastLikeIdentifier(podcast.id);
  const payload = {
    podcastId: podcast.id,
    podcastPublisher: podcast.publisher,
    title: podcast.title,
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
    title: `Like: ${podcast.title || podcast.id}`.slice(0, 55),
    description: `Podcast like for ${podcast.publisher}/${podcast.id}`.slice(0, 4000),
  });
};

export const unlikePodcast = async (username: string, podcastId: string): Promise<void> => {
  await deleteQdnResource({
    name: username,
    service: 'DOCUMENT',
    identifier: buildPodcastLikeIdentifier(podcastId),
  });
};
