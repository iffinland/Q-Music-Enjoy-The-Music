import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Song } from '../../types'


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
  earbumpSongs: number
  earbumpPlaylists: number
  totalPodcasts: number
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
const initialState: GlobalState = {
  isLoadingGlobal: false,
  downloads: {},
  userAvatarHash: {},
  imageCoverHash: {},
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
      const imageCover = action.payload
      if (imageCover?.id && imageCover?.url) {
        state.imageCoverHash[imageCover.id] = imageCover?.url
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
    upsertPlaylists: (state, action) => {
      action.payload.forEach((playlist: PlayList) => {
        const index = state.playlists.findIndex((p) => p.id === playlist.id)
        if (index !== -1) {
          state.playlists[index] = playlist
        } else {
          state.playlists.push(playlist)
        }
      })
    },
    upsertMyPlaylists: (state, action) => {
      action.payload.forEach((playlist: PlayList) => {
        const index = state.myPlaylists.findIndex((p) => p.id === playlist.id)
        if (index !== -1) {
          state.myPlaylists[index] = playlist
        } else {
          state.myPlaylists.push(playlist)
        }
      })
    },
    addNewSong: (state, action) => {
      const song: SongMeta = action.payload
      state.songListLibrary.unshift(song)
    },
    upsertQueriedPlaylist: (state, action) => {
      action.payload.forEach((playlist: PlayList) => {
        const index = state.playlistQueried.findIndex((p) => p.id === playlist.id)
        if (index !== -1) {
          state.playlistQueried[index] = playlist
        } else {
          state.playlistQueried.push(playlist)
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
      if (state.favoritesPlaylist) {
        const playlist = action.payload

        state.favoritesPlaylist.unshift(playlist)
      }

    },
    removeFavPlaylist: (state, action) => {
      if (state.favoritesPlaylist) {
        const playlist = action.payload

        state.favoritesPlaylist = state.favoritesPlaylist.filter((play) => play.id !== playlist.id)
      }

    },
    setFavoritesFromStorage: (state, action) => {
      state.favorites = action.payload
    },
    setFavoritesFromStoragePlaylists: (state, action) => {
      state.favoritesPlaylist = action.payload
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
    setVolumePlayer: (state, action) => {
      state.volume = action.payload
    },
    setNewPlayList: (state, action) => {
      state.newPlayList = action.payload
    },
    addToPlaylistHashMap: (state, action) => {
      const playlist = action.payload
      state.playlistHash[playlist.id] = playlist
    },
    removePlaylistById: (state, action: PayloadAction<string>) => {
      const playlistId = action.payload
      state.playlists = state.playlists.filter((playlist) => playlist.id !== playlistId)
      state.myPlaylists = state.myPlaylists.filter((playlist) => playlist.id !== playlistId)
      state.playlistQueried = state.playlistQueried.filter((playlist) => playlist.id !== playlistId)
      if (state.favoritesPlaylist) {
        state.favoritesPlaylist = state.favoritesPlaylist.filter((playlist) => playlist.id !== playlistId)
      }
      if (state.newPlayList?.id === playlistId) {
        state.newPlayList = null
      }
      if (state.currentPlaylist === playlistId) {
        state.currentPlaylist = 'nowPlayingPlaylist'
      }
      delete state.playlistHash[playlistId]
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
  setStatistics
} = globalSlice.actions

export default globalSlice.reducer
