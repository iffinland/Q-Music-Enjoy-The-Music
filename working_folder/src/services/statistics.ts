import { fetchRequestsFromQdn } from './qdnRequests';
import { shouldHideQdnResource } from '../utils/qdnResourceFilters';
import { SongRequest } from '../state/features/requestsSlice';
import { cachedSearchQdnResources } from './resourceCache';

type ResourceSummaryResult = {
  count: number;
  publishers: Set<string>;
};

type ResourcePrefixConfig = {
  key: string;
  service: 'AUDIO' | 'PLAYLIST' | 'DOCUMENT';
};

const TRACKED_AUDIO_SERIES_PREFIXES = ['enjoymusic'];

const RESOURCE_PREFIXES: ResourcePrefixConfig[] = [
  { key: 'enjoymusic_song', service: 'AUDIO' },
  { key: 'enjoymusic_playlist', service: 'PLAYLIST' },
  { key: 'enjoymusic_podcast', service: 'AUDIO' },
  { key: 'enjoymusic_audiobooks', service: 'AUDIO' },
];

const PAGE_SIZE = 200;

const fetchResourceSummary = async (
  service: 'AUDIO' | 'PLAYLIST' | 'DOCUMENT',
  prefix: string,
): Promise<ResourceSummaryResult> => {
  let offset = 0;
  let total = 0;
  const publishers = new Set<string>();
  const queryPrefix = `${prefix}_`;

  while (true) {
    const page: any[] = await cachedSearchQdnResources({
      mode: 'ALL',
      service,
      query: queryPrefix,
      identifier: queryPrefix,
      limit: PAGE_SIZE,
      offset,
      reverse: true,
      includeMetadata: false,
      excludeBlocked: true,
    });
    if (!Array.isArray(page)) {
      break;
    }

    const filteredPage = page.filter((item) => {
      if (shouldHideQdnResource(item)) {
        return false;
      }

      if (service === 'AUDIO' && (prefix.includes('podcast') || prefix.includes('audiobooks'))) {
        const identifier = typeof item?.identifier === 'string' ? item.identifier : '';
        const suffix = prefix.includes('audiobooks') ? 'audiobooks' : 'podcast';
        return TRACKED_AUDIO_SERIES_PREFIXES.some((p) => identifier.startsWith(`${p}_${suffix}_`));
      }

      return true;
    });

    total += filteredPage.length;
    filteredPage.forEach((item) => {
      if (item?.name) {
        publishers.add(item.name);
      }
    });

    if (page.length < PAGE_SIZE) {
      break;
    }

    offset += page.length;
  }

  return {
    count: total,
    publishers,
  };
};

export interface StatisticsSnapshot {
  allSongs: number;
  allPlaylists: number;
  qmusicSongs: number;
  qmusicPlaylists: number;
  totalPodcasts: number;
  totalAudiobooks: number;
  totalPublishers: number;
  openRequests: number;
  filledRequests: number;
}

export const fetchStatisticsSnapshot = async (): Promise<StatisticsSnapshot> => {
  const prefixResults = new Map<string, ResourceSummaryResult>();

  await Promise.all(
    RESOURCE_PREFIXES.map(async (config) => {
      const result = await fetchResourceSummary(config.service, config.key);
      prefixResults.set(config.key, result);
    }),
  );

  const qmusicSongs = prefixResults.get('enjoymusic_song')?.count ?? 0;
  const qmusicPlaylists = prefixResults.get('enjoymusic_playlist')?.count ?? 0;
  const qmusicPodcasts = prefixResults.get('enjoymusic_podcast')?.count ?? 0;
  const qmusicAudiobooks = prefixResults.get('enjoymusic_audiobooks')?.count ?? 0;
  const totalPodcasts = qmusicPodcasts;
  const totalAudiobooks = qmusicAudiobooks;

  const publisherSet = new Set<string>();
  prefixResults.forEach((result) => {
    result.publishers.forEach((publisher) => publisherSet.add(publisher));
  });

  const { requests, fills } = await fetchRequestsFromQdn();
  const isRequestFilled = (request: SongRequest) => {
    const normalizedStatus = typeof request?.status === 'string' ? request.status.toLowerCase() : '';
    return normalizedStatus === 'filled'
      || Boolean(request?.filledAt)
      || Boolean(request?.filledBy)
      || Boolean(request?.filledSongIdentifier)
      || Boolean(fills?.[request.id]);
  };
  const openRequests = requests.filter((request) => !isRequestFilled(request)).length;
  const filledRequests = requests.length - openRequests;

  return {
    allSongs: qmusicSongs,
    allPlaylists: qmusicPlaylists,
    qmusicSongs,
    qmusicPlaylists,
    totalPodcasts,
    totalAudiobooks,
    totalPublishers: publisherSet.size,
    openRequests,
    filledRequests,
  };
};
