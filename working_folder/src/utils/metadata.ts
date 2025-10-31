export interface MetadataEntry {
  label: string;
  value: string;
}

const HUMAN_LABELS: Record<string, string> = {
  title: 'Title',
  author: 'Performer',
  genre: 'Genre',
  mood: 'Mood',
  language: 'Language',
  notes: 'Notes',
  category: 'Category',
};

/**
 * Parses semicolon-separated k=v metadata strings into a record.
 * Keys are stored in lowercase for easier lookups.
 */
export const parseKeyValueMetadata = (raw?: string | null): Record<string, string> => {
  if (!raw) return {};

  return raw.split(';').reduce<Record<string, string>>((acc, pair) => {
    const [key, value] = pair.split('=');
    if (!key || !value) return acc;
    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey) return acc;
    acc[normalizedKey] = value.trim();
    return acc;
  }, {});
};

/**
 * Builds a list of metadata entries using predefined human labels.
 * Unknown keys fall back to a capitalised label.
 */
export const buildMetadataEntries = (
  map: Record<string, string>,
  priorityKeys: string[],
): MetadataEntry[] => {
  const entries: MetadataEntry[] = [];

  for (const key of priorityKeys) {
    const value = map[key];
    if (!value) continue;

    const label = HUMAN_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
    entries.push({ label, value });
  }

  return entries;
};

export const formatDateTime = (timestamp?: number | null): string | null => {
  if (!timestamp) return null;

  try {
    return new Intl.DateTimeFormat('et-EE', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch (error) {
    return new Date(timestamp).toLocaleString();
  }
};
