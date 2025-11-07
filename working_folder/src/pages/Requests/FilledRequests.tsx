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
import { fetchRequestsFromQdn } from '../../services/qdnRequests';
import RequestRewardInfo from '../../components/requests/RequestRewardInfo';

const FilledRequests: React.FC = () => {
  const dispatch = useDispatch();
  const requestModal = useRequestModal();
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

  const filledRequests = useMemo(
    () => requests.filter((request) => isRequestFilled(request)),
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

  return (
    <div className="px-4 py-6 space-y-6">
      <Header>
        <div className="flex flex-col gap-y-4 md:flex-row md:items-center md:justify-between">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-bold text-white">Filled Requests</h1>
            <p className="text-sky-300/80">Browse the latest completed requests and share feedback.</p>
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

      <Box className="border border-amber-600/40 bg-amber-900/30 p-4 text-sm text-amber-100 shadow-lg shadow-amber-900/20">
        <p className="font-semibold uppercase tracking-wide text-amber-200">
          Earn QRRTs by fulfilling every request (coming soon)
        </p>
      </Box>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Button
          className="flex-1 min-h-[48px] rounded-md border border-emerald-700/70 bg-emerald-900/40 px-5 py-3 text-base font-semibold text-emerald-100 shadow-lg shadow-emerald-950/50 transition hover:bg-emerald-500/80 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 aria-[current=page]:bg-sky-700/80 aria-[current=page]:text-white aria-[current=page]:border-sky-800/60 aria-[current=page]:shadow-slate-950/70"
          onClick={() => navigate('/requests')}
        >
          Open Requests
        </Button>
        <Button
          className="flex-1 min-h-[48px] rounded-md bg-sky-700/80 px-5 py-3 text-base font-semibold text-white shadow-lg shadow-slate-950/70 transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          onClick={() => navigate('/requests/filled')}
          aria-current="page"
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
                    <div className="pt-3">
                      <RequestRewardInfo request={request} fill={fill} />
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

export default FilledRequests;
