import ShortUniqueId from 'short-unique-id';
import { toast } from 'react-hot-toast';
import { store } from '../state/store';
import { MultiPublishPayload } from '../types/publish';
import { objectToBase64 } from '../utils/toBase64';

type MultiPublishEvent = CustomEvent<{ entries?: MultiPublishPayload[] }>;

const AUDIO_PREFIX = 'enjoymusic_song_';
const PODCAST_PREFIX = 'enjoymusic_podcast_';
const AUDIOBOOK_PREFIX = 'enjoymusic_audiobooks_';

const uid = new ShortUniqueId({ length: 8 });

const queue: MultiPublishPayload[] = [];
let isProcessing = false;

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

  await qortalRequest({
    action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
    resources,
  });

  window.dispatchEvent(new CustomEvent('statistics:refresh'));
  window.dispatchEvent(new CustomEvent('songs:refresh'));
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

  await qortalRequest({
    action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
    resources,
  });

  window.dispatchEvent(new CustomEvent('statistics:refresh'));
  window.dispatchEvent(new CustomEvent('podcasts:refresh'));
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

  await qortalRequest({
    action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
    resources,
  });

  window.dispatchEvent(new CustomEvent('statistics:refresh'));
  window.dispatchEvent(new CustomEvent('audiobooks:refresh'));
};

const publishEntry = async (entry: MultiPublishPayload, publisher: string) => {
  switch (entry.type) {
    case 'podcast':
      await publishPodcastEntry(entry, publisher);
      break;
    case 'audiobook':
      await publishAudiobookEntry(entry, publisher);
      break;
    default:
      await publishAudioEntry(entry, publisher);
  }
};

const processQueue = async () => {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const entry = queue.shift()!;
    const state = store.getState();
    const publisher = state.auth?.user?.name;
    if (!publisher) {
      toast.error('Log in to publish content.');
      queue.length = 0;
      break;
    }

    const loadingId = toast.loading(`Publishing ${entry.title || entry.fileName}…`);
    try {
      await publishEntry(entry, publisher);
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

  isProcessing = false;
};

const enqueueEntries = (entries: MultiPublishPayload[]) => {
  queue.push(...entries);
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
