import React from 'react';
import { useDispatch } from 'react-redux';

import { setAddToDownloads, updateDownloads } from '../state/features/globalSlice';
import { qdnClient } from '../state/api/client';

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

const DownloadWrapper: React.FC<Props> = ({ children }) => {
  const dispatch = useDispatch();

  const fetchResource = async ({ name, service, identifier }: ResourceIdentifier) => {
    try {
      await qdnClient.rawRequest({
        action: 'GET_QDN_RESOURCE_PROPERTIES',
        name,
        service,
        identifier,
      });
    } catch (error) {
      console.error('Failed to fetch resource properties', error);
    }
  };

  const fetchVideoUrl = async ({ name, service, identifier }: ResourceIdentifier) => {
    try {
      await fetchResource({ name, service, identifier });
      const url = await qdnClient.getResourceUrl({
        service,
        name,
        identifier,
      });
      if (url) {
        dispatch(
          updateDownloads({
            name,
            service,
            identifier,
            url,
          }),
        );
      }
    } catch (error) {
      console.error('Failed to resolve resource URL', error);
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
    const intervalId = setInterval(async () => {
      if (isCalling) return;
      isCalling = true;
      const res = (await qdnClient.getStatus({
        name,
        service,
        identifier,
      })) as ResourceStatus;
      isCalling = false;
      if (res.localChunkCount) {
        if (res.percentLoaded) {
          if (res.percentLoaded === percentLoaded && res.percentLoaded !== 100) {
            timer -= 5;
          } else {
            timer = 24;
          }
          if (timer < 0) {
            timer = 24;
            isCalling = true;
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
              isCalling = false;
              fetchResource({
                name,
                service,
                identifier,
              });
            }, 25000);
            return;
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
      }

      // check if progress is 100% and clear interval if true
      if (res?.status === 'READY') {
        clearInterval(intervalId);
        dispatch(
          updateDownloads({
            name,
            service,
            identifier,
            status: res,
          }),
        );
      }
    }, 5000); // 5 second interval

    fetchVideoUrl({
      name,
      service,
      identifier,
    });
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
