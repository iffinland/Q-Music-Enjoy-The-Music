import { useCallback } from 'react';
import usePlayer from './usePlayer';
import { Song } from '../types';

const useOnPlay = (songs: Song[]) => {
  const { setQueue, setActive, setStatus } = usePlayer();

  return useCallback(
    (id: string) => {
      const queue = songs.map((song) => ({
        id: song.id,
        title: song.title,
        author: song.author,
        url: (song as any)?.url ?? null,
        name: song.name,
        service: song.service,
        identifier: song.id,
        status: (song as any)?.status,
      }));
      setQueue(queue);
      setActive(id);
      setStatus('loading');
    },
    [setActive, setQueue, setStatus, songs],
  );
};

export default useOnPlay;
