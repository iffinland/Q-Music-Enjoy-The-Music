import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayList } from '../../state/features/globalSlice';
import HomeCardHoverDetails from './HomeCardHoverDetails';
import radioImg from '../../assets/img/enjoy-music.jpg';
import { formatDateTime } from '../../utils/metadata';
import useCoverImage from '../../hooks/useCoverImage';

interface HomePlaylistCardProps {
  playlist: PlayList;
}

const truncate = (value: string, max = 160) => {
  if (!value) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}...`;
};

export const HomePlaylistCard: React.FC<HomePlaylistCardProps> = ({ playlist }) => {
  const navigate = useNavigate();

  const { url: coverUrl } = useCoverImage({
    identifier: playlist?.id ?? null,
    publisher: playlist?.user ?? null,
    enabled: Boolean(playlist?.id && playlist?.user),
  });
  const coverImage = playlist.image || coverUrl || radioImg;

  const encodedPublisher = playlist.user ? encodeURIComponent(playlist.user) : '';
  const encodedIdentifier = encodeURIComponent(playlist.id);

  const hoverEntries = useMemo(() => {
    const entries: { label: string; value: string }[] = [];

    if (playlist.description) {
      entries.push({
        label: 'Description',
        value: truncate(playlist.description, 220),
      });
    }

    if (playlist.songs?.length) {
      entries.push({
        label: 'Tracks',
        value: `${playlist.songs.length}`,
      });
    }

    if (playlist.user) {
      entries.push({
        label: 'Creator',
        value: playlist.user,
      });
    }

    if (playlist.categoryName) {
      entries.push({
        label: 'Category',
        value: playlist.categoryName,
      });
    }

    const published = formatDateTime(playlist.updated || playlist.created);
    if (published) {
      entries.push({
        label: 'Updated',
        value: published,
      });
    }

    return entries;
  }, [playlist.categoryName, playlist.created, playlist.description, playlist.songs, playlist.updated, playlist.user]);

  const performer = playlist.categoryName || (playlist.songs?.length ? `${playlist.songs.length} tracks` : 'Mixed playlist');
  const publisher = playlist.user || 'Unknown publisher';

  const handleNavigate = () => {
    if (playlist.user) {
      navigate(`/playlists/${encodedPublisher}/${encodedIdentifier}`);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          handleNavigate();
        }
      }}
      onClick={handleNavigate}
      className="group relative flex min-w-[200px] max-w-[200px] flex-col rounded-xl border border-sky-900/60 bg-sky-950/70 p-3 shadow transition hover:border-sky-700/70 hover:bg-sky-950/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-sky-950/80"
    >
      <div className="relative h-28 w-full group/card">
        <div className="h-full w-full overflow-hidden rounded-lg border border-sky-900/60 bg-sky-900/40">
          <img src={coverImage} alt={playlist.title || 'Playlist cover'} className="h-full w-full object-cover" loading="lazy" />
        </div>
        <HomeCardHoverDetails title="Playlist details" entries={hoverEntries} />
      </div>
      <div className="mt-3 space-y-1 text-left">
        <p
          className="text-sm font-semibold text-white"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {playlist.title || 'Untitled playlist'}
        </p>
        <p
          className="text-xs font-medium text-sky-300"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {performer}
        </p>
        <p className="text-[11px] text-sky-400/80" title={publisher}>
          {publisher}
        </p>
      </div>
    </div>
  );
};

export default HomePlaylistCard;
