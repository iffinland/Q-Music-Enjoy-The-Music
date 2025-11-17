import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { HiOutlineSparkles } from 'react-icons/hi';
import { toast } from 'react-hot-toast';
import { useSelector } from 'react-redux';

import Modal from './Modal';
import Input from './Input';
import Textarea from './TextArea';
import Button from './Button';
import usePublishContentModal from '../hooks/usePublishContentModal';
import { PublishType, MultiEntryType, MultiPublishPayload, PlaylistTarget } from '../types/publish';
import { objectToBase64, toBase64 } from '../utils/toBase64';
import { RootState } from '../state/store';
import { PlayList } from '../state/features/globalSlice';
import {
  BaseValues,
  FieldVariant,
  PUBLISH_OPTIONS,
  SectionField,
  TYPE_SECTIONS,
  TypeSection,
} from '../features/publish/state/baseState';
import { usePublishFormState } from '../features/publish/state/usePublishFormState';
import { enqueueMultiPublishEntries } from '../services/multiPublishQueue';
import { MultiEntry, SharedCoverState } from '../features/publish/types';
import { MULTI_ENTRY_CATEGORY_MAP, MULTI_ENTRY_TYPES } from '../features/publish/multi/constants';
import {
  formatFileSize,
  formatTitleFromFilename,
  parseFilenameForMetadata,
} from '../features/publish/multi/utils';
import MultiPublishSection from '../features/publish/multi/MultiPublishSection';
import SinglePublishForm from '../features/publish/single/SinglePublishForm';

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
  limited: 'Link-only access',
};


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
  const {
    baseValues,
    typeValues,
    setBaseValue,
    setTypeValue,
    reset: resetPublishForm,
  } = usePublishFormState();
  const [sectionState, setSectionState] = useState<Record<string, boolean>>({});
  const [multiEntries, setMultiEntries] = useState<MultiEntry[]>([]);
  const multiFileInputRef = useRef<HTMLInputElement | null>(null);
  const primaryFileInputRef = useRef<HTMLInputElement | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const sharedCoverInputRef = useRef<HTMLInputElement | null>(null);
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
  const [multiSharedCover, setMultiSharedCover] = useState<SharedCoverState>({
    file: null,
    fileName: '',
    preview: null,
  });

  const currentOption = useMemo(
    () => PUBLISH_OPTIONS.find((option) => option.id === selectedType) ?? PUBLISH_OPTIONS[0],
    [selectedType],
  );
  const availablePlaylists = useMemo<PlayList[]>(() => myPlaylists ?? [], [myPlaylists]);

  useEffect(() => {
    setMultiEntries((prev) => {
      const hasLinked = prev.some((entry) => entry.usesSharedCover);
      if (!hasLinked) return prev;
      return prev.map((entry) => {
        if (!entry.usesSharedCover) return entry;
        if (!multiSharedCover.file) {
          return {
            ...entry,
            coverFile: null,
            coverFileName: '',
            coverPreview: null,
            usesSharedCover: false,
          };
        }
        return {
          ...entry,
          coverFile: multiSharedCover.file,
          coverFileName: multiSharedCover.fileName,
          coverPreview: multiSharedCover.preview,
        };
      });
    });
  }, [multiSharedCover]);

  const currentTypeValues = typeValues[selectedType] ?? {};
  const isMultiPublish = selectedType === 'multi';
  const showPlaylistShortcuts = !isMultiPublish && selectedType !== 'playlist';

  const resetState = () => {
    resetPublishForm();
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
    setSelectedType(modal.preferredType || 'audio');
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
    setBaseValue(field, event.target.value);
  };

  const handleTypeFieldChange = (field: string, value: string) => {
    setTypeValue(selectedType, field, value);
  };

  const handleFileChange = (target: 'primary' | 'cover') => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      if (target === 'primary') {
        setBaseValue('primaryFileName', '');
        setPrimaryFile(null);
      } else {
        setBaseValue('coverFileName', '');
        setBaseValue('coverPreview', null);
        setCoverFile(null);
      }
      return;
    }

    if (target === 'primary') {
      setPrimaryFile(file);
      setBaseValue('primaryFileName', file.name);
    } else {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBaseValue('coverFileName', file.name);
        setBaseValue('coverPreview', typeof reader.result === 'string' ? reader.result : null);
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
    const hasSharedCover = Boolean(multiSharedCover.file);
    const newEntries = Array.from(files).map((file, index) => ({
      id: `${file.name}-${file.size}-${timestamp}-${index}`,
      file,
      fileName: file.name,
      fileSize: file.size,
      type: 'audio' as MultiEntryType,
      title: '',
      performer: '',
      category: '',
      notes: '',
      coverFile: hasSharedCover ? multiSharedCover.file : null,
      coverFileName: hasSharedCover ? multiSharedCover.fileName : '',
      coverPreview: hasSharedCover ? multiSharedCover.preview : null,
      usesSharedCover: hasSharedCover,
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
    field: 'title' | 'performer' | 'category' | 'notes',
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
    setMultiSharedCover({ file: null, fileName: '', preview: null });
    if (multiFileInputRef.current) {
      multiFileInputRef.current.value = '';
    }
    if (sharedCoverInputRef.current) {
      sharedCoverInputRef.current.value = '';
    }
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
    let titleUpdates = 0;
    let performerUpdates = 0;
    setMultiEntries((prev) =>
      prev.map((entry) => {
        const trimmedTitle = entry.title.trim();
        const trimmedPerformer = entry.performer.trim();
        if (trimmedTitle && trimmedPerformer) {
          return entry;
        }
        const metadata = parseFilenameForMetadata(entry.fileName);
        let nextEntry = entry;
        let changed = false;
        if (!trimmedTitle && metadata.title) {
          nextEntry = { ...nextEntry, title: metadata.title };
          titleUpdates += 1;
          changed = true;
        }
        if (!trimmedPerformer && metadata.performer) {
          nextEntry = nextEntry === entry ? { ...nextEntry } : nextEntry;
          nextEntry.performer = metadata.performer;
          performerUpdates += 1;
          changed = true;
        }
        if (changed) {
          return { ...nextEntry, syncedFromTemplate: false };
        }
        return entry;
      }),
    );
    if (titleUpdates || performerUpdates) {
      const summaryParts: string[] = [];
      if (titleUpdates) summaryParts.push(`${titleUpdates} title${titleUpdates === 1 ? '' : 's'}`);
      if (performerUpdates) summaryParts.push(`${performerUpdates} performer${performerUpdates === 1 ? '' : 's'}`);
      toast.success(`Filled ${summaryParts.join(' and ')} from filenames`);
    } else {
      toast.success('All titles and performer fields already have values.');
    }
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

  const handleBulkTypeSelectionChange = (value: MultiEntryType | '') => {
    setBulkTypeSelection(value);
    if (!value) return;
    handleSetAllTypes(value);
    setBulkTypeSelection('');
    toast.success(`Set type to ${value} for all entries`);
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

  const handleFillPerformersFromCreator = () => {
    const creatorName = baseValues.creatorName.trim();
    if (!creatorName) {
      toast.error('Add the artist / author info before using this shortcut.');
      return;
    }
    let updated = 0;
    setMultiEntries((prev) =>
      prev.map((entry) => {
        if (entry.performer.trim().length > 0) {
          return entry;
        }
        updated += 1;
        return { ...entry, performer: creatorName, syncedFromTemplate: false };
      }),
    );
    if (updated > 0) {
      toast.success(`Filled performer info for ${updated} entr${updated === 1 ? 'y' : 'ies'}`);
    } else {
      toast.success('All performer fields already have values.');
    }
  };

  const handleSharedCoverSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const result = await toBase64(file);
    const preview = typeof result === 'string' ? result : null;
    setMultiSharedCover({
      file,
      fileName: file.name,
      preview,
    });
    event.target.value = '';
  };

  const handleClearSharedCover = () => {
    setMultiSharedCover({ file: null, fileName: '', preview: null });
    if (sharedCoverInputRef.current) {
      sharedCoverInputRef.current.value = '';
    }
  };

  const handleApplySharedCoverToAll = () => {
    if (!multiSharedCover.file) {
      toast.error('Upload a shared cover first.');
      return;
    }
    setMultiEntries((prev) =>
      prev.map((entry) => ({
        ...entry,
        coverFile: multiSharedCover.file,
        coverFileName: multiSharedCover.fileName,
        coverPreview: multiSharedCover.preview,
        usesSharedCover: true,
        syncedFromTemplate: false,
      })),
    );
    toast.success('Applied shared cover to every entry');
  };

  const handleApplySharedCoverToEntry = (entryId: string) => {
    if (!multiSharedCover.file) {
      toast.error('Upload a shared cover first.');
      return;
    }
    setMultiEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              coverFile: multiSharedCover.file,
              coverFileName: multiSharedCover.fileName,
              coverPreview: multiSharedCover.preview,
              usesSharedCover: true,
              syncedFromTemplate: false,
            }
          : entry,
      ),
    );
  };

  const handleMultiEntryCoverChange =
    (entryId: string) => async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const result = await toBase64(file);
      const preview = typeof result === 'string' ? result : null;
      setMultiEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                coverFile: file,
                coverFileName: file.name,
                coverPreview: preview,
                usesSharedCover: false,
                syncedFromTemplate: false,
              }
            : entry,
        ),
      );
      event.target.value = '';
    };

  const handleClearEntryCover = (entryId: string) => {
    setMultiEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              coverFile: null,
              coverFileName: '',
              coverPreview: null,
              usesSharedCover: false,
              syncedFromTemplate: false,
            }
          : entry,
      ),
    );
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
          performer: template.performer,
          notes: template.notes,
          coverFile: template.coverFile,
          coverFileName: template.coverFileName,
          coverPreview: template.coverPreview,
          usesSharedCover: template.usesSharedCover,
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
      coverFile: entry.coverFile || undefined,
      title: entry.title.trim(),
      category: entry.category,
      notes: entry.notes.trim(),
      author: entry.performer.trim() || creatorName,
      tags,
      visibility: baseValues.visibility,
      releaseDate: baseValues.releaseDate || undefined,
      collectionTitle: baseValues.title || undefined,
      collectionDescription: baseValues.description || undefined,
      supportPrice: baseValues.price || undefined,
      playlistTargets:
        multiPlaylistTargetsConfig.length > 0 ? clonePlaylistTargets(multiPlaylistTargetsConfig) : undefined,
    }));

    enqueueMultiPublishEntries(payloads);
    toast.success(`Queued ${payloads.length} entries for publishing.`);
    setMultiEntries([]);
    setMultiSharedCover({ file: null, fileName: '', preview: null });
    if (multiFileInputRef.current) {
      multiFileInputRef.current.value = '';
    }
    if (sharedCoverInputRef.current) {
      sharedCoverInputRef.current.value = '';
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
      setBaseValue('primaryFileName', '');
      setBaseValue('coverFileName', '');
      setBaseValue('coverPreview', null);
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

    const playlistValues = typeValues.playlist || {};
    setIsPlaylistPublishing(true);
    const toastId = toast.loading('Publishing playlist…');
    try {
      const identifier = buildPlaylistIdentifier(trimmedTitle);
      const description = baseValues.description.trim();
      const descriptionSnippet = description.slice(0, 4000);
      let playlistData64: string | null = null;
      let playlistFilename = primaryFile?.name || `${identifier}.json`;
      if (primaryFile) {
        playlistData64 = await fileToData64(primaryFile);
        if (!playlistData64) {
          throw new Error('Failed to read the playlist file.');
        }
      } else {
        const fallbackPayload = {
          title: trimmedTitle,
          description,
          songs: [],
          image: null,
          metadata: playlistValues,
        };
        playlistData64 = await objectToBase64(fallbackPayload);
        playlistFilename = `${identifier}.json`;
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
          filename: playlistFilename,
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
      setBaseValue('primaryFileName', '');
      setBaseValue('coverFileName', '');
      setBaseValue('coverPreview', null);
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

    enqueueMultiPublishEntries([payload]);
    toast.success(`Queued ${resolvedTitle} for publishing.`);
    setPrimaryFile(null);
    setBaseValue('primaryFileName', '');
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
              <MultiPublishSection
                multiEntries={multiEntries}
                multiCounts={multiCounts}
                multiFileInputRef={multiFileInputRef}
                sharedCoverInputRef={sharedCoverInputRef}
                bulkTypeSelection={bulkTypeSelection}
                bulkCategoryType={bulkCategoryType}
                bulkCategoryValue={bulkCategoryValue}
                bulkCategoryOptions={bulkCategoryOptions}
                multiSharedCover={multiSharedCover}
                availablePlaylists={availablePlaylists}
                multiPlaylistSelection={multiPlaylistSelection}
                multiNewPlaylist={multiNewPlaylist}
                onFileSelection={handleMultiFileSelection}
                onClearEntries={handleClearMultiEntries}
                onFillTitlesFromFilenames={handleFillTitlesFromFilenames}
                onFillPerformersFromCreator={handleFillPerformersFromCreator}
                onBulkTypeSelectionChange={handleBulkTypeSelectionChange}
                onBulkCategoryTypeChange={(value) => setBulkCategoryType(value)}
                onBulkCategoryValueChange={(value) => setBulkCategoryValue(value)}
                onApplyCategoryToType={handleApplyCategoryToType}
                onSharedCoverSelection={handleSharedCoverSelection}
                onApplySharedCoverToAll={handleApplySharedCoverToAll}
                onClearSharedCover={handleClearSharedCover}
                onApplySharedCoverToEntry={handleApplySharedCoverToEntry}
                onEntryTypeChange={handleMultiEntryTypeChange}
                onEntryChange={handleMultiEntryChange}
                onEntryCoverChange={handleMultiEntryCoverChange}
                onClearEntryCover={handleClearEntryCover}
                onApplyTemplateToOthers={handleApplyTemplateToOthers}
                onRemoveEntry={handleRemoveMultiEntry}
                onPlaylistAdd={handleMultiPlaylistAdd}
                onPlaylistRemove={handleMultiPlaylistRemove}
                setMultiNewPlaylist={setMultiNewPlaylist}
              />

            ) : (
              <SinglePublishForm
                baseValues={baseValues}
                currentOption={currentOption}
                selectedType={selectedType}
                typeSections={TYPE_SECTIONS[selectedType]}
                sectionState={sectionState}
                setSectionState={setSectionState}
                handleBaseValueChange={handleBaseValueChange}
                setBaseValue={setBaseValue}
                handleSinglePlaylistAdd={handleSinglePlaylistAdd}
                handleSinglePlaylistRemove={handleSinglePlaylistRemove}
                singlePlaylistSelection={singlePlaylistSelection}
                availablePlaylists={availablePlaylists}
                singleNewPlaylist={singleNewPlaylist}
                setSingleNewPlaylist={setSingleNewPlaylist}
                primaryFileInputRef={primaryFileInputRef}
                coverFileInputRef={coverFileInputRef}
                handleFileChange={handleFileChange}
                showPlaylistShortcuts={showPlaylistShortcuts}
                renderField={renderField}
                fileAccept={FILE_ACCEPT_MAP[selectedType]}
                fileHint={FILE_HINTS[selectedType]}
              />

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
