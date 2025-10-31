import { parseBlob } from 'music-metadata-browser';

export interface TrackMetadata {
  title: string;
  artist: string;
  album: string | null;
  trackNumber: number | null;
}

const removeExtension = (name: string): string => name.replace(/\.[^/.]+$/, '');

export const extractTrackMetadata = async (file: File): Promise<TrackMetadata> => {
  try {
    const metadata = await parseBlob(file);
    const title =
      metadata.common.title?.trim() ||
      removeExtension(file.name || 'untitled track');
    const artist =
      metadata.common.artist?.trim() ||
      metadata.common.albumartist?.trim() ||
      metadata.common.artists?.[0]?.trim() ||
      'Unknown artist';
    const trackNumber = metadata.common.track?.no ?? null;
    const album = metadata.common.album?.trim() ?? null;

    return {
      title,
      artist,
      trackNumber: typeof trackNumber === 'number' ? trackNumber : null,
      album,
    };
  } catch (error) {
    console.warn('Failed to parse track metadata', error);
    const fallbackTitle = removeExtension(file.name || 'untitled track');
    return {
      title: fallbackTitle,
      artist: 'Unknown artist',
      album: null,
      trackNumber: null,
    };
  }
};
