import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiThumbsUp } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import {
  fetchRequestLikers,
  hasUserLikedRequest,
  likeRequest,
  unlikeRequest,
} from '../../services/requestLikes';
import { SongRequest } from '../../state/features/requestsSlice';

interface RequestLikeButtonProps {
  request: SongRequest;
  username?: string | null;
}

const RequestLikeButton: React.FC<RequestLikeButtonProps> = ({ request, username }) => {
  const [likers, setLikers] = useState<string[]>([]);
  const [isLoadingLikers, setIsLoadingLikers] = useState<boolean>(false);
  const [hasLiked, setHasLiked] = useState<boolean>(false);
  const [isToggling, setIsToggling] = useState<boolean>(false);
  const [isTooltipVisible, setIsTooltipVisible] = useState<boolean>(false);

  const likeCount = useMemo(() => likers.length, [likers]);

  useEffect(() => {
    let cancelled = false;
    const loadLikers = async () => {
      setIsLoadingLikers(true);
      try {
        const users = await fetchRequestLikers(request.id);
        if (!cancelled) {
          setLikers(users);
        }
      } catch (error) {
        console.error('Failed to load request likes', error);
      } finally {
        if (!cancelled) {
          setIsLoadingLikers(false);
        }
      }
    };
    loadLikers();
    return () => {
      cancelled = true;
    };
  }, [request.id]);

  useEffect(() => {
    let cancelled = false;
    const evaluateLikeState = async () => {
      if (!username) {
        setHasLiked(false);
        return;
      }
      try {
        const liked = await hasUserLikedRequest(username, request.id);
        if (!cancelled) {
          setHasLiked(liked);
        }
      } catch (error) {
        console.error('Failed to check like status', error);
      }
    };
    evaluateLikeState();
    return () => {
      cancelled = true;
    };
  }, [request.id, username]);

  const handleToggle = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      event.preventDefault();
      if (!username) {
        toast.error('Log in to like requests.');
        return;
      }

      setIsToggling(true);
      try {
        if (hasLiked) {
          await unlikeRequest(username, request.id);
          setHasLiked(false);
          setLikers((prev) => prev.filter((name) => name !== username));
        } else {
          await likeRequest(username, request);
          setHasLiked(true);
          setLikers((prev) => {
            if (prev.includes(username)) return prev;
            return [...prev, username].sort((a, b) => a.localeCompare(b));
          });
        }
      } catch (error) {
        console.error('Failed to toggle request like', error);
        toast.error('Could not update like status. Try again.');
      } finally {
        setIsToggling(false);
      }
    },
    [hasLiked, request, username],
  );

  const handleTooltipVisibility = useCallback((visible: boolean) => {
    setIsTooltipVisible(visible);
  }, []);

  const buttonLabel = hasLiked ? 'Liked' : 'Like It';

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => handleTooltipVisibility(true)}
      onMouseLeave={() => handleTooltipVisibility(false)}
      onFocus={() => handleTooltipVisibility(true)}
      onBlur={() => handleTooltipVisibility(false)}
    >
      <button
        type="button"
        onClick={handleToggle}
        className={`flex items-center gap-1 rounded border px-2 py-1 text-xs transition ${
          hasLiked
            ? 'border-emerald-500/70 bg-emerald-600/10 text-emerald-200'
            : 'border-emerald-500/70 text-emerald-200 hover:bg-emerald-500/10'
        }`}
        disabled={isToggling}
      >
        <FiThumbsUp
          className={`h-4 w-4 ${
            hasLiked ? 'text-emerald-300' : 'text-emerald-200'
          }`}
        />
        <span>{buttonLabel}</span>
        <span className="ml-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
          {likeCount}
        </span>
      </button>
      {isTooltipVisible && (
        <div className="absolute left-0 top-full z-30 mt-2 w-48 rounded-md border border-sky-900/60 bg-sky-950/90 p-2 text-left text-[11px] text-sky-100 shadow-lg">
          {isLoadingLikers ? (
            <p className="text-sky-200/80">Loading…</p>
          ) : likeCount === 0 ? (
            <p className="text-sky-200/80">No likes yet</p>
          ) : (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-sky-300/80">
                Liked by
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto pr-1">
                {likers.map((name) => (
                  <li key={name} className="truncate">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RequestLikeButton;
