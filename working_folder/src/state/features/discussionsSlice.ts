import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ReplyAccess = 'everyone' | 'publisher' | 'custom';

export interface DiscussionReply {
  id: string; // QDN identifier for the reply resource
  threadId: string;
  author: string;
  body: string;
  created: number;
  updated?: number;
  parentReplyId?: string | null;
}

export interface DiscussionThread {
  id: string; // QDN identifier for the thread resource
  title: string;
  body: string;
  publisher: string;
  created: number;
  updated?: number;
  replies: DiscussionReply[];
  tags: string[];
  replyAccess: ReplyAccess;
  allowedResponders: string[];
  status: 'open' | 'locked';
}

interface DiscussionsState {
  threads: DiscussionThread[];
  isLoading: boolean;
  error: string | null;
  lastReadTimestamp: number;
  unreadThreadIds: string[];
}

const initialState: DiscussionsState = {
  threads: [],
  isLoading: false,
  error: null,
  lastReadTimestamp: 0,
  unreadThreadIds: [],
};

const sortThreads = (threads: DiscussionThread[]) =>
  [...threads].sort(
    (a, b) => (b.updated ?? b.created ?? 0) - (a.updated ?? a.created ?? 0),
  );

const sortReplies = (replies: DiscussionReply[]) =>
  [...replies].sort((a, b) => (a.created ?? 0) - (b.created ?? 0));

export const discussionsSlice = createSlice({
  name: 'discussions',
  initialState,
  reducers: {
    setDiscussionsLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setDiscussionsError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setDiscussionThreads(state, action: PayloadAction<DiscussionThread[]>) {
      state.threads = sortThreads(action.payload);
    },
    upsertDiscussionThread(state, action: PayloadAction<DiscussionThread>) {
      const incoming = action.payload;
      const index = state.threads.findIndex((thread) => thread.id === incoming.id);
      if (index >= 0) {
        state.threads[index] = incoming;
      } else {
        state.threads.unshift(incoming);
      }
      state.threads = sortThreads(state.threads);
    },
    addReplyToThread(
      state,
      action: PayloadAction<{ threadId: string; reply: DiscussionReply }>,
    ) {
      const { threadId, reply } = action.payload;
      const thread = state.threads.find((item) => item.id === threadId);
      if (!thread) return;
      thread.replies = sortReplies([...thread.replies, reply]);
      thread.updated = Math.max(thread.updated ?? 0, reply.created);
      state.threads = sortThreads(state.threads);
    },
    updateReplyInThread(
      state,
      action: PayloadAction<{ threadId: string; reply: DiscussionReply }>,
    ) {
      const { threadId, reply } = action.payload;
      const thread = state.threads.find((item) => item.id === threadId);
      if (!thread) return;
      const index = thread.replies.findIndex((item) => item.id === reply.id);
      if (index === -1) return;
      thread.replies[index] = reply;
      thread.replies = sortReplies(thread.replies);
      thread.updated = Math.max(thread.updated ?? 0, reply.updated ?? reply.created);
      state.threads = sortThreads(state.threads);
    },
    setUnreadThreadIds(state, action: PayloadAction<string[]>) {
      state.unreadThreadIds = action.payload;
    },
    setLastReadTimestamp(state, action: PayloadAction<number>) {
      state.lastReadTimestamp = action.payload;
    },
    markAllThreadsRead(state, action: PayloadAction<number>) {
      state.lastReadTimestamp = action.payload;
      state.unreadThreadIds = [];
    },
    clearThreadUnread(state, action: PayloadAction<string>) {
      state.unreadThreadIds = state.unreadThreadIds.filter((id) => id !== action.payload);
    },
    removeDiscussionThread(state, action: PayloadAction<string>) {
      state.threads = state.threads.filter((thread) => thread.id !== action.payload);
    },
    removeReplyFromThread(
      state,
      action: PayloadAction<{ threadId: string; replyId: string }>,
    ) {
      const { threadId, replyId } = action.payload;
      const thread = state.threads.find((item) => item.id === threadId);
      if (!thread) return;
      thread.replies = thread.replies.filter((reply) => reply.id !== replyId);
      const newest = thread.replies[thread.replies.length - 1];
      thread.updated = newest ? (newest.updated ?? newest.created) : thread.created;
      state.threads = sortThreads(state.threads);
    },
  },
});

export const {
  setDiscussionsLoading,
  setDiscussionsError,
  setDiscussionThreads,
  upsertDiscussionThread,
  addReplyToThread,
  updateReplyInThread,
  setUnreadThreadIds,
  setLastReadTimestamp,
  markAllThreadsRead,
  clearThreadUnread,
  removeDiscussionThread,
  removeReplyFromThread,
} = discussionsSlice.actions;

export default discussionsSlice.reducer;
