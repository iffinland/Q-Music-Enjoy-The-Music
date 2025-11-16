import {
  DiscussionAttachment,
  DiscussionReply,
  DiscussionThread,
  ReplyAccess,
} from '../state/features/discussionsSlice';
import { deleteQdnResource } from '../utils/qortalApi';
import { objectToBase64 } from '../utils/toBase64';
import { cachedSearchQdnResources, clearSearchCache } from './resourceCache';

const THREAD_IDENTIFIER_PREFIX = 'qm_discussion_thread_';
const REPLY_IDENTIFIER_PREFIX = 'qm_discussion_reply_';
const REPLY_LIKE_IDENTIFIER_PREFIX = 'qm_discussion_like_';
const THREAD_SERVICE = 'DOCUMENT';
const PAGE_SIZE = 200;
const CONCURRENCY_LIMIT = 10;

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
    const page: any[] = await cachedSearchQdnResources({
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

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const tasks = Array.from({ length: Math.min(items.length, limit) }).map(async () => {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(tasks);
  return results;
};

const sanitizeAttachments = (value: any): DiscussionAttachment[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!item) return null;
      const name = typeof item.name === 'string' ? item.name : `attachment-${index + 1}`;
      const dataUrl = typeof item.dataUrl === 'string' ? item.dataUrl : '';
      if (!dataUrl) return null;
      return {
        id: typeof item.id === 'string' ? item.id : `${Date.now()}-${index}`,
        name,
        mimeType: typeof item.mimeType === 'string' ? item.mimeType : 'application/octet-stream',
        size: typeof item.size === 'number' ? item.size : 0,
        dataUrl,
      };
    })
    .filter((item): item is DiscussionAttachment => Boolean(item));
};

const sanitizeThread = (data: Partial<DiscussionThread>, fallback: { name: string; identifier: string; created?: number; updated?: number; }): DiscussionThread | null => {
  if (!data || (data as any).deleted) {
    return null;
  }
  if (!data.title || !data.body) {
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
    attachments: sanitizeAttachments(data.attachments),
  };
};

const sanitizeReply = (
  data: Partial<DiscussionReply>,
  fallback: { name: string; identifier: string; created?: number; updated?: number; },
): DiscussionReply | null => {
  if (!data || (data as any).deleted) {
    return null;
  }
  if (!data.threadId || !data.body) {
    return null;
  }

  return {
    id: data.id ?? fallback.identifier,
    threadId: data.threadId,
    author: data.author ?? (data as any).publisher ?? fallback.name,
    body: data.body,
    created: data.created ?? fallback.created ?? Date.now(),
    updated: data.updated ?? fallback.updated,
    parentReplyId: data.parentReplyId ?? null,
    attachments: sanitizeAttachments(data.attachments),
    likes: Array.isArray((data as any).likes) ? ((data as any).likes as string[]) : [],
  };
};

interface ReplyLike {
  replyId: string;
  liker: string;
}

const decodeIdentifierSegment = (value: string | undefined) => {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const sanitizeReplyLike = (
  data: Partial<ReplyLike>,
  fallback: { identifier: string; name: string },
): ReplyLike | null => {
  const trimmed = (fallback.identifier || '').replace(REPLY_LIKE_IDENTIFIER_PREFIX, '');
  const [replySegment, likerSegment] = trimmed.split('__');
  const derivedReplyId = decodeIdentifierSegment(replySegment);
  const derivedLiker = decodeIdentifierSegment(likerSegment);

  const replyId = (data.replyId as string) || derivedReplyId;
  const liker = (data.liker as string) || derivedLiker || fallback.name;

  if (!replyId || !liker) return null;
  return { replyId, liker };
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
  const [threadSummaries, replySummaries, likeSummaries] = await Promise.all([
    fetchSummaries(THREAD_IDENTIFIER_PREFIX),
    fetchSummaries(REPLY_IDENTIFIER_PREFIX),
    fetchSummaries(REPLY_LIKE_IDENTIFIER_PREFIX),
  ]);

  const threadResults = await mapWithConcurrency(
    threadSummaries,
    CONCURRENCY_LIMIT,
    async (summary) => {
      if (!summary?.identifier?.startsWith(THREAD_IDENTIFIER_PREFIX)) return null;
      const payload = await fetchQdnJson(summary.name, summary.identifier);
      const sanitized = sanitizeThread(payload ?? {}, summary);
      if (sanitized) {
        sanitized.replies = [];
      }
      return sanitized;
    },
  );

  const threads = threadResults.filter((thread): thread is DiscussionThread => Boolean(thread));

  const repliesByThread = new Map<string, DiscussionReply[]>();
  const likesByReply = new Map<string, string[]>();

  const replyResults = await mapWithConcurrency(
    replySummaries,
    CONCURRENCY_LIMIT,
    async (summary) => {
      if (!summary?.identifier?.startsWith(REPLY_IDENTIFIER_PREFIX)) return null;
      const payload = await fetchQdnJson(summary.name, summary.identifier);
      return sanitizeReply(payload ?? {}, summary);
    },
  );

  replyResults
    .filter((reply): reply is DiscussionReply => Boolean(reply))
    .forEach((reply) => {
      const existing = repliesByThread.get(reply.threadId) ?? [];
      existing.push(reply);
      repliesByThread.set(reply.threadId, existing);
    });

  const likeResults = await mapWithConcurrency(
    likeSummaries,
    CONCURRENCY_LIMIT,
    async (summary) => {
      if (!summary?.identifier?.startsWith(REPLY_LIKE_IDENTIFIER_PREFIX)) return null;
      const payload = await fetchQdnJson(summary.name, summary.identifier);
      return sanitizeReplyLike(payload ?? {}, summary);
    },
  );

  likeResults
    .filter((like): like is ReplyLike => Boolean(like))
    .forEach((like) => {
      const existing = likesByReply.get(like.replyId) ?? [];
      if (!existing.includes(like.liker)) {
        existing.push(like.liker);
      }
      likesByReply.set(like.replyId, existing);
    });

  return threads
    .map((thread) => {
      const replies = repliesByThread.get(thread.id) ?? [];
      return {
        ...thread,
        replies: replies
          .map((reply) => ({
            ...reply,
            likes: likesByReply.get(reply.id) ?? [],
          }))
          .sort((a, b) => (a.created ?? 0) - (b.created ?? 0)),
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
  attachments?: DiscussionAttachment[];
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
    attachments: payload.attachments ?? [],
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
  parentReplyId?: string | null;
  attachments?: DiscussionAttachment[];
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
    parentReplyId: payload.parentReplyId ?? null,
    attachments: payload.attachments ?? [],
    likes: [],
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
  attachments: DiscussionAttachment[],
): Promise<DiscussionReply> => {
  const updated: DiscussionReply = {
    ...reply,
    body,
    attachments,
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

export const deleteDiscussionThread = async (thread: DiscussionThread): Promise<void> => {
  await publishDocument(
    thread.publisher,
    thread.id,
    {
      id: thread.id,
      deleted: true,
      updated: Date.now(),
    },
    'Discussion deleted',
    'Thread deleted by author',
  );
};

export const deleteDiscussionReply = async (reply: DiscussionReply): Promise<void> => {
  await publishDocument(
    reply.author,
    reply.id,
    {
      id: reply.id,
      threadId: reply.threadId,
      deleted: true,
      updated: Date.now(),
    },
    'Discussion reply deleted',
    'Reply deleted by author',
  );
};

const buildReplyLikeIdentifier = (replyId: string, liker: string): string =>
  `${REPLY_LIKE_IDENTIFIER_PREFIX}${encodeURIComponent(replyId)}__${encodeURIComponent(liker)}`;

export const likeDiscussionReply = async (reply: DiscussionReply, liker: string): Promise<void> => {
  const identifier = buildReplyLikeIdentifier(reply.id, liker);
  const payload = {
    replyId: reply.id,
    threadId: reply.threadId,
    liker,
    author: reply.author,
    created: Date.now(),
  };

  await publishDocument(
    liker,
    identifier,
    payload as Record<string, unknown>,
    `Reply like: ${reply.threadId}`,
    `Support for reply ${reply.id}`,
  );
  clearSearchCache();
};

export const unlikeDiscussionReply = async (reply: DiscussionReply, liker: string): Promise<void> => {
  const identifier = buildReplyLikeIdentifier(reply.id, liker);
  await deleteQdnResource({
    name: liker,
    service: THREAD_SERVICE,
    identifier,
  });
  clearSearchCache();
};
