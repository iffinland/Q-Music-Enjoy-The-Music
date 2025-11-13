import { objectToBase64 } from '../utils/toBase64';

export const deletePlaylistResource = async (owner: string, identifier: string): Promise<void> => {
  if (!owner || !identifier) {
    throw new Error('Missing playlist owner or identifier.');
  }

  const payload = {
    id: identifier,
    deleted: true,
    updated: Date.now(),
    title: 'deleted',
    description: 'deleted',
    songs: [],
  };

  const data64 = await objectToBase64(payload as Record<string, unknown>);

  await qortalRequest({
    action: 'PUBLISH_QDN_RESOURCE',
    name: owner,
    service: 'PLAYLIST',
    identifier,
    data64,
    encoding: 'base64',
    title: 'deleted',
    description: 'deleted',
  });
};
