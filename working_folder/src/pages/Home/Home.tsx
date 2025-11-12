import React from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Box from '../../components/Box';
import Button from '../../components/Button';
import { useHomeFeed } from '../../hooks/useHomeFeed';
import HomeSongCard from '../../components/home/HomeSongCard';
import HomePlaylistCard from '../../components/home/HomePlaylistCard';
import HomePodcastCard from '../../components/home/HomePodcastCard';
import HomeAudiobookCard from '../../components/home/HomeAudiobookCard';
import HomeVideoCard from '../../components/home/HomeVideoCard';
import qmusicLogo from '../../assets/img/qmusic.png';
import { RootState } from '../../state/store';
import {
  setDiscussionThreads,
  setLastReadTimestamp,
  setUnreadThreadIds,
} from '../../state/features/discussionsSlice';
import { fetchDiscussionThreadsFromQdn } from '../../services/discussionBoards';
import { readLastReadTimestamp } from '../../utils/discussionsReadState';
import { setNotification } from '../../state/features/notificationsSlice';

const SectionSkeleton: React.FC<{ items?: number; variant?: 'default' | 'compact' }> = ({ items = 6, variant = 'default' }) => {
  const itemClass = variant === 'compact' ? 'h-32 w-36 md:h-32 md:w-40' : 'h-44 w-44';
  const baseSkeleton =
    'flex-shrink-0 rounded-xl border border-sky-900/60 bg-gradient-to-br from-sky-950/80 via-sky-900/50 to-sky-950/80 shadow-inner animate-pulse';
  return (
    <div className="flex overflow-x-auto gap-x-4 pb-3 horizontal-scrollbar" aria-hidden>
      {Array.from({ length: items }).map((_, index) => (
        <div key={`home-skeleton-${index}`} className={`${baseSkeleton} ${itemClass}`} />
      ))}
    </div>
  );
};

const ErrorNotice: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="rounded-lg border border-red-500/40 bg-red-900/40 px-4 py-3 text-sm text-red-100">
    <p className="mb-2 font-semibold">{message}</p>
    <Button onClick={onRetry} className="w-auto bg-red-600/80 px-4 py-2 text-xs uppercase tracking-wide">
      Try again
    </Button>
  </div>
);

const HorizontalScroll: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex overflow-x-auto gap-x-4 pb-3 horizontal-scrollbar">
    {children}
  </div>
);

const HomeSection: React.FC<{
  title: string;
  viewAllTo?: string;
  viewAllLabel?: string;
  children: React.ReactNode;
}> = ({ title, viewAllTo, viewAllLabel = 'View all', children }) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xl font-semibold text-white md:text-2xl">{title}</h2>
      {viewAllTo && (
        <Link
          to={viewAllTo}
          className="text-xs font-semibold uppercase tracking-wide text-sky-300 transition hover:text-sky-100"
        >
          {viewAllLabel}
        </Link>
      )}
    </div>
    {children}
  </section>
);

const HomeHero = () => (
  <section className="rounded-2xl border border-sky-900/60 bg-gradient-to-br from-sky-950/85 via-sky-900/60 to-sky-950/80 px-4 py-5 shadow-lg sm:px-6 sm:py-6">
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-bold text-white md:text-3xl">
        <span className="inline-flex items-center gap-3">
          <img src={qmusicLogo} alt="Q-Music logo" className="h-9 w-9 shrink-0" />
          Enjoy and share music, podcasts, and audiobooks with the Q-Music community
        </span>
      </h1>
      <p className="text-sm text-sky-200/85 md:text-base">
        Discover the latest community creations and keep your library fresh with new songs, playlists, podcasts, audiobooks and videos.
      </p>
    </div>
  </section>
);

let discussionsPrefetchedOnce = false;
let homeUnreadToastShown = false;

export const Home = () => {
  const dispatch = useDispatch();
  const { unreadThreadIds, lastReadTimestamp } = useSelector((state: RootState) => state.discussions);
  const { data, isLoading, error, refresh } = useHomeFeed({
    songsLimit: 12,
    playlistsLimit: 12,
    podcastsLimit: 8,
    audiobooksLimit: 8,
    videosLimit: 8,
  });

  const songs = data?.songs ?? [];
  const playlists = data?.playlists ?? [];
  const podcasts = data?.podcasts ?? [];
  const audiobooks = data?.audiobooks ?? [];
  const videos = data?.videos ?? [];
  const filteredVideos = React.useMemo(
    () =>
      videos.filter((video) => {
        if (!video) return false;
        const identifier = (video.id || '').toLowerCase();
        if (!identifier) return false;
        if (identifier.startsWith('video_like_')) return false;

        const normalizedTitle = (video.title || '').trim();
        if (normalizedTitle.length === 0) return false;
        if (/^like[:\s]/i.test(normalizedTitle)) return false;
        if (/video\s+like\s+for/i.test(normalizedTitle)) return false;

        const normalizedDescription = (video.description || '').toLowerCase();
        if (normalizedDescription.includes('video like for')) return false;

        return Boolean(video.publisher);
      }),
    [videos],
  );

  const showSongSkeleton = isLoading && songs.length === 0;
  const showPlaylistSkeleton = isLoading && playlists.length === 0;
  const showPodcastSkeleton = isLoading && podcasts.length === 0;
  const showAudiobookSkeleton = isLoading && audiobooks.length === 0;
  const showVideoSkeleton = isLoading && filteredVideos.length === 0;

  const hasAnyData = songs.length + playlists.length + podcasts.length + audiobooks.length + videos.length > 0;
  const shouldShowError = !isLoading && error && !hasAnyData;

  React.useEffect(() => {
    let cancelled = false;

    const preloadDiscussions = async () => {
      try {
        const threads = await fetchDiscussionThreadsFromQdn();
        if (cancelled) return;
        dispatch(setDiscussionThreads(threads));
        const baselineLastRead = lastReadTimestamp || readLastReadTimestamp();
        if (!lastReadTimestamp && baselineLastRead > 0) {
          dispatch(setLastReadTimestamp(baselineLastRead));
        }
        const unreadIds = threads
          .filter((thread) => {
            const updatedAt = thread.updated ?? thread.created ?? 0;
            return updatedAt > (baselineLastRead || 0);
          })
          .map((thread) => thread.id);
        dispatch(setUnreadThreadIds(unreadIds));
        if (unreadIds.length > 0 && !homeUnreadToastShown) {
          dispatch(setNotification({
            alertType: 'info',
            msg: 'There are unread posts in the forum or a topic you are following has been answered.',
          }));
          homeUnreadToastShown = true;
        }
      } catch (err) {
        console.error('Failed to preload discussion threads', err);
      }
    };

    if (!discussionsPrefetchedOnce) {
      discussionsPrefetchedOnce = true;
      preloadDiscussions();
    } else if (unreadThreadIds.length > 0 && !homeUnreadToastShown) {
      dispatch(setNotification({
        alertType: 'info',
        msg: 'There are unread posts in the forum or a topic you are following has been answered.',
      }));
      homeUnreadToastShown = true;
    }

    return () => {
      cancelled = true;
    };
  }, [dispatch, unreadThreadIds.length, lastReadTimestamp]);

  return (
    <Box className="overflow-hidden">
      <div className="space-y-10 px-6 py-6">
        <HomeHero />

        {shouldShowError && (
          <ErrorNotice
            message="Failed to load the latest content. Check your connection and try again."
            onRetry={refresh}
          />
        )}

        <HomeSection title="Newest songs" viewAllTo="/songs" viewAllLabel="All Audio">
          {showSongSkeleton ? (
            <SectionSkeleton variant="compact" />
          ) : (
            <HorizontalScroll>
              {songs.map((song) => (
                <HomeSongCard key={song.id} song={song} />
              ))}
            </HorizontalScroll>
          )}
        </HomeSection>

        <HomeSection title="Newest playlists" viewAllTo="/playlists/all" viewAllLabel="All Playlists">
          {showPlaylistSkeleton ? (
            <SectionSkeleton variant="compact" />
          ) : (
            <HorizontalScroll>
              {playlists.map((playlist) => (
                <HomePlaylistCard key={playlist.id} playlist={playlist} />
              ))}
            </HorizontalScroll>
          )}
        </HomeSection>

        {(showPodcastSkeleton || podcasts.length > 0 || audiobooks.length > 0) && (
          <HomeSection title="Newest podcasts" viewAllTo="/podcasts" viewAllLabel="All Podcasts">
            {showPodcastSkeleton ? (
              <SectionSkeleton variant="compact" />
            ) : (
              <HorizontalScroll>
                {podcasts.map((podcast) => (
                  <HomePodcastCard key={podcast.id} podcast={podcast} />
                ))}
              </HorizontalScroll>
            )}

            {(showAudiobookSkeleton || audiobooks.length > 0) && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white md:text-xl">Newest audiobooks</h3>
                  <Link
                    to="/audiobooks"
                    className="text-xs font-semibold uppercase tracking-wide text-sky-300 transition hover:text-sky-100"
                  >
                    All Audiobooks
                  </Link>
                </div>
                {showAudiobookSkeleton ? (
                  <SectionSkeleton variant="compact" />
                ) : (
                  <HorizontalScroll>
                    {audiobooks.map((audiobook) => (
                      <HomeAudiobookCard key={audiobook.id} audiobook={audiobook} />
                    ))}
                  </HorizontalScroll>
                )}
              </div>
            )}
          </HomeSection>
        )}

        {(showVideoSkeleton || filteredVideos.length > 0) && (
          <HomeSection title="Newest videos" viewAllTo="/videos" viewAllLabel="All Videos">
            {showVideoSkeleton ? (
              <SectionSkeleton variant="compact" />
            ) : (
              <HorizontalScroll>
                {filteredVideos.map((video) => (
                  <HomeVideoCard key={video.id} video={video} />
                ))}
              </HorizontalScroll>
            )}
          </HomeSection>
        )}
      </div>
    </Box>
  );
};
