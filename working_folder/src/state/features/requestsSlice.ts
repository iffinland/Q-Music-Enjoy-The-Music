import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type RequestStatus = 'open' | 'filled';

export interface SongRequest {
  id: string;
  artist: string;
  title: string;
  info?: string;
  created: number;
  updated?: number;
  publisher: string;
  status: RequestStatus;
  filledAt?: number;
  filledBy?: string;
  filledSongIdentifier?: string;
  filledSongTitle?: string;
  filledSongArtist?: string;
}

export interface RequestFill {
  id: string;
  requestId: string;
  filledBy: string;
  songIdentifier: string;
  songTitle: string;
  songArtist: string;
  created: number;
}

interface RequestsState {
  requests: SongRequest[];
  fills: Record<string, RequestFill>;
  isLoading: boolean;
  error: string | null;
}

const initialState: RequestsState = {
  requests: [],
  fills: {},
  isLoading: false,
  error: null,
};

export const requestsSlice = createSlice({
  name: 'requests',
  initialState,
  reducers: {
    setRequestsLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setRequestsError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setSongRequests(state, action: PayloadAction<SongRequest[]>) {
      state.requests = action.payload;
    },
    upsertSongRequest(state, action: PayloadAction<SongRequest>) {
      const incoming = action.payload;
      const index = state.requests.findIndex((item) => item.id === incoming.id);
      if (index !== -1) {
        state.requests[index] = incoming;
      } else {
        state.requests.unshift(incoming);
      }
    },
    setRequestFills(state, action: PayloadAction<Record<string, RequestFill>>) {
      state.fills = action.payload;
    },
    upsertRequestFill(state, action: PayloadAction<RequestFill>) {
      const incoming = action.payload;
      state.fills[incoming.requestId] = incoming;
      const index = state.requests.findIndex((item) => item.id === incoming.requestId);
      if (index !== -1) {
        const request = state.requests[index];
        state.requests[index] = {
          ...request,
          status: 'filled',
          filledAt: incoming.created,
          filledBy: incoming.filledBy,
          filledSongIdentifier: incoming.songIdentifier,
          filledSongTitle: incoming.songTitle,
          filledSongArtist: incoming.songArtist,
        };
      }
    },
  },
});

export const {
  setRequestsLoading,
  setRequestsError,
  setSongRequests,
  upsertSongRequest,
  setRequestFills,
  upsertRequestFill,
} = requestsSlice.actions;

export default requestsSlice.reducer;
