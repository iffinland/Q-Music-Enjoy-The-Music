import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SongMeta } from '../../state/features/globalSlice';
import HomeCardHoverDetails from './HomeCardHoverDetails';
import radioImg from '../../assets/img/enjoy-music.jpg';
import { buildMetadataEntries, formatDateTime, parseKeyValueMetadata } from '../../utils/metadata';
import useCoverImage from '../../hooks/useCoverImage';

interface HomeSongCardProps {
  song: SongMeta;
}

export const HomeSongCard: React.FC<HomeSongCardProps> = ({ song }) => {
  const navigate = useNavigate();

  const { url: coverUrl } = useCoverImage({
    identifier: song?.id,
    publisher: song?.name,
    enabled: Boolean(song?.id && song?.name),
  });
  const coverImage = coverUrl || radioImg;
  const publisher = song.name || '—';
  const performer = song.author || 'Author unknown';
  const encodedPublisher = song.name ? encodeURIComponent(song.name) : '';
  const encodedIdentifier = song.id ? encodeURIComponent(song.id) : '';

  const metadataMap = useMemo(
    () => parseKeyValueMetadata(song.description),
    [song.description],
  );

  const hoverEntries = useMemo(() => {
    const entries = buildMetadataEntries(metadataMap, [
      'title',
      'author',
      'genre',
      'mood',
      'language',
      'notes',
    ]);

    if (!metadataMap.author && song.author) {
      entries.push({
        label: 'Performer',
        value: song.author,
      });
    }

    if (song.name) {
      entries.push({
        label: 'Publisher',
        value: song.name,
      });
    }

    const published = formatDateTime(song.created);
    if (published) {
      entries.push({
        label: 'Published',
        value: published,
      });
    }

    return entries;
  }, [metadataMap, song.author, song.created, song.name]);

  const handleNavigate = () => {
    if (encodedPublisher && encodedIdentifier) {
      navigate(`/songs/${encodedPublisher}/${encodedIdentifier}`);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleNavigate();
        }
      }}
      onClick={handleNavigate}
      className="group relative flex min-w-[200px] max-w-[200px] flex-col rounded-xl border border-sky-900/60 bg-sky-950/70 p-3 shadow transition hover:border-sky-700/70 hover:bg-sky-950/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-sky-950/80"
    >
      <div className="relative h-28 w-full group/card">
        <div className="h-full w-full overflow-hidden rounded-lg border border-sky-900/60 bg-sky-900/40">
          <img src={coverImage} alt={song.title || 'Song cover'} className="h-full w-full object-cover" loading="lazy" />
        </div>
        <HomeCardHoverDetails title="Song details" entries={hoverEntries} />
      </div>
      <div className="mt-3 space-y-1 text-left">
        <p
          className="text-sm font-semibold text-white"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {song.title || 'Untitled song'}
        </p>
        <p className="text-xs font-medium text-sky-300" title={song.author || undefined}>
          {performer}
        </p>
        <p className="text-[11px] text-sky-400/80" title={publisher}>
          {publisher}
        </p>
      </div>
    </div>
  );
};

export default HomeSongCard;
