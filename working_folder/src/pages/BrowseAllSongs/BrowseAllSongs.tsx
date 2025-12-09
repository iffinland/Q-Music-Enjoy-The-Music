import React, { useCallback, useEffect, useMemo, useState } from "react";
import Box from "../../components/Box";
import Header from "../../components/Header";
import SongItem from "../../components/SongItem";
import useOnPlay from "../../hooks/useOnPlay";
import { SongMeta } from "../../state/features/globalSlice";
import { CircularProgress } from "@mui/material";
import { cachedSearchQdnResources } from "../../services/resourceCache";
import { shouldHideQdnResource } from "../../utils/qdnResourceFilters";
import SortControls from "../../components/common/SortControls";
import BrowseToolbar from "../../components/common/BrowseToolbar";
import AlphabetFilter from "../../components/common/AlphabetFilter";
import { MUSIC_CATEGORIES } from "../../constants/categories";
import Button from "../../components/Button";
import useUploadModal from "../../hooks/useUploadModal";

type AlphabetKey = "ALL" | string;

const PAGE_SIZE = 24;
const FETCH_LIMIT = 50;
const MAX_FETCH_BATCHES = 5;
const SLOGAN = "Discover every song across the Q-Music catalog.";

const buildSongMeta = (song: any): SongMeta => {
  const description: string = song?.metadata?.description || "";
  const pairs = description.split(";");
  const metadataFromDescription: Record<string, string> = {};

  for (const pair of pairs) {
    const [rawKey, rawValue] = pair.split("=");
    if (!rawKey || !rawValue) continue;

    const key = rawKey.trim().toLowerCase();
    const value = rawValue.trim();
    if (!value) continue;

    if (
      key === "title" ||
      key === "author" ||
      key === "genre" ||
      key === "category" ||
      key === "categoryname" ||
      key === "mood" ||
      key === "language" ||
      key === "notes"
    ) {
      metadataFromDescription[key] = value;
    }
  }

  const fallbackTitle =
    song?.metadata?.title ||
    metadataFromDescription.title ||
    (typeof song?.identifier === "string"
      ? song.identifier.replace(/_/g, " ")
      : "");

  return {
    title: fallbackTitle,
    description: song?.metadata?.description,
    created: song?.created,
    updated: song?.updated,
    name: song?.name,
    id: song?.identifier,
    status: song?.status,
    service: song?.service || "AUDIO",
    author: metadataFromDescription.author || song?.metadata?.author,
    genre: metadataFromDescription.genre || song?.metadata?.genre,
    mood: metadataFromDescription.mood || song?.metadata?.mood,
    language: metadataFromDescription.language || song?.metadata?.language,
    notes: metadataFromDescription.notes || song?.metadata?.notes,
    category:
      metadataFromDescription.category ||
      song?.metadata?.category ||
      metadataFromDescription.categoryname ||
      song?.metadata?.categoryName ||
      null,
    categoryName:
      metadataFromDescription.categoryname ||
      song?.metadata?.categoryName ||
      metadataFromDescription.category ||
      song?.metadata?.category ||
      null,
  };
};

const BrowseAllSongs: React.FC = () => {

  const [songs, setSongs] = useState<SongMeta[]>([]);
  const [activeLetter, setActiveLetter] = useState<AlphabetKey>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const uploadModal = useUploadModal();

  const fetchSongsForPrefix = useCallback(
    async (prefix?: string) => {
      if (!prefix) {
        return [];
      }

      const aggregated: SongMeta[] = [];
      const seen = new Set<string>();
      let offset = 0;
      let batches = 0;

      while (batches < MAX_FETCH_BATCHES) {
        try {
          const responseData = await cachedSearchQdnResources({
            mode: 'ALL',
            service: 'AUDIO',
            query: prefix,
            limit: FETCH_LIMIT,
            includeMetadata: true,
            offset,
            reverse: true,
            excludeBlocked: true,
            includeStatus: true,
          });
          if (!Array.isArray(responseData) || responseData.length === 0) {
            break;
          }

          const filtered = responseData.filter((song: any) => !shouldHideQdnResource(song));

          for (const song of filtered) {
            const parsed = buildSongMeta(song);
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
    },
    []
  );

  const fetchSongs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const aggregated = await fetchSongsForPrefix("enjoymusic_song_");

      const uniqueSongs = Array.from(
        aggregated.reduce((map, song) => {
          if (song?.id) {
            map.set(song.id, song);
          }
          return map;
        }, new Map<string, SongMeta>())
      ).map(([, value]) => value);

      const sortedSongs = uniqueSongs.sort((a, b) => {
        const aTitle = (a.title || "").toLowerCase();
        const bTitle = (b.title || "").toLowerCase();
        return aTitle.localeCompare(bTitle);
      });

      setSongs(sortedSongs);
      setCurrentPage(1);
      setActiveLetter("ALL");
    } catch (err) {
      console.error(err);
      setSongs([]);
      setError("Unable to load songs right now. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, [fetchSongsForPrefix]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  const handleQMusicFilter = () => {
    setActiveLetter("ALL");
    setCurrentPage(1);
    setSelectedCategory('ALL');
    void fetchSongs();
  };

  const handleLetterChange = (letter: AlphabetKey) => {
    if (letter === activeLetter) return;
    setActiveLetter(letter);
    setCurrentPage(1);
  };

  const getSongCategory = useCallback((song: SongMeta): string | null => {
    const candidate =
      (song as any)?.category ??
      (song as any)?.categoryName ??
      (song as any)?.genre ??
      (song as any)?.mood ??
      null;
    if (!candidate || typeof candidate !== 'string') return null;
    const trimmed = candidate.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, []);

  const categoryFilteredSongs = useMemo(() => {
    if (selectedCategory === 'ALL') return songs;
    return songs.filter((song) => {
      const category = getSongCategory(song) ?? 'Uncategorized';
      return category.toLowerCase() === selectedCategory.toLowerCase();
    });
  }, [songs, selectedCategory, getSongCategory]);

  const filteredSongs = useMemo(() => {
    if (activeLetter === "ALL") {
      return categoryFilteredSongs;
    }

    return categoryFilteredSongs.filter((song) => {
      const titleFirstLetter = (song.title || "")
        .trim()
        .charAt(0)
        .toUpperCase();
      const authorFirstLetter = (song.author || "")
        .trim()
        .charAt(0)
        .toUpperCase();

      return (
        titleFirstLetter === activeLetter || authorFirstLetter === activeLetter
      );
    });
  }, [categoryFilteredSongs, activeLetter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSongs.length / PAGE_SIZE)
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [activeLetter, songs, selectedCategory]);

  useEffect(() => {
    setActiveLetter('ALL');
  }, [selectedCategory]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentPageSafe = Math.min(currentPage, totalPages);
  const startIndex = (currentPageSafe - 1) * PAGE_SIZE;
  const paginatedSongs = filteredSongs.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  const onPlay = useOnPlay(filteredSongs);

  const paginationNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, index) => index + 1),
    [totalPages]
  );

  return (
    <div className="px-4 py-6">
      <Header className="rounded-lg bg-gradient-to-b from-sky-900/80 via-sky-950/40 to-transparent">
        <BrowseToolbar
          title="Browse & Listen Songs"
          slogan={SLOGAN}
          action={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={handleQMusicFilter}
                className="min-w-[160px] rounded-full border px-5 py-2 text-sm font-semibold transition bg-sky-800/80 border-sky-400/60 text-white shadow-lg shadow-sky-900/40"
              >
                Q-Music songs
              </button>
              <Button
                type="button"
                onClick={() => uploadModal.openSingle()}
                className="w-full sm:w-auto md:w-auto max-w-[240px] bg-gradient-to-r from-sky-400 to-cyan-300 text-sky-950 hover:from-sky-300 hover:to-cyan-200 shadow-lg shadow-sky-900/40 border-transparent"
              >
                Add Audio Track
              </Button>
            </div>
          }
        />
      </Header>

      <div className="mt-6 flex flex-col gap-6">
        <Box className="p-6">
          <AlphabetFilter activeLetter={activeLetter} onLetterSelect={handleLetterChange} />
        </Box>

        <Box className="p-4">
          <SortControls
            sortOrder={'desc'}
            onSortOrderChange={() => {}}
            categories={(() => {
              const normalized = new Set<string>();
              songs.forEach((song) => {
                const category = getSongCategory(song);
                if (!category) {
                  normalized.add('Uncategorized');
                } else {
                  normalized.add(category);
                }
              });
              const base: string[] = [...MUSIC_CATEGORIES];
              normalized.forEach((category) => {
                if (!base.includes(category)) {
                  base.push(category);
                }
              });
              return base;
            })()}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            showOrderButtons={false}
          />
        </Box>

        <Box className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <CircularProgress />
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-500/40 bg-red-900/40 px-4 py-6 text-center text-sm font-medium text-red-100">
              {error}
            </div>
          ) : paginatedSongs.length === 0 ? (
            <div className="rounded-md border border-sky-900/60 bg-sky-950/60 px-4 py-6 text-center text-sm font-semibold text-sky-200/80">
              No songs match the selected filters.
            </div>
          ) : (
            <>
              <div
                className="
                grid
                grid-cols-[repeat(auto-fit,minmax(240px,1fr))]
                gap-4
              "
              >
                {paginatedSongs.map((song) => (
                  <SongItem
                    key={song.id}
                    data={song}
                    onClick={(id: string) => onPlay(id)}
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
        </Box>
      </div>
    </div>
  );
};

export default BrowseAllSongs;
