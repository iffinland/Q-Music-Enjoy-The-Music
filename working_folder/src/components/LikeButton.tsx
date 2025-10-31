"use client";

import { useRef } from "react";
import { AiOutlineHeart, AiFillHeart } from "react-icons/ai";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../state/store";
import { Favorites, removeFavSong, setFavSong } from "../state/features/globalSlice";
import { Song } from "../types";
import localforage from 'localforage';

const favoritesStorage = localforage.createInstance({
  name: 'ear-bump-favorites',
});

interface LikeButtonProps {
  songId: string;
  name: string;
  service: string
  songData: Song
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  iconSize?: number;
  title?: string;
  ariaLabel?: string;
}

const LikeButton: React.FC<LikeButtonProps> = ({
  songId,
  name,
  service = 'AUDIO',
  songData,
  className,
  activeClassName,
  inactiveClassName,
  iconSize = 25,
  title,
  ariaLabel
}) => {
  const songs = useSelector((state: RootState) => state.global?.favorites?.songs);
  const dispatch = useDispatch();
  const isFavoriting = useRef(false);
  const isLiked = songs && songs[songId];
  const Icon = isLiked ? AiFillHeart : AiOutlineHeart;
   
  const handleLike = async () => {
    if (isFavoriting.current) return;

    isFavoriting.current = true;
    try {
      const alreadyLiked = Boolean(songs && songs[songId]);
      if (alreadyLiked) {
        dispatch(removeFavSong({
          identifier: songId,
          name,
          service,
        }));

        const favoritesObj = await favoritesStorage.getItem<Favorites>('favorites');

        if (favoritesObj?.songs?.[songId]) {
          const updatedFavorites: Favorites = {
            songs: { ...favoritesObj.songs },
            playlists: favoritesObj.playlists,
          };
          delete updatedFavorites.songs[songId];
          await favoritesStorage.setItem('favorites', updatedFavorites);
        }
      } else {
        dispatch(setFavSong({
          identifier: songId,
          name,
          service,
          songData,
        }));

        const favoritesObj = await favoritesStorage.getItem<Favorites>('favorites');

        if (!favoritesObj) {
          const newObj: Favorites = {
            songs: {
              [songId]: {
                identifier: songId,
                name,
                service,
              },
            },
            playlists: {},
          };

          await favoritesStorage.setItem('favorites', newObj);
        } else {
          const updatedFavorites: Favorites = {
            songs: {
              ...favoritesObj.songs,
              [songId]: {
                identifier: songId,
                name,
                service,
              },
            },
            playlists: favoritesObj.playlists,
          };

          await favoritesStorage.setItem('favorites', updatedFavorites);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      isFavoriting.current = false;
    }
  };

  

  const baseClassName = `
        cursor-pointer 
        hover:opacity-75 
        transition
      `;

  const computedClassName = [
    baseClassName,
    className,
    isLiked ? activeClassName : inactiveClassName
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <button 
      type="button"
      className={computedClassName}
      onClick={handleLike}
      title={title}
      aria-label={ariaLabel || title || 'Toggle favorite'}
    >
      <Icon color={isLiked ? '#22c55e' : 'white'} size={iconSize} />
    </button>
  );
}

export default LikeButton;
