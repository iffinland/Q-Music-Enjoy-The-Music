import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Song } from '../../types'

const COVER_CACHE_LIMIT = 500;

interface ResourceBase {
  name?: string;
  id: string;
  category?: string;
  categoryName?: string;
  tags?: string[];
  created: number;
  updated: number;
  user?: string;
}

interface GlobalState {
  isLoadingGlobal: boolean
  downloads: any
  userAvatarHash: Record<string, string>
  songHash: Record<string, string>
  imageCoverHash: Record<string, string>
  imageCoverOrder: string[]
  songListLibrary: Song[]
  queriedValuePlaylist: string;
  currentSong: string | null
  favorites: null | Favorites
  favoritesPlaylist: null | PlayList[]
  favoriteList: Song[]
  nowPlayingPlaylist: Song[]
  volume: number
  newPlayList: PlayList | null
  playlists: PlayList[]
  myPlaylists: PlayList[]
  playlistHash: Record<string, PlayList>
  currentPlaylist: string
  playlistQueried: PlayList[]
  isQueryingPlaylist: boolean
  statistics: StatisticsState
}

interface StatisticsData {
  allSongs: number
  allPlaylists: number
  qmusicSongs: number
  qmusicPlaylists: number
  totalPodcasts: number
  totalAudiobooks: number
  musicVideos: number
  totalPublishers: number
  openRequests: number
  filledRequests: number
}

interface StatisticsState {
  isLoading: boolean
  lastUpdated: number | null
  data: StatisticsData | null
}

export interface PlayList extends ResourceBase {
  title: string;
  description: string;
  songs: SongReference[];
  image: string | null
}

export interface SongReference {
  name: string;
  service: string;
  identifier: string;
  title: string;
  author?: string;
  artist?: string;
}
export interface Status {
  status: string;
  id: string;
  title: string;
  description: string;
}
export interface SongMeta {
  title: string
  description: string
  created: number
  updated: number
  name: string
  id: string
  status?: Status
  author?: string;
  service?: string;
  genre?: string;
  mood?: string;
  language?: string;
  notes?: string;
  category?: string | null;
  categoryName?: string | null;
}

export interface FavSong {
  name: string;
  identifier: string;
  service: string;
  status?: string
}
export interface FavPlaylist {
  name: string;
  identifier: string;
  service: string
}

export interface Favorites {
  songs: Record<string, FavSong>
  playlists: Record<string, FavPlaylist>
}

const ensureValidPlaylist = (playlist: PlayList | null | undefined): PlayList | null => {
  if (!playlist) return null;
  const rawId = typeof playlist.id === 'string' ? playlist.id : '';
  const normalizedId = rawId.trim();
  if (!normalizedId) return null;
  if (rawId === normalizedId) return playlist;
  return { ...playlist, id: normalizedId };
};

const normalizePlaylistList = (
  list: Array<PlayList | null | undefined>,
): PlayList[] => {
  const result: PlayList[] = [];
  list.forEach((entry) => {
    const normalized = ensureValidPlaylist(entry);
    if (normalized) {
      result.push(normalized);
    }
  });
  return result;
};

const initialState: GlobalState = {
  isLoadingGlobal: false,
  downloads: {},
  userAvatarHash: {},
  imageCoverHash: {},
  imageCoverOrder: [],
  songHash: {},
  songListLibrary: [],
  queriedValuePlaylist: "",
  currentSong: null,
  favorites: null,
  favoriteList: [],
  nowPlayingPlaylist: [],
  volume: 0.75,
  newPlayList: null,
  playlists: [],
  myPlaylists: [],
  playlistHash: {},
  currentPlaylist: 'nowPlayingPlaylist',
  playlistQueried: [],
  isQueryingPlaylist: false,
  favoritesPlaylist: null,
  statistics: {
    isLoading: false,
    lastUpdated: null,
    data: null
  }
}

export const globalSlice = createSlice({
  name: 'global',
  initialState,
  reducers: {
    setIsLoadingGlobal: (state, action) => {
      state.isLoadingGlobal = action.payload
    },
    setAddToDownloads: (state, action) => {
      const download = action.payload
      state.downloads[download.identifier] = download
    },
    updateDownloads: (state, action) => {
      const { identifier } = action.payload
      const download = action.payload
      state.downloads[identifier] = {
        ...state.downloads[identifier],
        ...download
      }
    },
    setUserAvatarHash: (state, action) => {
      const avatar = action.payload
      if (avatar?.name && avatar?.url) {
        state.userAvatarHash[avatar?.name] = avatar?.url
      }
    },
    setImageCoverHash: (state, action) => {
      const imageCover = action.payload;
      if (!imageCover?.id) return;
      const normalizedUrl = typeof imageCover.url === 'string' ? imageCover.url : '';
      const key = imageCover.id;
      const alreadyCached = Object.prototype.hasOwnProperty.call(state.imageCoverHash, key);
      state.imageCoverHash[key] = normalizedUrl;
      if (!alreadyCached) {
        state.imageCoverOrder.push(key);
        if (state.imageCoverOrder.length > COVER_CACHE_LIMIT) {
          const staleKey = state.imageCoverOrder.shift();
          if (staleKey) {
            delete state.imageCoverHash[staleKey];
          }
        }
      }
    },
    upsertMyLibrary: (state, action) => {
      action.payload.forEach((song: Song) => {
        const index = state.songListLibrary.findIndex((p) => p.id === song.id)
        if (index !== -1) {
          state.songListLibrary[index] = song
        } else {
          state.songListLibrary.push(song)
        }
      })
    },
    removeSongFromLibrary: (state, action: PayloadAction<string>) => {
      const songId = action.payload
      state.songListLibrary = state.songListLibrary.filter((song) => song.id !== songId)
      state.favoriteList = state.favoriteList.filter((song) => song.id !== songId)
      if (state.favorites?.songs?.[songId]) {
        delete state.favorites.songs[songId]
      }
      if (state.songHash[songId]) {
        delete state.songHash[songId]
      }
      if (state.currentSong === songId) {
        state.currentSong = null
      }
    },
    upsertPlaylists: (state, action) => {
      action.payload.forEach((playlist: PlayList) => {
        const normalized = ensureValidPlaylist(playlist)
        if (!normalized) return
        const index = state.playlists.findIndex((p) => p.id === normalized.id)
        if (index !== -1) {
          state.playlists[index] = normalized
        } else {
          state.playlists.push(normalized)
        }
      })
    },
    upsertMyPlaylists: (state, action) => {
      action.payload.forEach((playlist: PlayList) => {
        const normalized = ensureValidPlaylist(playlist)
        if (!normalized) return
        const index = state.myPlaylists.findIndex((p) => p.id === normalized.id)
        if (index !== -1) {
          state.myPlaylists[index] = normalized
        } else {
          state.myPlaylists.push(normalized)
        }
      })
    },
    addNewSong: (state, action) => {
      const song: SongMeta = action.payload
      state.songListLibrary.unshift(song)
    },
    upsertQueriedPlaylist: (state, action) => {
      action.payload.forEach((playlist: PlayList) => {
        const normalized = ensureValidPlaylist(playlist)
        if (!normalized) return
        const index = state.playlistQueried.findIndex((p) => p.id === normalized.id)
        if (index !== -1) {
          state.playlistQueried[index] = normalized
        } else {
          state.playlistQueried.push(normalized)
        }
      })
    },
    upsertFavorite: (state, action) => {
      action.payload.forEach((song: Song) => {
        const index = state.favoriteList.findIndex((p) => p.id === song.id)
        if (index !== -1) {
          state.favoriteList[index] = song
        } else {
          state.favoriteList.push(song)
        }
      })
    },
    setCurrentSong: (state, action) => {
      state.currentSong = action.payload
    },

    resetQueriedListPlaylist: (state) => {
      state.playlistQueried = []
    },
    setQueriedValuePlaylist: (state, action) => {
      state.queriedValuePlaylist = action.payload
    },
    setFavSong: (state, action) => {
      if (state.favorites) {
        const song = action.payload
        state.favorites.songs[song.identifier] = {
          identifier: song.identifier,
          name: song.name,
          service: song.service
        }
        state.favoriteList.unshift(song.songData)
      }

    },
    removeFavSong: (state, action) => {
      if (state.favorites) {
        const song = action.payload
        if (state.favorites.songs[song.identifier]) {
          delete state.favorites.songs[song.identifier]
        }
        state.favoriteList = state.favoriteList.filter((songItem) => songItem.id !== song.identifier)
      }

    },
    setFavPlaylist: (state, action) => {
      if (!state.favoritesPlaylist) {
        state.favoritesPlaylist = [];
      }
      const normalizedList = normalizePlaylistList(state.favoritesPlaylist);
      const normalized = ensureValidPlaylist(action.payload);
      if (!normalized) {
        state.favoritesPlaylist = normalizedList;
        return;
      }
      state.favoritesPlaylist = [normalized, ...normalizedList];
    },
    removeFavPlaylist: (state, action) => {
      if (state.favoritesPlaylist) {
        const normalized = ensureValidPlaylist(action.payload);
        const normalizedList = normalizePlaylistList(state.favoritesPlaylist);
        if (!normalized) {
          state.favoritesPlaylist = normalizedList;
          return;
        }
        state.favoritesPlaylist = normalizedList.filter(
          (play) => play.id !== normalized.id,
        )
      }

    },
    setFavoritesFromStorage: (state, action) => {
      state.favorites = action.payload
    },
    setFavoritesFromStoragePlaylists: (state, action) => {
      const payload = Array.isArray(action.payload)
        ? action.payload
        : [];
      state.favoritesPlaylist = normalizePlaylistList(payload)
    },
    upsertNowPlayingPlaylist: (state, action) => {
      action.payload.forEach((song: Song) => {
        const index = state.nowPlayingPlaylist.findIndex((p) => p.id === song.id)
        if (index !== -1) {
          state.nowPlayingPlaylist[index] = song
        } else {
          state.nowPlayingPlaylist.push(song)
        }
      })
    },
    setNowPlayingPlaylist: (state, action: PayloadAction<Song[]>) => {
      state.nowPlayingPlaylist = Array.isArray(action.payload) ? action.payload : [];
    },
    setVolumePlayer: (state, action) => {
      state.volume = action.payload
    },
    setNewPlayList: (state, action) => {
      state.newPlayList = action.payload
    },
    addToPlaylistHashMap: (state, action) => {
      const normalized = ensureValidPlaylist(action.payload)
      if (!normalized) return
      state.playlistHash[normalized.id] = normalized
    },
    removePlaylistById: (state, action: PayloadAction<string>) => {
      const playlistId = action.payload
      state.playlists = normalizePlaylistList(state.playlists).filter((playlist) => playlist.id !== playlistId)
      state.myPlaylists = normalizePlaylistList(state.myPlaylists).filter((playlist) => playlist.id !== playlistId)
      state.playlistQueried = normalizePlaylistList(state.playlistQueried).filter((playlist) => playlist.id !== playlistId)
      if (state.favoritesPlaylist) {
        state.favoritesPlaylist = normalizePlaylistList(state.favoritesPlaylist).filter((playlist) => playlist.id !== playlistId)
      }
      if (state.newPlayList?.id === playlistId) {
        state.newPlayList = null
      }
      if (state.currentPlaylist === playlistId) {
        state.currentPlaylist = 'nowPlayingPlaylist'
      }
      delete state.playlistHash[playlistId]

      const stats = state.statistics.data
      if (stats) {
        stats.allPlaylists = Math.max(0, stats.allPlaylists - 1)
        if (playlistId.startsWith('enjoymusic_playlist_')) {
          stats.qmusicPlaylists = Math.max(0, stats.qmusicPlaylists - 1)
        }
      }
    },
    setCurrentPlaylist: (state, action) => {
      state.currentPlaylist = action.payload
    },
    setIsQueryingPlaylist: (state, action) => {
      state.isQueryingPlaylist = action.payload
    },
    setStatisticsLoading: (state, action: PayloadAction<boolean>) => {
      state.statistics.isLoading = action.payload
    },
    setStatistics: (state, action: PayloadAction<StatisticsData>) => {
      state.statistics.data = action.payload
      state.statistics.lastUpdated = Date.now()
    },
  }
})

export const {
  setIsLoadingGlobal,
  setAddToDownloads,
  updateDownloads,
  setUserAvatarHash,
  setImageCoverHash,
  upsertMyLibrary,
  removeSongFromLibrary,
  setCurrentSong,
  addNewSong,
  setFavSong,
  removeFavSong,
  upsertFavorite,
  setFavoritesFromStorage,
  upsertNowPlayingPlaylist,
  setVolumePlayer,
  setNewPlayList,
  upsertPlaylists,
  addToPlaylistHashMap,
  removePlaylistById,
  setCurrentPlaylist,
  upsertQueriedPlaylist,
  setQueriedValuePlaylist,
  resetQueriedListPlaylist,
  setIsQueryingPlaylist,
  upsertMyPlaylists,
  setFavoritesFromStoragePlaylists,
  setFavPlaylist,
  removeFavPlaylist,
  setStatisticsLoading,
  setStatistics,
  setNowPlayingPlaylist,
} = globalSlice.actions

export default globalSlice.reducer
