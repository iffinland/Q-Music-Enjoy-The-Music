import { FaPlay } from "react-icons/fa";
import { MouseEvent } from "react";

interface PlayButtonProps {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

const PlayButton: React.FC<PlayButtonProps> = ({ onClick, className }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`transition opacity-0 rounded-full flex items-center justify-center bg-green-500 p-4 drop-shadow-md translate translate-y-1/4 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-110 ${className ?? ''}`.trim()}
      aria-label="Play"
    >
      <FaPlay className="text-black" />
    </button>
  );
};

export default PlayButton;
