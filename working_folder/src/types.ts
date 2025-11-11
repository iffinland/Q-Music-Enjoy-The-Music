import { Status } from "./state/features/globalSlice";

export interface Song {
  id: string;
  author?: string;
  title: string;
  name: string;
  service?: string;
  status?: Status
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
}

export type Audiobook = Podcast;

export interface Video {
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
  videoFilename?: string;
  videoMimeType?: string;
  durationSeconds?: number;
  author?: string;
  genre?: string;
  mood?: string;
  language?: string;
  notes?: string;
}
