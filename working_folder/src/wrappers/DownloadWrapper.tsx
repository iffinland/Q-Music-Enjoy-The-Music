import React from 'react';
import { useDispatch } from 'react-redux';

import { setAddToDownloads, updateDownloads } from '../state/features/globalSlice';
import { getQdnResourceUrl } from '../utils/qortalApi';
import { resolveAudioUrl } from '../utils/resolveAudioUrl';

interface Props {
  children: React.ReactNode;
}

interface IDownloadVideoParams {
  name: string;
  service: string;
  identifier: string;
  title: string;
  id: string;
  author: string;
  mediaType?: string;
}

interface MyContextInterface {
  downloadVideo: (params: IDownloadVideoParams) => Promise<string | void>;
}

type ResourceIdentifier = Pick<IDownloadVideoParams, 'name' | 'service' | 'identifier'>;

const noopDownload: MyContextInterface['downloadVideo'] = async () => {
  console.warn('downloadVideo called outside of DownloadWrapper context');
};

const defaultValues: MyContextInterface = {
  downloadVideo: noopDownload,
};
export const MyContext = React.createContext<MyContextInterface>(defaultValues);

interface ResourceStatus {
  status?: string;
  percentLoaded?: number;
  localChunkCount?: number;
}

const STATUS_POLL_INTERVAL_MS = 4_000;
const STATUS_TIMEOUT_MS = 20_000;
const PROPERTIES_TIMEOUT_MS = 25_000;
const URL_REFRESH_DELAY_MS = 4_000;
const REQUEST_TIMEOUT_FALLBACK_MS = 20_000;

const DownloadWrapper: React.FC<Props> = ({ children }) => {
  const dispatch = useDispatch();

  const withLocalTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('The request timed out')), timeoutMs),
    );
    return Promise.race([promise, timeout]);
  };

  const requestWithTimeout = async <T,>(payload: any, timeoutMs?: number): Promise<T> => {
    const resolvedTimeout =
      typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) ? timeoutMs : null;

    if (resolvedTimeout && typeof qortalRequestWithTimeout === 'function') {
      return qortalRequestWithTimeout(payload, resolvedTimeout) as Promise<T>;
    }

    if (resolvedTimeout) {
      return withLocalTimeout(qortalRequest(payload) as Promise<T>, resolvedTimeout);
    }

    if (typeof qortalRequestWithTimeout === 'function') {
      return qortalRequestWithTimeout(payload, REQUEST_TIMEOUT_FALLBACK_MS) as Promise<T>;
    }

    return qortalRequest(payload) as Promise<T>;
  };

  const fetchResource = async ({ name, service, identifier }: ResourceIdentifier) => {
    try {
      await requestWithTimeout(
        {
        action: 'GET_QDN_RESOURCE_PROPERTIES',
        name,
        service,
        identifier,
      },
        PROPERTIES_TIMEOUT_MS,
      );
    } catch (error) {
      console.error('Failed to fetch resource properties', error);
    }
  };

  const resolveAndStoreUrl = async (
    { name, service, identifier }: ResourceIdentifier,
    options: { forceRefresh?: boolean } = {},
  ): Promise<string | null> => {
    try {
      try {
        await fetchResource({ name, service, identifier });
      } catch (error) {
        console.warn('Fetching resource properties failed, continuing to resolve URL', error);
      }
      const directUrl = await getQdnResourceUrl(service, name, identifier, {
        forceRefresh: options.forceRefresh,
        nullTtlMs: 5_000,
      });

      let resolvedUrl = directUrl;
      if (!resolvedUrl && service === 'AUDIO') {
        resolvedUrl = await resolveAudioUrl(name, identifier);
      }

      if (resolvedUrl) {
        dispatch(
          updateDownloads({
            name,
            service,
            identifier,
            url: resolvedUrl,
          }),
        );
      }

      return resolvedUrl;
    } catch (error) {
      console.error('Failed to resolve resource URL', error);
      return null;
    }
  };

  const performDownload = ({ name, service, identifier, ...props }: IDownloadVideoParams) => {
    dispatch(
      setAddToDownloads({
        name,
        service,
        identifier,
        ...props,
      }),
    );

    let isCalling = false;
    let percentLoaded = 0;
    let timer = 24;
    let urlResolved = false;
    let lastUrlAttempt = 0;

    const attemptUrl = async (force = false) => {
      if (urlResolved && !force) return;
      const now = Date.now();
      if (!force && now - lastUrlAttempt < URL_REFRESH_DELAY_MS) return;
      lastUrlAttempt = now;
      const url = await resolveAndStoreUrl({ name, service, identifier }, { forceRefresh: force });
      if (url) {
        urlResolved = true;
      }
    };

    // Try to resolve URL immediately in case it is already available
    void attemptUrl(true);

    const poll = async () => {
      if (isCalling) {
        setTimeout(poll, STATUS_POLL_INTERVAL_MS);
        return;
      }
      isCalling = true;
      try {
        const res = (await requestWithTimeout<ResourceStatus>(
          {
            action: 'GET_QDN_RESOURCE_STATUS',
            name,
            service,
            identifier,
          },
          STATUS_TIMEOUT_MS,
        )) as ResourceStatus;

        if (res?.percentLoaded !== undefined) {
          if (res.percentLoaded === percentLoaded && res.percentLoaded !== 100) {
            timer -= 5;
          } else {
            timer = 24;
          }
          percentLoaded = res.percentLoaded;
        }

        dispatch(
          updateDownloads({
            name,
            service,
            identifier,
            status: res,
          }),
        );

        // If we hit READY (or 100%) ensure we have the freshest URL
        if (res?.status === 'READY' || res?.percentLoaded === 100) {
          await attemptUrl(true);
          isCalling = false;
          return;
        }

        // If progress is stuck, try to refresh the resource metadata
        if (res?.localChunkCount && timer < 0) {
          timer = 24;
          dispatch(
            updateDownloads({
              name,
              service,
              identifier,
              status: {
                ...res,
                status: 'REFETCHING',
              },
            }),
          );
          setTimeout(() => {
            fetchResource({
              name,
              service,
              identifier,
            });
          }, 25_000);
        }
      } catch (error) {
        console.error('Failed to fetch resource status', error);
      } finally {
        isCalling = false;
      }

      // Opportunistically retry URL resolution while downloading
      void attemptUrl(false);
      setTimeout(poll, STATUS_POLL_INTERVAL_MS);
    };

    setTimeout(poll, STATUS_POLL_INTERVAL_MS);
  };

  const downloadVideo = async ({
    name,
    service,
    identifier,
    ...props
  }: IDownloadVideoParams) => {
    try {

      performDownload({
        name,
        service,
        identifier,
        ...props,
      });
      return 'addedToList';
    } catch (error) {
      console.error(error);
      return undefined;
    }
  };

  return (
    <>
      <MyContext.Provider value={{ downloadVideo }}>
        {children}
      </MyContext.Provider>
    </>
  )
}

export default DownloadWrapper
