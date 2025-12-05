import { configureStore } from '@reduxjs/toolkit'
import { qdnApi } from './api/qdnApi'
import notificationsReducer from './features/notificationsSlice'
import authReducer from './features/authSlice'
import globalReducer from './features/globalSlice'
import requestsReducer from './features/requestsSlice'
import discussionsReducer from './features/discussionsSlice'
import publishReducer from './slices/publishSlice'

export const store = configureStore({
  reducer: {
    [qdnApi.reducerPath]: qdnApi.reducer,
    notifications: notificationsReducer,
    auth: authReducer,
    global: globalReducer,
    requests: requestsReducer,
    discussions: discussionsReducer,
    publish: publishReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    }).concat(qdnApi.middleware),
  preloadedState: undefined // optional, can be any valid state object
})

// Define the RootState type, which is the type of the entire Redux state tree.
// This is useful when you need to access the state in a component or elsewhere.
export type RootState = ReturnType<typeof store.getState>

// Define the AppDispatch type, which is the type of the Redux store's dispatch function.
// This is useful when you need to dispatch an action in a component or elsewhere.
export type AppDispatch = typeof store.dispatch
