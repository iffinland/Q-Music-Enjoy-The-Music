import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeCardHoverDetails from './HomeCardHoverDetails';
import radioImg from '../../assets/img/enjoy-music.jpg';
import { Video } from '../../types';
import { buildMetadataEntries, formatDateTime, parseKeyValueMetadata } from '../../utils/metadata';
import useCoverImage from '../../hooks/useCoverImage';

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return null;
  const wholeSeconds = Math.round(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remaining = wholeSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m ${remaining}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remaining}s`;
  }
  return `${remaining}s`;
};

interface HomeVideoCardProps {
  video: Video;
}

export const HomeVideoCard: React.FC<HomeVideoCardProps> = ({ video }) => {
  const navigate = useNavigate();

  const { url: coverUrl } = useCoverImage({
    identifier: video?.id ?? null,
    publisher: video?.publisher ?? null,
    enabled: Boolean(video?.id && video?.publisher),
    service: 'THUMBNAIL',
  });
  const coverImage = video.coverImage && video.coverImage.trim().length > 0 ? video.coverImage : coverUrl || radioImg;
  const performer = video.author?.trim() || video.publisher || 'Unknown creator';
  const publisher = video.publisher || 'Unknown publisher';

  const encodedPublisher = video.publisher ? encodeURIComponent(video.publisher) : '';
  const encodedIdentifier = encodeURIComponent(video.id);

  const metadataMap = useMemo(
    () => parseKeyValueMetadata(video.description),
    [video.description],
  );

  const hoverEntries = useMemo(() => {
    const entries = buildMetadataEntries(metadataMap, ['genre', 'mood', 'language', 'notes']);

    const duration = formatDuration(video.durationSeconds);
    if (duration) {
      entries.unshift({
        label: 'Duration',
        value: duration,
      });
    }

    const published = formatDateTime(video.updated || video.created);
    if (published) {
      entries.push({
        label: 'Updated',
        value: published,
      });
    }

    entries.push({
      label: 'Publisher',
      value: publisher,
    });

    return entries;
  }, [metadataMap, publisher, video.created, video.durationSeconds, video.updated]);

  const handleNavigate = () => {
    if (video.publisher) {
      navigate(`/videos/${encodedPublisher}/${encodedIdentifier}`);
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
          <img src={coverImage} alt={video.title || 'Video cover'} className="h-full w-full object-cover" loading="lazy" />
        </div>
        <HomeCardHoverDetails title="Video details" entries={hoverEntries} />
      </div>
      <div className="mt-3 space-y-1 text-left">
        <p
          className="text-sm font-semibold text-white"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {video.title || 'Untitled video'}
        </p>
        <p
          className="text-xs font-semibold text-sky-300"
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

export default HomeVideoCard;
