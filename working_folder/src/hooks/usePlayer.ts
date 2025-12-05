import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../state/store'
import {
  setActive,
  setQueue,
  setStatus,
  setVolume,
  setRepeat,
  setShuffle,
  setPosition,
  setDuration,
  type QueueItem,
  type PlayerStatus
} from '../state/slices/playerSlice'

const usePlayer = () => {
  const dispatch = useDispatch()
  const player = useSelector((state: RootState) => state.player)

  return {
    ...player,
    setActive: (id: string | null) => dispatch(setActive(id)),
    setQueue: (queue: QueueItem[]) => dispatch(setQueue(queue)),
    setStatus: (status: PlayerStatus) => dispatch(setStatus(status)),
    setVolume: (volume: number) => dispatch(setVolume(volume)),
    setRepeat: (mode: 'off' | 'one' | 'all') => dispatch(setRepeat(mode)),
    setShuffle: (value: boolean) => dispatch(setShuffle(value)),
    setPosition: (pos: number) => dispatch(setPosition(pos)),
    setDuration: (dur: number) => dispatch(setDuration(dur))
  }
}

export default usePlayer
