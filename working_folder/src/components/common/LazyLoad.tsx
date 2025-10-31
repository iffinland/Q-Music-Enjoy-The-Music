import React, { useState, useEffect, useRef } from 'react'
import { useInView } from 'react-intersection-observer'
import CircularProgress from '@mui/material/CircularProgress'

interface Props {
  onLoadMore: () => Promise<void>
}

const LazyLoad: React.FC<Props> = ({ onLoadMore }) => {
  const [isFetching, setIsFetching] = useState<boolean>(false)

  const firstLoad = useRef(false)
  const [ref, inView] = useInView({
    threshold: 0.7
  })

  useEffect(() => {
    if (inView) {
      setIsFetching(true)
      onLoadMore().finally(() => {
        setIsFetching(false)
        firstLoad.current = true
      })
    }
  }, [inView])

  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        justifyContent: 'center',
        minHeight: '25px',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          visibility: isFetching ? 'visible' : 'hidden'
        }}
      >
        <CircularProgress />
      </div>
    </div>
  )
}

export default LazyLoad
