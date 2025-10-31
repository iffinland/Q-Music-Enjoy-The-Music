import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Header from '../../components/Header';
import Button from '../../components/Button';
import {
  fetchRequestsFromQdn,
  deleteRequest,
  reportRequest,
} from '../../services/qdnRequests';
import { SongRequest } from '../../state/features/requestsSlice';
import { RootState } from '../../state/store';
import { toast } from 'react-hot-toast';
import useFillRequestModal from '../../hooks/useFillRequestModal';

const formatTimestamp = (value?: number) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
};

const RequestDetail: React.FC = () => {
  const { publisher, requestId } = useParams();
  const navigate = useNavigate();
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const fillModal = useFillRequestModal();

  const [request, setRequest] = useState<SongRequest | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadRequest = useCallback(async () => {
    if (!publisher || !requestId) {
      setError('Missing request identifier.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchRequestsFromQdn();
      const match = result.requests.find(
        (entry) => entry.id === requestId && entry.publisher === publisher,
      );

      if (!match) {
        setError('Request could not be found.');
        setRequest(null);
      } else {
        setRequest(match);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load request.');
      setRequest(null);
    } finally {
      setIsLoading(false);
    }
  }, [publisher, requestId]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  const handleGoBack = useCallback(() => {
    navigate('/requests');
  }, [navigate]);

  const handleFill = useCallback(() => {
    if (!request) return;
    fillModal.onOpen(request);
  }, [fillModal, request]);

  const handleDelete = useCallback(async () => {
    if (!request) return;
    if (!username) {
      toast.error('Log in to manage requests.');
      return;
    }
    if (username !== request.publisher) {
      toast.error('Only the original author can delete this request.');
      return;
    }

    try {
      await deleteRequest(request.publisher, request.id);
      toast.success('Request deleted.');
      window.dispatchEvent(new CustomEvent('statistics:refresh'));
      navigate('/requests');
    } catch (err) {
      console.error('Failed to delete request', err);
      toast.error('Could not delete the request.');
    }
  }, [navigate, request, username]);

  const handleReport = useCallback(async () => {
    if (!request) return;
    if (!username) {
      toast.error('Log in to report requests.');
      return;
    }
    const reason = window.prompt('Describe the issue with this request (optional):', '');
    if (reason === null) return;

    try {
      await reportRequest(username, request.id, reason || 'Reported without comment');
      toast.success('Request was reported.');
    } catch (err) {
      console.error('Failed to report request', err);
      toast.error('Could not report the request.');
    }
  }, [request, username]);

  const isOwner = useMemo(
    () => Boolean(request && username && request.publisher === username),
    [request, username],
  );

  return (
    <div className="px-4 py-6 space-y-6">
      <Header>
        <div className="flex flex-col gap-y-2">
          <h1 className="text-3xl font-bold text-white">Request details</h1>
          <p className="text-sky-300/80">
            Review the request information, fill it, or manage it if you are the author.
          </p>
        </div>
      </Header>

      <div className="rounded-lg border border-sky-900/60 bg-sky-950/70 p-6">
        {isLoading ? (
          <p className="text-center text-sky-200/70">Loading request…</p>
        ) : error ? (
          <div className="space-y-4 text-center text-sky-200/70">
            <p>{error}</p>
            <Button onClick={handleGoBack} className="bg-sky-800/70 hover:bg-sky-700 text-white">
              Back to requests
            </Button>
          </div>
        ) : !request ? (
          <div className="space-y-4 text-center text-sky-200/70">
            <p>Request not available.</p>
            <Button onClick={handleGoBack} className="bg-sky-800/70 hover:bg-sky-700 text-white">
              Back to requests
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-white">
                {request.artist} — {request.title}
              </h2>
              <p className="mt-2 text-sm text-sky-300/80">
                Requested by {request.publisher} · {formatTimestamp(request.created)}
              </p>
              {request.status === 'filled' && (
                <p className="mt-1 text-sm text-emerald-300/80">
                  Filled by {request.filledBy ?? 'Unknown'} ·{' '}
                  {formatTimestamp(request.filledAt)} · {request.filledSongArtist} —{' '}
                  {request.filledSongTitle}
                </p>
              )}
            </div>

            {request.info && (
              <section className="rounded-md border border-sky-900/60 bg-sky-950/40 p-4 text-sm leading-relaxed text-sky-100/90 whitespace-pre-line">
                {request.info}
              </section>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleFill}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Fill this request
              </Button>
              {isOwner && (
                <Button
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-500 text-white"
                >
                  Delete
                </Button>
              )}
              {username && username !== request.publisher && (
                <Button
                  onClick={handleReport}
                  className="bg-amber-600 hover:bg-amber-500 text-white"
                >
                  Report
                </Button>
              )}
              <Button
                onClick={handleGoBack}
                className="border border-sky-700/70 text-sky-200/80 hover:bg-sky-900/30"
              >
                Back to list
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestDetail;
