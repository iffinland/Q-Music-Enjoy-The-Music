const TRACKING_PREFIXES = ['enjoymusic_', 'earbump_', 'qmusic_'];
const DELETED_MARKER = 'deleted';

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

const isTrackedIdentifier = (resource: any): boolean => {
  const identifier = normalize(resource?.identifier);
  if (!identifier) return false;
  return TRACKING_PREFIXES.some((prefix) => identifier.startsWith(prefix));
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

  if (!isTrackedIdentifier(resource)) return false;

  if (hasDeletedMarker(resource)) return true;

  if (isEmptyResource(resource)) return true;

  return false;
};
