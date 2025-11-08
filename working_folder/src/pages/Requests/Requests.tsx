import React, { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Button from '../../components/Button';
import Box from '../../components/Box';
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
import { fetchRequestsFromQdn } from '../../services/qdnRequests';
import { FiEdit2 } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import RequestLikeButton from '../../components/requests/RequestLikeButton';
import RequestRewardInfo from '../../components/requests/RequestRewardInfo';

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

  useEffect(() => {
    const handleRefresh = () => {
      loadRequests();
    };
    window.addEventListener('requests:refresh', handleRefresh);
    return () => {
      window.removeEventListener('requests:refresh', handleRefresh);
    };
  }, [loadRequests]);

  const isRequestFilled = useCallback((request: SongRequest) => {
    const normalizedStatus = (request.status || '').toLowerCase();
    return normalizedStatus === 'filled'
      || Boolean(request.filledAt)
      || Boolean(request.filledBy)
      || Boolean(request.filledSongIdentifier)
      || Boolean(fills[request.id]);
  }, [fills]);

  const openRequests = useMemo(
    () => requests.filter((request) => !isRequestFilled(request)),
    [requests, isRequestFilled],
  );

  const formatTimestamp = (value?: number) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return '—';
    }
  };

  const handleEditRequest = useCallback((
    event: React.MouseEvent<HTMLButtonElement>,
    request: SongRequest,
  ) => {
    event.stopPropagation();
    event.preventDefault();

    if (!username) {
      toast.error('Log in to edit requests.');
      return;
    }

    if (username !== request.publisher) {
      toast.error('Only the original author can edit this request.');
      return;
    }

    requestModal.onOpen(request);
  }, [requestModal, username]);

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
              className="bg-sky-800/80 text-white hover:bg-sky-700 md:w-auto rounded-md px-5 py-3 font-semibold shadow-lg shadow-sky-950/50"
              onClick={loadRequests}
              disabled={isLoading}
            >
              {isLoading ? 'Refreshing…' : 'Refresh list'}
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-500 text-white md:w-auto rounded-md px-5 py-3 font-semibold shadow-lg shadow-amber-900/30"
              onClick={() => requestModal.onOpen(null)}
            >
              Add new request
            </Button>
          </div>
        </div>
      </Header>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Button
          className="flex-1 min-h-[48px] rounded-md bg-emerald-500/90 px-5 py-3 text-base font-semibold text-black shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 aria-[current=page]:shadow-slate-950/70 aria-[current=page]:bg-sky-700/80 aria-[current=page]:text-white aria-[current=page]:border aria-[current=page]:border-sky-800/60"
          onClick={() => navigate('/requests')}
          aria-current="page"
        >
          Open Requests
        </Button>
        <Button
          className="flex-1 min-h-[48px] rounded-md border border-sky-800/60 bg-sky-900/70 px-5 py-3 text-base font-semibold text-sky-100 shadow-lg shadow-sky-950/60 transition hover:bg-sky-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          onClick={() => navigate('/requests/filled')}
        >
          Filled Requests
        </Button>
      </div>

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
            {openRequests.map((request) => {
              const isFilled = isRequestFilled(request);
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
                    <div className="flex flex-wrap gap-2 pt-2 text-xs">
                      <RequestLikeButton request={request} username={username} />
                      {username === request.publisher && (
                        <button
                          type="button"
                          onClick={(event) => handleEditRequest(event, request)}
                          className="flex items-center gap-1 rounded border border-sky-500/60 px-2 py-1 text-sky-200 transition hover:bg-sky-500/20"
                        >
                          <FiEdit2 />
                          Edit
                        </button>
                      )}
                    </div>
                    <div className="pt-3">
                      <RequestRewardInfo request={request} fill={fill} />
                    </div>
                  </div>
                  <div className="w-full md:w-40">
                    <Button
                      className={`py-2 px-4 rounded-full md:w-full ${
                        isFilled
                          ? 'bg-sky-800/60 text-sky-200/70 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (isFilled) return;
                          fillModal.onOpen(request);
                        }}
                        disabled={isFilled}
                      >
                        {isFilled ? 'FILLED' : 'FILL IT'}
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
