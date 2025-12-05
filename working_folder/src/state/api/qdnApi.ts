import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react'

export type QErr = {
  message: string
  status?: number
  data?: unknown
}

export type QdnService = 'AUDIO' | 'DOCUMENT'

export type QdnLocator = {
  service: QdnService | string
  name: string
  identifier?: string
}

type QortalRequester = typeof qortalRequest
type QortalRequestPayload = QortalRequestOptions

const qortalBaseQuery: BaseQueryFn<QortalRequestPayload, unknown, QErr> = async (
  args
) => {
  const requester =
    typeof window !== 'undefined'
      ? (window as typeof window & { qortalRequest?: QortalRequester })
          .qortalRequest
      : undefined

  if (!requester) {
    return { error: { message: 'qortalRequest is not available in this environment.' } }
  }

  try {
    const data = await requester(args)
    return { data }
  } catch (err: any) {
    return {
      error: {
        message: err?.message ?? 'QDN request failed',
        status: err?.status ?? err?.code,
        data: err?.data ?? err
      }
    }
  }
}

export const qdnApi = createApi({
  reducerPath: 'qdnApi',
  baseQuery: qortalBaseQuery,
  endpoints: () => ({})
})
