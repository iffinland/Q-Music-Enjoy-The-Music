import ShortUniqueId from 'short-unique-id';
import { searchQdnResources, fetchQdnResource } from '../utils/qortalApi';
import { objectToBase64 } from '../utils/toBase64';

const COMMENT_PREFIX = 'enjoymusic_song_comment_';
const FETCH_LIMIT = 50;

export interface SongComment {
  id: string;
  songIdentifier: string;
  songPublisher: string;
  author: string;
  message: string;
  created: number;
}

const uid = new ShortUniqueId();

export const fetchSongComments = async (
  songPublisher: string,
  songIdentifier: string,
): Promise<SongComment[]> => {
  const prefix = `${COMMENT_PREFIX}${songIdentifier}_`;
  const aggregated: SongComment[] = [];
  let offset = 0;

  while (true) {
    const page = await searchQdnResources({
      mode: 'ALL',
      service: 'DOCUMENT',
      query: prefix,
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

        aggregated.push({
          id: entry.identifier,
          songIdentifier: data.songIdentifier,
          songPublisher: data.songPublisher,
          author: data.author || entry.name,
          message: data.message || '',
          created: data.created ?? entry.created ?? Date.now(),
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
  };

  const data64 = await objectToBase64(payload);
  const filename = `${commentIdentifier}.json`;

  await qortalRequest({
    action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
    resources: [
      {
        name: author,
        service: 'DOCUMENT',
        data64,
        identifier: commentIdentifier,
        filename,
        title: `Comment on ${songTitle || identifier}`.slice(0, 55),
        description: message.slice(0, 120),
        encoding: 'base64',
      },
    ],
  });

  return {
    ...payload,
    author,
  };
};

export const deleteSongComment = async (author: string, identifier: string) => {
  await qortalRequest({
    action: 'DELETE_QDN_RESOURCE',
    name: author,
    service: 'DOCUMENT',
    identifier,
  });
};

export const reportSongComment = async (
  reporter: string,
  comment: SongComment,
  reason: string,
) => {
  const reportIdentifier = `${comment.id}_report_${Date.now()}`;
  const payload = {
    id: reportIdentifier,
    commentId: comment.id,
    songIdentifier: comment.songIdentifier,
    songPublisher: comment.songPublisher,
    reporter,
    reason,
    created: Date.now(),
  };

  const data64 = await objectToBase64(payload);

  await qortalRequest({
    action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
    resources: [
      {
        name: reporter,
        service: 'DOCUMENT',
        data64,
        identifier: reportIdentifier,
        filename: `${reportIdentifier}.json`,
        title: `Report for comment ${comment.id}`.slice(0, 55),
        description: reason.slice(0, 120),
        encoding: 'base64',
      },
    ],
  });
};
