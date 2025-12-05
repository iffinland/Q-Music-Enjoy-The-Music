import { store } from '../store'
import {
  qdnApiWithEndpoints,
  type DeleteListItemRequest,
  type DeleteResourceRequest,
  type FetchAudioRangeRequest,
  type FetchResourceMetaRequest,
  type FetchResourceRequest,
  type GetResourceUrlRequest,
  type GetResourcePropertiesRequest,
  type GetWalletBalanceRequest,
  type GetStatusRequest,
  type GetListItemsRequest,
  type GetUserAccountResponse,
  type PublishResourceRequest,
  type SearchResourcesRequest,
  type SendTipRequest,
  type TxStatusRequest
} from './endpoints'

const callEndpoint = async <Arg, Result>(
  initiate: (arg: Arg) => any,
  params: Arg
): Promise<Result> => {
  const result = store.dispatch(initiate(params))
  try {
    return await result.unwrap()
  } finally {
    result.unsubscribe()
  }
}

export const qdnClient = {
  searchResources: (params: SearchResourcesRequest) =>
    callEndpoint<SearchResourcesRequest, any[]>(
      qdnApiWithEndpoints.endpoints.searchResources.initiate,
      params
    ),
  fetchResourceMeta: (params: FetchResourceMetaRequest) =>
    callEndpoint<FetchResourceMetaRequest, any>(
      qdnApiWithEndpoints.endpoints.fetchResourceMeta.initiate,
      params
    ),
  fetchResource: (params: FetchResourceRequest) =>
    callEndpoint<FetchResourceRequest, any>(
      qdnApiWithEndpoints.endpoints.fetchResource.initiate,
      params
    ),
  fetchAudioRange: (params: FetchAudioRangeRequest) =>
    callEndpoint<FetchAudioRangeRequest, ArrayBuffer>(
      qdnApiWithEndpoints.endpoints.fetchAudioRange.initiate,
      params
    ),
  publishResource: (params: PublishResourceRequest) =>
    callEndpoint<PublishResourceRequest, any>(
      qdnApiWithEndpoints.endpoints.publishResource.initiate,
      params
    ),
  getStatus: (params: GetStatusRequest) =>
    callEndpoint<GetStatusRequest, any>(qdnApiWithEndpoints.endpoints.getStatus.initiate, params),
  getResourceProperties: (params: GetResourcePropertiesRequest) =>
    callEndpoint<GetResourcePropertiesRequest, any>(
      qdnApiWithEndpoints.endpoints.getResourceProperties.initiate,
      params
    ),
  getAccountNames: (params?: { address?: string }) =>
    callEndpoint<{ address?: string }, any>(
      qdnApiWithEndpoints.endpoints.getAccountNames.initiate,
      params ?? {}
    ),
  getUserAccount: () =>
    callEndpoint<void, GetUserAccountResponse>(
      qdnApiWithEndpoints.endpoints.getUserAccount.initiate,
      undefined as void
    ),
  deleteResource: (params: DeleteResourceRequest) =>
    callEndpoint<DeleteResourceRequest, any>(
      qdnApiWithEndpoints.endpoints.deleteResource.initiate,
      params
    ),
  getListItems: (params: GetListItemsRequest) =>
    callEndpoint<GetListItemsRequest, any>(
      qdnApiWithEndpoints.endpoints.getListItems.initiate,
      params
    ),
  deleteListItem: (params: DeleteListItemRequest) =>
    callEndpoint<DeleteListItemRequest, any>(
      qdnApiWithEndpoints.endpoints.deleteListItem.initiate,
      params
    ),
  getWalletBalance: (params?: GetWalletBalanceRequest) =>
    callEndpoint<GetWalletBalanceRequest | void, any>(
      qdnApiWithEndpoints.endpoints.getWalletBalance.initiate,
      params ?? ({} as GetWalletBalanceRequest)
    ),
  sendTip: (params: SendTipRequest) =>
    callEndpoint<SendTipRequest, any>(qdnApiWithEndpoints.endpoints.sendTip.initiate, params),
  txStatus: (params: TxStatusRequest) =>
    callEndpoint<TxStatusRequest, any>(qdnApiWithEndpoints.endpoints.txStatus.initiate, params),
  getResourceUrl: (params: GetResourceUrlRequest) =>
    callEndpoint<GetResourceUrlRequest, string | null>(
      qdnApiWithEndpoints.endpoints.getResourceUrl.initiate,
      params
    )
}
