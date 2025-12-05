import { configureStore } from '@reduxjs/toolkit'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { qdnApiWithEndpoints as api } from '../../src/state/api/endpoints'

const createTestStore = () =>
  configureStore({
    reducer: {
      [api.reducerPath]: api.reducer
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware)
  })

describe('qdnApi baseQuery', () => {
  const sampleResult = {
    name: 'tester',
    service: 'AUDIO',
    identifier: 'track-1',
    metadata: { title: 'Hello Track', description: 'title=Hello Track;author=Tester' },
    status: { status: 'READY', percentLoaded: 100 }
  }

  beforeEach(() => {
    const requester = vi.fn(async (payload: any) => {
      const action = payload?.action
      switch (action) {
        case 'SEARCH_QDN_RESOURCES':
          return [sampleResult]
        case 'PUBLISH_QDN_RESOURCE':
          return { ...payload, ok: true }
        case 'PUBLISH_MULTIPLE_QDN_RESOURCES':
          return { identifiers: payload?.resources?.map((r: any) => r.identifier) }
        case 'GET_QDN_RESOURCE_STATUS':
          return { status: 'READY', percentLoaded: 100 }
        case 'FETCH_QDN_RESOURCE':
          return { payload: true }
        default:
          return {}
      }
    })

    ;(globalThis as any).window = {
      ...(globalThis as any).window,
      qortalRequest: requester
    }
  })

  it('searchResources routes through qortalRequest', async () => {
    const store = createTestStore()
    const query = { service: 'AUDIO', query: 'track-1', limit: 5 }
    const result = await store.dispatch(api.endpoints.searchResources.initiate(query)).unwrap()

    expect(result).toEqual([sampleResult])
    const calls = (window as any).qortalRequest.mock.calls
    expect(calls[0][0]).toMatchObject({ action: 'SEARCH_QDN_RESOURCES', ...query })
  })

  it('publishResource supports single resource payloads', async () => {
    const store = createTestStore()
    const payload = {
      name: 'tester',
      service: 'AUDIO',
      identifier: 'track-1',
      data64: 'ZGF0YQ==',
      encoding: 'base64'
    }

    const response = await store.dispatch(api.endpoints.publishResource.initiate(payload)).unwrap()

    expect(response.identifier).toBe('track-1')
    expect((window as any).qortalRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'PUBLISH_QDN_RESOURCE', name: 'tester', identifier: 'track-1' })
    )
  })

  it('surface structured errors from qortalRequest', async () => {
    const store = createTestStore()
    const requester = (window as any).qortalRequest as ReturnType<typeof vi.fn>
    requester.mockRejectedValueOnce({ message: 'boom', status: 500, data: { reason: 'fail' } })

    const promise = store
      .dispatch(
        api.endpoints.getStatus.initiate({
          service: 'AUDIO',
          name: 'tester',
          identifier: 'missing'
        })
      )
      .unwrap()

    await expect(promise).rejects.toEqual({ message: 'boom', status: 500, data: { reason: 'fail' } })
  })
})
