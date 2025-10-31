import { Status } from "./state/features/globalSlice";

export interface Song {
  id: string;
  author: string;
  title: string;
  name: string;
  service: string;
  status?: Status
}

export interface Product {
  id: string;
  active?: boolean;
  name?: string;
  description?: string;
  image?: string;
}