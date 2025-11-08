import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ReplyAccess = 'everyone' | 'publisher' | 'custom';

export interface DiscussionReply {
  id: string;
  author: string;
  body: string;
  created: number;
  updated?: number;
}

export interface DiscussionThread {
  id: string;
  title: string;
  body: string;
  publisher: string;
  created: number;
  updated?: number;
  replies: DiscussionReply[];
  tags: string[];
  replyAccess: ReplyAccess;
  allowedResponders: string[]; // used when replyAccess === 'custom'
  status: 'open' | 'locked';
}

interface DiscussionsState {
  threads: DiscussionThread[];
}

const generateId = () => `disc-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;

const now = Date.now();

const initialState: DiscussionsState = {
  threads: [
    {
      id: generateId(),
      title: 'Feature ideas for next release',
      body: 'Share the features you would love to see inside Q-Music next. Be specific about the workflows and how they would help DJs and listeners.',
      publisher: 'Q-Music',
      created: now - 1000 * 60 * 60 * 30,
      replies: [
        {
          id: generateId(),
          author: 'NovaDJ',
          body: 'It would be amazing to have scheduled releases where curators can queue drops ahead of time.',
          created: now - 1000 * 60 * 60 * 24,
        },
      ],
      tags: ['roadmap', 'feedback'],
      replyAccess: 'everyone',
      allowedResponders: [],
      status: 'open',
    },
    {
      id: generateId(),
      title: 'Trusted curators onboarding',
      body: 'Collecting questions from curators who were recently invited. I will add clarifications in the top message so newcomers can find answers quickly.',
      publisher: 'Q-Music',
      created: now - 1000 * 60 * 60 * 55,
      replies: [],
      tags: ['curators', 'guides'],
      replyAccess: 'custom',
      allowedResponders: ['NovaDJ', 'LunaQ'],
      status: 'open',
    },
    {
      id: generateId(),
      title: 'Archive migration progress',
      body: 'Locked note regarding the migration status. Only moderators can update this thread so readers always have one canonical source.',
      publisher: 'Moderator',
      created: now - 1000 * 60 * 60 * 72,
      replies: [
        {
          id: generateId(),
          author: 'Moderator',
          body: 'Phase 1 completed. Indexing runs nightly.',
          created: now - 1000 * 60 * 60 * 36,
        },
      ],
      tags: ['status'],
      replyAccess: 'publisher',
      allowedResponders: [],
      status: 'locked',
    },
  ],
};

const discussionsSlice = createSlice({
  name: 'discussions',
  initialState,
  reducers: {
    createThread: {
      reducer(state, action: PayloadAction<DiscussionThread>) {
        state.threads = [action.payload, ...state.threads];
      },
      prepare: (data: {
        title: string;
        body: string;
        publisher: string;
        tags: string[];
        replyAccess: ReplyAccess;
        allowedResponders: string[];
      }) => ({
        payload: {
          id: generateId(),
          created: Date.now(),
          replies: [],
          status: 'open' as const,
          ...data,
        },
      }),
    },
    updateThread: (
      state,
      action: PayloadAction<{
        threadId: string;
        changes: Partial<Omit<DiscussionThread, 'id' | 'publisher' | 'created' | 'replies'>> & {
          body?: string;
          title?: string;
          tags?: string[];
          replyAccess?: ReplyAccess;
          allowedResponders?: string[];
          status?: 'open' | 'locked';
        };
      }>,
    ) => {
      const { threadId, changes } = action.payload;
      const thread = state.threads.find((item) => item.id === threadId);
      if (!thread) return;
      Object.assign(thread, changes);
      thread.updated = Date.now();
    },
    createReply: {
      reducer(state, action: PayloadAction<{ threadId: string; reply: DiscussionReply }>) {
        const thread = state.threads.find((item) => item.id === action.payload.threadId);
        if (!thread) return;
        thread.replies.push(action.payload.reply);
        thread.updated = Date.now();
      },
      prepare: (threadId: string, data: { author: string; body: string }) => ({
        payload: {
          threadId,
          reply: {
            id: generateId(),
            created: Date.now(),
            ...data,
          },
        },
      }),
    },
    updateReply: (
      state,
      action: PayloadAction<{ threadId: string; replyId: string; body: string }>,
    ) => {
      const thread = state.threads.find((item) => item.id === action.payload.threadId);
      if (!thread) return;
      const reply = thread.replies.find((item) => item.id === action.payload.replyId);
      if (!reply) return;
      reply.body = action.payload.body;
      reply.updated = Date.now();
      thread.updated = Date.now();
    },
  },
});

export const { createThread, updateThread, createReply, updateReply } = discussionsSlice.actions;

export default discussionsSlice.reducer;
