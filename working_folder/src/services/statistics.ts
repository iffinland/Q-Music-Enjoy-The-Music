import { fetchRequestsFromQdn } from './qdnRequests';
import { searchQdnResources } from '../utils/qortalApi';
import { shouldHideQdnResource } from '../utils/qdnResourceFilters';

type ResourceSummaryResult = {
  count: number;
  publishers: Set<string>;
};

type ResourcePrefixConfig = {
  key: string;
  service: 'AUDIO' | 'PLAYLIST' | 'DOCUMENT' | 'VIDEO';
};

const TRACKED_PODCAST_PREFIXES = ['enjoymusic', 'earbump'];

const RESOURCE_PREFIXES: ResourcePrefixConfig[] = [
  { key: 'enjoymusic_song', service: 'AUDIO' },
  { key: 'earbump_song', service: 'AUDIO' },
  { key: 'enjoymusic_playlist', service: 'PLAYLIST' },
  { key: 'earbump_playlist', service: 'PLAYLIST' },
  { key: 'enjoymusic_podcast', service: 'AUDIO' },
  { key: 'earbump_podcast', service: 'AUDIO' },
  { key: 'enjoymusic_video', service: 'VIDEO' },
];

const PAGE_SIZE = 200;

const fetchResourceSummary = async (
  service: 'AUDIO' | 'PLAYLIST' | 'DOCUMENT' | 'VIDEO',
  prefix: string,
): Promise<ResourceSummaryResult> => {
  let offset = 0;
  let total = 0;
  const publishers = new Set<string>();
  const queryPrefix = `${prefix}_`;

  while (true) {
    const page: any[] = await searchQdnResources({
      mode: 'ALL',
      service,
      query: queryPrefix,
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

      if (service === 'AUDIO' && prefix.includes('podcast')) {
        const identifier = typeof item?.identifier === 'string' ? item.identifier : '';
        return TRACKED_PODCAST_PREFIXES.some((p) => identifier.startsWith(`${p}_podcast_`));
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
  earbumpSongs: number;
  earbumpPlaylists: number;
  totalPodcasts: number;
  musicVideos: number;
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
  const earbumpSongs = prefixResults.get('earbump_song')?.count ?? 0;
  const qmusicPlaylists = prefixResults.get('enjoymusic_playlist')?.count ?? 0;
  const earbumpPlaylists = prefixResults.get('earbump_playlist')?.count ?? 0;
  const qmusicPodcasts = prefixResults.get('enjoymusic_podcast')?.count ?? 0;
  const earbumpPodcasts = prefixResults.get('earbump_podcast')?.count ?? 0;
  const totalPodcasts = qmusicPodcasts + earbumpPodcasts;
  const musicVideos = prefixResults.get('enjoymusic_video')?.count ?? 0;

  const publisherSet = new Set<string>();
  prefixResults.forEach((result) => {
    result.publishers.forEach((publisher) => publisherSet.add(publisher));
  });

  const { requests } = await fetchRequestsFromQdn();
  const openRequests = requests.filter((request) => request.status !== 'filled').length;
  const filledRequests = requests.length - openRequests;

  return {
    allSongs: qmusicSongs + earbumpSongs,
    allPlaylists: qmusicPlaylists + earbumpPlaylists,
    qmusicSongs,
    qmusicPlaylists,
    earbumpSongs,
    earbumpPlaylists,
    totalPodcasts,
    musicVideos,
    totalPublishers: publisherSet.size,
    openRequests,
    filledRequests,
  };
};
