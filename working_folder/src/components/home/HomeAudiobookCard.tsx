import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeCardHoverDetails from './HomeCardHoverDetails';
import radioImg from '../../assets/img/enjoy-music.jpg';
import { Audiobook } from '../../types';
import { formatDateTime } from '../../utils/metadata';
import useCoverImage from '../../hooks/useCoverImage';

const truncate = (value: string, max = 200) => {
  if (!value) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}...`;
};

interface HomeAudiobookCardProps {
  audiobook: Audiobook;
}

export const HomeAudiobookCard: React.FC<HomeAudiobookCardProps> = ({ audiobook }) => {
  const navigate = useNavigate();

  const { url: coverUrl } = useCoverImage({
    identifier: audiobook?.id ?? null,
    publisher: audiobook?.publisher ?? null,
    enabled: Boolean(audiobook?.id && audiobook?.publisher),
  });
  const coverImage = audiobook.coverImage && audiobook.coverImage.trim().length > 0 ? audiobook.coverImage : coverUrl || radioImg;
  const performer = audiobook.author?.trim() || audiobook.publisher || 'Unknown narrator';
  const publisher = audiobook.publisher || 'Unknown publisher';

  const encodedPublisher = audiobook.publisher ? encodeURIComponent(audiobook.publisher) : '';
  const encodedIdentifier = encodeURIComponent(audiobook.id);

  const hoverEntries = useMemo(() => {
    const entries: { label: string; value: string }[] = [
      {
        label: 'Narrator',
        value: performer,
      },
    ];

    if (audiobook.description) {
      entries.push({
        label: 'Summary',
        value: truncate(audiobook.description, 240),
      });
    }

    if (audiobook.category) {
      entries.push({
        label: 'Category',
        value: audiobook.category,
      });
    }

    const published = formatDateTime(audiobook.updated || audiobook.created);
    if (published) {
      entries.push({
        label: 'Updated',
        value: published,
      });
    }

    return entries;
  }, [audiobook.category, audiobook.created, audiobook.description, audiobook.updated, performer]);

  const handleNavigate = () => {
    if (audiobook.publisher) {
      navigate(`/audiobooks/${encodedPublisher}/${encodedIdentifier}`);
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
          <img src={coverImage} alt={audiobook.title || 'Audiobook cover'} className="h-full w-full object-cover" loading="lazy" />
        </div>
        <HomeCardHoverDetails title="Audiobook details" entries={hoverEntries} />
      </div>
      <div className="mt-3 space-y-1 text-left">
        <p
          className="text-sm font-semibold text-white"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {audiobook.title || 'Untitled audiobook'}
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

export default HomeAudiobookCard;
