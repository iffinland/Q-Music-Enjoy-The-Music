import { RequestFill, SongRequest } from '../state/features/requestsSlice';
import { objectToBase64 } from '../utils/toBase64';
import { searchQdnResources } from '../utils/qortalApi';

const REQUEST_IDENTIFIER_PREFIX = 'enjoymusic_request_';
const REQUEST_FILL_IDENTIFIER_PREFIX = 'enjoymusic_request_fill_';
const REQUEST_REPORT_PREFIX = 'enjoymusic_request_report_';

const PAGE_SIZE = 200;

const fetchQdnJson = async (name: string, service: string, identifier: string) => {
  try {
    const payload = await qortalRequest({
      action: 'FETCH_QDN_RESOURCE',
      name,
      service,
      identifier,
    });
    return payload;
  } catch (error) {
    console.error(`Failed to fetch QDN resource ${service}/${name}/${identifier}`, error);
    return null;
  }
};

const fetchDocumentSummaries = async (identifierPrefix: string): Promise<any[]> => {
  let offset = 0;
  const aggregated: any[] = [];

  while (true) {
    const page: any[] = await searchQdnResources({
      mode: 'ALL',
      service: 'DOCUMENT',
      identifier: identifierPrefix,
      limit: PAGE_SIZE,
      offset,
      reverse: true,
      includeMetadata: false,
      includeStatus: true,
      excludeBlocked: true,
    });
    aggregated.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    offset += page.length;
  }

  return aggregated;
};

export interface FetchRequestsResult {
  requests: SongRequest[];
  fills: Record<string, RequestFill>;
}

export const fetchRequestsFromQdn = async (): Promise<FetchRequestsResult> => {
  const requestSummaries = await fetchDocumentSummaries(REQUEST_IDENTIFIER_PREFIX);
  const fillSummaries = await fetchDocumentSummaries(REQUEST_FILL_IDENTIFIER_PREFIX);

  const fetchedRequests: SongRequest[] = [];

  for (const item of requestSummaries) {
    const data = await fetchQdnJson(item.name, 'DOCUMENT', item.identifier);
    if (data && data.id) {
      fetchedRequests.push({
        status: 'open',
        created: data.created ?? item.created,
        updated: data.updated ?? item.updated,
        ...data,
      });
    }
  }

  const fillEntries: RequestFill[] = [];

  for (const item of fillSummaries) {
    const data = await fetchQdnJson(item.name, 'DOCUMENT', item.identifier);
    if (data && data.requestId) {
      fillEntries.push({
        created: data.created ?? item.created,
        ...data,
      });
    }
  }

  const fills = fillEntries.reduce<Record<string, RequestFill>>((acc, entry) => {
    const existing = acc[entry.requestId];
    if (!existing || (existing.created ?? 0) < (entry.created ?? 0)) {
      acc[entry.requestId] = entry;
    }
    return acc;
  }, {});

  const enrichedRequests = fetchedRequests
    .map((request) => {
      const matchingFill = fills[request.id];
      if (!matchingFill) {
        return request;
      }
      return {
        ...request,
        status: 'filled' as const,
        filledAt: matchingFill.created,
        filledBy: matchingFill.filledBy,
        filledSongIdentifier: matchingFill.songIdentifier,
        filledSongTitle: matchingFill.songTitle,
        filledSongArtist: matchingFill.songArtist,
      };
    })
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0));

  return {
    requests: enrichedRequests,
    fills,
  };
};

export const deleteRequest = async (publisher: string, identifier: string) => {
  await qortalRequest({
    action: 'DELETE_QDN_RESOURCE',
    name: publisher,
    service: 'DOCUMENT',
    identifier,
  });
};

export const reportRequest = async (
  reporter: string,
  requestId: string,
  reason: string,
) => {
  const reportIdentifier = `${REQUEST_REPORT_PREFIX}${requestId}_${Date.now()}`;
  const payload = {
    id: reportIdentifier,
    requestId,
    reporter,
    reason,
    created: Date.now(),
  };

  const data64 = await objectToBase64(payload);

  await qortalRequest({
    action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
    resources: [
      {
        name: reporter,
        service: 'DOCUMENT',
        data64,
        identifier: reportIdentifier,
        filename: `${reportIdentifier}.json`,
        title: `Request report ${requestId}`.slice(0, 55),
        description: reason.slice(0, 120),
        encoding: 'base64',
      },
    ],
  });
};

export const fetchRequestsByPublisher = async (publisher: string): Promise<SongRequest[]> => {
  if (!publisher) return [];

  const summaries = await searchQdnResources({
    mode: 'ALL',
    service: 'DOCUMENT',
    name: publisher,
    identifier: REQUEST_IDENTIFIER_PREFIX,
    limit: PAGE_SIZE,
    offset: 0,
    reverse: true,
    includeMetadata: false,
    includeStatus: true,
    excludeBlocked: true,
    exactMatchNames: true,
  });

  if (!Array.isArray(summaries) || summaries.length === 0) {
    return [];
  }

  const requests: SongRequest[] = [];

  for (const summary of summaries) {
    if (!summary?.identifier || !summary.identifier.startsWith(REQUEST_IDENTIFIER_PREFIX)) continue;
    const data = await fetchQdnJson(summary.name, 'DOCUMENT', summary.identifier);
    if (data && data.id) {
      requests.push({
        status: 'open',
        created: data.created ?? summary.created,
        updated: data.updated ?? summary.updated,
        ...data,
      });
    }
  }

  return requests.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
};
