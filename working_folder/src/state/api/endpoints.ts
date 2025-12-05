import { qdnApi, type QdnLocator, type QdnService } from './qdnApi'

export type SearchResourcesRequest = {
  mode?: string
  service?: string
  query?: string
  name?: string
  identifier?: string
  limit?: number
  offset?: number
  reverse?: boolean
  includeMetadata?: boolean
  includeStatus?: boolean
  excludeBlocked?: boolean
  resources?: any[]
  namePrefix?: string
  exactMatchNames?: boolean
  tag1?: string
  tag2?: string
  tag3?: string
  tag4?: string
  tag5?: string
}

export type FetchResourceMetaRequest = QdnLocator & {
  encoding?: string
}

export type FetchAudioRangeRequest = QdnLocator & {
  rangeStart?: number
  rangeEnd?: number
}

export type PublishResourceEntry = {
  name: string
  service: QdnService | string
  identifier?: string
  data64?: string
  title?: string
  description?: string
  filename?: string
  metaData?: string
  encoding?: string
  blob?: Blob
  mimeType?: string
  file?: File
}

export type PublishResourceRequest =
  | {
      resources: PublishResourceEntry[]
    }
  | PublishResourceEntry

export type GetStatusRequest = QdnLocator

export type DeleteResourceRequest = QdnLocator & {
  hostedData?: { name: string; service: string; identifier: string }[]
}

export type SendTipRequest = {
  recipient: string
  amount: number
  coin?: string
  assetId?: string
}

export type TxStatusRequest = {
  signature: string
}

export type GetResourceUrlRequest = QdnLocator & {
  method?: string
}

export type FetchResourceRequest = QdnLocator & {
  encoding?: string
  responseType?: string
}

export type GetResourcePropertiesRequest = QdnLocator

export type GetWalletBalanceRequest = {
  coin?: string
}

export type GetListItemsRequest = {
  list_name: string
}

export type DeleteListItemRequest = {
  list_name: string
  item: string
}

export type GetUserAccountResponse = {
  address: string
  [key: string]: unknown
}

export const qdnApiWithEndpoints = qdnApi.injectEndpoints({
  endpoints: (builder) => ({
    searchResources: builder.query<any[], SearchResourcesRequest>({
      query: (params) => ({
        action: 'SEARCH_QDN_RESOURCES',
        ...params
      })
    }),
    fetchResourceMeta: builder.query<any, FetchResourceMetaRequest>({
      query: ({ service, name, identifier, encoding = 'utf-8' }) => ({
        action: 'FETCH_QDN_RESOURCE',
        service,
        name,
        identifier,
        encoding
      })
    }),
    fetchAudioRange: builder.query<ArrayBuffer, FetchAudioRangeRequest>({
      query: ({ service, name, identifier, rangeEnd, rangeStart }) => {
        const headers: Record<string, string> = {}
        if (rangeStart !== undefined || rangeEnd !== undefined) {
          const start = Number.isFinite(rangeStart) ? rangeStart : ''
          const end = Number.isFinite(rangeEnd) ? rangeEnd : ''
          headers.Range = `bytes=${start}-${end}`
        }
        return {
          action: 'FETCH_QDN_RESOURCE',
          service,
          name,
          identifier,
          responseType: 'arraybuffer',
          ...(headers.Range ? { headers } : {})
        }
      }
    }),
    publishResource: builder.mutation<any, PublishResourceRequest>({
      query: (payload) => {
        if ('resources' in payload) {
          return {
            action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
            resources: payload.resources
          }
        }
        return {
          action: 'PUBLISH_QDN_RESOURCE',
          ...payload
        }
      }
    }),
    getStatus: builder.query<any, GetStatusRequest>({
      query: ({ service, name, identifier }) => ({
        action: 'GET_QDN_RESOURCE_STATUS',
        service,
        name,
        identifier
      })
    }),
    getResourceProperties: builder.query<any, GetResourcePropertiesRequest>({
      query: ({ service, name, identifier }) => ({
        action: 'GET_QDN_RESOURCE_PROPERTIES',
        service,
        name,
        identifier
      })
    }),
    getAccountNames: builder.query<any, { address?: string } | void>({
      query: (payload) => ({
        action: 'GET_ACCOUNT_NAMES',
        ...(payload ?? {})
      })
    }),
    getUserAccount: builder.query<GetUserAccountResponse, void>({
      query: () => ({
        action: 'GET_USER_ACCOUNT'
      })
    }),
    deleteResource: builder.mutation<any, DeleteResourceRequest>({
      query: ({ service, name, identifier, hostedData }) => ({
        action: hostedData ? 'DELETE_HOSTED_DATA' : 'DELETE_QDN_RESOURCE',
        service,
        name,
        identifier,
        ...(hostedData ? { hostedData } : {})
      })
    }),
    getListItems: builder.query<any, GetListItemsRequest>({
      query: ({ list_name }) => ({
        action: 'GET_LIST_ITEMS',
        list_name
      })
    }),
    deleteListItem: builder.mutation<any, DeleteListItemRequest>({
      query: ({ list_name, item }) => ({
        action: 'DELETE_LIST_ITEM',
        list_name,
        item
      })
    }),
    getWalletBalance: builder.query<any, GetWalletBalanceRequest | void>({
      query: (payload) => ({
        action: 'GET_WALLET_BALANCE',
        ...(payload ?? {})
      })
    }),
    sendTip: builder.mutation<any, SendTipRequest>({
      query: (payload) => ({
        action: 'SEND_QORTAL_TIP',
        ...payload
      })
    }),
    txStatus: builder.query<any, TxStatusRequest>({
      query: ({ signature }) => ({
        action: 'GET_TX_STATUS',
        signature
      })
    }),
    getResourceUrl: builder.query<string | null, GetResourceUrlRequest>({
      query: ({ service, name, identifier, method }) => ({
        action: 'GET_QDN_RESOURCE_URL',
        service,
        name,
        identifier,
        ...(method ? { method } : {})
      })
    }),
    fetchResource: builder.query<any, FetchResourceRequest>({
      query: ({ service, name, identifier, encoding, responseType }) => ({
        action: 'FETCH_QDN_RESOURCE',
        service,
        name,
        identifier,
        ...(encoding ? { encoding } : {}),
        ...(responseType ? { responseType } : {})
      })
    })
  }),
  overrideExisting: true
})

export const {
  useSearchResourcesQuery,
  useLazySearchResourcesQuery,
  useFetchResourceMetaQuery,
  useLazyFetchResourceMetaQuery,
  useFetchAudioRangeQuery,
  usePublishResourceMutation,
  useGetStatusQuery,
  useLazyGetStatusQuery,
  useGetResourcePropertiesQuery,
  useLazyGetResourcePropertiesQuery,
  useGetAccountNamesQuery,
  useLazyGetAccountNamesQuery,
  useGetUserAccountQuery,
  useLazyGetUserAccountQuery,
  useDeleteResourceMutation,
  useGetListItemsQuery,
  useLazyGetListItemsQuery,
  useDeleteListItemMutation,
  useGetWalletBalanceQuery,
  useLazyGetWalletBalanceQuery,
  useSendTipMutation,
  useTxStatusQuery,
  useLazyTxStatusQuery,
  useGetResourceUrlQuery,
  useLazyGetResourceUrlQuery,
  useFetchResourceQuery,
  useLazyFetchResourceQuery
} = qdnApiWithEndpoints
