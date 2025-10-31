import React from 'react';

interface VideoAlphabetFilterProps {
  activeLetter: string;
  onLetterSelect: (letter: string) => void;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const VideoAlphabetFilter: React.FC<VideoAlphabetFilterProps> = ({
  activeLetter,
  onLetterSelect,
}) => {
  const renderLetterButton = (label: string) => {
    const isActive = activeLetter === label;

    return (
      <button
        key={label}
        type="button"
        onClick={() => onLetterSelect(label)}
        className={`rounded-md border px-3 py-1 text-sm font-semibold transition ${
          isActive
            ? 'border-sky-400 bg-sky-700 text-white shadow-sm'
            : 'border-sky-800/80 bg-sky-950/40 text-sky-300 hover:border-sky-600 hover:text-white'
        }`}
        aria-pressed={isActive}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-sky-900/60 bg-sky-950/40 p-4">
      {renderLetterButton('ALL')}
      {LETTERS.map(renderLetterButton)}
    </div>
  );
};

export default VideoAlphabetFilter;
