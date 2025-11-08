import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header';
import Button from '../../components/Button';
import {
  fetchRequestsFromQdn,
} from '../../services/qdnRequests';
import { SongRequest } from '../../state/features/requestsSlice';
import RequestRewardInfo from '../../components/requests/RequestRewardInfo';

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

  return (
    <div className="px-4 py-6 space-y-6">
      <Header>
        <div className="flex flex-col gap-y-2">
          <h1 className="text-3xl font-bold text-white">Request details</h1>
          <p className="text-sky-300/80">
            Review the information and track the status of this request.
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

            <RequestRewardInfo
              request={request}
              onRequestUpdated={(updated) => setRequest(updated)}
            />

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleGoBack}
                className="rounded-md bg-sky-800/80 px-5 py-3 font-semibold text-white shadow-lg shadow-sky-950/40 transition hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
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
