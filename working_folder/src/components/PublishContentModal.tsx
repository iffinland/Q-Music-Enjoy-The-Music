import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { BsMusicNoteBeamed, BsMusicNoteList } from 'react-icons/bs';
import { FaBookOpen, FaPodcast, FaVideo } from 'react-icons/fa';
import { IconType } from 'react-icons';
import { HiOutlineSparkles } from 'react-icons/hi';
import { toast } from 'react-hot-toast';
import { useSelector } from 'react-redux';

import Modal from './Modal';
import Input from './Input';
import Textarea from './TextArea';
import Button from './Button';
import usePublishContentModal from '../hooks/usePublishContentModal';
import { PublishType, MultiEntryType, MultiPublishPayload, PlaylistTarget } from '../types/publish';
import {
  AUDIOBOOK_CATEGORIES,
  MUSIC_CATEGORIES,
  PODCAST_CATEGORIES,
  PLAYLIST_CATEGORIES,
  VIDEO_CATEGORIES,
} from '../constants/categories';
import { objectToBase64, toBase64 } from '../utils/toBase64';
import { RootState } from '../state/store';
import { PlayList } from '../state/features/globalSlice';

type FieldVariant = 'text' | 'number' | 'textarea' | 'select';

interface MultiEntry {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  type: MultiEntryType;
  title: string;
  category: string;
  notes: string;
  syncedFromTemplate?: boolean;
}

interface TypeOption {
  id: PublishType;
  label: string;
  tagline: string;
  previewCopy: string;
  accent: string;
  icon: IconType;
}

interface SectionField {
  name: string;
  label: string;
  placeholder?: string;
  variant?: FieldVariant;
  options?: { label: string; value: string }[];
  helper?: string;
}

interface TypeSection {
  id: string;
  title: string;
  description: string;
  fields: SectionField[];
  defaultOpen?: boolean;
}

interface BaseValues {
  title: string;
  description: string;
  creatorName: string;
  tags: string;
  releaseDate: string;
  visibility: 'public' | 'draft' | 'limited';
  price: string;
  primaryFileName: string;
  coverFileName: string;
  coverPreview: string | null;
}

type TypeSpecificValues = Record<PublishType, Record<string, string>>;

const mapCategoriesToOptions = (values: readonly string[]) =>
  values.map((value) => ({ label: value, value }));

const MULTI_ENTRY_TYPES: { value: MultiEntryType; label: string }[] = [
  { value: 'audio', label: 'Audio track' },
  { value: 'podcast', label: 'Podcast episode' },
  { value: 'audiobook', label: 'Audiobook chapter' },
];

const MULTI_ENTRY_CATEGORY_MAP: Record<MultiEntryType, readonly string[]> = {
  audio: MUSIC_CATEGORIES,
  podcast: PODCAST_CATEGORIES,
  audiobook: AUDIOBOOK_CATEGORIES,
};

const PUBLISH_OPTIONS: TypeOption[] = [
  {
    id: 'audio',
    label: 'Audio track',
    tagline: 'MP3 / WAV singles and remixes',
    previewCopy: 'Perfect for releasing a single song or a quick demo.',
    accent: 'from-sky-500/80 via-cyan-400 to-emerald-400',
    icon: BsMusicNoteBeamed,
  },
  {
    id: 'podcast',
    label: 'Podcast episode',
    tagline: 'Series, interviews and conversations',
    previewCopy: 'Keep season info, RSS and calls-to-action in one spot.',
    accent: 'from-purple-500/80 via-indigo-500 to-sky-400',
    icon: FaPodcast,
  },
  {
    id: 'audiobook',
    label: 'Audiobook chapter',
    tagline: 'Full releases or standalone chapters',
    previewCopy: 'Highlight author credits and narrator notes.',
    accent: 'from-emerald-500/80 via-teal-500 to-cyan-300',
    icon: FaBookOpen,
  },
  {
    id: 'video',
    label: 'Music video',
    tagline: 'Clips, live takes and visualizers',
    previewCopy: 'Match the right resolution, ratio and CTA.',
    accent: 'from-rose-500/80 via-orange-500 to-amber-400',
    icon: FaVideo,
  },
  {
    id: 'playlist',
    label: 'Playlist',
    tagline: 'Curated lists and moods',
    previewCopy: 'Explain your concept, refresh cadence and collaborators.',
    accent: 'from-fuchsia-500/80 via-pink-500 to-rose-400',
    icon: BsMusicNoteList,
  },
  {
    id: 'multi',
    label: 'Folder / multi-file',
    tagline: 'Drop a full release and edit entries in bulk',
    previewCopy: 'Upload multiple tracks, podcasts or chapters in one go.',
    accent: 'from-emerald-400 via-cyan-400 to-sky-500',
    icon: HiOutlineSparkles,
  },
];

const TYPE_SECTIONS: Record<PublishType, TypeSection[]> = {
  audio: [
    {
      id: 'audio-core',
      title: 'Audio details',
      description: 'Category, mood and metadata improve discovery.',
      defaultOpen: true,
      fields: [
        {
          name: 'category',
          label: 'Category',
          variant: 'select',
          options: mapCategoriesToOptions(MUSIC_CATEGORIES),
        },
        { name: 'genre', label: 'Style or sub-genre', placeholder: 'e.g. dreamwave textures' },
        { name: 'mood', label: 'Mood', placeholder: 'e.g. late-night ride' },
        { name: 'language', label: 'Language', placeholder: 'e.g. English / instrumental' },
        { name: 'bpm', label: 'Tempo (BPM)', placeholder: 'e.g. 118', variant: 'number' },
      ],
    },
  ],
  podcast: [
    {
      id: 'podcast-episode',
      title: 'Episode settings',
      description: 'Keep listeners informed about the series timeline.',
      defaultOpen: true,
      fields: [
        {
          name: 'category',
          label: 'Category',
          variant: 'select',
          options: mapCategoriesToOptions(PODCAST_CATEGORIES),
        },
        { name: 'series', label: 'Show title', placeholder: 'e.g. Q-Pocket' },
        { name: 'season', label: 'Season', placeholder: 'e.g. 3' },
        { name: 'episode', label: 'Episode', placeholder: 'e.g. 12' },
        { name: 'duration', label: 'Duration', placeholder: 'e.g. 42 min' },
      ],
    },
  ],
  audiobook: [
    {
      id: 'audiobook-core',
      title: 'Book information',
      description: 'Core details help listeners understand the story.',
      defaultOpen: true,
      fields: [
        {
          name: 'category',
          label: 'Category',
          variant: 'select',
          options: mapCategoriesToOptions(AUDIOBOOK_CATEGORIES),
        },
        { name: 'bookTitle', label: 'Book title', placeholder: 'e.g. Echoes from the Sky' },
        { name: 'author', label: 'Author', placeholder: 'e.g. Mari Mae' },
        { name: 'chapter', label: 'Chapter', placeholder: 'e.g. Chapter 5' },
        { name: 'narrator', label: 'Narrator', placeholder: 'e.g. Peter Teller' },
        { name: 'duration', label: 'Duration', placeholder: 'e.g. 1h 12m' },
      ],
    },
  ],
  video: [
    {
      id: 'video-core',
      title: 'Video specs',
      description: 'Prepare format, quality and runtime.',
      defaultOpen: true,
      fields: [
        {
          name: 'category',
          label: 'Category',
          variant: 'select',
          options: mapCategoriesToOptions(VIDEO_CATEGORIES),
        },
        { name: 'resolution', label: 'Resolution', placeholder: 'e.g. 4K (3840x2160)' },
        { name: 'aspectRatio', label: 'Aspect ratio', placeholder: 'e.g. 16:9' },
        { name: 'duration', label: 'Duration', placeholder: 'e.g. 3:32' },
        { name: 'frameRate', label: 'Frame rate', placeholder: 'e.g. 60 fps' },
        {
          name: 'subtitles',
          label: 'Subtitles',
          placeholder: 'Upload references or links to subtitle files',
        },
      ],
    },
  ],
  playlist: [
    {
      id: 'playlist-core',
      title: 'Playlist identity',
      description: 'Explain who it is for and what binds the tracks.',
      defaultOpen: true,
      fields: [
        {
          name: 'category',
          label: 'Category',
          variant: 'select',
          options: mapCategoriesToOptions(PLAYLIST_CATEGORIES),
        },
        { name: 'theme', label: 'Theme', placeholder: 'e.g. Late night walk' },
        { name: 'vibe', label: 'Vibe / tempo', placeholder: 'e.g. Chill 90 BPM' },
        {
          name: 'isPublic',
          label: 'Visibility',
          variant: 'select',
          options: [
            { label: 'Public', value: 'public' },
            { label: 'Link only', value: 'unlisted' },
          ],
        },
        { name: 'collaborators', label: 'Collaborators', placeholder: 'e.g. @dj-moon, @crystalwave' },
      ],
    },
  ],
  multi: [],
};

const FILE_ACCEPT_MAP: Record<PublishType, string> = {
  audio: 'audio/*',
  podcast: 'audio/*',
  audiobook: 'audio/*',
  video: 'video/*',
  playlist: '.json,.txt',
  multi: 'audio/*',
};

const FILE_HINTS: Record<PublishType, string> = {
  audio: 'MP3, WAV, FLAC',
  podcast: 'MP3, AAC, OGG',
  audiobook: 'MP3, M4B, FLAC',
  video: 'MP4, MOV, MKV',
  playlist: 'JSON or TXT list',
  multi: 'MP3, WAV, FLAC, AAC, OGG',
};

const VISIBILITY_LABELS: Record<BaseValues['visibility'], string> = {
  public: 'Public release',
  draft: 'Private draft',
  limited: 'Link-only access',
};

const createInitialBaseValues = (): BaseValues => ({
  title: '',
  description: '',
  creatorName: '',
  tags: '',
  releaseDate: '',
  visibility: 'public',
  price: '',
  primaryFileName: '',
  coverFileName: '',
  coverPreview: null,
});

const createInitialTypeValues = (): TypeSpecificValues => ({
  audio: {
    category: '',
    genre: '',
    mood: '',
    language: '',
    bpm: '',
    explicit: '',
    album: '',
    supportingNotes: '',
  },
  podcast: {
    category: '',
    series: '',
    season: '',
    episode: '',
    duration: '',
    explicit: '',
    rssFeed: '',
    callToAction: '',
  },
  audiobook: {
    category: '',
    bookTitle: '',
    author: '',
    chapter: '',
    narrator: '',
    duration: '',
    summary: '',
    license: '',
  },
  video: {
    category: '',
    resolution: '',
    aspectRatio: '',
    duration: '',
    frameRate: '',
    subtitles: '',
    ctaHeadline: '',
    ctaLink: '',
  },
  playlist: {
    category: '',
    theme: '',
    vibe: '',
    isPublic: '',
    collaborators: '',
    curationNotes: '',
    updateFrequency: '',
  },
  multi: {},
});

const SINGLE_ENTRY_SUPPORTED_TYPES: MultiEntryType[] = ['audio', 'podcast', 'audiobook'];
const VIDEO_IDENTIFIER_PREFIX = 'enjoymusic_video_';
const PLAYLIST_IDENTIFIER_PREFIX = 'enjoymusic_playlist_';

const sanitizeMetaValue = (value: string) => value.replace(/[;=]/g, ' ').trim();
const slugifyForResource = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

const fileToData64 = async (file: File) => {
  const result = await toBase64(file);
  if (typeof result !== 'string') return null;
  const [, base64] = result.split(',');
  return base64 || null;
};

const buildVideoIdentifier = (title: string) => {
  const slug = slugifyForResource(title) || `video_${Date.now().toString(36)}`;
  return `${VIDEO_IDENTIFIER_PREFIX}${slug}_${Date.now().toString(36)}`;
};

const buildVideoFilename = (file: File, title: string) => {
  const slug = slugifyForResource(title) || slugifyForResource(file.name) || 'video';
  const extension =
    file.name && file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '.video';
  return `${slug}_${Date.now().toString(36)}${extension}`;
};

const buildPlaylistIdentifier = (title: string) => {
  const slug = slugifyForResource(title) || `playlist_${Date.now().toString(36)}`;
  return `${PLAYLIST_IDENTIFIER_PREFIX}${slug}_${Date.now().toString(36)}`;
};

const PublishContentModal: React.FC = () => {
  const modal = usePublishContentModal();
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const myPlaylists = useSelector((state: RootState) => state.global.myPlaylists);
  const [selectedType, setSelectedType] = useState<PublishType>('audio');
  const [baseValues, setBaseValues] = useState<BaseValues>(() => createInitialBaseValues());
  const [typeValues, setTypeValues] = useState<TypeSpecificValues>(() => createInitialTypeValues());
  const [sectionState, setSectionState] = useState<Record<string, boolean>>({});
  const [multiEntries, setMultiEntries] = useState<MultiEntry[]>([]);
  const multiFileInputRef = useRef<HTMLInputElement | null>(null);
  const primaryFileInputRef = useRef<HTMLInputElement | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const [bulkCategoryType, setBulkCategoryType] = useState<MultiEntryType>('audio');
  const [bulkCategoryValue, setBulkCategoryValue] = useState('');
  const [bulkTypeSelection, setBulkTypeSelection] = useState<MultiEntryType | ''>('');
  const [primaryFile, setPrimaryFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isVideoPublishing, setIsVideoPublishing] = useState(false);
  const [isPlaylistPublishing, setIsPlaylistPublishing] = useState(false);
  const [singlePlaylistSelection, setSinglePlaylistSelection] = useState<string[]>([]);
  const [singleNewPlaylist, setSingleNewPlaylist] = useState({ enabled: false, title: '', description: '' });
  const [multiPlaylistSelection, setMultiPlaylistSelection] = useState<string[]>([]);
  const [multiNewPlaylist, setMultiNewPlaylist] = useState({ enabled: false, title: '', description: '' });

  const currentOption = useMemo(
    () => PUBLISH_OPTIONS.find((option) => option.id === selectedType) ?? PUBLISH_OPTIONS[0],
    [selectedType],
  );
  const availablePlaylists = useMemo<PlayList[]>(() => myPlaylists ?? [], [myPlaylists]);

  const currentTypeValues = typeValues[selectedType];
  const isMultiPublish = selectedType === 'multi';
  const showPlaylistShortcuts = !isMultiPublish && selectedType !== 'playlist';

  const resetState = () => {
    setBaseValues(createInitialBaseValues());
    setTypeValues(createInitialTypeValues());
    setSectionState({});
    setMultiEntries([]);
    setBulkCategoryType('audio');
    setBulkCategoryValue('');
    setPrimaryFile(null);
    setCoverFile(null);
    setSinglePlaylistSelection([]);
    setSingleNewPlaylist({ enabled: false, title: '', description: '' });
    setMultiPlaylistSelection([]);
    setMultiNewPlaylist({ enabled: false, title: '', description: '' });
    if (multiFileInputRef.current) {
      multiFileInputRef.current.value = '';
    }
    if (primaryFileInputRef.current) {
      primaryFileInputRef.current.value = '';
    }
    if (coverFileInputRef.current) {
      coverFileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (!modal.isOpen) {
      resetState();
      setSelectedType('audio');
      return;
    }
    setSelectedType(modal.preferredType);
  }, [modal.isOpen, modal.preferredType]);

  useEffect(() => {
    if (!modal.isOpen) return;
    const initialState: Record<string, boolean> = {};
    TYPE_SECTIONS[selectedType].forEach((section) => {
      initialState[section.id] = section.defaultOpen ?? false;
    });
    setSectionState(initialState);
  }, [modal.isOpen, selectedType]);

  useEffect(() => {
    setBulkCategoryValue('');
  }, [bulkCategoryType]);

  const handleBaseValueChange = (
    field: keyof BaseValues,
  ) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setBaseValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleTypeFieldChange = (field: string, value: string) => {
    setTypeValues((prev) => ({
      ...prev,
      [selectedType]: {
        ...prev[selectedType],
        [field]: value,
      },
    }));
  };

  const handleFileChange = (target: 'primary' | 'cover') => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setBaseValues((prev) => ({
        ...prev,
        primaryFileName: target === 'primary' ? '' : prev.primaryFileName,
        coverFileName: target === 'cover' ? '' : prev.coverFileName,
        coverPreview: target === 'cover' ? null : prev.coverPreview,
      }));
      if (target === 'primary') {
        setPrimaryFile(null);
      } else {
        setCoverFile(null);
      }
      return;
    }

    if (target === 'primary') {
      setPrimaryFile(file);
      setBaseValues((prev) => ({
        ...prev,
        primaryFileName: file.name,
      }));
    } else {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBaseValues((prev) => ({
          ...prev,
          coverFileName: file.name,
          coverPreview: typeof reader.result === 'string' ? reader.result : null,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSinglePlaylistAdd = (playlistId: string) => {
    if (!playlistId) return;
    setSinglePlaylistSelection((prev) => (prev.includes(playlistId) ? prev : [...prev, playlistId]));
  };

  const handleSinglePlaylistRemove = (playlistId: string) => {
    setSinglePlaylistSelection((prev) => prev.filter((id) => id !== playlistId));
  };

  const handleMultiPlaylistAdd = (playlistId: string) => {
    if (!playlistId) return;
    setMultiPlaylistSelection((prev) => (prev.includes(playlistId) ? prev : [...prev, playlistId]));
  };

  const handleMultiPlaylistRemove = (playlistId: string) => {
    setMultiPlaylistSelection((prev) => prev.filter((id) => id !== playlistId));
  };

  const handleMultiFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const timestamp = Date.now();
    const newEntries = Array.from(files).map((file, index) => ({
      id: `${file.name}-${file.size}-${timestamp}-${index}`,
      file,
      fileName: file.name,
      fileSize: file.size,
      type: 'audio' as MultiEntryType,
      title: '',
      category: '',
      notes: '',
    }));
    setMultiEntries((prev) => [...prev, ...newEntries]);
    if (multiFileInputRef.current) {
      multiFileInputRef.current.value = '';
    }
  };

  const handleMultiEntryTypeChange = (entryId: string, nextType: MultiEntryType) => {
    setMultiEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== entryId) return entry;
        const allowedCategories = MULTI_ENTRY_CATEGORY_MAP[nextType];
        const nextCategory = allowedCategories.includes(entry.category) ? entry.category : '';
        return {
          ...entry,
          type: nextType,
          category: nextCategory,
          syncedFromTemplate: false,
        };
      }),
    );
  };

  const handleMultiEntryChange = (
    entryId: string,
    field: 'title' | 'category' | 'notes',
    value: string,
  ) => {
    setMultiEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId ? { ...entry, [field]: value, syncedFromTemplate: false } : entry,
      ),
    );
  };

  const handleRemoveMultiEntry = (entryId: string) => {
    setMultiEntries((prev) => prev.filter((entry) => entry.id !== entryId));
  };

  const handleClearMultiEntries = () => {
    setMultiEntries([]);
    if (multiFileInputRef.current) {
      multiFileInputRef.current.value = '';
    }
  };

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
};

const formatTitleFromFilename = (fileName: string) => {
  const withoutExtension = fileName.replace(/\.[^/.]+$/, '');
  return withoutExtension.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
};

const clonePlaylistTargets = (targets: PlaylistTarget[]): PlaylistTarget[] =>
  targets.map((target) =>
    target.type === 'new'
      ? {
          type: 'new',
          title: target.title,
          description: target.description,
          sharedKey: target.sharedKey,
        }
      : {
          type: 'existing',
          playlistId: target.playlistId,
        },
  );

const buildPlaylistTargets = (
  existingIds: string[],
  newPlaylist: { enabled: boolean; title: string; description: string },
  options?: { sharedKey?: string },
): PlaylistTarget[] => {
  const targets: PlaylistTarget[] = [];
  existingIds.forEach((playlistId) => {
    if (playlistId.trim().length > 0) {
      targets.push({
        type: 'existing',
        playlistId,
      });
    }
  });
  if (newPlaylist.enabled && newPlaylist.title.trim().length > 0) {
    targets.push({
      type: 'new',
      title: newPlaylist.title.trim(),
      description: newPlaylist.description.trim() || undefined,
      sharedKey: options?.sharedKey,
    });
  }
  return targets;
};

  const highlightEntries = useMemo(
    () =>
      Object.entries(currentTypeValues)
        .filter(([, value]) => Boolean(value && value.trim().length > 0))
        .slice(0, 4),
    [currentTypeValues],
  );

  const tags = useMemo(
    () =>
      baseValues.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    [baseValues.tags],
  );

  const multiCounts = useMemo(
    () =>
      multiEntries.reduce(
        (acc, entry) => {
          acc.total += 1;
          acc[entry.type] += 1;
          return acc;
        },
        {
          total: 0,
          audio: 0,
          podcast: 0,
          audiobook: 0,
        },
      ),
    [multiEntries],
  );
  const bulkCategoryOptions = useMemo(
    () => MULTI_ENTRY_CATEGORY_MAP[bulkCategoryType],
    [bulkCategoryType],
  );

  const handleFillTitlesFromFilenames = () => {
    setMultiEntries((prev) =>
      prev.map((entry) => {
        if (entry.title.trim().length > 0) return entry;
        return { ...entry, title: formatTitleFromFilename(entry.fileName), syncedFromTemplate: false };
      }),
    );
  };

  const handleSetAllTypes = (nextType: MultiEntryType) => {
    setMultiEntries((prev) =>
      prev.map((entry) => {
        const allowedCategories = MULTI_ENTRY_CATEGORY_MAP[nextType];
        const nextCategory = allowedCategories.includes(entry.category) ? entry.category : '';
        return {
          ...entry,
          type: nextType,
          category: nextCategory,
          syncedFromTemplate: false,
        };
      }),
    );
    setBulkCategoryType(nextType);
    setBulkCategoryValue('');
  };

  const handleApplyCategoryToType = () => {
    if (!bulkCategoryValue) {
      toast.error('Choose a category to apply');
      return;
    }
    setMultiEntries((prev) =>
      prev.map((entry) =>
        entry.type === bulkCategoryType
          ? { ...entry, category: bulkCategoryValue, syncedFromTemplate: false }
          : entry,
      ),
    );
    toast.success(`Applied category to all ${bulkCategoryType} entries`);
  };

  const handleApplyTemplateToOthers = (entryId: string) => {
    const template = multiEntries.find((entry) => entry.id === entryId);
    if (!template) return;
    setMultiEntries((prev) =>
      prev.map((entry) => {
        if (entry.id === template.id) {
          return { ...entry, syncedFromTemplate: false };
        }
        const allowedCategories = MULTI_ENTRY_CATEGORY_MAP[template.type];
        const nextCategory = allowedCategories.includes(template.category) ? template.category : '';
        return {
          ...entry,
          type: template.type,
          category: nextCategory,
          notes: template.notes,
          syncedFromTemplate: true,
        };
      }),
    );
    toast.success('Applied template to other entries');
  };

  const handleMultiPublish = () => {
    const creatorName = baseValues.creatorName.trim();
    if (!creatorName) {
      toast.error('Add the artist / author info before publishing.');
      return;
    }
    if (multiEntries.length === 0) {
      toast.error('Add at least one file to publish');
      return;
    }
    const missingTitle = multiEntries.find((entry) => !entry.title.trim());
    if (missingTitle) {
      toast.error(`Add a title for ${missingTitle.fileName}`);
      return;
    }
    const missingCategory = multiEntries.find((entry) => !entry.category.trim());
    if (missingCategory) {
      toast.error(`Choose a category for ${missingCategory.fileName}`);
      return;
    }

    const multiPlaylistTargetsConfig = buildPlaylistTargets(
      multiPlaylistSelection,
      multiNewPlaylist,
      multiNewPlaylist.enabled ? { sharedKey: `multi-${Date.now().toString(36)}` } : undefined,
    );

    const payloads: MultiPublishPayload[] = multiEntries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      file: entry.file,
      fileName: entry.fileName,
      fileSize: entry.fileSize,
      title: entry.title.trim(),
      category: entry.category,
      notes: entry.notes.trim(),
      author: creatorName,
      tags,
      visibility: baseValues.visibility,
      releaseDate: baseValues.releaseDate || undefined,
      collectionTitle: baseValues.title || undefined,
      collectionDescription: baseValues.description || undefined,
      supportPrice: baseValues.price || undefined,
      playlistTargets:
        multiPlaylistTargetsConfig.length > 0 ? clonePlaylistTargets(multiPlaylistTargetsConfig) : undefined,
    }));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('multi-publish:queue', {
          detail: {
            entries: payloads,
          },
        }),
      );
    }
    toast.success(`Queued ${payloads.length} entries for publishing.`);
    setMultiEntries([]);
    if (multiFileInputRef.current) {
      multiFileInputRef.current.value = '';
    }
    modal.close();
  };

  const handleSingleVideoPublish = async () => {
    if (isVideoPublishing) return;
    if (!username) {
      toast.error('Log in to publish videos.');
      return;
    }
    const creatorName = baseValues.creatorName.trim();
    if (!creatorName) {
      toast.error('Add the artist / author info before publishing.');
      return;
    }
    if (!primaryFile) {
      toast.error('Select a video file to publish.');
      return;
    }

    const trimmedTitle = baseValues.title.trim();
    const resolvedTitle = trimmedTitle || formatTitleFromFilename(primaryFile.name);
    if (!resolvedTitle) {
      toast.error('Add a title before publishing.');
      return;
    }

    const videoValues = typeValues.video || {};
    const categoryValue = (videoValues.category ?? '').trim();
    if (!categoryValue) {
      toast.error('Choose a category to continue.');
      return;
    }

    setIsVideoPublishing(true);
    const toastId = toast.loading('Publishing video…');
    try {
      const identifier = buildVideoIdentifier(resolvedTitle);
      const videoFilename = buildVideoFilename(primaryFile, resolvedTitle);
      const description = baseValues.description.trim();
      const descriptionSnippet = description.slice(0, 4000);
      const metadataEntries: Record<string, string> = {};
      if (creatorName) {
        metadataEntries.author = sanitizeMetaValue(creatorName);
      }
      Object.entries(videoValues).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim().length > 0) {
          metadataEntries[key] = sanitizeMetaValue(value);
        }
      });

      const documentPayload: Record<string, any> = {
        id: identifier,
        title: resolvedTitle,
        description,
        publisher: username,
        visibility: baseValues.visibility,
        author: creatorName,
        created: Date.now(),
        updated: Date.now(),
        ...(tags.length ? { tags } : {}),
        ...(baseValues.releaseDate ? { releaseDate: baseValues.releaseDate } : {}),
        ...(baseValues.price ? { supportPrice: baseValues.price } : {}),
        video: {
          filename: videoFilename,
          mimeType: primaryFile.type || 'video/mp4',
        },
      };

      if (Object.keys(metadataEntries).length > 0) {
        documentPayload.metadata = metadataEntries;
      }

      const resources: any[] = [
        {
          name: username,
          service: 'VIDEO',
          file: primaryFile,
          identifier,
          filename: videoFilename,
          title: resolvedTitle.slice(0, 55),
          description: descriptionSnippet,
        },
        {
          name: username,
          service: 'DOCUMENT',
          data64: await objectToBase64(documentPayload),
          identifier,
          filename: `${identifier}.json`,
          title: resolvedTitle.slice(0, 55),
          description: descriptionSnippet,
        },
      ];

      if (coverFile) {
        const coverBase64 = await fileToData64(coverFile);
        if (coverBase64) {
          resources.push({
            name: username,
            service: 'THUMBNAIL',
            data64: coverBase64,
            identifier,
          });
        }
      }

      await qortalRequest({
        action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
        resources,
      });

      toast.success(`Published ${resolvedTitle}`, { id: toastId });
      window.dispatchEvent(new CustomEvent('videos:refresh'));
      setPrimaryFile(null);
      setCoverFile(null);
      setBaseValues((prev) => ({
        ...prev,
        primaryFileName: '',
        coverFileName: '',
        coverPreview: null,
      }));
      if (primaryFileInputRef.current) {
        primaryFileInputRef.current.value = '';
      }
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = '';
      }
      modal.close();
    } catch (error: any) {
      console.error('Failed to publish video', error);
      const message =
        typeof error?.message === 'string' ? error.message : 'Failed to publish video.';
      toast.error(message, { id: toastId });
    } finally {
      setIsVideoPublishing(false);
    }
  };

  const handleSinglePlaylistPublish = async () => {
    if (isPlaylistPublishing) return;
    if (!username) {
      toast.error('Log in to publish playlists.');
      return;
    }

    const trimmedTitle = baseValues.title.trim();
    if (!trimmedTitle) {
      toast.error('Add a title before publishing.');
      return;
    }

    const creatorName = baseValues.creatorName.trim();
    if (!creatorName) {
      toast.error('Add the artist / author info before publishing.');
      return;
    }

    if (!primaryFile) {
      toast.error('Upload a playlist file (JSON or text).');
      return;
    }

    const playlistValues = typeValues.playlist || {};
    setIsPlaylistPublishing(true);
    const toastId = toast.loading('Publishing playlist…');
    try {
      const identifier = buildPlaylistIdentifier(trimmedTitle);
      const description = baseValues.description.trim();
      const descriptionSnippet = description.slice(0, 4000);
      const playlistData64 = await fileToData64(primaryFile);
      if (!playlistData64) {
        throw new Error('Failed to read the playlist file.');
      }

      const metadataEntries: Record<string, string> = {};
      if (creatorName) {
        metadataEntries.author = sanitizeMetaValue(creatorName);
      }
      Object.entries(playlistValues).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim().length > 0) {
          metadataEntries[key] = sanitizeMetaValue(value);
        }
      });

      const documentPayload: Record<string, any> = {
        id: identifier,
        title: trimmedTitle,
        description,
        publisher: username,
        visibility: baseValues.visibility,
        type: 'PLAYLIST',
        author: creatorName,
        ...(tags.length ? { tags } : {}),
        ...(baseValues.releaseDate ? { releaseDate: baseValues.releaseDate } : {}),
        ...(baseValues.price ? { supportPrice: baseValues.price } : {}),
      };

      if (Object.keys(metadataEntries).length > 0) {
        documentPayload.metadata = metadataEntries;
      }

      let coverBase64: string | null = null;
      if (coverFile) {
        coverBase64 = await fileToData64(coverFile);
        if (coverBase64) {
          const mime = coverFile.type || 'image/png';
          documentPayload.coverImage = `data:${mime};base64,${coverBase64}`;
        }
      }

      const resources: any[] = [
        {
          name: username,
          service: 'PLAYLIST',
          data64: playlistData64,
          identifier,
          filename: primaryFile.name || `${identifier}.json`,
          title: trimmedTitle.slice(0, 55),
          description: descriptionSnippet,
        },
        {
          name: username,
          service: 'DOCUMENT',
          data64: await objectToBase64(documentPayload),
          identifier,
          filename: `${identifier}.meta.json`,
          title: trimmedTitle.slice(0, 55),
          description: descriptionSnippet,
        },
      ];

      if (coverBase64) {
        resources.push({
          name: username,
          service: 'THUMBNAIL',
          data64: coverBase64,
          identifier,
        });
      }

      await qortalRequest({
        action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
        resources,
      });

      toast.success(`Published ${trimmedTitle}`, { id: toastId });
      window.dispatchEvent(new CustomEvent('playlists:refresh'));
      setPrimaryFile(null);
      setCoverFile(null);
      setBaseValues((prev) => ({
        ...prev,
        primaryFileName: '',
        coverFileName: '',
        coverPreview: null,
      }));
      if (primaryFileInputRef.current) {
        primaryFileInputRef.current.value = '';
      }
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = '';
      }
      modal.close();
    } catch (error: any) {
      console.error('Failed to publish playlist', error);
      const message =
        typeof error?.message === 'string' ? error.message : 'Failed to publish playlist.';
      toast.error(message, { id: toastId });
    } finally {
      setIsPlaylistPublishing(false);
    }
  };

  const handlePublishClick = async () => {
    if (isMultiPublish) {
      handleMultiPublish();
      return;
    }

    if (selectedType === 'video') {
      await handleSingleVideoPublish();
      return;
    }

    if (selectedType === 'playlist') {
      await handleSinglePlaylistPublish();
      return;
    }

    if (!SINGLE_ENTRY_SUPPORTED_TYPES.includes(selectedType as MultiEntryType)) {
      toast('Publishing for this type is not available yet.');
      return;
    }

    const creatorName = baseValues.creatorName.trim();
    if (!creatorName) {
      toast.error('Add the artist / author info before publishing.');
      return;
    }

    if (!primaryFile) {
      toast.error('Select a primary file to publish.');
      return;
    }

    const trimmedTitle = baseValues.title.trim();
    const resolvedTitle = trimmedTitle || formatTitleFromFilename(primaryFile.name);
    if (!resolvedTitle) {
      toast.error('Add a title before publishing.');
      return;
    }

    const categoryValue = (currentTypeValues?.category ?? '').trim();
    if (!categoryValue) {
      toast.error('Choose a category to continue.');
      return;
    }

    const singlePlaylistTargets = buildPlaylistTargets(singlePlaylistSelection, singleNewPlaylist);

    const payload: MultiPublishPayload = {
      id: `${selectedType}-${Date.now()}`,
      type: selectedType as MultiEntryType,
      file: primaryFile,
      fileName: primaryFile.name,
      fileSize: primaryFile.size,
      title: resolvedTitle,
      category: categoryValue,
      notes: baseValues.description.trim(),
      author: creatorName,
      tags,
      visibility: baseValues.visibility,
      releaseDate: baseValues.releaseDate || undefined,
      collectionTitle: baseValues.title || undefined,
      collectionDescription: baseValues.description || undefined,
      supportPrice: baseValues.price || undefined,
    };
    if (singlePlaylistTargets.length > 0) {
      payload.playlistTargets = clonePlaylistTargets(singlePlaylistTargets);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('multi-publish:queue', {
          detail: {
            entries: [payload],
          },
        }),
      );
    }

    toast.success(`Queued ${resolvedTitle} for publishing.`);
    setPrimaryFile(null);
    setBaseValues((prev) => ({
      ...prev,
      primaryFileName: '',
    }));
    if (primaryFileInputRef.current) {
      primaryFileInputRef.current.value = '';
    }
    modal.close();
  };

  const renderField = (field: SectionField) => {
    const value = currentTypeValues[field.name] ?? '';

    if (field.variant === 'textarea') {
      return (
        <Textarea
          rows={3}
          placeholder={field.placeholder}
          value={value}
          onChange={(event) => handleTypeFieldChange(field.name, event.target.value)}
        />
      );
    }

    if (field.variant === 'select') {
      return (
        <select
          className="
            flex 
            w-full 
            rounded-md 
            bg-sky-950/70
            border
            border-sky-900/60
            px-3 
            py-3 
            text-sm 
            text-white
            placeholder:text-sky-200/60 
            focus:outline-none
            "
          value={value}
          onChange={(event) => handleTypeFieldChange(field.name, event.target.value)}
        >
          <option value="">Select</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <Input
        type={field.variant === 'number' ? 'number' : 'text'}
        placeholder={field.placeholder}
        value={value}
        onChange={(event) => handleTypeFieldChange(field.name, event.target.value)}
      />
    );
  };

  const summaryDate = baseValues.releaseDate
    ? new Date(baseValues.releaseDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'No release date yet';

  const summaryTitle = baseValues.title.trim().length > 0 ? baseValues.title : 'Untitled submission';
  const summaryDescription =
    baseValues.description.trim().length > 0 ? baseValues.description : 'Add a short description to give listeners context.';

  return (
    <Modal
      isOpen={modal.isOpen}
      onChange={(open) => {
        if (!open) {
          modal.close();
        }
      }}
      title="Publish any audio or video asset"
      description="Pick a type, fill in the key details, then tailor the type-specific fields."
      contentClassName="w-full max-w-[95vw] md:w-full md:max-w-none lg:max-w-[1100px] xl:max-w-[1200px] p-4 md:p-8"
    >
      <div className="flex flex-col gap-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,_3fr)_minmax(0,_2fr)]">
          <div className="flex flex-col gap-6">
            <section className="rounded-2xl border border-sky-900/70 bg-sky-950/40 p-4 md:p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-sky-200/80 font-semibold mb-3">
                1. Choose what to publish
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {PUBLISH_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isActive = option.id === selectedType;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedType(option.id)}
                      className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition focus:outline-none ${
                        isActive
                          ? 'border-cyan-300/80 bg-sky-900/60 shadow-[0_0_20px_rgba(14,165,233,0.35)]'
                          : 'border-sky-900/70 bg-sky-950/40 hover:border-sky-400/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-base font-semibold text-white">
                          <Icon className="text-cyan-300" />
                          {option.label}
                        </div>
                        {isActive && (
                          <span className="text-[11px] uppercase tracking-widest text-cyan-200">
                            selected
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-sky-200/80">{option.tagline}</p>
                    </button>
                  );
                })}
              </div>
            </section>
            {isMultiPublish ? (
              <>
                <section className="rounded-2xl border border-sky-900/70 bg-sky-950/40 p-4 md:p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-sky-200/80 font-semibold mb-3">
                    2. Upload your folder
                  </p>
                  <div className="flex flex-col gap-4">
                    <div className="rounded-2xl border border-dashed border-sky-800 bg-sky-900/40 p-5 text-center">
                      <p className="text-sm font-semibold text-white">Drop audio files or browse your device</p>
                      <p className="text-xs text-sky-200/80 mt-1">
                        Supports MP3, WAV, FLAC, AAC, OGG — perfect for songs, podcasts and audiobook chapters.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => multiFileInputRef.current?.click()}
                          className="rounded-full bg-sky-500/80 px-5 py-2 text-sm font-semibold text-sky-950 hover:bg-sky-400 transition"
                        >
                          Select files
                        </button>
                        {multiEntries.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearMultiEntries}
                            className="rounded-full border border-sky-500/60 px-5 py-2 text-sm text-sky-100 hover:bg-sky-900/60 transition"
                          >
                            Clear selection
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      ref={multiFileInputRef}
                      type="file"
                      className="hidden"
                      accept="audio/*"
                      multiple
                      onChange={handleMultiFileSelection}
                    />
                  </div>
                  {multiEntries.length > 0 && (
                    <div className="rounded-2xl border border-sky-900/70 bg-sky-950/30 p-4 flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <p className="text-xs uppercase tracking-[0.3em] text-sky-200/80">Bulk helpers</p>
                        <p className="text-sm text-sky-200/70">
                          Speed up catalog prep by applying shared settings or auto-filling missing titles.
                        </p>
                      </div>
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                        <button
                          type="button"
                          onClick={handleFillTitlesFromFilenames}
                          className="rounded-full border border-sky-500/60 px-4 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-900/60 transition"
                        >
                          Use filenames for empty titles
                        </button>
                        <select
                          className="rounded-md border border-sky-900/60 bg-sky-950/70 px-3 py-2 text-xs text-white focus:outline-none"
                          value={bulkTypeSelection}
                          onChange={(event) => {
                            const value = event.target.value as MultiEntryType | '';
                            setBulkTypeSelection(value);
                            if (!value) return;
                            handleSetAllTypes(value);
                            setBulkTypeSelection('');
                            toast.success(`Set type to ${value} for all entries`);
                          }}
                        >
                          <option value="">Set type for all entries</option>
                          {MULTI_ENTRY_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
                        <label className="flex flex-col gap-1 text-xs text-sky-100/80">
                          Target type
                          <select
                            className="rounded-md border border-sky-900/60 bg-sky-950/70 px-3 py-2 text-xs text-white focus:outline-none"
                            value={bulkCategoryType}
                            onChange={(event) => setBulkCategoryType(event.target.value as MultiEntryType)}
                          >
                            {MULTI_ENTRY_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-sky-100/80 flex-1">
                          Category to apply
                          <select
                            className="w-full rounded-md border border-sky-900/60 bg-sky-950/70 px-3 py-2 text-xs text-white focus:outline-none"
                            value={bulkCategoryValue}
                            onChange={(event) => setBulkCategoryValue(event.target.value)}
                          >
                            <option value="">Select a category</option>
                            {bulkCategoryOptions.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={handleApplyCategoryToType}
                          className="rounded-full bg-sky-500/80 px-4 py-2 text-xs font-semibold text-sky-950 hover:bg-sky-400 transition"
                        >
                          Apply to {bulkCategoryType} entries
                        </button>
                      </div>
                    </div>
                  )}
                  {multiEntries.length === 0 ? (
                    <p className="text-sm text-sky-200/80">
                      After picking files, each entry appears here so you can assign a content type, title and category
                      before publishing.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {multiEntries.map((entry, index) => {
                        const categoryOptions = MULTI_ENTRY_CATEGORY_MAP[entry.type];
                        return (
                          <div
                            key={entry.id}
                            className="rounded-2xl border border-sky-900/70 bg-sky-950/50 p-4 flex flex-col gap-4"
                          >
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-white">
                                  {index + 1}. {entry.fileName}
                                </p>
                                <p className="text-xs text-sky-200/70">{formatFileSize(entry.fileSize)}</p>
                                {entry.syncedFromTemplate && (
                                  <span className="mt-1 inline-flex rounded-full border border-cyan-400/50 bg-cyan-400/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-cyan-100">
                                    Synced from template
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleApplyTemplateToOthers(entry.id)}
                                  className="text-xs text-cyan-200 hover:text-cyan-100 transition"
                                >
                                  Apply to others
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMultiEntry(entry.id)}
                                  className="text-xs text-sky-200/70 hover:text-rose-300 transition"
                                >
                                  Remove entry
                                </button>
                              </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="flex flex-col gap-2 text-sm text-sky-100/80">
                                Content type
                                <select
                                  className="rounded-md border border-sky-900/60 bg-sky-950/70 px-3 py-3 text-sm text-white focus:outline-none"
                                  value={entry.type}
                                  onChange={(event) =>
                                    handleMultiEntryTypeChange(entry.id, event.target.value as MultiEntryType)
                                  }
                                >
                                  {MULTI_ENTRY_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>
                                      {type.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="flex flex-col gap-2 text-sm text-sky-100/80">
                                Title
                                <Input
                                  placeholder="Give this entry a title"
                                  value={entry.title}
                                  onChange={(event) => handleMultiEntryChange(entry.id, 'title', event.target.value)}
                                />
                              </label>
                              <label className="flex flex-col gap-2 text-sm text-sky-100/80">
                                Category
                                <select
                                  className="rounded-md border border-sky-900/60 bg-sky-950/70 px-3 py-3 text-sm text-white focus:outline-none"
                                  value={entry.category}
                                  onChange={(event) => handleMultiEntryChange(entry.id, 'category', event.target.value)}
                                >
                                  <option value="">Select a category</option>
                                  {categoryOptions.map((category) => (
                                    <option key={category} value={category}>
                                      {category}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="md:col-span-2 flex flex-col gap-2 text-sm text-sky-100/80">
                                Notes (optional)
                                <Textarea
                                  rows={2}
                                  placeholder="Add featured guests, season info or a quick reminder"
                                  value={entry.notes}
                                  onChange={(event) => handleMultiEntryChange(entry.id, 'notes', event.target.value)}
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
                <section className="rounded-2xl border border-sky-900/70 bg-sky-950/40 p-4 md:p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-sky-200/80 font-semibold mb-3">
                    Playlists for this folder
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-semibold text-white">Add every entry to existing playlists</p>
                      <select
                        className="rounded-md border border-sky-900/60 bg-sky-950/70 px-3 py-2 text-sm text-white focus:outline-none"
                        value=""
                        onChange={(event) => handleMultiPlaylistAdd(event.target.value)}
                      >
                        <option value="">Select a playlist</option>
                        {availablePlaylists.map((playlist) => (
                          <option key={playlist.id} value={playlist.id}>
                            {playlist.title || 'Untitled playlist'}
                          </option>
                        ))}
                      </select>
                      {multiPlaylistSelection.length === 0 ? (
                        <p className="text-xs text-sky-200/70">No target playlists selected.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {multiPlaylistSelection.map((id) => {
                            const playlist = availablePlaylists.find((item) => item.id === id);
                            if (!playlist) return null;
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => handleMultiPlaylistRemove(id)}
                                className="group flex items-center gap-2 rounded-full border border-sky-800/80 bg-sky-900/40 px-3 py-1 text-xs text-sky-100 hover:border-sky-500/80"
                              >
                                <span>{playlist.title || 'Untitled playlist'}</span>
                                <span className="text-sky-400/80 group-hover:text-sky-200">×</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-3">
                      <label className="flex items-center gap-2 text-sm text-sky-100/80">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-sky-700 bg-sky-950 text-sky-500 focus:ring-sky-500"
                          checked={multiNewPlaylist.enabled}
                          onChange={(event) =>
                            setMultiNewPlaylist((prev) => ({ ...prev, enabled: event.target.checked }))
                          }
                        />
                        Create a new playlist from these entries
                      </label>
                      {multiNewPlaylist.enabled ? (
                        <>
                          <Input
                            placeholder="Playlist title"
                            value={multiNewPlaylist.title}
                            onChange={(event) =>
                              setMultiNewPlaylist((prev) => ({ ...prev, title: event.target.value }))
                            }
                          />
                          <Textarea
                            rows={3}
                            placeholder="Short description or curator notes"
                            value={multiNewPlaylist.description}
                            onChange={(event) =>
                              setMultiNewPlaylist((prev) => ({
                                ...prev,
                                description: event.target.value,
                              }))
                            }
                          />
                        </>
                      ) : (
                        <p className="text-xs text-sky-200/70">
                          Toggle on to generate a playlist from this folder once all entries finish publishing.
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-sky-200/60 mt-3">
                    Playlist actions apply to every entry in this folder.
                  </p>
                </section>
              </>
            ) : (
              <>
                <section className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-sky-900/70 bg-sky-950/40 p-4 md:p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-sky-200/80 font-semibold mb-3">
                      2. Core details
                    </p>
                    <div className="flex flex-col gap-3">
                      <label className="flex flex-col gap-2 text-sm text-sky-100/80">
                        Title
                        <Input
                          placeholder="Content name"
                          value={baseValues.title}
                          onChange={handleBaseValueChange('title')}
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm text-sky-100/80">
                        Artist / Band / Author / Performer / Narrator
                        <Input
                          placeholder="e.g. Analog Voyage Collective"
                          value={baseValues.creatorName}
                          onChange={handleBaseValueChange('creatorName')}
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm text-sky-100/80">
                        Description
                        <Textarea
                          rows={4}
                          placeholder="Share a short elevator pitch"
                          value={baseValues.description}
                          onChange={handleBaseValueChange('description')}
                        />
                      </label>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-2 text-sm text-sky-100/80">
                          Tags
                          <Input
                            placeholder="synthwave, chill, live"
                            value={baseValues.tags}
                            onChange={handleBaseValueChange('tags')}
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm text-sky-100/80">
                          Release date
                          <Input
                            type="date"
                            value={baseValues.releaseDate}
                            onChange={handleBaseValueChange('releaseDate')}
                          />
                        </label>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-2 text-sm text-sky-100/80">
                          Visibility
                          <select
                            className="
                              flex 
                              w-full 
                              rounded-md 
                              bg-sky-950/70
                              border
                              border-sky-900/60
                              px-3 
                              py-3 
                              text-sm 
                              text-white
                              focus:outline-none
                            "
                            value={baseValues.visibility}
                            onChange={(event) =>
                              setBaseValues((prev) => ({
                                ...prev,
                                visibility: event.target.value as BaseValues['visibility'],
                              }))
                            }
                          >
                            <option value="public">Public</option>
                            <option value="draft">Draft</option>
                            <option value="limited">Link-only</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-2 text-sm text-sky-100/80">
                          (Optional) Support price
                          <Input
                            placeholder="e.g. 5 QORT"
                            value={baseValues.price}
                            onChange={handleBaseValueChange('price')}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {showPlaylistShortcuts && (
                    <div className="rounded-2xl border border-sky-900/70 bg-sky-950/40 p-4 md:p-5">
                      <p className="text-xs uppercase tracking-[0.2em] text-sky-200/80 font-semibold mb-3">
                        3. Playlists & collections
                      </p>
                      <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <p className="text-sm font-semibold text-white">Attach to existing playlists</p>
                        <select
                          className="rounded-md border border-sky-900/60 bg-sky-950/70 px-3 py-2 text-sm text-white focus:outline-none"
                          value=""
                          onChange={(event) => handleSinglePlaylistAdd(event.target.value)}
                        >
                          <option value="">Select a playlist</option>
                          {availablePlaylists.map((playlist) => (
                            <option key={playlist.id} value={playlist.id}>
                              {playlist.title || 'Untitled playlist'}
                            </option>
                          ))}
                        </select>
                        {singlePlaylistSelection.length === 0 ? (
                          <p className="text-xs text-sky-200/70">No playlists selected yet.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {singlePlaylistSelection.map((id) => {
                              const playlist = availablePlaylists.find((item) => item.id === id);
                              if (!playlist) return null;
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => handleSinglePlaylistRemove(id)}
                                  className="group flex items-center gap-2 rounded-full border border-sky-800/80 bg-sky-900/40 px-3 py-1 text-xs text-sky-100 hover:border-sky-500/80"
                                >
                                  <span>{playlist.title || 'Untitled playlist'}</span>
                                  <span className="text-sky-400/80 group-hover:text-sky-200">×</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-3">
                        <label className="flex items-center gap-2 text-sm text-sky-100/80">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-sky-700 bg-sky-950 text-sky-500 focus:ring-sky-500"
                            checked={singleNewPlaylist.enabled}
                            onChange={(event) =>
                              setSingleNewPlaylist((prev) => ({ ...prev, enabled: event.target.checked }))
                            }
                          />
                          Create a new playlist once this publishes
                        </label>
                        {singleNewPlaylist.enabled ? (
                          <>
                            <Input
                              placeholder="Playlist title"
                              value={singleNewPlaylist.title}
                              onChange={(event) =>
                                setSingleNewPlaylist((prev) => ({ ...prev, title: event.target.value }))
                              }
                            />
                            <Textarea
                              rows={3}
                              placeholder="Short description or curator notes"
                              value={singleNewPlaylist.description}
                              onChange={(event) =>
                                setSingleNewPlaylist((prev) => ({
                                  ...prev,
                                  description: event.target.value,
                                }))
                              }
                            />
                          </>
                        ) : (
                          <p className="text-xs text-sky-200/70">
                            Enable the toggle to spin up a brand new playlist automatically.
                          </p>
                        )}
                      </div>
                      </div>
                      <p className="text-[11px] text-sky-200/60 mt-3">
                        We will queue playlist updates as soon as the publish finishes.
                      </p>
                    </div>
                  )}

                  <div className="rounded-2xl border border-sky-900/70 bg-sky-950/40 p-4 md:p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-sky-200/80 font-semibold mb-3">
                      {showPlaylistShortcuts ? '4. Files & artwork' : '3. Files & artwork'}
                    </p>
                    <div className="flex flex-col gap-4">
                      <label className="flex flex-col gap-2 text-sm text-sky-100/80">
                        Primary file ({currentOption.label.toLowerCase()})
                        <div className="rounded-xl border border-dashed border-sky-800 bg-sky-900/40 p-4">
                          <div className="mb-2 text-xs uppercase tracking-widest text-sky-200/60">
                            Drag & drop or pick a file
                          </div>
                          <p className="text-sm text-white">{baseValues.primaryFileName || 'No file selected yet'}</p>
                          <p className="text-xs text-sky-200/70 mt-1">Supports: {FILE_HINTS[selectedType]}</p>
                          <input
                            ref={primaryFileInputRef}
                            type="file"
                            className="mt-3 text-xs"
                            accept={FILE_ACCEPT_MAP[selectedType]}
                            onChange={handleFileChange('primary')}
                          />
                        </div>
                      </label>
                      <label className="flex flex-col gap-2 text-sm text-sky-100/80">
                        Cover image / artwork
                        <div className="rounded-xl border border-dashed border-sky-800 bg-sky-900/40 p-4">
                          <p className="text-sm text-white">{baseValues.coverFileName || 'Choose an image (JPG, PNG, WEBP)'}</p>
                          <p className="text-xs text-sky-200/70 mt-1">Minimum height 800px, keep the contrast strong.</p>
                          <input
                            ref={coverFileInputRef}
                            type="file"
                            className="mt-3 text-xs"
                            accept="image/*"
                            onChange={handleFileChange('cover')}
                          />
                        </div>
                      </label>
                    </div>
                  </div>
                </section>

                <section className="flex flex-col gap-4">
                  {TYPE_SECTIONS[selectedType].map((section) => (
                    <details
                      key={section.id}
                      open={sectionState[section.id]}
                      onToggle={(event) =>
                        setSectionState((prev) => ({
                          ...prev,
                          [section.id]: event.currentTarget.open,
                        }))
                      }
                      className="rounded-2xl border border-sky-900/70 bg-sky-950/40"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left">
                        <div>
                          <p className="text-sm font-semibold text-white">{section.title}</p>
                          <p className="text-xs text-sky-200/80">{section.description}</p>
                        </div>
                        <HiOutlineSparkles className="text-cyan-300" />
                      </summary>
                      <div className="flex flex-col gap-4 border-t border-sky-900/60 px-5 py-4">
                        {section.fields.map((field) => (
                          <label key={field.name} className="flex flex-col gap-2 text-sm text-sky-100/80">
                            <span>{field.label}</span>
                            {renderField(field)}
                            {field.helper && (
                              <span className="text-[11px] text-sky-200/60">{field.helper}</span>
                            )}
                          </label>
                        ))}
                      </div>
                    </details>
                  ))}
                </section>
              </>
            )}
          </div>

          <aside className="rounded-3xl border border-sky-900/60 bg-sky-950/50 p-5 shadow-[0_0_35px_rgba(14,165,233,0.15)]">
            {isMultiPublish ? (
              <div className="space-y-4">
                <div className={`rounded-2xl bg-gradient-to-br ${currentOption.accent} p-4 text-sky-50`}>
                  <p className="text-xs uppercase tracking-[0.3em] mb-1">Bulk preview</p>
                  <p className="text-lg font-semibold">Folder / multi-file</p>
                  <p className="text-sm text-sky-50/80">
                    Drop a collection, then fine-tune each entry before pushing to QDN.
                  </p>
                </div>
                <div className="rounded-2xl border border-sky-900/70 bg-sky-950/60 p-4 space-y-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-sky-200/60">Selection</p>
                  <p className="text-2xl font-bold text-white">{multiCounts.total} files</p>
                  <div className="text-xs text-sky-200/80">
                    <p>Audio tracks: {multiCounts.audio}</p>
                    <p>Podcast episodes: {multiCounts.podcast}</p>
                    <p>Audiobook chapters: {multiCounts.audiobook}</p>
                  </div>
                  {multiEntries.length === 0 && (
                    <p className="text-xs text-sky-200/70">
                      No files selected yet. Once you choose a folder, entries will appear here.
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-sky-900/70 bg-sky-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-sky-200/60 mb-2">Entries in focus</p>
                  {multiEntries.length === 0 ? (
                    <p className="text-xs text-sky-200/70">
                      Use the selector on the left to add multiple audio files and tag them quickly.
                    </p>
                  ) : (
                    <ul className="space-y-2 text-sm text-sky-100">
                      {multiEntries.slice(0, 4).map((entry) => (
                        <li key={entry.id} className="flex items-start justify-between gap-3 rounded-xl border border-sky-900/60 bg-sky-950/40 px-3 py-2">
                          <div>
                            <p className="font-semibold">{entry.title || entry.fileName}</p>
                            <p className="text-xs text-sky-200/70">{formatFileSize(entry.fileSize)}</p>
                          </div>
                          <span className="text-[11px] uppercase tracking-widest text-cyan-200">
                            {entry.type}
                          </span>
                        </li>
                      ))}
                      {multiEntries.length > 4 && (
                        <li className="text-xs text-sky-200/70">
                          +{multiEntries.length - 4} more entries queued
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div
                  className={`rounded-2xl bg-gradient-to-br ${currentOption.accent} p-4 text-sky-50 mb-4`}
                >
                  <p className="text-xs uppercase tracking-[0.3em] mb-1">Live preview</p>
                  <p className="text-lg font-semibold">{currentOption.label}</p>
                  <p className="text-sm text-sky-50/80">{currentOption.previewCopy}</p>
                </div>
                <div className="space-y-4">
                  <div className="rounded-2xl border border-sky-900/70 bg-sky-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-sky-200/60 mb-2">Cover preview</p>
                    <div className="h-40 w-full overflow-hidden rounded-xl border border-sky-900/70 bg-sky-900/40 flex items-center justify-center">
                      {baseValues.coverPreview ? (
                        <img
                          src={baseValues.coverPreview}
                          alt="Cover preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <p className="text-xs text-sky-200/70 text-center px-6">
                          Add an image to see how it will appear on the listing.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-sky-900/70 bg-sky-950/60 p-4 space-y-2">
                    <p className="text-sm font-semibold text-white">{summaryTitle}</p>
                    <p className="text-xs text-sky-200/70">{summaryDescription}</p>
                    <div className="text-xs text-sky-200/80">
                      <p>
                        {baseValues.creatorName
                          ? `By ${baseValues.creatorName}`
                          : 'Artist / author not set yet'}
                      </p>
                      <p>{summaryDate}</p>
                      <p>{VISIBILITY_LABELS[baseValues.visibility]}</p>
                      {baseValues.price && <p>Support: {baseValues.price}</p>}
                    </div>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-cyan-400/60 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-sky-900/70 bg-sky-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-sky-200/60 mb-2">File</p>
                    <p className="text-sm text-white">
                      {baseValues.primaryFileName || 'No file selected'}
                    </p>
                    <p className="text-xs text-sky-200/70 mt-1">
                      Type: {currentOption.label} ({selectedType})
                    </p>
                  </div>

                  <div className="rounded-2xl border border-sky-900/70 bg-sky-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-sky-200/60 mb-2">
                      Type-specific focus
                    </p>
                    {highlightEntries.length > 0 ? (
                      <ul className="space-y-1 text-sm text-sky-100">
                        {highlightEntries.map(([key, value]) => (
                          <li key={key} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                            <span className="capitalize">{value}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-sky-200/70">
                        Fill at least one field to provide more context for your audience.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:justify-end">
          <Button
            className="w-full md:w-auto rounded-full bg-gradient-to-r from-sky-400 to-cyan-300 px-8 py-3 font-semibold text-sky-950 hover:opacity-90"
            onClick={handlePublishClick}
          >
            Publish to QDN
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default PublishContentModal;
