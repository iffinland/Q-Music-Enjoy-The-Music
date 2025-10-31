import React from 'react'
import { useDispatch } from 'react-redux'


import {
  setAddToDownloads,
  updateDownloads
} from '../state/features/globalSlice'

interface Props {
  children: React.ReactNode
}


const defaultValues: MyContextInterface = {
  downloadVideo: () => {}
}
interface IDownloadVideoParams {
  name: string
  service: string
  identifier: string
  title: string
  id: string
  author: string
}
interface MyContextInterface {
  downloadVideo: ({
    name,
    service,
    identifier
  }: IDownloadVideoParams) => void
}
export const MyContext = React.createContext<MyContextInterface>(defaultValues)

const DownloadWrapper: React.FC<Props> = ({ children }) => {
  const dispatch = useDispatch()


  const fetchResource = async ({ name, service, identifier }: any) => {
    try {
      await qortalRequest({
        action: 'GET_QDN_RESOURCE_PROPERTIES',
        name,
        service,
        identifier
      })
    } catch (error) {}
  }

  const fetchVideoUrl = async ({ name, service, identifier }: any) => {
    try {
      fetchResource({ name, service, identifier })
      let url = await qortalRequest({
        action: 'GET_QDN_RESOURCE_URL',
        service: service,
        name: name,
        identifier: identifier
      })
      if (url) {
        dispatch(
          updateDownloads({
            name,
            service,
            identifier,
            url
          })
        )
      }
    } catch (error) {}
  }

  const performDownload = ({
    name,
    service,
    identifier,
    ...props
  }: IDownloadVideoParams) => {
    dispatch(
      setAddToDownloads({
        name,
        service,
        identifier,
        ...props
      })
    )

    let isCalling = false
    let percentLoaded = 0
    let timer = 24
    const intervalId = setInterval(async () => {
      if (isCalling) return
      isCalling = true
      const res = await qortalRequest({
        action: 'GET_QDN_RESOURCE_STATUS',
        name: name,
        service: service,
        identifier: identifier
      })
      isCalling = false
      if (res.localChunkCount) {
        if (res.percentLoaded) {
          if (
            res.percentLoaded === percentLoaded &&
            res.percentLoaded !== 100
          ) {
            timer = timer - 5
          } else {
            timer = 24
          }
          if (timer < 0) {
            timer = 24
            isCalling = true
            dispatch(
              updateDownloads({
                name,
                service,
                identifier,
                status: {
                  ...res,
                  status: 'REFETCHING'
                }
              })
            )
            setTimeout(() => {
              isCalling = false
              fetchResource({
                name,
                service,
                identifier
              })
            }, 25000)
            return
          }
          percentLoaded = res.percentLoaded
        }
        dispatch(
          updateDownloads({
            name,
            service,
            identifier,
            status: res
          })
        )
      }

      // check if progress is 100% and clear interval if true
      if (res?.status === 'READY') {
        clearInterval(intervalId)
        dispatch(
          updateDownloads({
            name,
            service,
            identifier,
            status: res
          })
        )
      }
    }, 5000) // 1 second interval

    fetchVideoUrl({
      name,
      service,
      identifier
    })
  }

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
        ...props
      })
      return 'addedToList'
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <>
      <MyContext.Provider value={{ downloadVideo }}>
        {children}
      </MyContext.Provider>
    </>
  )
}

export default DownloadWrapper
