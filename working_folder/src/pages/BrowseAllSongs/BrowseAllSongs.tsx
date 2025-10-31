import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "../../components/Box";
import Header from "../../components/Header";
import SongItem from "../../components/SongItem";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import useOnPlay from "../../hooks/useOnPlay";
import { queueFetchAvatars } from "../../wrappers/GlobalWrapper";
import { setImageCoverHash, SongMeta } from "../../state/features/globalSlice";
import { CircularProgress } from "@mui/material";
import { searchQdnResources } from "../../utils/qortalApi";
import { shouldHideQdnResource } from "../../utils/qdnResourceFilters";

type SourceKey = "ALL" | "QMUSIC" | "EARBUMP";
type AlphabetKey = "ALL" | string;

const SOURCE_FILTERS: Array<{
  key: SourceKey;
  label: string;
  prefix?: string;
}> = [
  { key: "ALL", label: "All songs" },
  { key: "QMUSIC", label: "Q-Music songs", prefix: "enjoymusic_song_" },
  { key: "EARBUMP", label: "Ear-Bump songs", prefix: "earbump_song_" },
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const PAGE_SIZE = 24;
const FETCH_LIMIT = 50;
const MAX_FETCH_BATCHES = 5;

const buildSongMeta = (song: any): SongMeta => {
  const description: string = song?.metadata?.description || "";
  const pairs = description.split(";");
  const metadataFromDescription: Record<string, string> = {};

  for (const pair of pairs) {
    const [rawKey, rawValue] = pair.split("=");
    if (!rawKey || !rawValue) continue;

    const key = rawKey.trim();
    if (key !== "title" && key !== "author") continue;

    metadataFromDescription[key] = rawValue.trim();
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
    ...metadataFromDescription,
  };
};

const BrowseAllSongs: React.FC = () => {
  const dispatch = useDispatch();
  const imageCoverHash = useSelector(
    (state: RootState) => state.global.imageCoverHash
  );
  const imageCoverHashRef = useRef(imageCoverHash);

  const [songs, setSongs] = useState<SongMeta[]>([]);
  const [activeSource, setActiveSource] = useState<SourceKey>("ALL");
  const [activeLetter, setActiveLetter] = useState<AlphabetKey>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    imageCoverHashRef.current = imageCoverHash;
  }, [imageCoverHash]);

  const getImgCover = useCallback(
    async (id: string, name: string) => {
      try {
        const url = await qortalRequest({
          action: "GET_QDN_RESOURCE_URL",
          name,
          service: "THUMBNAIL",
          identifier: id,
        });

        if (url === "Resource does not exist") return;

        dispatch(setImageCoverHash({ url, id }));
      } catch (err) {
        console.error(err);
      }
    },
    [dispatch]
  );

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
          const responseData = await searchQdnResources({
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
      let aggregated: SongMeta[] = [];

      if (activeSource === "ALL") {
        const [qMusicSongs, earBumpSongs] = await Promise.all([
          fetchSongsForPrefix("enjoymusic_song_"),
          fetchSongsForPrefix("earbump_song_"),
        ]);
        aggregated = [...qMusicSongs, ...earBumpSongs];
      } else {
        const { prefix } =
          SOURCE_FILTERS.find((filter) => filter.key === activeSource) || {};
        aggregated = await fetchSongsForPrefix(prefix);
      }

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

      for (const song of sortedSongs) {
        if (!song?.id || !song?.name) continue;
        if (!imageCoverHashRef.current[song.id]) {
          queueFetchAvatars.push(() => getImgCover(song.id, song.name));
        }
      }

      setSongs(sortedSongs);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
      setSongs([]);
      setError("Unable to load songs right now. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, [activeSource, fetchSongsForPrefix, getImgCover]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  const handleSourceChange = (source: SourceKey) => {
    if (source === activeSource) return;
    setActiveSource(source);
    setActiveLetter("ALL");
    setCurrentPage(1);
  };

  const handleLetterChange = (letter: AlphabetKey) => {
    if (letter === activeLetter) return;
    setActiveLetter(letter);
    setCurrentPage(1);
  };

  const filteredSongs = useMemo(() => {
    if (activeLetter === "ALL") {
      return songs;
    }

    return songs.filter((song) => {
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
  }, [songs, activeLetter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSongs.length / PAGE_SIZE)
  );

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
    <Box className="overflow-hidden">
      <Header className="rounded-t-lg bg-gradient-to-b from-sky-900/80 via-sky-950/40 to-transparent">
        <div className="flex flex-col items-center gap-y-6 text-center">
          <div>
            <h1 className="text-white text-3xl font-semibold">
              Browse All Songs
            </h1>
            <p className="text-sky-200/80 text-sm mt-2">
              Discover every song across Q-Music and Ear-Bump catalogs.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {SOURCE_FILTERS.map((filter) => {
              const isActive = activeSource === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => handleSourceChange(filter.key)}
                  className={`min-w-[140px] rounded-full border px-5 py-2 text-sm font-medium transition ${
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
        ) : paginatedSongs.length === 0 ? (
          <div className="flex justify-center py-8">
            <p className="text-sm text-sky-200/80">
              No songs match the selected filters.
            </p>
          </div>
        ) : (
          <>
            <div
              className="
                mt-6
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
      </div>
    </Box>
  );
};

export default BrowseAllSongs;
