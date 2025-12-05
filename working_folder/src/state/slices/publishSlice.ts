import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { PublishFormValues, PublishKind } from '../../schemas/publish'

export type PublishStep = 'meta' | 'files' | 'preview' | 'sign' | 'publish'

export interface PublishState {
  step: PublishStep
  kind: PublishKind
  dirty: boolean
  draftId: string | null
  payload: Partial<PublishFormValues>
}

const initialState: PublishState = {
  step: 'meta',
  kind: 'music',
  dirty: false,
  draftId: null,
  payload: {
    kind: 'music'
  }
}

export const publishSlice = createSlice({
  name: 'publish',
  initialState,
  reducers: {
    setKind: (state, action: PayloadAction<PublishKind>) => {
      state.kind = action.payload
      state.payload = { ...state.payload, kind: action.payload }
      state.dirty = true
    },
    setStep: (state, action: PayloadAction<PublishStep>) => {
      state.step = action.payload
    },
    mergePayload: (state, action: PayloadAction<Partial<PublishFormValues>>) => {
      state.payload = { ...state.payload, ...action.payload }
      state.dirty = true
    },
    setDraftId: (state, action: PayloadAction<string | null>) => {
      state.draftId = action.payload
    },
    reset: () => ({
      ...initialState,
      payload: { ...initialState.payload }
    })
  }
})

export const { setKind, setStep, mergePayload, setDraftId, reset } = publishSlice.actions
export default publishSlice.reducer
