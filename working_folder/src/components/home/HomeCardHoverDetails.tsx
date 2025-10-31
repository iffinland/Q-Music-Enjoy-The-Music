import { MetadataEntry } from '../../utils/metadata';

export const HOME_HOVER_DETAILS_ENABLED = false;

interface HomeCardHoverDetailsProps {
  title: string;
  entries: MetadataEntry[];
  align?: 'left' | 'right';
}

const alignmentClasses = {
  left: 'right-full mr-2 origin-top-right',
  right: 'left-full ml-2 origin-top-left',
} as const;

const HomeCardHoverDetails: React.FC<HomeCardHoverDetailsProps> = ({
  title,
  entries,
  align = 'right',
}) => {
  if (!HOME_HOVER_DETAILS_ENABLED || !entries.length) {
    return null;
  }

  return (
    <div
      className={[
        'pointer-events-none absolute top-0 z-30 w-72 rounded-xl border border-sky-900/70 bg-sky-950/95 p-4 text-left text-xs text-sky-100 shadow-xl transition-all duration-200 ease-out sm:w-80',
        'translate-y-1 opacity-0 group-hover/card:translate-y-0 group-hover/card:opacity-100 group-focus-within/card:translate-y-0 group-focus-within/card:opacity-100',
        alignmentClasses[align],
      ].join(' ')}
    >
      <p className="text-sm font-semibold text-white">{title}</p>
      <dl className="mt-2 space-y-1">
        {entries.map((entry) => (
          <div key={`${entry.label}-${entry.value}`} className="flex gap-2">
            <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-sky-300">
              {entry.label}:
            </dt>
            <dd className="flex-1 text-xs text-sky-100/90">{entry.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default HomeCardHoverDetails;
