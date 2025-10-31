import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Song } from "../types";


const useSongById = (id?: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [song, setSong] = useState<Song | undefined>(undefined);

  useEffect(() => {
    if (!id) {
      return;
    }

    setIsLoading(true);

    const fetchSong = async () => {

      const error = {
        message: 'error'
      }
      if (error) {
        setIsLoading(false);
        return toast.error(error.message);
      }

      setSong(undefined);
      setIsLoading(false);
    }

    fetchSong();
  }, [id]);

  return useMemo(() => ({
    isLoading,
    song
  }), [isLoading, song]);
};

export default useSongById;
