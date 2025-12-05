import React, { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Skeleton } from "./ui/skeleton";
import { useNavigate } from "react-router-dom";

import { PlayList } from "../state/features/globalSlice";
import { RootState } from "../state/store";
import { PlaylistItem } from "./PlaylistItem";
import SortControls from "./common/SortControls";

interface PlaylistsContentProps {
  playlists: PlayList[];
  renderActions?: (playlist: PlayList) => React.ReactNode;
}

const ALL_CATEGORIES_VALUE = "ALL";
const UNCATEGORIZED_LABEL = "Uncategorized";

const getPlaylistTimestamp = (playlist: PlayList) => {
  const candidate = playlist.updated ?? playlist.created ?? 0;
  return typeof candidate === "number" ? candidate : 0;
};

const getPlaylistCategory = (playlist: PlayList): string | null => {
  const candidate =
    playlist.categoryName || playlist.category || (playlist as any)?.genre || null;
  if (!candidate || typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const PlayListsContent: React.FC<PlaylistsContentProps> = ({
  playlists,
  renderActions,
}) => {
  const navigate = useNavigate();
  const playlistHash = useSelector(
    (state: RootState) => state.global.playlistHash,
  );

  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [selectedCategory, setSelectedCategory] = useState<string>(
    ALL_CATEGORIES_VALUE,
  );

  const { resolvedPlaylists, pendingPlaylists } = useMemo(() => {
    const resolved: PlayList[] = [];
    const pending: PlayList[] = [];

    playlists.forEach((playlist) => {
      if (!playlist || !playlist.id) {
        return;
      }
      const existing = playlistHash[playlist.id];
      if (existing) {
        resolved.push(existing);
      } else {
        pending.push(playlist);
      }
    });

    return { resolvedPlaylists: resolved, pendingPlaylists: pending };
  }, [playlists, playlistHash]);

  const availableCategories = useMemo(() => {
    const bucket = new Set<string>();
    let hasUncategorized = false;

    resolvedPlaylists.forEach((playlist) => {
      const category = getPlaylistCategory(playlist);
      if (category) {
        bucket.add(category);
      } else {
        hasUncategorized = true;
      }
    });

    const sorted = Array.from(bucket).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );

    if (hasUncategorized) {
      sorted.push(UNCATEGORIZED_LABEL);
    }

    return sorted;
  }, [resolvedPlaylists]);

  const displayPlaylists = useMemo(() => {
    const filtered = resolvedPlaylists.filter((playlist) => {
      if (selectedCategory === ALL_CATEGORIES_VALUE) return true;
      const category =
        getPlaylistCategory(playlist) ?? UNCATEGORIZED_LABEL;
      return category === selectedCategory;
    });

    return filtered
      .slice()
      .sort((a, b) => {
        const delta = getPlaylistTimestamp(b) - getPlaylistTimestamp(a);
        return sortOrder === "desc" ? delta : -delta;
      });
  }, [resolvedPlaylists, selectedCategory, sortOrder]);

  const showEmptyState =
    resolvedPlaylists.length > 0 && displayPlaylists.length === 0;

  return (
    <div className="flex flex-col gap-y-3">
      {playlists.length > 0 && (
        <SortControls
          className="px-6"
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          categories={availableCategories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      )}
      <div className="flex flex-col gap-y-2 w-full px-6">
        {displayPlaylists.map((playlist) => (
          <div
            key={playlist.id}
            className="flex w-full items-center gap-x-4"
          >
            <div className="flex-1">
              <PlaylistItem
                onClick={() =>
                  navigate(`/playlists/${playlist.user}/${playlist.id}`)
                }
                data={playlist}
              />
            </div>
            {renderActions && (
              <div className="flex-shrink-0">
                {renderActions(playlist)}
              </div>
            )}
          </div>
        ))}
        {showEmptyState && (
          <div className="rounded-md border border-sky-900/60 bg-sky-950/60 p-4 text-sm text-sky-200/80">
            No playlists match the selected filters.
          </div>
        )}
        {pendingPlaylists.map((playlist, index) => (
          <Skeleton
            key={`playlist-skeleton-${playlist.id ?? `fallback-${index}`}`}
            variant="rectangular"
            style={{
              width: "100%",
              height: "64px",
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default PlayListsContent;
