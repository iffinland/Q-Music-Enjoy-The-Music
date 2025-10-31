import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import { Video } from '../../types';

interface VideoPlayerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  video?: Video | null;
  videoUrl?: string | null;
  isLoading?: boolean;
  error?: string | null;
}

const VideoPlayerOverlay: React.FC<VideoPlayerOverlayProps> = ({
  isOpen,
  onClose,
  video,
  videoUrl,
  isLoading = false,
  error = null,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl rounded-2xl border border-sky-900/70 bg-sky-950/95 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-sky-800/70 bg-sky-900/70 p-2 text-sky-100 transition hover:border-sky-500 hover:bg-sky-800/70 hover:text-white"
          aria-label="Close video player"
        >
          <FiX size={18} />
        </button>

        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-white">
              {video?.title || 'Video'}
            </h2>
            <p className="text-sm text-sky-300/80">
              {video?.publisher
                ? `Published by ${video.publisher}`
                : 'Enjoy the video'}
            </p>
          </div>

          <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-sky-900/70 bg-black/60 p-2">
            {isLoading ? (
              <p className="py-20 text-sm font-semibold text-sky-200/80">
                Preparing video stream…
              </p>
            ) : error ? (
              <p className="py-20 text-sm font-semibold text-red-300/80">
                {error}
              </p>
            ) : videoUrl ? (
              <video
                key={videoUrl}
                className="h-full w-full rounded-lg bg-black"
                controls
                autoPlay
                preload="auto"
              >
                <source src={videoUrl} type={video?.videoMimeType || 'video/mp4'} />
                Your browser does not support the video tag.
              </video>
            ) : (
              <p className="py-20 text-sm font-semibold text-sky-200/80">
                Video URL is not available yet. Please try again in a moment.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default VideoPlayerOverlay;
