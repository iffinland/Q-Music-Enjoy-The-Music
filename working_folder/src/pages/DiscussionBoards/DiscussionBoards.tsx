import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMessageCircle, FiPlusCircle, FiEdit3, FiSend } from 'react-icons/fi';
import { HiOutlineLockClosed } from 'react-icons/hi';
import { toast } from 'react-hot-toast';
import Header from '../../components/Header';
import Box from '../../components/Box';
import Button from '../../components/Button';
import {
  createReply,
  createThread,
  DiscussionReply,
  DiscussionThread,
  ReplyAccess,
  updateReply,
  updateThread,
} from '../../state/features/discussionsSlice';
import { RootState } from '../../state/store';

const replyAccessOptions: Array<{ label: string; value: ReplyAccess; helper: string }> = [
  {
    label: 'Everyone can reply',
    value: 'everyone',
    helper: 'Open community discussion.',
  },
  {
    label: 'Only thread author',
    value: 'publisher',
    helper: 'Use for announcements or locked notes.',
  },
  {
    label: 'Specific usernames',
    value: 'custom',
    helper: 'Allow replies only from selected contributors.',
  },
];

const formatTimestamp = (value: number) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
};

const formatChips = (value: string) => value
  .split(',')
  .map((chip) => chip.trim())
  .filter(Boolean);

const DiscussionBoards: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const threads = useSelector((state: RootState) => state.discussions.threads);
  const username = useSelector((state: RootState) => state.auth.user?.name || '');

  const [searchTerm, setSearchTerm] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newReplyDraft, setNewReplyDraft] = useState('');
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [replyEditDraft, setReplyEditDraft] = useState('');

  const [composerState, setComposerState] = useState({
    title: '',
    body: '',
    tags: '',
    replyAccess: 'everyone' as ReplyAccess,
    allowed: '',
  });

  const [threadEditState, setThreadEditState] = useState({
    title: '',
    body: '',
    tags: '',
    replyAccess: 'everyone' as ReplyAccess,
    allowed: '',
    status: 'open' as 'open' | 'locked',
  });

  useEffect(() => {
    if (!selectedThreadId && threads.length > 0) {
      setSelectedThreadId(threads[0].id);
    }
  }, [threads, selectedThreadId]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId],
  );

  useEffect(() => {
    if (selectedThread && editingThreadId === selectedThread.id) {
      setThreadEditState({
        title: selectedThread.title,
        body: selectedThread.body,
        tags: selectedThread.tags.join(', '),
        replyAccess: selectedThread.replyAccess,
        allowed: selectedThread.allowedResponders.join(', '),
        status: selectedThread.status,
      });
    }
  }, [selectedThread, editingThreadId]);

  const filteredThreads = useMemo(() => {
    if (!searchTerm.trim()) return threads;
    const term = searchTerm.toLowerCase();
    return threads.filter((thread) => (
      thread.title.toLowerCase().includes(term)
      || thread.body.toLowerCase().includes(term)
      || thread.tags.some((tag) => tag.toLowerCase().includes(term))
    ));
  }, [threads, searchTerm]);

  const isUserAllowedToReply = useMemo(() => {
    if (!selectedThread || !username) return false;
    if (selectedThread.status === 'locked') return false;
    if (selectedThread.replyAccess === 'everyone') return true;
    if (selectedThread.replyAccess === 'publisher') {
      return username === selectedThread.publisher;
    }
    if (selectedThread.replyAccess === 'custom') {
      const normalized = selectedThread.allowedResponders.map((entry) => entry.toLowerCase());
      return (
        username === selectedThread.publisher
        || normalized.includes(username.toLowerCase())
      );
    }
    return false;
  }, [selectedThread, username]);

  const handleCreateThread = () => {
    if (!username) {
      toast.error('Log in to create a thread.');
      return;
    }
    if (!composerState.title.trim() || !composerState.body.trim()) {
      toast.error('Add a title and description.');
      return;
    }

    const tags = formatChips(composerState.tags);
    const allowedResponders = formatChips(composerState.allowed);

    const actionResult = dispatch(createThread({
      title: composerState.title.trim(),
      body: composerState.body.trim(),
      tags,
      replyAccess: composerState.replyAccess,
      allowedResponders,
      publisher: username,
    }));

    if ('payload' in actionResult && actionResult.payload && typeof actionResult.payload === 'object' && 'id' in actionResult.payload) {
      setSelectedThreadId((actionResult.payload as DiscussionThread).id);
    }

    setComposerState({
      title: '',
      body: '',
      tags: '',
      replyAccess: 'everyone',
      allowed: '',
    });
    setShowComposer(false);
    toast.success('Thread created');
  };

  const handleSaveThread = () => {
    if (!selectedThread) return;
    if (!threadEditState.title.trim() || !threadEditState.body.trim()) {
      toast.error('Title and description cannot be empty.');
      return;
    }

    dispatch(updateThread({
      threadId: selectedThread.id,
      changes: {
        title: threadEditState.title.trim(),
        body: threadEditState.body.trim(),
        tags: formatChips(threadEditState.tags),
        replyAccess: threadEditState.replyAccess,
        allowedResponders: formatChips(threadEditState.allowed),
        status: threadEditState.status,
      },
    }));
    setEditingThreadId(null);
    toast.success('Thread updated');
  };

  const handleCreateReply = () => {
    if (!selectedThread || !username) {
      toast.error('Log in to reply.');
      return;
    }
    if (!isUserAllowedToReply) {
      toast.error('Replies are restricted for this thread.');
      return;
    }
    if (!newReplyDraft.trim()) {
      toast.error('Add a response before sending.');
      return;
    }

    dispatch(createReply(selectedThread.id, {
      author: username,
      body: newReplyDraft.trim(),
    }));
    setNewReplyDraft('');
    toast.success('Reply posted');
  };

  const beginReplyEdit = (reply: DiscussionReply) => {
    setEditingReplyId(reply.id);
    setReplyEditDraft(reply.body);
  };

  const handleSaveReplyEdit = () => {
    if (!selectedThread || !editingReplyId) return;
    if (!replyEditDraft.trim()) {
      toast.error('Reply cannot be empty.');
      return;
    }
    dispatch(updateReply({
      threadId: selectedThread.id,
      replyId: editingReplyId,
      body: replyEditDraft.trim(),
    }));
    setEditingReplyId(null);
    setReplyEditDraft('');
    toast.success('Reply updated');
  };

  const renderReplyComposer = () => {
    if (!selectedThread) {
      return (
        <div className="rounded-md border border-slate-700/50 bg-slate-900/40 px-4 py-5 text-center text-slate-300">
          Pick a thread to start a conversation.
        </div>
      );
    }

    if (!username) {
      return (
        <div className="rounded-md border border-amber-600/40 bg-amber-900/30 px-4 py-5 text-sm text-amber-100">
          Log in to participate in the conversation.
        </div>
      );
    }

    if (!isUserAllowedToReply) {
      return (
        <div className="rounded-md border border-pink-600/40 bg-pink-900/30 px-4 py-5 text-sm text-pink-100">
          Replies are limited by the author. You are not on the allowed list for this thread.
        </div>
      );
    }

    if (selectedThread.status === 'locked') {
      return (
        <div className="flex items-center gap-3 rounded-md border border-slate-600/60 bg-slate-900/40 px-4 py-5 text-sm text-slate-200">
          <HiOutlineLockClosed className="text-base" />
          <span>This thread is locked. Only the author can make updates.</span>
        </div>
      );
    }

    return (
      <div className="space-y-3 rounded-xl border border-sky-900/60 bg-slate-950/60 p-4">
        <label htmlFor="reply-input" className="text-sm font-semibold text-sky-100">
          Add your reply
        </label>
        <textarea
          id="reply-input"
          value={newReplyDraft}
          onChange={(event) => setNewReplyDraft(event.target.value)}
          className="min-h-[120px] w-full rounded-lg border border-sky-800/70 bg-slate-900/70 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
          placeholder="Share your thoughts, attach resources or ask a follow-up."
        />
        <div className="flex flex-col gap-2 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <span>{newReplyDraft.trim().length} characters</span>
          <Button
            className="flex items-center justify-center gap-2 rounded-md bg-sky-500/90 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-sky-400 md:w-auto"
            onClick={handleCreateReply}
          >
            <FiSend className="text-base" />
            Send reply
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 px-4 py-6">
      <Header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-white">Discussion Boards</h1>
            <p className="text-sm text-sky-200/80">
              Host structured conversations with curators, artists and the community.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex items-center justify-center gap-2 rounded-md border border-sky-700/70 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-sky-100 hover:bg-slate-900/80 sm:w-auto"
              onClick={() => navigate('/')}
            >
              <FiArrowLeft />
              Back to Q-Music
            </Button>
            <Button
              className="flex items-center justify-center gap-2 rounded-md bg-emerald-500/90 px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-emerald-400 sm:w-auto"
              onClick={() => setShowComposer((prev) => !prev)}
            >
              <FiPlusCircle />
              {showComposer ? 'Hide thread builder' : 'Create new threads'}
            </Button>
          </div>
        </div>
        {showComposer && (
          <Box className="border border-sky-900/60 bg-slate-950/70 px-4 py-5">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-sky-100" htmlFor="thread-title">
                    Thread title
                  </label>
                  <input
                    id="thread-title"
                    value={composerState.title}
                    onChange={(event) => setComposerState((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Example: Weekly spotlight planning"
                    className="w-full rounded-lg border border-sky-800/70 bg-slate-900/70 px-4 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-sky-100" htmlFor="thread-tags">
                    Tags (comma separated)
                  </label>
                  <input
                    id="thread-tags"
                    value={composerState.tags}
                    onChange={(event) => setComposerState((prev) => ({ ...prev, tags: event.target.value }))}
                    placeholder="roadmap, requests"
                    className="w-full rounded-lg border border-sky-800/70 bg-slate-900/70 px-4 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-sky-100" htmlFor="thread-body">
                  Description
                </label>
                <textarea
                  id="thread-body"
                  value={composerState.body}
                  onChange={(event) => setComposerState((prev) => ({ ...prev, body: event.target.value }))}
                  rows={4}
                  placeholder="Set the context. Link to resources, embed guidelines, describe the goal."
                  className="w-full rounded-lg border border-sky-800/70 bg-slate-900/70 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {replyAccessOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer flex-col gap-1 rounded-lg border px-3 py-3 text-sm transition ${
                      composerState.replyAccess === option.value
                        ? 'border-emerald-400 bg-emerald-900/30 text-emerald-100'
                        : 'border-sky-800/70 bg-slate-900/60 text-sky-100/80 hover:border-sky-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reply-access"
                      className="hidden"
                      checked={composerState.replyAccess === option.value}
                      onChange={() => setComposerState((prev) => ({ ...prev, replyAccess: option.value }))}
                    />
                    <span className="font-semibold">{option.label}</span>
                    <span className="text-xs text-slate-300/80">{option.helper}</span>
                  </label>
                ))}
              </div>
              {composerState.replyAccess === 'custom' && (
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-sky-100" htmlFor="allowed-users">
                    Allowed usernames
                  </label>
                  <input
                    id="allowed-users"
                    value={composerState.allowed}
                    onChange={(event) => setComposerState((prev) => ({ ...prev, allowed: event.target.value }))}
                    placeholder="Comma separated usernames"
                    className="w-full rounded-lg border border-sky-800/70 bg-slate-900/70 px-4 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
                  />
                </div>
              )}
              <div className="flex flex-col gap-3 md:flex-row md:justify-end">
                <Button
                  className="rounded-md border border-slate-700 bg-slate-900/70 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/90 md:w-auto"
                  onClick={() => {
                    setShowComposer(false);
                    setComposerState({
                      title: '',
                      body: '',
                      tags: '',
                      replyAccess: 'everyone',
                      allowed: '',
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex items-center justify-center gap-2 rounded-md bg-sky-500/90 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-sky-400 md:w-auto"
                  onClick={handleCreateThread}
                >
                  <FiPlusCircle />
                  Publish thread
                </Button>
              </div>
            </div>
          </Box>
        )}
      </Header>

      <div className="flex flex-col gap-6 lg:flex-row">
        <Box className="border border-sky-900/60 bg-slate-950/70 px-4 py-5 lg:w-[40%]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Threads</h2>
              <p className="text-sm text-sky-200/70">{filteredThreads.length} active topics</p>
            </div>
            <FiMessageCircle className="text-2xl text-sky-400/80" />
          </div>
          <div className="mt-4">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by title, tags or author"
              className="w-full rounded-lg border border-sky-800/70 bg-slate-900/70 px-4 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
            />
          </div>
          <ul className="mt-4 space-y-3">
            {filteredThreads.map((thread) => {
              const isActive = selectedThreadId === thread.id;
              return (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      isActive
                        ? 'border-emerald-400/70 bg-emerald-900/20 shadow-lg shadow-emerald-900/30'
                        : 'border-sky-800/60 bg-slate-900/50 hover:border-sky-600/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-semibold text-white">{thread.title}</p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          thread.status === 'locked'
                            ? 'bg-slate-700/80 text-slate-200'
                            : 'bg-emerald-600/70 text-slate-900'
                        }`}
                      >
                        {thread.status === 'locked' ? 'Locked' : 'Open'}
                      </span>
                    </div>
                    <p className="mt-1 max-h-16 overflow-hidden text-sm text-slate-300">{thread.body}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>{thread.replies.length} replies</span>
                      <span>•</span>
                      <span>By {thread.publisher}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {thread.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-sky-800/60 px-2 py-0.5 text-[11px] uppercase tracking-wide text-sky-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                </li>
              );
            })}
            {filteredThreads.length === 0 && (
              <li className="rounded-lg border border-slate-700/50 bg-slate-900/50 px-4 py-6 text-center text-sm text-slate-300">
                No threads match your search.
              </li>
            )}
          </ul>
        </Box>

        <Box className="flex-1 border border-sky-900/60 bg-slate-950/70 px-4 py-5">
          {!selectedThread ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-slate-800/60 bg-slate-900/40 p-6 text-center text-slate-300">
              Select a thread from the list to view its details.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-semibold text-white">{selectedThread.title}</h2>
                    {selectedThread.replyAccess === 'publisher' && (
                      <span className="rounded-full border border-slate-600/60 px-2 py-0.5 text-xs text-slate-200">
                        Announcement
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-300">
                    By {selectedThread.publisher} • {formatTimestamp(selectedThread.created)}
                  </p>
                </div>
                {username === selectedThread.publisher && (
                  <Button
                    className="flex items-center justify-center gap-2 rounded-md border border-sky-700/70 bg-slate-900/60 px-5 py-2 text-sm font-semibold text-sky-100 hover:bg-slate-900/80 md:w-auto"
                    onClick={() => setEditingThreadId(
                      editingThreadId === selectedThread.id ? null : selectedThread.id,
                    )}
                  >
                    <FiEdit3 />
                    {editingThreadId === selectedThread.id ? 'Cancel edit' : 'Edit thread'}
                  </Button>
                )}
              </div>

              {editingThreadId === selectedThread.id ? (
                <div className="space-y-4 rounded-xl border border-amber-500/50 bg-amber-950/30 p-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-sky-100" htmlFor="edit-thread-title">
                      Title
                    </label>
                    <input
                      id="edit-thread-title"
                      value={threadEditState.title}
                      onChange={(event) => setThreadEditState((prev) => ({ ...prev, title: event.target.value }))}
                      className="w-full rounded-lg border border-sky-800/70 bg-slate-900/70 px-4 py-2 text-sm text-slate-50 focus:border-sky-400 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-sky-100" htmlFor="edit-thread-body">
                      Content
                    </label>
                    <textarea
                      id="edit-thread-body"
                      value={threadEditState.body}
                      onChange={(event) => setThreadEditState((prev) => ({ ...prev, body: event.target.value }))}
                      rows={4}
                      className="w-full rounded-lg border border-sky-800/70 bg-slate-900/70 px-4 py-3 text-sm text-slate-50 focus:border-sky-400 focus:outline-none"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-sky-100" htmlFor="edit-thread-tags">
                        Tags
                      </label>
                      <input
                        id="edit-thread-tags"
                        value={threadEditState.tags}
                        onChange={(event) => setThreadEditState((prev) => ({ ...prev, tags: event.target.value }))}
                        className="w-full rounded-lg border border-sky-800/70 bg-slate-900/70 px-4 py-2 text-sm text-slate-50 focus:border-sky-400 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-sky-100" htmlFor="edit-thread-status">
                        Thread status
                      </label>
                      <select
                        id="edit-thread-status"
                        value={threadEditState.status}
                        onChange={(event) => setThreadEditState((prev) => ({
                          ...prev,
                          status: event.target.value as 'open' | 'locked',
                        }))}
                        className="w-full rounded-lg border border-sky-800/70 bg-slate-900/70 px-4 py-2 text-sm text-slate-50 focus:border-sky-400 focus:outline-none"
                      >
                        <option value="open">Open for replies</option>
                        <option value="locked">Locked</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {replyAccessOptions.map((option) => (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer flex-col gap-1 rounded-lg border px-3 py-3 text-sm transition ${
                          threadEditState.replyAccess === option.value
                            ? 'border-emerald-400 bg-emerald-900/30 text-emerald-100'
                            : 'border-sky-800/70 bg-slate-900/60 text-sky-100/80 hover:border-sky-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="edit-reply-access"
                          className="hidden"
                          checked={threadEditState.replyAccess === option.value}
                          onChange={() => setThreadEditState((prev) => ({ ...prev, replyAccess: option.value }))}
                        />
                        <span className="font-semibold">{option.label}</span>
                        <span className="text-xs text-slate-300/80">{option.helper}</span>
                      </label>
                    ))}
                  </div>
                  {threadEditState.replyAccess === 'custom' && (
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-sky-100" htmlFor="edit-allowed-users">
                        Allowed usernames
                      </label>
                      <input
                        id="edit-allowed-users"
                        value={threadEditState.allowed}
                        onChange={(event) => setThreadEditState((prev) => ({ ...prev, allowed: event.target.value }))}
                        className="w-full rounded-lg border border-sky-800/70 bg-slate-900/70 px-4 py-2 text-sm text-slate-50 focus:border-sky-400 focus:outline-none"
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-3 md:flex-row md:justify-end">
                    <Button
                      className="rounded-md border border-slate-700 bg-slate-900/70 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/90 md:w-auto"
                      onClick={() => setEditingThreadId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="rounded-md bg-emerald-500/90 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 md:w-auto"
                      onClick={handleSaveThread}
                    >
                      Save changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
                  <p className="text-base text-slate-100 whitespace-pre-line">{selectedThread.body}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>Updated {formatTimestamp(selectedThread.updated ?? selectedThread.created)}</span>
                    <span>•</span>
                    <span>
                      Replies: {selectedThread.replies.length} · Access:&nbsp;
                      {selectedThread.replyAccess === 'everyone' && 'All members'}
                      {selectedThread.replyAccess === 'publisher' && 'Thread author only'}
                      {selectedThread.replyAccess === 'custom' && 'Custom list'}
                    </span>
                  </div>
                  {selectedThread.replyAccess === 'custom' && selectedThread.allowedResponders.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedThread.allowedResponders.map((user) => (
                        <span
                          key={user}
                          className="rounded-full border border-sky-700/60 px-3 py-0.5 text-xs text-sky-100"
                        >
                          {user}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">
                    Replies ({selectedThread.replies.length})
                  </h3>
                  {selectedThread.status === 'locked' && (
                    <div className="flex items-center gap-2 rounded-full border border-slate-600/70 px-3 py-1 text-xs text-slate-200">
                      <HiOutlineLockClosed />
                      Locked by author
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {selectedThread.replies.length === 0 && (
                    <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-300">
                      No replies yet. Kick things off with the form below.
                    </div>
                  )}
                  {selectedThread.replies.map((reply) => {
                    const canEdit = username === reply.author;
                    const isEditing = editingReplyId === reply.id;
                    return (
                      <div
                        key={reply.id}
                        className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                          <span className="font-semibold text-slate-100">{reply.author}</span>
                          <span>{formatTimestamp(reply.updated ?? reply.created)}</span>
                        </div>
                        {isEditing ? (
                          <textarea
                            value={replyEditDraft}
                            onChange={(event) => setReplyEditDraft(event.target.value)}
                            rows={3}
                            className="mt-3 w-full rounded-lg border border-sky-800/70 bg-slate-950/70 px-3 py-2 text-sm text-slate-50 focus:border-sky-400 focus:outline-none"
                          />
                        ) : (
                          <p className="mt-2 whitespace-pre-line text-sm text-slate-100">
                            {reply.body}
                          </p>
                        )}
                        {canEdit && (
                          <div className="mt-3 flex flex-wrap gap-2 text-sm">
                            {isEditing ? (
                              <>
                                <Button
                                  className="rounded-md border border-slate-700 bg-slate-900/70 px-4 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-900/90 md:w-auto"
                                  onClick={() => {
                                    setEditingReplyId(null);
                                    setReplyEditDraft('');
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  className="rounded-md bg-emerald-500/90 px-4 py-1 text-xs font-semibold text-slate-900 hover:bg-emerald-400 md:w-auto"
                                  onClick={handleSaveReplyEdit}
                                >
                                  Save
                                </Button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => beginReplyEdit(reply)}
                                className="flex items-center gap-1 rounded-md border border-sky-700/60 px-3 py-1 text-xs font-semibold text-sky-100 transition hover:bg-slate-900/70"
                              >
                                <FiEdit3 className="text-sm" />
                                Edit
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {renderReplyComposer()}
            </div>
          )}
        </Box>
      </div>
    </div>
  );
};

export default DiscussionBoards;
