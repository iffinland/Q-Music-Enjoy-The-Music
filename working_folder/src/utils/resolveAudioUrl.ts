import { getQdnResourceUrl } from './qortalApi';

/**
 * Attempts to resolve an audio URL for a given publisher/identifier.
 * Tries AUDIO first, then DOCUMENT as a fallback. Returns the first working URL or null.
 */
export const resolveAudioUrl = async (publisher: string, identifier: string): Promise<string | null> => {
  if (!publisher || !identifier) return null;

  const services: Array<'AUDIO' | 'DOCUMENT'> = ['AUDIO', 'DOCUMENT'];

  for (const service of services) {
    try {
      const url = await getQdnResourceUrl(service, publisher, identifier);
      console.log('[resolveAudioUrl]', { service, publisher, identifier, urlFound: Boolean(url) });
      if (url) {
        return url;
      }
    } catch (error) {
      console.warn('[resolveAudioUrl] Failed to resolve', { service, publisher, identifier, error });
    }
  }

  console.warn('[resolveAudioUrl] No URL found', { publisher, identifier });
  return null;
};
