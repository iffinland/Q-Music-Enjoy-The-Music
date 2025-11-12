const LAST_READ_STORAGE_KEY = 'qmusic:discussions:lastReadAt';

export const readLastReadTimestamp = (): number => {
  if (typeof window === 'undefined') return 0;
  const rawValue = window.localStorage.getItem(LAST_READ_STORAGE_KEY);
  const parsed = rawValue ? Number(rawValue) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

export const persistLastReadTimestamp = (value: number) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LAST_READ_STORAGE_KEY, String(value));
};

export { LAST_READ_STORAGE_KEY };
