import ShortUniqueId from 'short-unique-id';
import { toast } from 'react-hot-toast';
import { store } from '../state/store';
import { SongReference } from '../state/features/globalSlice';
import { MultiPublishPayload } from '../types/publish';
import { objectToBase64, toBase64 } from '../utils/toBase64';

type MultiPublishEvent = CustomEvent<{ entries?: MultiPublishPayload[] }>;

const AUDIO_PREFIX = 'enjoymusic_song_';
const PODCAST_PREFIX = 'enjoymusic_podcast_';
const AUDIOBOOK_PREFIX = 'enjoymusic_audiobooks_';

const uid = new ShortUniqueId({ length: 8 });

const queue: MultiPublishPayload[] = [];
let isProcessing = false;

interface PendingNewPlaylist {
  owner: string;
  sharedKey: string;
  title: string;
  description?: string;
  entries: SongReference[];
}

interface PendingExistingPlaylist {
  owner: string;
  playlistId: string;
  entries: SongReference[];
}

const newPlaylistAccumulators = new Map<string, PendingNewPlaylist>();
const existingPlaylistAccumulators = new Map<string, PendingExistingPlaylist>();

const buildNewPlaylistKey = (owner: string, sharedKey: string) => `${owner}::${sharedKey}`;
const buildExistingPlaylistKey = (owner: string, playlistId: string) => `${owner}::${playlistId}`;

const fileToData64 = async (file: File) => {
  const result = await toBase64(file);
  if (typeof result !== 'string') return null;
  const [, base64] = result.split(',');
  return base64 || null;
};

const appendCoverResource = async (
  resources: any[],
  entry: MultiPublishPayload,
  identifier: string,
  publisher: string,
) => {
  if (!entry.coverFile) return;
  const coverBase64 = await fileToData64(entry.coverFile);
  if (!coverBase64) return;
  resources.push({
    name: publisher,
    service: 'THUMBNAIL',
    data64: coverBase64,
    identifier,
  });
};

const sanitizeMetaValue = (value: string) => value.replace(/[;=]/g, ' ').trim();
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);

const buildIdentifier = (prefix: string, entry: MultiPublishPayload) => {
  const baseSlug =
    slugify(entry.title) ||
    slugify(entry.fileName) ||
    `entry_${Date.now().toString(36)}`;
  return `${prefix}${baseSlug}_${uid()}`;
};

const buildFilename = (entry: MultiPublishPayload, identifier: string) => {
  const ext = entry.fileName.split('.').pop() || 'audio';
  const slug = slugify(entry.title) || identifier.slice(-12);
  return `${slug}.${ext}`;
};

const buildDescription = (entry: MultiPublishPayload) => {
  const parts: string[] = [];
  if (entry.title) parts.push(`title=${sanitizeMetaValue(entry.title)}`);
  if (entry.author) parts.push(`author=${sanitizeMetaValue(entry.author)}`);
  if (entry.category) parts.push(`category=${sanitizeMetaValue(entry.category)}`);
  if (entry.notes) parts.push(`notes=${sanitizeMetaValue(entry.notes)}`);
  if (entry.tags?.length) parts.push(`tags=${sanitizeMetaValue(entry.tags.join(','))}`);
  if (entry.releaseDate) parts.push(`release=${entry.releaseDate}`);
  if (entry.supportPrice) parts.push(`price=${entry.supportPrice}`);
  return parts.join(';').slice(0, 4000);
};

const sanitizeTitleForIdentifier = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 25);

const buildPlaylistIdentifier = (title: string) => {
  const slug = sanitizeTitleForIdentifier(title);
  const unique = uid();
  return slug ? `enjoymusic_playlist_${slug}_${unique}` : `enjoymusic_playlist_${unique}`;
};

const dedupeSongReferences = (entries: SongReference[]) => {
  const seen = new Set<string>();
  const deduped: SongReference[] = [];
  entries.forEach((entry) => {
    const key = `${entry.name}:${entry.identifier}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(entry);
  });
  return deduped;
};

const buildSongReference = (
  entry: MultiPublishPayload,
  publisher: string,
  identifier: string,
): SongReference => ({
  identifier,
  name: publisher,
  service: 'AUDIO',
  title: entry.title || entry.fileName,
  author: entry.author,
});

const registerPlaylistTargets = (entries: MultiPublishPayload[], owner?: string) => {
  if (!owner) return;
  entries.forEach((entry) => {
    entry.playlistTargets?.forEach((target) => {
      if (target.type === 'new' && target.sharedKey) {
        const key = buildNewPlaylistKey(owner, target.sharedKey);
        if (!newPlaylistAccumulators.has(key)) {
          newPlaylistAccumulators.set(key, {
            owner,
            sharedKey: target.sharedKey,
            title: target.title || 'Untitled playlist',
            description: target.description,
            entries: [],
          });
        }
      } else if (target.type === 'existing') {
        const key = buildExistingPlaylistKey(owner, target.playlistId);
        if (!existingPlaylistAccumulators.has(key)) {
          existingPlaylistAccumulators.set(key, {
            owner,
            playlistId: target.playlistId,
            entries: [],
          });
        }
      }
    });
  });
};

const recordPlaylistTargets = (
  entry: MultiPublishPayload,
  owner: string,
  reference: SongReference | null,
) => {
  if (!reference || !entry.playlistTargets?.length) return;
  entry.playlistTargets.forEach((target) => {
    if (target.type === 'new' && target.sharedKey) {
      const key = buildNewPlaylistKey(owner, target.sharedKey);
      const group = newPlaylistAccumulators.get(key);
      if (group) {
        group.entries.push(reference);
      }
    } else if (target.type === 'existing') {
      const key = buildExistingPlaylistKey(owner, target.playlistId);
      const group = existingPlaylistAccumulators.get(key);
      if (group) {
        group.entries.push(reference);
      }
    }
  });
};

const fetchPlaylistResource = async (owner: string, playlistId: string) => {
  const response = await qortalRequest({
    action: 'FETCH_QDN_RESOURCE',
    name: owner,
    service: 'PLAYLIST',
    identifier: playlistId,
  });
  if (!response) {
    throw new Error('Playlist not found.');
  }
  const responseTitle =
    typeof response.title === 'string'
      ? response.title
      : typeof response.metadata?.title === 'string'
        ? response.metadata.title
        : 'Untitled playlist';
  const responseDescription =
    typeof response.description === 'string'
      ? response.description
      : typeof response.metadata?.description === 'string'
        ? response.metadata.description
        : '';
  const responseImage =
    typeof response.image === 'string'
      ? response.image
      : typeof response.metadata?.image === 'string'
        ? response.metadata.image
        : null;
  const songs: SongReference[] = Array.isArray(response.songs) ? response.songs : [];
  return {
    title: responseTitle,
    description: responseDescription,
    image: responseImage,
    songs,
  };
};

const publishPlaylistResource = async (
  owner: string,
  identifier: string,
  payload: { songs: SongReference[]; title?: string; description?: string; image?: string | null },
) => {
  const normalizedTitle = (payload.title || 'Untitled playlist').toString();
  const normalizedDescription = (payload.description || '').toString();
  const playlistPayload = {
    songs: payload.songs,
    title: normalizedTitle,
    description: normalizedDescription,
    image: payload.image ?? null,
  };
  const playlistToBase64 = await objectToBase64(playlistPayload);
  const safeFilename = sanitizeTitleForIdentifier(normalizedTitle) || identifier;

  await qortalRequest({
    action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
    resources: [
      {
        name: owner,
        service: 'PLAYLIST',
        data64: playlistToBase64,
        identifier,
        filename: `${safeFilename}.json`,
        title: normalizedTitle.slice(0, 55),
        description: normalizedDescription.slice(0, 4000),
      },
    ],
  });
};

const createPlaylistFromAccumulator = async (acc: PendingNewPlaylist) => {
  if (acc.entries.length === 0) return;
  const title = acc.title?.trim() || 'Untitled playlist';
  const description = acc.description?.trim() || '';
  const songs = dedupeSongReferences(acc.entries);
  const identifier = buildPlaylistIdentifier(title);
  try {
    await publishPlaylistResource(acc.owner, identifier, {
      songs,
      title,
      description,
      image: null,
    });
    toast.success(`Created playlist "${title}"`);
    window.dispatchEvent(new CustomEvent('playlists:refresh'));
  } catch (error) {
    console.error('Failed to create playlist from multi publish', error);
    toast.error('Failed to create playlist.');
  }
};

const appendEntriesToPlaylist = async (
  owner: string,
  playlistId: string,
  entries: SongReference[],
) => {
  if (entries.length === 0) return;
  try {
    const playlist = await fetchPlaylistResource(owner, playlistId);
    const combinedSongs = dedupeSongReferences([...playlist.songs, ...entries]);
    await publishPlaylistResource(owner, playlistId, {
      songs: combinedSongs,
      title: playlist.title,
      description: playlist.description,
      image: playlist.image,
    });
    toast.success(`Updated playlist "${playlist.title}"`);
    window.dispatchEvent(new CustomEvent('playlists:refresh'));
  } catch (error) {
    console.error('Failed to update playlist from multi publish', error);
    toast.error('Failed to update playlist.');
  }
};

const flushPlaylistAggregations = async (owner?: string) => {
  if (!owner) return;
  const newPlaylistKeys = Array.from(newPlaylistAccumulators.keys()).filter((key) =>
    key.startsWith(`${owner}::`),
  );
  for (const key of newPlaylistKeys) {
    const accumulator = newPlaylistAccumulators.get(key);
    newPlaylistAccumulators.delete(key);
    if (accumulator) {
      await createPlaylistFromAccumulator(accumulator);
    }
  }

  const existingKeys = Array.from(existingPlaylistAccumulators.keys()).filter((key) =>
    key.startsWith(`${owner}::`),
  );
  for (const key of existingKeys) {
    const accumulator = existingPlaylistAccumulators.get(key);
    existingPlaylistAccumulators.delete(key);
    if (accumulator) {
      await appendEntriesToPlaylist(accumulator.owner, accumulator.playlistId, accumulator.entries);
    }
  }
};

const publishAudioEntry = async (entry: MultiPublishPayload, publisher: string) => {
  const identifier = buildIdentifier(AUDIO_PREFIX, entry);
  const resources = [
    {
      name: publisher,
      service: 'AUDIO',
      file: entry.file,
      title: entry.title.slice(0, 55) || 'Untitled audio',
      description: buildDescription(entry),
      identifier,
      filename: buildFilename(entry, identifier),
    },
  ];

  await appendCoverResource(resources, entry, identifier, publisher);

  await qortalRequest({
    action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
    resources,
  });

  window.dispatchEvent(new CustomEvent('statistics:refresh'));
  window.dispatchEvent(new CustomEvent('songs:refresh'));
  return buildSongReference(entry, publisher, identifier);
};

const publishPodcastEntry = async (entry: MultiPublishPayload, publisher: string) => {
  const identifier = buildIdentifier(PODCAST_PREFIX, entry);
  const documentPayload = {
    title: entry.title,
    description: entry.notes,
    author: entry.author,
    category: entry.category,
    tags: entry.tags,
    visibility: entry.visibility,
    releaseDate: entry.releaseDate,
    collectionTitle: entry.collectionTitle,
    collectionDescription: entry.collectionDescription,
    audio: {
      filename: buildFilename(entry, identifier),
      size: entry.fileSize,
      mimeType: entry.file.type || 'audio/mpeg',
    },
  };

  const resources = [
    {
      name: publisher,
      service: 'AUDIO',
      file: entry.file,
      title: entry.title.slice(0, 55) || 'Untitled podcast',
      description: buildDescription(entry),
      identifier,
      filename: buildFilename(entry, identifier),
    },
    {
      name: publisher,
      service: 'DOCUMENT',
      data64: await objectToBase64(documentPayload),
      identifier,
      title: entry.title.slice(0, 55),
      description: (entry.notes || '').slice(0, 4000),
    },
  ];

  await appendCoverResource(resources, entry, identifier, publisher);

  await qortalRequest({
    action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
    resources,
  });

  window.dispatchEvent(new CustomEvent('statistics:refresh'));
  window.dispatchEvent(new CustomEvent('podcasts:refresh'));
  return buildSongReference(entry, publisher, identifier);
};

const publishAudiobookEntry = async (entry: MultiPublishPayload, publisher: string) => {
  const identifier = buildIdentifier(AUDIOBOOK_PREFIX, entry);
  const documentPayload = {
    title: entry.title,
    description: entry.notes,
    author: entry.author,
    category: entry.category,
    tags: entry.tags,
    visibility: entry.visibility,
    releaseDate: entry.releaseDate,
    type: 'AUDIOBOOK',
  };

  const resources = [
    {
      name: publisher,
      service: 'AUDIO',
      file: entry.file,
      title: entry.title.slice(0, 55) || 'Untitled audiobook',
      description: buildDescription(entry),
      identifier,
      filename: buildFilename(entry, identifier),
    },
    {
      name: publisher,
      service: 'DOCUMENT',
      data64: await objectToBase64(documentPayload),
      identifier,
      title: entry.title.slice(0, 55),
      description: (entry.notes || '').slice(0, 4000),
    },
  ];

  await appendCoverResource(resources, entry, identifier, publisher);

  await qortalRequest({
    action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
    resources,
  });

  window.dispatchEvent(new CustomEvent('statistics:refresh'));
  window.dispatchEvent(new CustomEvent('audiobooks:refresh'));
  return buildSongReference(entry, publisher, identifier);
};

const publishEntry = async (entry: MultiPublishPayload, publisher: string) => {
  switch (entry.type) {
    case 'podcast':
      return publishPodcastEntry(entry, publisher);
    case 'audiobook':
      return publishAudiobookEntry(entry, publisher);
    default:
      return publishAudioEntry(entry, publisher);
  }
};

const processQueue = async () => {
  if (isProcessing) return;
  isProcessing = true;
  let lastPublisher: string | null = null;

  while (queue.length > 0) {
    const entry = queue.shift()!;
    const state = store.getState();
    const publisher = state.auth?.user?.name;
    if (!publisher) {
      toast.error('Log in to publish content.');
      queue.length = 0;
      newPlaylistAccumulators.clear();
      existingPlaylistAccumulators.clear();
      break;
    }
    lastPublisher = publisher;

    const loadingId = toast.loading(`Publishing ${entry.title || entry.fileName}…`);
    try {
      const reference = await publishEntry(entry, publisher);
      recordPlaylistTargets(entry, publisher, reference);
      toast.success(`Published ${entry.title || entry.fileName}`, { id: loadingId });
    } catch (error: any) {
      console.error('Multi publish failed', error);
      const message =
        typeof error?.message === 'string'
          ? error.message
          : 'Failed to publish entry.';
      toast.error(message, { id: loadingId });
    }
  }

  await flushPlaylistAggregations(lastPublisher || undefined);
  isProcessing = false;
};

const enqueueEntries = (entries: MultiPublishPayload[]) => {
  queue.push(...entries);
  const state = store.getState();
  registerPlaylistTargets(entries, state.auth?.user?.name);
  toast.success(`Queued ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} for publishing.`);
  processQueue();
};

export const initMultiPublishQueue = () => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const custom = event as MultiPublishEvent;
    const entries = custom.detail?.entries;
    if (!entries || entries.length === 0) {
      return;
    }
    enqueueEntries(entries);
  };

  window.addEventListener('multi-publish:queue', handler as EventListener);
  return () => {
    window.removeEventListener('multi-publish:queue', handler as EventListener);
  };
};
