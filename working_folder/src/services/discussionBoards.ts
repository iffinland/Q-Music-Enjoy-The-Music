import {
  DiscussionReply,
  DiscussionThread,
  ReplyAccess,
} from '../state/features/discussionsSlice';
import { objectToBase64 } from '../utils/toBase64';
import { searchQdnResources } from '../utils/qortalApi';

const THREAD_IDENTIFIER_PREFIX = 'qm_discussion_thread_';
const REPLY_IDENTIFIER_PREFIX = 'qm_discussion_reply_';
const THREAD_SERVICE = 'DOCUMENT';
const PAGE_SIZE = 200;

const generateId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const fetchQdnJson = async (name: string, identifier: string) => {
  try {
    const payload = await qortalRequest({
      action: 'FETCH_QDN_RESOURCE',
      name,
      service: THREAD_SERVICE,
      identifier,
    });
    return payload;
  } catch (error) {
    console.error(`Failed to fetch QDN resource ${name}/${identifier}`, error);
    return null;
  }
};

const fetchSummaries = async (identifierPrefix: string) => {
  let offset = 0;
  const aggregated: any[] = [];

  while (true) {
    const page: any[] = await searchQdnResources({
      mode: 'ALL',
      service: THREAD_SERVICE,
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

const sanitizeThread = (data: Partial<DiscussionThread>, fallback: { name: string; identifier: string; created?: number; updated?: number; }): DiscussionThread | null => {
  if (!data || !data.title || !data.body) {
    return null;
  }
  return {
    id: data.id ?? fallback.identifier,
    title: data.title,
    body: data.body,
    publisher: data.publisher ?? fallback.name,
    created: data.created ?? fallback.created ?? Date.now(),
    updated: data.updated ?? fallback.updated,
    replies: Array.isArray(data.replies) ? data.replies : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
    replyAccess: (data.replyAccess ?? 'everyone') as ReplyAccess,
    allowedResponders: Array.isArray(data.allowedResponders) ? data.allowedResponders : [],
    status: data.status === 'locked' ? 'locked' : 'open',
  };
};

const sanitizeReply = (
  data: Partial<DiscussionReply>,
  fallback: { name: string; identifier: string; created?: number; updated?: number; },
): DiscussionReply | null => {
  if (!data || !data.threadId || !data.body) {
    return null;
  }

  return {
    id: data.id ?? fallback.identifier,
    threadId: data.threadId,
    author: data.author ?? (data as any).publisher ?? fallback.name,
    body: data.body,
    created: data.created ?? fallback.created ?? Date.now(),
    updated: data.updated ?? fallback.updated,
  };
};

const publishDocument = async (
  name: string,
  identifier: string,
  payload: Record<string, unknown>,
  title: string,
  description: string,
) => {
  const data64 = await objectToBase64(payload);

  await qortalRequest({
    action: 'PUBLISH_QDN_RESOURCE',
    name,
    service: THREAD_SERVICE,
    identifier,
    data64,
    encoding: 'base64',
    title: title.slice(0, 55),
    description: description.slice(0, 4000),
  });
};

export const fetchDiscussionThreadsFromQdn = async (): Promise<DiscussionThread[]> => {
  const [threadSummaries, replySummaries] = await Promise.all([
    fetchSummaries(THREAD_IDENTIFIER_PREFIX),
    fetchSummaries(REPLY_IDENTIFIER_PREFIX),
  ]);

  const threads: DiscussionThread[] = [];

  for (const summary of threadSummaries) {
    if (!summary?.identifier?.startsWith(THREAD_IDENTIFIER_PREFIX)) continue;
    const payload = await fetchQdnJson(summary.name, summary.identifier);
    const sanitized = sanitizeThread(payload ?? {}, summary);
    if (sanitized) {
      sanitized.replies = [];
      threads.push(sanitized);
    }
  }

  const repliesByThread = new Map<string, DiscussionReply[]>();

  for (const summary of replySummaries) {
    if (!summary?.identifier?.startsWith(REPLY_IDENTIFIER_PREFIX)) continue;
    const payload = await fetchQdnJson(summary.name, summary.identifier);
    const sanitized = sanitizeReply(payload ?? {}, summary);
    if (!sanitized) continue;
    const existing = repliesByThread.get(sanitized.threadId) ?? [];
    existing.push(sanitized);
    repliesByThread.set(sanitized.threadId, existing);
  }

  return threads
    .map((thread) => {
      const replies = repliesByThread.get(thread.id) ?? [];
      return {
        ...thread,
        replies: replies.sort((a, b) => (a.created ?? 0) - (b.created ?? 0)),
        updated: replies.length > 0
          ? Math.max(thread.updated ?? thread.created, replies[replies.length - 1].created)
          : thread.updated ?? thread.created,
      };
    })
    .sort((a, b) => (b.updated ?? b.created ?? 0) - (a.updated ?? a.created ?? 0));
};

interface PersistThreadPayload {
  title: string;
  body: string;
  tags: string[];
  replyAccess: ReplyAccess;
  allowedResponders: string[];
  publisher: string;
  status?: 'open' | 'locked';
  id?: string;
  created?: number;
  updated?: number;
  replies?: DiscussionReply[];
}

export const publishDiscussionThread = async (payload: PersistThreadPayload): Promise<DiscussionThread> => {
  const now = Date.now();
  const id = payload.id ?? `${THREAD_IDENTIFIER_PREFIX}${generateId()}`;
  const replies = payload.replies ?? [];

  const thread: DiscussionThread = {
    id,
    title: payload.title,
    body: payload.body,
    publisher: payload.publisher,
    created: payload.created ?? now,
    updated: payload.updated ?? now,
    replies,
    tags: payload.tags,
    replyAccess: payload.replyAccess,
    allowedResponders: payload.allowedResponders,
    status: payload.status ?? 'open',
  };

  await publishDocument(
    thread.publisher,
    thread.id,
    {
      ...thread,
      replies: [],
    } as Record<string, unknown>,
    `Discussion: ${thread.title}`,
    thread.body,
  );

  return thread;
};

interface CreateReplyPayload {
  threadId: string;
  author: string;
  body: string;
}

export const publishDiscussionReply = async (
  payload: CreateReplyPayload,
): Promise<DiscussionReply> => {
  const now = Date.now();
  const id = `${REPLY_IDENTIFIER_PREFIX}${generateId()}`;

  const reply: DiscussionReply = {
    id,
    threadId: payload.threadId,
    author: payload.author,
    body: payload.body,
    created: now,
  };

  await publishDocument(
    payload.author,
    reply.id,
    reply as unknown as Record<string, unknown>,
    'Discussion reply',
    reply.body,
  );

  return reply;
};

export const updateDiscussionReply = async (
  reply: DiscussionReply,
  body: string,
): Promise<DiscussionReply> => {
  const updated: DiscussionReply = {
    ...reply,
    body,
    updated: Date.now(),
  };

  await publishDocument(
    reply.author,
    reply.id,
    updated as unknown as Record<string, unknown>,
    'Discussion reply update',
    updated.body,
  );

  return updated;
};
