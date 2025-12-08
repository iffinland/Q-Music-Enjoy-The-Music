import { Status } from "./state/features/globalSlice";

export interface Song {
  id: string;
  author?: string;
  title: string;
  name: string;
  service?: string;
  status?: Status
  mediaType?: 'SONG' | 'PODCAST' | 'AUDIOBOOK' | string;
}

export interface Product {
  id: string;
  active?: boolean;
  name?: string;
  description?: string;
  image?: string;
}

export interface Podcast {
  id: string;
  title: string;
  description?: string;
  created?: number;
  updated?: number;
  publisher: string;
  status?: Status;
  service: string;
  size?: number;
  type?: string;
  coverImage?: string;
  audioFilename?: string;
  audioMimeType?: string;
  category?: string;
  author?: string;
  mediaType?: 'PODCAST' | 'AUDIOBOOK' | string;
}

export type Audiobook = Podcast;
