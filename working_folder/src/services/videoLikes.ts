import { Video } from '../types';
import { deleteQdnResource, fetchQdnResource } from '../utils/qortalApi';
import { objectToBase64 } from '../utils/toBase64';
import { cachedSearchQdnResources } from './resourceCache';

const VIDEO_LIKE_PREFIX = 'video_like_';
const LIKE_FETCH_LIMIT = 50;

export const buildVideoLikeIdentifier = (videoId: string): string =>
  `${VIDEO_LIKE_PREFIX}${videoId}`;

export const fetchVideoLikeCount = async (videoId: string): Promise<number> => {
  let offset = 0;
  let total = 0;

  try {
    while (true) {
      const results = await cachedSearchQdnResources({
        mode: 'ALL',
        service: 'DOCUMENT',
        identifier: buildVideoLikeIdentifier(videoId),
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
    console.error('Failed to fetch video like count', error);
  }

  return total;
};

export const fetchVideoLikeCounts = async (videoIds: string[]): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const videoId of videoIds) {
    counts[videoId] = await fetchVideoLikeCount(videoId);
  }
  return counts;
};


export const hasUserLikedVideo = async (
  username: string,
  videoId: string,
): Promise<boolean> => {
  try {
    await fetchQdnResource({
      name: username,
      service: 'DOCUMENT',
      identifier: buildVideoLikeIdentifier(videoId),
    });
    return true;
  } catch (error) {
    return false;
  }
};

export const haveUsersLikedVideos = async (
  username: string,
  videoIds: string[],
): Promise<Record<string, boolean>> => {
  const likedStatuses: Record<string, boolean> = {};
  for (const videoId of videoIds) {
    likedStatuses[videoId] = await hasUserLikedVideo(username, videoId);
  }
  return likedStatuses;
};

export const likeVideo = async (username: string, video: Video): Promise<void> => {
  const identifier = buildVideoLikeIdentifier(video.id);
  const payload = {
    videoId: video.id,
    videoPublisher: video.publisher,
    title: video.title,
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
    title: `Like: ${video.title || video.id}`.slice(0, 55),
    description: `Video like for ${video.publisher}/${video.id}`.slice(0, 4000),
  });
};

export const unlikeVideo = async (username: string, videoId: string): Promise<void> => {
  await deleteQdnResource({
    name: username,
    service: 'DOCUMENT',
    identifier: buildVideoLikeIdentifier(videoId),
  });
};
