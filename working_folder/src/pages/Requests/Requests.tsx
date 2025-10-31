import React, { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Button from '../../components/Button';
import { RootState } from '../../state/store';
import {
  setRequestsLoading,
  setRequestsError,
  setSongRequests,
  setRequestFills,
  SongRequest,
} from '../../state/features/requestsSlice';
import useRequestModal from '../../hooks/useRequestModal';
import useFillRequestModal from '../../hooks/useFillRequestModal';
import { fetchRequestsFromQdn, deleteRequest, reportRequest } from '../../services/qdnRequests';
import { FiTrash2, FiFlag } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

const Requests: React.FC = () => {
  const dispatch = useDispatch();
  const requestModal = useRequestModal();
  const fillModal = useFillRequestModal();
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const navigate = useNavigate();

  const { requests, isLoading, error, fills } = useSelector((state: RootState) => state.requests);

  const loadRequests = useCallback(async () => {
    dispatch(setRequestsLoading(true));
    dispatch(setRequestsError(null));

    try {
      const result = await fetchRequestsFromQdn();
      dispatch(setRequestFills(result.fills));
      dispatch(setSongRequests(result.requests));
    } catch (err: any) {
      dispatch(setRequestsError(err?.message || 'Failed to load requests'));
    } finally {
      dispatch(setRequestsLoading(false));
    }
  }, [dispatch]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const openRequests = useMemo(
    () => requests.filter((request) => request.status !== 'filled'),
    [requests],
  );

  const filledRequests = useMemo(
    () => requests.filter((request) => request.status === 'filled'),
    [requests],
  );

  const formatTimestamp = (value?: number) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return '—';
    }
  };

  const handleDeleteRequest = useCallback(async (
    event: React.MouseEvent<HTMLButtonElement>,
    request: SongRequest,
  ) => {
    event.stopPropagation();

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
      loadRequests();
      window.dispatchEvent(new CustomEvent('statistics:refresh'));
    } catch (error) {
      console.error('Failed to delete request', error);
      toast.error('Could not delete the request.');
    }
  }, [loadRequests, username]);

  const handleReportRequest = useCallback(async (
    event: React.MouseEvent<HTMLButtonElement>,
    request: SongRequest,
  ) => {
    event.stopPropagation();

    if (!username) {
      toast.error('Log in to report requests.');
      return;
    }
    const reason = window.prompt('Describe the issue with this request (optional):', '');
    if (reason === null) return;

    try {
      await reportRequest(username, request.id, reason || 'Reported without comment');
      toast.success('Request was reported.');
    } catch (error) {
      console.error('Failed to report request', error);
      toast.error('Could not report the request.');
    }
  }, [username]);

  return (
    <div className="px-4 py-6 space-y-6">
      <Header>
        <div className="flex flex-col gap-y-4 md:flex-row md:items-center md:justify-between">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-bold text-white">Requests</h1>
            <p className="text-sky-300/80">Ask the community for songs and fill existing requests.</p>
          </div>
          <div className="flex flex-col gap-y-2 md:flex-row md:gap-x-2">
            <Button
              className="bg-sky-800/80 text-white hover:bg-sky-700 py-2 px-6 rounded-full md:w-auto"
              onClick={loadRequests}
              disabled={isLoading}
            >
              {isLoading ? 'Refreshing…' : 'Refresh list'}
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-500 text-white py-2 px-6 rounded-full md:w-auto"
              onClick={requestModal.onOpen}
            >
              Add new request
            </Button>
          </div>
        </div>
      </Header>

      {error && (
        <div className="rounded-md border border-red-700 bg-red-900/60 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-sky-900/60 bg-sky-950/70">
        <header className="flex flex-col gap-y-1 border-b border-sky-900/60 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Open requests</h2>
            <p className="text-sm text-sky-300/80">Newest requests appear first.</p>
          </div>
          <span className="text-sm text-sky-200/70">{openRequests.length} open</span>
        </header>
        {isLoading && openRequests.length === 0 ? (
          <div className="px-4 py-8 text-center text-sky-200/70">Loading requests…</div>
        ) : openRequests.length === 0 ? (
          <div className="px-4 py-8 text-center text-sky-200/70">
            No pending requests yet. Be the first one to submit a request!
          </div>
        ) : (
          <ul className="divide-y divide-sky-900/60">
            {openRequests.map((request) => (
              <li
                key={request.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/requests/${encodeURIComponent(request.publisher)}/${encodeURIComponent(request.id)}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/requests/${encodeURIComponent(request.publisher)}/${encodeURIComponent(request.id)}`);
                  }
                }}
                className="flex flex-col gap-y-4 px-4 py-4 md:flex-row md:items-center md:justify-between cursor-pointer hover:bg-sky-900/30 transition"
              >
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-white">
                    {request.artist} — {request.title}
                  </p>
                  {request.info && (
                    <p className="whitespace-pre-line text-sm text-sky-200/80">{request.info}</p>
                  )}
                  <p className="text-xs text-sky-400/70">
                    Requested by {request.publisher} · {formatTimestamp(request.created)}
                  </p>
                    <div className="flex flex-wrap gap-2 pt-2 text-xs">
                      {username === request.publisher && (
                        <button
                          type="button"
                          onClick={(event) => handleDeleteRequest(event, request)}
                          className="flex items-center gap-1 rounded border border-red-500/60 px-2 py-1 text-red-200 transition hover:bg-red-500/20"
                        >
                          <FiTrash2 />
                          Delete
                        </button>
                      )}
                      {username && username !== request.publisher && (
                        <button
                          type="button"
                          onClick={(event) => handleReportRequest(event, request)}
                          className="flex items-center gap-1 rounded border border-amber-500/60 px-2 py-1 text-amber-200 transition hover:bg-amber-500/20"
                        >
                          <FiFlag />
                          Report
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="w-full md:w-40">
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-4 rounded-full md:w-full"
                      onClick={(event) => {
                        event.stopPropagation();
                        fillModal.onOpen(request);
                      }}
                    >
                      FILL IT
                    </Button>
                  </div>
                </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-sky-900/60 bg-sky-950/70">
        <header className="flex flex-col gap-y-1 border-b border-sky-900/60 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Recently filled</h2>
            <p className="text-sm text-sky-300/80">Completed requests stay here for reference.</p>
          </div>
          <span className="text-sm text-sky-200/70">{filledRequests.length} filled</span>
        </header>
        {filledRequests.length === 0 ? (
          <div className="px-4 py-8 text-center text-sky-200/70">No filled requests yet.</div>
        ) : (
          <ul className="divide-y divide-sky-900/60">
            {filledRequests.map((request) => {
              const fill = fills[request.id];
              return (
                <li
                  key={request.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/requests/${encodeURIComponent(request.publisher)}/${encodeURIComponent(request.id)}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/requests/${encodeURIComponent(request.publisher)}/${encodeURIComponent(request.id)}`);
                    }
                  }}
                  className="flex flex-col gap-y-4 px-4 py-4 md:flex-row md:items-center md:justify-between cursor-pointer hover:bg-sky-900/30 transition"
                >
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-white">
                      {request.artist} — {request.title}
                    </p>
                    {request.info && (
                      <p className="whitespace-pre-line text-sm text-sky-200/80">{request.info}</p>
                    )}
                    <p className="text-xs text-sky-400/70">
                      Requested by {request.publisher} · {formatTimestamp(request.created)}
                    </p>
                    {fill && (
                      <p className="text-xs text-emerald-300/80">
                        Filled by {fill.filledBy} · {fill.songArtist} — {fill.songTitle} (
                        {formatTimestamp(fill.created)})
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-2 text-xs">
                      {username === request.publisher && (
                        <button
                          type="button"
                          onClick={(event) => handleDeleteRequest(event, request)}
                          className="flex items-center gap-1 rounded border border-red-500/60 px-2 py-1 text-red-200 transition hover:bg-red-500/20"
                        >
                          <FiTrash2 />
                          Delete
                        </button>
                      )}
                      {username && username !== request.publisher && (
                        <button
                          type="button"
                          onClick={(event) => handleReportRequest(event, request)}
                          className="flex items-center gap-1 rounded border border-amber-500/60 px-2 py-1 text-amber-200 transition hover:bg-amber-500/20"
                        >
                          <FiFlag />
                          Report
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="w-full md:w-40">
                    <Button
                      className="bg-sky-800/60 text-sky-200/70 cursor-not-allowed py-2 px-4 rounded-full md:w-full"
                      disabled
                    >
                      FILLED
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default Requests;
