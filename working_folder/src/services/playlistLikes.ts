import { PlayList } from '../state/features/globalSlice';
import { deleteQdnResource, fetchQdnResource } from '../utils/qortalApi';
import { objectToBase64 } from '../utils/toBase64';
import { cachedSearchQdnResources } from './resourceCache';

const PLAYLIST_LIKE_PREFIX = 'playlist_like_';
const LIKE_FETCH_LIMIT = 50;

export const buildPlaylistLikeIdentifier = (playlistId: string): string =>
  `${PLAYLIST_LIKE_PREFIX}${playlistId}`;

export const fetchPlaylistLikeCount = async (playlistId: string): Promise<number> => {
  let offset = 0;
  let total = 0;

  try {
    while (true) {
      const results = await cachedSearchQdnResources({
        mode: 'ALL',
        service: 'DOCUMENT',
        identifier: buildPlaylistLikeIdentifier(playlistId),
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
    console.error('Failed to fetch playlist like count', error);
  }

  return total;
};

export const hasUserLikedPlaylist = async (
  username: string,
  playlistId: string,
): Promise<boolean> => {
  try {
    await fetchQdnResource({
      name: username,
      service: 'DOCUMENT',
      identifier: buildPlaylistLikeIdentifier(playlistId),
    });
    return true;
  } catch (error) {
    return false;
  }
};

export const likePlaylist = async (username: string, playlist: PlayList): Promise<void> => {
  const identifier = buildPlaylistLikeIdentifier(playlist.id);
  const payload = {
    playlistId: playlist.id,
    playlistPublisher: playlist.user,
    title: playlist.title,
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
    title: `Like: ${playlist.title || playlist.id}`.slice(0, 55),
    description: `Playlist like for ${playlist.user}/${playlist.id}`.slice(0, 4000),
  });
};

export const unlikePlaylist = async (username: string, playlistId: string): Promise<void> => {
  await deleteQdnResource({
    name: username,
    service: 'DOCUMENT',
    identifier: buildPlaylistLikeIdentifier(playlistId),
  });
};
