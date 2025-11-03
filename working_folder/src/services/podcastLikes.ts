import { Podcast } from '../types';
import { deleteQdnResource, fetchQdnResource, searchQdnResources } from '../utils/qortalApi';
import { objectToBase64 } from '../utils/toBase64';

const PODCAST_LIKE_PREFIX = 'podcast_like_';
const LIKE_FETCH_LIMIT = 50;

export const buildPodcastLikeIdentifier = (podcastId: string): string =>
  `${PODCAST_LIKE_PREFIX}${podcastId}`;

export const fetchPodcastLikeCount = async (podcastId: string): Promise<number> => {
  let offset = 0;
  let total = 0;

  try {
    while (true) {
      const results = await searchQdnResources({
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
