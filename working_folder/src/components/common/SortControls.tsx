import React from 'react';
import { twMerge } from 'tailwind-merge';

type SortOrder = 'desc' | 'asc';

interface SortControlsProps {
  sortOrder: SortOrder;
  onSortOrderChange: (order: SortOrder) => void;
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  className?: string;
  showOrderButtons?: boolean;
  hideOrderControls?: boolean;
  hideCategoryControl?: boolean;
}

const baseButtonClasses =
  'rounded-full border border-sky-900/60 bg-sky-950/60 px-3 py-1 text-xs font-semibold transition text-sky-200/80 hover:bg-sky-900/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-sky-950/80';

const activeButtonClasses = 'bg-sky-700/80 border-sky-600/70 text-white';

const SortControls: React.FC<SortControlsProps> = ({
  sortOrder,
  onSortOrderChange,
  categories,
  selectedCategory,
  onCategoryChange,
  className,
  showOrderButtons = true,
  hideOrderControls = false,
  hideCategoryControl = false,
}) => {
  const orderControl = hideOrderControls
    ? null
    : showOrderButtons
      ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSortOrderChange('desc')}
            className={twMerge(
              baseButtonClasses,
              sortOrder === 'desc' && activeButtonClasses,
            )}
          >
            Newest
          </button>
          <button
            type="button"
            onClick={() => onSortOrderChange('asc')}
            className={twMerge(
              baseButtonClasses,
              sortOrder === 'asc' && activeButtonClasses,
            )}
          >
            Oldest
          </button>
        </div>
      )
      : (
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-300/80">
          Sort by
          <select
            value={sortOrder}
            onChange={(event) => onSortOrderChange(event.target.value as SortOrder)}
            className="rounded-md border border-sky-900/60 bg-sky-950/60 px-3 py-1 text-sm text-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-sky-950/80"
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </label>
      );

  const categoryControl = hideCategoryControl
    ? null
    : (
      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-300/80">
        Category
        <select
          value={selectedCategory}
          onChange={(event) => onCategoryChange(event.target.value)}
          className="rounded-md border border-sky-900/60 bg-sky-950/60 px-3 py-1 text-sm text-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-sky-950/80"
        >
          <option value="ALL">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>
    );

  const visibleControls = [orderControl, categoryControl].filter(Boolean);

  if (visibleControls.length === 0) {
    return null;
  }

  return (
    <div
      className={twMerge(
        'flex flex-wrap items-center gap-3',
        visibleControls.length > 1 ? 'justify-between' : 'justify-end',
        className,
      )}
    >
      {orderControl}
      {categoryControl}
    </div>
  );
};

export type { SortOrder };
export default SortControls;
