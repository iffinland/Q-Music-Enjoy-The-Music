import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { twMerge } from 'tailwind-merge';

interface GoBackButtonProps {
  className?: string;
  label?: string;
}

const GoBackButton: React.FC<GoBackButtonProps> = ({ className, label = 'Go Back' }) => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className={twMerge(
        `inline-flex items-center gap-2 rounded-xl border border-sky-900/60 bg-sky-950/40 px-4 py-2
         text-sm font-semibold text-sky-100 transition hover:border-sky-600 hover:bg-sky-900/40
         focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70`,
        className,
      )}
    >
      <FiArrowLeft size={16} />
      {label}
    </button>
  );
};

export default GoBackButton;
