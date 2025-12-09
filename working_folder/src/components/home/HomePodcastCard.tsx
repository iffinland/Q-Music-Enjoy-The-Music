import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeCardHoverDetails from './HomeCardHoverDetails';
import radioImg from '../../assets/img/enjoy-music.jpg';
import { Podcast } from '../../types';
import { formatDateTime } from '../../utils/metadata';

const truncate = (value: string, max = 200) => {
  if (!value) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}...`;
};

interface HomePodcastCardProps {
  podcast: Podcast;
}

export const HomePodcastCard: React.FC<HomePodcastCardProps> = ({ podcast }) => {
  const navigate = useNavigate();

  const coverImage = podcast.coverImage && podcast.coverImage.trim().length > 0 ? podcast.coverImage : radioImg;
  const performer = podcast.author?.trim() || podcast.publisher || 'Unknown host';
  const publisher = podcast.publisher || 'Unknown publisher';

  const encodedPublisher = podcast.publisher ? encodeURIComponent(podcast.publisher) : '';
  const encodedIdentifier = encodeURIComponent(podcast.id);

  const hoverEntries = useMemo(() => {
    const entries: { label: string; value: string }[] = [
      {
        label: 'Creator',
        value: performer,
      },
    ];

    if (podcast.category) {
      entries.push({
        label: 'Category',
        value: podcast.category,
      });
    }

    if (podcast.description) {
      entries.push({
        label: 'Summary',
        value: truncate(podcast.description, 240),
      });
    }

    const published = formatDateTime(podcast.updated || podcast.created);
    if (published) {
      entries.push({
        label: 'Updated',
        value: published,
      });
    }

    return entries;
  }, [performer, podcast.category, podcast.created, podcast.description, podcast.updated]);

  const handleNavigate = () => {
    if (podcast.publisher) {
      navigate(`/podcasts/${encodedPublisher}/${encodedIdentifier}`);
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
          <img src={coverImage} alt={podcast.title || 'Podcast cover'} className="h-full w-full object-cover" loading="lazy" />
        </div>
        <HomeCardHoverDetails title="Podcast details" entries={hoverEntries} />
      </div>
      <div className="mt-3 space-y-1 text-left">
        <p
          className="text-sm font-semibold text-white"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {podcast.title || 'Untitled podcast'}
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

export default HomePodcastCard;
