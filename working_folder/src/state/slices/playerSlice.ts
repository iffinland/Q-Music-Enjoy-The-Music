import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

export interface QueueItem {
  id: string
  title?: string
  author?: string
  url?: string | null
  name?: string
  service?: string
  identifier?: string
  status?: any
}

export interface PlayerState {
  queue: QueueItem[]
  activeId: string | null
  status: PlayerStatus
  volume: number
  repeat: 'off' | 'one' | 'all'
  shuffle: boolean
  position: number
  duration: number
}

const initialState: PlayerState = {
  queue: [],
  activeId: null,
  status: 'idle',
  volume: 0.75,
  repeat: 'off',
  shuffle: false,
  position: 0,
  duration: 0
}

export const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    setQueue: (state, action: PayloadAction<QueueItem[]>) => {
      state.queue = action.payload
    },
    setActive: (state, action: PayloadAction<string | null>) => {
      state.activeId = action.payload
    },
    setStatus: (state, action: PayloadAction<PlayerStatus>) => {
      state.status = action.payload
    },
    setVolume: (state, action: PayloadAction<number>) => {
      state.volume = Math.max(0, Math.min(1, action.payload))
    },
    setRepeat: (state, action: PayloadAction<PlayerState['repeat']>) => {
      state.repeat = action.payload
    },
    setShuffle: (state, action: PayloadAction<boolean>) => {
      state.shuffle = action.payload
    },
    setPosition: (state, action: PayloadAction<number>) => {
      state.position = Math.max(0, action.payload)
    },
    setDuration: (state, action: PayloadAction<number>) => {
      state.duration = Math.max(0, action.payload)
    },
    resetPlayer: () => initialState
  }
})

export const {
  setQueue,
  setActive,
  setStatus,
  setVolume,
  setRepeat,
  setShuffle,
  setPosition,
  setDuration,
  resetPlayer
} = playerSlice.actions

export default playerSlice.reducer
