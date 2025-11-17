import { PlayList } from '../state/features/globalSlice';

const normalizeString = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const resolveFromMetadata = (resource: any, key: 'title' | 'description' | 'image') => {
  const value = normalizeString(resource?.metadata?.[key]);
  return value;
};

const resolveFromRoot = (resource: any, key: 'title' | 'description' | 'image') => {
  const value = normalizeString(resource?.[key]);
  return value;
};

export const resolvePlaylistTitle = (resource: any, fallback = 'Untitled playlist'): string => {
  const fromMeta = resolveFromMetadata(resource, 'title');
  if (fromMeta) return fromMeta;
  const fromRoot = resolveFromRoot(resource, 'title');
  if (fromRoot) return fromRoot;
  return fallback;
};

export const resolvePlaylistDescription = (resource: any, fallback = ''): string => {
  const fromMeta = resolveFromMetadata(resource, 'description');
  if (fromMeta) return fromMeta;
  const fromRoot = resolveFromRoot(resource, 'description');
  if (fromRoot) return fromRoot;
  return fallback;
};

export const resolvePlaylistImage = (resource: any, fallback: string | null = null): string | null => {
  const fromMeta = resolveFromMetadata(resource, 'image');
  if (fromMeta) return fromMeta;
  const fromRoot = resolveFromRoot(resource, 'image');
  if (fromRoot) return fromRoot;
  return fallback;
};

export const resolvePlaylistCategory = (resource: any): string | undefined => {
  const fromMeta = normalizeString(resource?.metadata?.category);
  if (fromMeta) return fromMeta;
  const fromRoot = normalizeString(resource?.category);
  if (fromRoot) return fromRoot;
  return undefined;
};

export const resolvePlaylistCategoryName = (resource: any): string | undefined => {
  const fromMeta = normalizeString(resource?.metadata?.categoryName);
  if (fromMeta) return fromMeta;
  const fromRoot = normalizeString(resource?.categoryName);
  if (fromRoot) return fromRoot;
  return undefined;
};

export const resolvePlaylistTags = (resource: any): string[] => {
  if (Array.isArray(resource?.metadata?.tags)) {
    return resource.metadata.tags;
  }
  if (Array.isArray(resource?.tags)) {
    return resource.tags;
  }
  return [];
};

export const mapPlaylistSummary = (resource: any): PlayList => ({
  title: resolvePlaylistTitle(resource),
  category: resolvePlaylistCategory(resource),
  categoryName: resolvePlaylistCategoryName(resource),
  tags: resolvePlaylistTags(resource),
  description: resolvePlaylistDescription(resource),
  created: typeof resource?.created === 'number' ? resource.created : undefined,
  updated: typeof resource?.updated === 'number' ? resource.updated : undefined,
  user: resource?.name,
  image: resolvePlaylistImage(resource, null),
  songs: Array.isArray(resource?.songs) ? resource.songs : [],
  id: resource?.identifier,
});
