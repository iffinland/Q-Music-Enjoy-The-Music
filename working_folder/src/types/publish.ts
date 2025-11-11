export type PublishType = 'audio' | 'podcast' | 'audiobook' | 'video' | 'playlist' | 'multi';

export type MultiEntryType = Extract<PublishType, 'audio' | 'podcast' | 'audiobook'>;

export interface MultiPublishPayload {
  id: string;
  type: MultiEntryType;
  file: File;
  fileName: string;
  fileSize: number;
  title: string;
  category: string;
  notes: string;
  author: string;
  tags: string[];
  visibility: 'public' | 'draft' | 'limited';
  releaseDate?: string;
  collectionTitle?: string;
  collectionDescription?: string;
  supportPrice?: string;
  playlistTargets?: PlaylistTarget[];
}

export type PlaylistTarget =
  | {
      type: 'existing';
      playlistId: string;
    }
  | {
      type: 'new';
      title: string;
      description?: string;
      sharedKey?: string;
    };
