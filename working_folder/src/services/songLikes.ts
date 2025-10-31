import { Song } from '../types';
import { SongMeta } from '../state/features/globalSlice';
import { deleteQdnResource, fetchQdnResource, searchQdnResources } from '../utils/qortalApi';
import { objectToBase64 } from '../utils/toBase64';

const SONG_LIKE_PREFIX = 'song_like_';
const LIKE_FETCH_LIMIT = 50;

export const buildSongLikeIdentifier = (songId: string): string =>
  `${SONG_LIKE_PREFIX}${songId}`;

export const fetchSongLikeCount = async (songId: string): Promise<number> => {
  let offset = 0;
  let total = 0;

  try {
    while (true) {
      const results = await searchQdnResources({
        mode: 'ALL',
        service: 'DOCUMENT',
        identifier: buildSongLikeIdentifier(songId),
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
    console.error('Failed to fetch song like count', error);
  }

  return total;
};

export const hasUserLikedSong = async (
  username: string,
  songId: string,
): Promise<boolean> => {
  try {
    await fetchQdnResource({
      name: username,
      service: 'DOCUMENT',
      identifier: buildSongLikeIdentifier(songId),
    });
    return true;
  } catch (error) {
    return false;
  }
};

type LikeableSong = Pick<SongMeta, 'id' | 'name' | 'title'> | Pick<Song, 'id' | 'name' | 'title'>;

export const likeSong = async (username: string, song: LikeableSong): Promise<void> => {
  const identifier = buildSongLikeIdentifier(song.id);
  const payload = {
    songId: song.id,
    songPublisher: song.name,
    title: song.title,
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
    title: `Like: ${song.title || song.id}`.slice(0, 55),
    description: `Song like for ${song.name}/${song.id}`.slice(0, 120),
  });
};

export const unlikeSong = async (username: string, songId: string): Promise<void> => {
  await deleteQdnResource({
    name: username,
    service: 'DOCUMENT',
    identifier: buildSongLikeIdentifier(songId),
  });
};
