const TRACKING_PREFIXES = ['enjoymusic_', 'qmusic_'];
const LIKE_ARTIFACT_PREFIXES = [
  'song_like_',
  'playlist_like_',
  'podcast_like_',
  'video_like_',
  'audiobook_like_',
  'enjoymusic_request_like_',
  'qm_discussion_like_',
];
const DELETED_MARKER = 'deleted';
const hiddenIdentifiers = new Set<string>();

const normalize = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

const hasDeletedMarker = (resource: any): boolean => {
  const candidates = [
    normalize(resource?.name),
    normalize(resource?.identifier),
    normalize(resource?.metadata?.title),
    normalize(resource?.metadata?.description),
  ];

  return candidates.some((candidate) => candidate === DELETED_MARKER);
};

const hasStringValue = (value: unknown): boolean => {
  const normalized = normalize(value);
  return normalized.length > 0 && normalized !== DELETED_MARKER;
};

const hasArrayContent = (value: unknown): boolean => Array.isArray(value) && value.length > 0;

const hasMeaningfulMetadata = (resource: any): boolean => {
  const metadata = resource?.metadata && typeof resource.metadata === 'object' ? resource.metadata : null;
  if (hasStringValue(metadata?.title) || hasStringValue(resource?.title)) return true;
  if (hasStringValue(metadata?.description) || hasStringValue(resource?.description)) return true;

  const metadataKeys = metadata ? Object.keys(metadata) : [];
  if (
    metadataKeys.some((key) => {
      if (key === 'title' || key === 'description') return false;
      const value = metadata?.[key];
      if (Array.isArray(value)) return value.length > 0;
      return hasStringValue(value);
    })
  ) {
    return true;
  }

  if (hasArrayContent(metadata?.tags) || hasArrayContent(resource?.tags)) return true;

  const extraFields: Array<'category' | 'categoryName' | 'image'> = ['category', 'categoryName', 'image'];
  if (
    extraFields.some((field) => hasStringValue(metadata?.[field]) || hasStringValue(resource?.[field]))
  ) {
    return true;
  }

  return false;
};

const isLikelyPlaceholderPayload = (resource: any): boolean => {
  const size = typeof resource?.size === 'number' ? resource.size : null;
  if (size === null) return false;
  // deleted placeholders are tiny (string "deleted" payload)
  if (size > 1024) return false;
  if (hasMeaningfulMetadata(resource)) return false;
  return true;
};

const getIdentifierKey = (resource: any): string => normalize(resource?.identifier);

const isTrackedIdentifier = (identifier: string): boolean => {
  if (!identifier) return false;
  return TRACKING_PREFIXES.some((prefix) => identifier.startsWith(prefix));
};

const isLikeArtifact = (identifier: string): boolean => {
  if (!identifier) return false;
  return LIKE_ARTIFACT_PREFIXES.some((prefix) => identifier.startsWith(prefix));
};

const isEmptyResource = (resource: any): boolean => {
  const metadataKeys = resource?.metadata ? Object.keys(resource.metadata) : [];
  const hasMetadata = metadataKeys.length > 0;
  const size = typeof resource?.size === 'number' ? resource.size : null;

  const hasZeroSize = size !== null && size <= 0;
  return !hasMetadata && hasZeroSize;
};

/**
 * Returns true when the QDN resource represents a deleted placeholder that should be hidden.
 */
export const shouldHideQdnResource = (resource: any): boolean => {
  if (!resource || typeof resource !== 'object') return false;

  const identifierKey = getIdentifierKey(resource);
  if (identifierKey && hiddenIdentifiers.has(identifierKey)) return true;

  if (identifierKey && isLikeArtifact(identifierKey)) {
    hiddenIdentifiers.add(identifierKey);
    return true;
  }

  if (!isTrackedIdentifier(identifierKey)) return false;

  if (hasDeletedMarker(resource)) {
    if (identifierKey) hiddenIdentifiers.add(identifierKey);
    return true;
  }

  if (isEmptyResource(resource)) {
    if (identifierKey) hiddenIdentifiers.add(identifierKey);
    return true;
  }

  if (isLikelyPlaceholderPayload(resource)) {
    if (identifierKey) hiddenIdentifiers.add(identifierKey);
    return true;
  }

  return false;
};
