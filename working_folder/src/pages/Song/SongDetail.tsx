import React, { useCallback, useEffect, useMemo, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Box from '../../components/Box';
import Button from '../../components/Button';
import Textarea from '../../components/TextArea';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../state/store';
import { setAddToDownloads, setCurrentSong, SongMeta } from '../../state/features/globalSlice';
import { fetchSongByIdentifier } from '../../services/songs';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import { MyContext } from '../../wrappers/DownloadWrapper';
import { SongComment, fetchSongComments, publishSongComment, deleteSongComment, updateSongComment } from '../../services/songComments';
import { FiTrash2, FiPlay, FiShare2, FiEdit2 } from 'react-icons/fi';
import { buildSongShareUrl } from '../../utils/qortalLinks';
import moment from 'moment';
import { toast } from 'react-hot-toast';
import useUploadModal from '../../hooks/useUploadModal';

const DEFAULT_COVER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect width="100%25" height="100%25" fill="%230b2137"%3E%3C/rect%3E%3Ctext x="50%25" y="50%25" fill="%2355a8ff" font-size="28" font-family="Arial" text-anchor="middle"%3ENo Cover%3C/text%3E%3C/svg%3E';

const SongDetail: React.FC = () => {
  const params = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { downloadVideo } = useContext(MyContext);
  const uploadModal = useUploadModal();
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const downloads = useSelector((state: RootState) => state.global.downloads);

  const publisher = useMemo(() => decodeURIComponent(params.publisher || ''), [params.publisher]);
  const identifier = useMemo(() => decodeURIComponent(params.identifier || ''), [params.identifier]);

  const [isLoadingSong, setIsLoadingSong] = useState(true);
  const [songError, setSongError] = useState<string | null>(null);
  const [song, setSong] = useState<SongMeta | null>(null);
  const [coverUrl, setCoverUrl] = useState<string>(DEFAULT_COVER);

  const [comments, setComments] = useState<SongComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState<boolean>(false);
  const [commentText, setCommentText] = useState<string>('');
  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editedCommentText, setEditedCommentText] = useState<string>('');
  const [isSavingCommentEdit, setIsSavingCommentEdit] = useState<boolean>(false);

  const loadSong = useCallback(async () => {
    if (!publisher || !identifier) {
      setSongError('Song identifier is missing.');
      setIsLoadingSong(false);
      return;
    }

    setIsLoadingSong(true);
    setSongError(null);

    try {
      const meta = await fetchSongByIdentifier(publisher, identifier);
      if (!meta) {
        setSongError('Song could not be found.');
        return;
      }
      setSong(meta);

      const artwork = await getQdnResourceUrl('THUMBNAIL', publisher, identifier);
      if (artwork) {
        setCoverUrl(artwork);
      }
    } catch (error) {
      console.error('Failed to load song details', error);
      setSongError('Failed to load the song details.');
    } finally {
      setIsLoadingSong(false);
    }
  }, [identifier, publisher]);

  const loadComments = useCallback(async () => {
    if (!publisher || !identifier) return;

    setIsLoadingComments(true);
    try {
      const results = await fetchSongComments(publisher, identifier);
      setComments(results);
    } catch (error) {
      console.error('Failed to load song comments', error);
    } finally {
      setIsLoadingComments(false);
    }
  }, [identifier, publisher]);

  useEffect(() => {
    loadSong();
  }, [loadSong]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handlePlaySong = useCallback(async () => {
    if (!song) return;

    try {
      const resolvedUrl = await getQdnResourceUrl('AUDIO', publisher, identifier);

      if (resolvedUrl) {
        dispatch(setAddToDownloads({
          name: publisher,
          service: 'AUDIO',
          id: identifier,
          identifier,
          url: resolvedUrl,
          status: song.status,
          title: song.title || '',
          author: song.author || '',
        }));
      } else {
        downloadVideo({
          name: publisher,
          service: 'AUDIO',
          identifier,
          title: song.title || '',
          author: song.author || '',
          id: identifier,
        });
      }

      dispatch(setCurrentSong(identifier));
    } catch (error) {
      console.error('Failed to play song', error);
      toast.error('Failed to start playback. Please try again.');
    }
  }, [dispatch, downloadVideo, identifier, publisher, song]);

  const handleShare = useCallback(async () => {
    try {
      const link = buildSongShareUrl(publisher, identifier);
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast.success('Link copied! Happy sharing!');
    } catch (error) {
      console.error('Failed to copy link', error);
      toast.error('Could not copy the link right now.');
    }
  }, [identifier, publisher]);

  const isOwner = useMemo(() => {
    if (!username || !song?.name) return false;
    return username.toLowerCase() === song.name.toLowerCase();
  }, [song?.name, username]);

  const handleEditSong = useCallback(() => {
    if (!song) return;
    if (!isOwner) {
      toast.error('Only the original publisher can edit this song.');
      return;
    }
    uploadModal.openSingleEdit(song);
  }, [isOwner, song, uploadModal]);

  const handleSubmitComment = useCallback(async () => {
    if (!username) {
      toast.error('Log in to comment.');
      return;
    }

    const trimmed = commentText.trim();
    if (!trimmed) {
      toast.error('Comment cannot be empty.');
      return;
    }

    setIsSubmittingComment(true);
    try {
      const newComment = await publishSongComment({
        publisher,
        identifier,
        author: username,
        message: trimmed,
        songTitle: song?.title,
      });

      setComments((prev) => [
        {
          ...newComment,
          author: username,
        },
        ...prev,
      ]);
      setCommentText('');
      toast.success('Comment added!');
    } catch (error) {
      console.error('Failed to publish comment', error);
      toast.error('Failed to add comment. Please try again.');
    } finally {
      setIsSubmittingComment(false);
    }
  }, [commentText, identifier, publisher, song?.title, username]);

  const handleDeleteComment = useCallback(async (comment: SongComment) => {
    if (!username) {
      toast.error('Log in to continue.');
      return;
    }

    const isAuthor = comment.author === username;
    if (!isAuthor) {
      toast.error('Only the original author can delete this comment.');
      return;
    }

    const confirmed = window.confirm('Delete this comment permanently?');
    if (!confirmed) return;

    try {
      await deleteSongComment(username, comment.id);
      setComments((prev) => prev.filter((entry) => entry.id !== comment.id));
      toast.success('Comment deleted.');
      if (editingCommentId === comment.id) {
        setEditingCommentId(null);
        setEditedCommentText('');
      }
    } catch (error) {
      console.error('Failed to delete comment', error);
      toast.error('Could not delete the comment.');
    }
  }, [editingCommentId, username]);

  const handleStartEditComment = useCallback((comment: SongComment) => {
    if (!username) {
      toast.error('Log in to continue.');
      return;
    }
    if (comment.author !== username) {
      toast.error('Only the original author can edit this comment.');
      return;
    }
    setEditingCommentId(comment.id);
    setEditedCommentText(comment.message);
  }, [username]);

  const handleCancelEditComment = useCallback(() => {
    setEditingCommentId(null);
    setEditedCommentText('');
  }, []);

  const handleSaveEditComment = useCallback(async () => {
    if (!editingCommentId) return;
    const target = comments.find((comment) => comment.id === editingCommentId);
    if (!target) {
      toast.error('Comment could not be found.');
      return;
    }
    const trimmed = editedCommentText.trim();
    if (!trimmed) {
      toast.error('Comment cannot be empty.');
      return;
    }
    setIsSavingCommentEdit(true);
    try {
      const updated = await updateSongComment(target, trimmed);
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === updated.id
            ? {
                ...comment,
                message: updated.message,
                updated: updated.updated,
              }
            : comment,
        ),
      );
      toast.success('Comment updated.');
      setEditingCommentId(null);
      setEditedCommentText('');
    } catch (error) {
      console.error('Failed to update comment', error);
      toast.error('Could not update the comment.');
    } finally {
      setIsSavingCommentEdit(false);
    }
  }, [comments, editedCommentText, editingCommentId]);

  const formattedDetails = useMemo(() => {
    if (!song?.description) return null;

    const pairs = song.description.split(';');
    const entries: Array<{ key: string; value: string }> = [];

    for (const pair of pairs) {
      const [rawKey, rawValue] = pair.split('=');
      if (!rawKey || !rawValue) continue;
      entries.push({
        key: rawKey.trim(),
        value: rawValue.trim(),
      });
    }

    return entries.length > 0 ? entries : null;
  }, [song]);

  const publishedLabel = useMemo(() => {
    if (!song?.created) return null;
    return moment(song.created).format('MMMM D, YYYY • HH:mm');
  }, [song]);

  const currentDownloadStatus = downloads[identifier]?.status?.status || song?.status?.status;

  return (
    <div className="px-4 py-6">
      <Header>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between w-full gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">
              {song?.title || identifier}
            </h1>
            <p className="text-sky-300/80">
              {song?.author ? `By ${song.author}` : 'Enjoy the music'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handlePlaySong}
              className="flex items-center justify-center gap-2 rounded-md bg-emerald-500/90 px-5 py-2 text-black transition hover:bg-emerald-400"
            >
              <FiPlay />
              {currentDownloadStatus === 'READY' ? 'Play again' : 'Play song'}
            </Button>
            <Button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 rounded-md bg-sky-700/80 px-5 py-2 text-white transition hover:bg-sky-600"
            >
              <FiShare2 />
              Share
            </Button>
            {isOwner && song && (
              <Button
                onClick={handleEditSong}
                className="flex items-center justify-center gap-2 rounded-md border border-sky-700/60 bg-sky-900/60 px-5 py-2 text-sky-100 transition hover:bg-sky-800/60"
              >
                <FiEdit2 />
                Edit
              </Button>
            )}
            <Button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center gap-2 rounded-md border border-sky-900/60 bg-slate-900/50 px-5 py-2 text-sky-200/80 transition hover:bg-slate-900/40"
            >
              Go Back
            </Button>
          </div>
        </div>
      </Header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px,1fr]">
        <Box className="p-6 flex flex-col items-center gap-4">
          <img
            src={coverUrl}
            alt={song?.title || 'Song artwork'}
            className="w-full rounded-lg border border-sky-900/60 object-cover"
          />

          <div className="w-full text-center md:text-left">
            <h2 className="text-xl font-semibold text-white">{song?.title || identifier}</h2>
            {song?.author && (
              <p className="text-sky-200/80 text-sm mt-1">Performed by {song.author}</p>
            )}
            <p className="text-sky-400/70 text-xs mt-2">
              Published by <span className="font-medium text-sky-200">{publisher}</span>
            </p>
            {publishedLabel && (
              <p className="text-sky-400/60 text-xs mt-1">Published on {publishedLabel}</p>
            )}
          </div>
        </Box>

        <div className="flex flex-col gap-6">
          <Box className="p-6">
            <h3 className="text-lg font-semibold text-white mb-3">Additional Information</h3>
            {formattedDetails ? (
              <dl className="grid gap-2">
                {formattedDetails.map((entry) => (
                  <div key={`${entry.key}-${entry.value}`} className="grid grid-cols-[140px,1fr] gap-4">
                    <dt className="text-sm font-semibold text-sky-200/80 uppercase tracking-wide">
                      {entry.key}
                    </dt>
                    <dd className="text-sm text-sky-100">{entry.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-sky-200/70">
                No extra information has been provided yet. Stay tuned!
              </p>
            )}
          </Box>

          <Box className="p-6">
            <h3 className="text-lg font-semibold text-white mb-3">Comments</h3>

            <div className="mb-4">
              <Textarea
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder={username ? "Share your thoughts about this song..." : "Log in to comment"}
                disabled={isSubmittingComment || !username}
                className="h-28 resize-none"
              />
              <div className="mt-3 flex justify-end">
                <Button
                  onClick={handleSubmitComment}
                  disabled={isSubmittingComment || !username}
                  className="bg-sky-700 hover:bg-sky-600 px-6 py-2 w-auto"
                >
                  {isSubmittingComment ? 'Adding...' : 'Add Comment'}
                </Button>
              </div>
            </div>

            <div className="border-t border-sky-900/60 pt-4 space-y-4">
              {isLoadingComments && comments.length === 0 && (
                <p className="text-sm text-sky-200/70">Loading comments…</p>
              )}
              {!isLoadingComments && comments.length === 0 && (
                <p className="text-sm text-sky-200/70">No comments yet. Be the first!</p>
              )}
              {comments.map((comment) => {
                const canModify = username && comment.author === username;
                const isEditing = editingCommentId === comment.id;
                const displayTimestamp = comment.updated ?? comment.created;
                return (
                  <div
                    key={comment.id}
                    className="rounded-lg border border-sky-900/50 bg-sky-950/40 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-sky-100">
                        {comment.author || 'Anonymous'}
                      </span>
                      <span className="text-xs text-sky-400/70">
                        {moment(displayTimestamp).format('MMM D, YYYY • HH:mm')}
                        {comment.updated && comment.updated !== comment.created && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-sky-400/50">
                            (edited)
                          </span>
                        )}
                      </span>
                    </div>
                    {isEditing ? (
                      <div className="mt-3 space-y-3">
                        <Textarea
                          value={editedCommentText}
                          onChange={(event) => setEditedCommentText(event.target.value)}
                          className="h-24 resize-none"
                        />
                        <div className="flex flex-wrap gap-2 text-xs">
                          <button
                            type="button"
                            onClick={handleSaveEditComment}
                            disabled={isSavingCommentEdit}
                            className="flex items-center gap-1 rounded border border-emerald-500/60 bg-emerald-600/20 px-3 py-1 text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-60"
                          >
                            {isSavingCommentEdit ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditComment}
                            disabled={isSavingCommentEdit}
                            className="flex items-center gap-1 rounded border border-sky-700/60 bg-sky-900/40 px-3 py-1 text-sky-200 transition hover:bg-sky-800/40 disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-sky-200/80 whitespace-pre-wrap">
                        {comment.message}
                      </p>
                    )}
                    {canModify && !isEditing && (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => handleStartEditComment(comment)}
                          className="flex items-center gap-1 rounded border border-sky-600/60 px-2 py-1 text-sky-200 transition hover:bg-sky-700/20"
                        >
                          <FiEdit2 />
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Box>
        </div>
      </div>

      {isLoadingSong && (
        <div className="mt-6 text-center text-sky-200/70">Loading song details…</div>
      )}
      {songError && (
        <div className="mt-6 rounded-md border border-red-500/40 bg-red-900/30 px-4 py-3 text-sm text-red-200 text-center">
          {songError}
        </div>
      )}
    </div>
  );
};

export default SongDetail;
