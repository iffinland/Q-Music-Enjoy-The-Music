import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "../../components/Box";
import Header from "../../components/Header";
import PlaylistCard from "../../components/PlaylistCard";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import {
  PlayList,
  addToPlaylistHashMap,
  setCurrentPlaylist,
  setNewPlayList,
} from "../../state/features/globalSlice";
import { CircularProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { cachedSearchQdnResources } from "../../services/resourceCache";
import { loadPlaylistMeta } from "../../services/playlistLoader";
import { shouldHideQdnResource } from "../../utils/qdnResourceFilters";
import SortControls from "../../components/common/SortControls";
import { mapPlaylistSummary } from "../../utils/playlistHelpers";
import Button from "../../components/Button";
import useUploadPlaylistModal from "../../hooks/useUploadPlaylistModal";

type SourceKey = "ALL" | "QMUSIC";
type AlphabetKey = "ALL" | string;

const SOURCE_FILTERS: Array<{
  key: SourceKey;
  label: string;
  prefix?: string;
}> = [
  { key: "ALL", label: "All playlists" },
  { key: "QMUSIC", label: "Q-Music playlists", prefix: "enjoymusic_playlist_" },
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const PAGE_SIZE = 18;
const FETCH_LIMIT = 50;
const MAX_FETCH_BATCHES = 5;

const buildPlaylist = (playlist: any): PlayList => mapPlaylistSummary(playlist);

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

const BrowseAllPlaylists: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const playlistHash = useSelector(
    (state: RootState) => state.global.playlistHash
  );
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const playlistHashRef = useRef(playlistHash);

  const [playlists, setPlaylists] = useState<PlayList[]>([]);
  const [activeSource, setActiveSource] = useState<SourceKey>("ALL");
  const [activeLetter, setActiveLetter] = useState<AlphabetKey>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [selectedCategory, setSelectedCategory] = useState<string>(
    ALL_CATEGORIES_VALUE,
  );
  const uploadPlaylistModal = useUploadPlaylistModal();

  useEffect(() => {
    playlistHashRef.current = playlistHash;
  }, [playlistHash]);

  const fetchPlaylistContent = useCallback(
    async (user: string, identifier: string) => {
      try {
        const meta = await loadPlaylistMeta(user, identifier);
        if (meta) {
          dispatch(addToPlaylistHashMap(meta));
        }
      } catch (error) {
        console.error(error);
      }
    },
    [dispatch]
  );

  const fetchPlaylistsForPrefix = useCallback(async (prefix?: string) => {
    if (!prefix) {
      return [];
    }

    const aggregated: PlayList[] = [];
    const seen = new Set<string>();
    let offset = 0;
    let batches = 0;

    while (batches < MAX_FETCH_BATCHES) {
      try {
        const responseData = await cachedSearchQdnResources({
          mode: "ALL",
          service: "PLAYLIST",
          query: prefix,
          identifier: prefix,
          limit: FETCH_LIMIT,
          includeMetadata: true,
          offset,
          reverse: true,
          excludeBlocked: true,
          includeStatus: false,
        });
        if (!Array.isArray(responseData) || responseData.length === 0) {
          break;
        }

        const filtered = responseData.filter((playlist: any) => !shouldHideQdnResource(playlist));

        for (const playlist of filtered) {
          const parsed = buildPlaylist(playlist);
          if (!parsed?.id || seen.has(parsed.id)) continue;

          aggregated.push(parsed);
          seen.add(parsed.id);
        }

        offset += responseData.length;
        batches += 1;

        if (responseData.length < FETCH_LIMIT) {
          break;
        }
      } catch (err) {
        console.error(err);
        break;
      }
    }

    return aggregated;
  }, []);

  const fetchPlaylists = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let aggregated: PlayList[] = [];

      if (activeSource === "ALL") {
        aggregated = await fetchPlaylistsForPrefix("enjoymusic_playlist_");
      } else {
        const { prefix } =
          SOURCE_FILTERS.find((filter) => filter.key === activeSource) || {};
        aggregated = await fetchPlaylistsForPrefix(prefix || "enjoymusic_playlist_");
      }

      const uniquePlaylists = Array.from(
        aggregated.reduce((map, playlist) => {
          if (playlist?.id) {
            map.set(playlist.id, playlist);
          }
          return map;
        }, new Map<string, PlayList>())
      ).map(([, value]) => value);

      const sortedPlaylists = uniquePlaylists.sort((a, b) => {
        const aTitle = (a.title || "").toLowerCase();
        const bTitle = (b.title || "").toLowerCase();
        return aTitle.localeCompare(bTitle);
      });

      for (const playlist of sortedPlaylists) {
        const playlistId = playlist?.id;
        const playlistUser = playlist?.user;
        if (!playlistId || !playlistUser) continue;

        if (!playlistHashRef.current[playlistId]) {
          fetchPlaylistContent(playlistUser, playlistId);
        }
      }

      setPlaylists(sortedPlaylists);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
      setPlaylists([]);
      setError("Unable to load playlists right now. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, [activeSource, fetchPlaylistContent, fetchPlaylistsForPrefix]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const handleSourceChange = (source: SourceKey) => {
    if (source === activeSource) return;
    setActiveSource(source);
    setActiveLetter("ALL");
    setSelectedCategory(ALL_CATEGORIES_VALUE);
    setCurrentPage(1);
  };

  const handleLetterChange = (letter: AlphabetKey) => {
    if (letter === activeLetter) return;
    setActiveLetter(letter);
    setCurrentPage(1);
  };

  const filteredPlaylists = useMemo(() => {
    const letterFiltered =
      activeLetter === "ALL"
        ? playlists
        : playlists.filter((playlist) => {
            const titleFirstLetter = (playlist.title || "")
              .trim()
              .charAt(0)
              .toUpperCase();
            const creatorFirstLetter = (playlist.user || "")
              .trim()
              .charAt(0)
              .toUpperCase();

            return (
              titleFirstLetter === activeLetter ||
              creatorFirstLetter === activeLetter
            );
          });

    return letterFiltered.filter((playlist) => {
      if (selectedCategory === ALL_CATEGORIES_VALUE) return true;
      const category =
        getPlaylistCategory(playlist) ?? UNCATEGORIZED_LABEL;
      return category === selectedCategory;
    });
  }, [playlists, activeLetter, selectedCategory]);

  const sortedPlaylists = useMemo(() => {
    return filteredPlaylists
      .slice()
      .sort((a, b) => {
        const delta = getPlaylistTimestamp(b) - getPlaylistTimestamp(a);
        return sortOrder === "desc" ? delta : -delta;
      });
  }, [filteredPlaylists, sortOrder]);

  const availableCategories = useMemo(() => {
    const bucket = new Set<string>();
    let hasUncategorized = false;

    playlists.forEach((playlist) => {
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
  }, [playlists]);

  useEffect(() => {
    if (
      selectedCategory !== ALL_CATEGORIES_VALUE &&
      !availableCategories.includes(selectedCategory)
    ) {
      setSelectedCategory(ALL_CATEGORIES_VALUE);
    }
  }, [availableCategories, selectedCategory]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedPlaylists.length / PAGE_SIZE)
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentPageSafe = Math.min(currentPage, totalPages);
  const startIndex = (currentPageSafe - 1) * PAGE_SIZE;
  const paginatedPlaylists = sortedPlaylists.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  const paginationNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, index) => index + 1),
    [totalPages]
  );

  const handlePlaylistClick = useCallback(
    (playlist: PlayList) => {
      if (!playlist?.id || !playlist?.user) return;
      dispatch(setCurrentPlaylist(playlist.id));
      navigate(`/playlists/${encodeURIComponent(playlist.user)}/${encodeURIComponent(playlist.id)}`);
    },
    [dispatch, navigate]
  );

  return (
    <Box className="overflow-hidden">
      <Header className="rounded-t-lg bg-gradient-to-b from-sky-900/80 via-sky-950/40 to-transparent">
        <div className="flex flex-col items-center gap-y-6 text-center">
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="text-white text-3xl font-semibold">
                Browse All Playlists
              </h1>
              <p className="text-sky-200/80 text-sm mt-2">
                Explore curated playlists from Q-Music.
              </p>
            </div>
            <div className="flex justify-center">
              <Button
                type="button"
                onClick={() => {
                  const owner = username || '';
                  dispatch(
                    setNewPlayList({
                      id: `draft-playlist-${Date.now().toString(36)}`,
                      title: '',
                      description: '',
                      songs: [],
                      image: null,
                      user: owner,
                      created: Date.now(),
                      updated: Date.now(),
                    } as PlayList)
                  );
                  uploadPlaylistModal.onOpen();
                }}
                className="w-full md:w-auto"
              >
                Add Playlist
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {SOURCE_FILTERS.map((filter) => {
              const isActive = activeSource === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => handleSourceChange(filter.key)}
                  className={`min-w-[160px] rounded-full border px-5 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-sky-800/80 border-sky-400/60 text-white shadow-lg shadow-sky-900/40"
                      : "bg-sky-900/40 border-sky-800/70 text-sky-200/80 hover:bg-sky-800/50"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => handleLetterChange("ALL")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                activeLetter === "ALL"
                  ? "bg-sky-700/80 border-sky-400/60 text-white"
                  : "bg-sky-950/40 border-sky-800/70 text-sky-200/70 hover:bg-sky-800/50"
              }`}
            >
              All
            </button>
            {ALPHABET.map((letter) => {
              const isActive = activeLetter === letter;
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => handleLetterChange(letter)}
                  className={`h-8 w-8 rounded-full border text-xs font-semibold transition ${
                    isActive
                      ? "bg-sky-700/80 border-sky-400/60 text-white"
                      : "bg-sky-950/40 border-sky-800/70 text-sky-200/70 hover:bg-sky-800/50"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
      </Header>

      <div className="px-6 py-6">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <CircularProgress />
          </div>
        ) : error ? (
          <div className="flex justify-center py-8">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        ) : paginatedPlaylists.length === 0 ? (
          <div className="flex justify-center py-8">
            <p className="text-sm text-sky-200/80">
              No playlists match the selected filters.
            </p>
          </div>
        ) : (
          <>
            <SortControls
              className="mb-4"
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              categories={availableCategories}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />
            <div
              className="
                grid 
                grid-cols-1 
                sm:grid-cols-2 
                md:grid-cols-3 
                lg:grid-cols-3 
                xl:grid-cols-4 
                2xl:grid-cols-5 
                gap-4 
                mt-4
              "
            >
              {paginatedPlaylists.map((playlist) => (
                <PlaylistCard
                  key={playlist.id}
                  data={playlist}
                  onClick={() => handlePlaylistClick(playlist)}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                {paginationNumbers.map((pageNumber) => {
                  const isActive = currentPageSafe === pageNumber;
                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`h-9 min-w-[36px] rounded-md border px-3 text-sm font-semibold transition ${
                        isActive
                          ? "bg-sky-700/80 border-sky-400/60 text-white"
                          : "bg-sky-950/40 border-sky-800/70 text-sky-200/70 hover:bg-sky-800/50"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Box>
  );
};

export default BrowseAllPlaylists;
