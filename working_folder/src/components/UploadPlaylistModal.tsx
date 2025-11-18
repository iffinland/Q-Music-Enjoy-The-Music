import ShortUniqueId from 'short-unique-id'
import React, { useEffect, useRef, useState } from 'react';
import { FieldValues, SubmitHandler, useForm } from 'react-hook-form';
import { toast } from "react-hot-toast";
import Compressor from 'compressorjs'



import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import useUploadModal from "../hooks/useUploadPlaylistModal";
import { useDispatch, useSelector } from 'react-redux';
import { setNotification } from '../state/features/notificationsSlice';
import { RootState } from '../state/store';
import { objectToBase64, toBase64 } from '../utils/toBase64';
import { PlayList, SongReference, addToPlaylistHashMap, setNewPlayList, upsertPlaylists } from '../state/features/globalSlice';
import Textarea from './TextArea';
import {AiOutlineClose} from  "react-icons/ai";
import { Song } from '../types';
import { removeTrailingUnderscore } from '../utils/extra';
import { useNavigate } from 'react-router-dom';
const uid = new ShortUniqueId()

const UploadPlaylistModal = () => {
  const username = useSelector((state: RootState) => state?.auth?.user?.name)
  const dispatch = useDispatch()
  const [isLoading, setIsLoading] = useState(false);
  const newPlaylist = useSelector((state: RootState) => state?.global.newPlayList);
  const [prevSavedImg, setPrevSavedImg] = useState<null | string>(null)
  const uploadModal = useUploadModal();
  const currentPlaylist = useRef<any>(null)
  const successTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const successRedirectDelay = 1600;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FieldValues>({
    defaultValues: {
      description: newPlaylist?.description,
      title: newPlaylist?.title || '',
      image: null,
    }
  });


  useEffect(()=> {
    if (uploadModal.isOpen && !newPlaylist && username) {
      dispatch(setNewPlayList({
        id: `draft-playlist-${Date.now().toString(36)}`,
        title: '',
        description: '',
        songs: [],
        image: null,
        user: username,
        created: Date.now(),
        updated: Date.now(),
      } as PlayList));
    }
    if(currentPlaylist?.current?.id === newPlaylist?.id) return
    if(newPlaylist)  reset({
      description: newPlaylist?.description,
      title: newPlaylist?.title || '',
      image: null,
    })
    if(newPlaylist?.image) {
      setPrevSavedImg(newPlaylist.image)
    } else {
      setPrevSavedImg(null)
    }
    if(newPlaylist?.id){
      currentPlaylist.current = newPlaylist
    }
  }, [reset, newPlaylist, uploadModal.isOpen, username, dispatch])

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const onChange = async (open: boolean) => {
    if (!open) {
      reset({ title: '', description: '', image: null });
      setPrevSavedImg(null);
      dispatch(setNewPlayList(null));
      uploadModal.onClose();
    }
  }

  const compressImg = async (img: File)=> {
    try {
      const image = img
      let compressedFile: File | undefined

      await new Promise<void>((resolve) => {
        new Compressor(image, {
          quality: 0.6,
          maxWidth: 300,
          mimeType: 'image/webp',
          success(result) {
            const file = new File([result], 'name', {
              type: 'image/webp'
            })
            compressedFile = file
            resolve()
          },
          error(err) {}
        })
      })
      if (!compressedFile) return
      const dataURI = await toBase64(compressedFile)
      if(!dataURI || typeof dataURI !== 'string') throw new Error('invalid image')
      const base64Data = dataURI?.split(',')[1];
      return base64Data
    } catch (error) {
      console.error(error)
    }
  }


  const onSubmit: SubmitHandler<FieldValues> = async (values) => {
    try {
      if(!username){
        toast.error('Please LogIn')
        return;
      }
      if(!values.image?.[0] && !prevSavedImg){
        toast.error('Please attach an image cover')
        return;
      }

      if(!newPlaylist) return
      setIsLoading(true);
      
      const imageFile = values.image?.[0];
      const title = typeof values.title === 'string' ? values.title : '';
      const description = typeof values.description === 'string' ? values.description : '';
      if ((!imageFile && !prevSavedImg) || !username || !description) {
        toast.error('Missing fields')
        return;
      }

  

      const songError = null
      const imageError = null

      try {
        const compressedImg = prevSavedImg ? prevSavedImg : await compressImg(imageFile)
        if(!compressedImg){
          toast.error('Image compression Error')
          return;
        }
        const id = uid(8)
        const titleToUnderscore = title?.replace(/ /g, '_')
        const titleToLowercase = titleToUnderscore.toLowerCase()
        const titleSlice = titleToLowercase.slice(0,25)
        const cleanTitle = removeTrailingUnderscore(titleSlice)
        const identifier = newPlaylist?.id ? newPlaylist.id : `enjoymusic_playlist_${cleanTitle}_${id}`
        const descriptionSnipped = description.slice(0, 4000)
       
        // const fileExtension = imageFile?.name?.split('.')?.pop()
        const fileTitle = title?.replace(/ /g, '_')?.slice(0, 20)
        const filenameBase = fileTitle || identifier
        const filename = `${filenameBase}.json`
        const playlistObject = {
          songs: newPlaylist.songs,
          title,
          description,
          image: (newPlaylist?.id && prevSavedImg) ? prevSavedImg  : 'data:image/webp;base64,' +  compressedImg
        }
        console.log({playlistObject})

        
        const playlistToBase64 = await objectToBase64(playlistObject);
        const resources = [
          {
            name: newPlaylist?.user ? newPlaylist?.user : username,
          service: 'PLAYLIST',
          data64: playlistToBase64,
          title: title.slice(0, 55),
          description: descriptionSnipped,
          identifier: identifier,
          filename
          }
          // {
          //   name: username,
          // service: 'THUMBNAIL',
          // data64: compressedImg,
          // identifier: identifier
          // }
        ]

        const multiplePublish = {
          action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
          resources: resources
        }
        await qortalRequest(multiplePublish)
      toast.success('The playlist was published successfully!', { duration: successRedirectDelay });
      if(newPlaylist?.id){
        //update playlist in store
        dispatch(addToPlaylistHashMap(
            {
              user: newPlaylist?.user ? newPlaylist?.user : username,
              service: 'PLAYLIST',
              id: identifier,
              filename,
            songs: newPlaylist.songs,
          title,
          description,
          image: (newPlaylist?.id && prevSavedImg) ? prevSavedImg  : 'data:image/webp;base64,' +  compressedImg}
          ))
      } else {
        //add playlist to store
        dispatch(upsertPlaylists(
          {
            user: newPlaylist?.user ? newPlaylist?.user : username,
              service: 'PLAYLIST',
              id: identifier,
              filename,
            songs: newPlaylist.songs,
          title,
          description,
          image: (newPlaylist?.id && prevSavedImg) ? prevSavedImg  : 'data:image/webp;base64,' +  compressedImg}
        ))
      }
      successTimeoutRef.current = window.setTimeout(() => {
        reset();
        dispatch(setNewPlayList(null))
        uploadModal.onClose();
        successTimeoutRef.current = null;
      }, successRedirectDelay);
      
      } catch (error: any) {
        let notificationObj = null
        if (typeof error === 'string') {
          notificationObj = {
            msg: error || 'Failed to publish audio',
            alertType: 'error'
          }
        } else if (typeof error?.error === 'string') {
          notificationObj = {
            msg: error?.error || 'Failed to publish audio',
            alertType: 'error'
          }
        } else {
          notificationObj = {
            msg: error?.message || error?.message || 'Failed to publish audio',
            alertType: 'error'
          }
        }
        if (!notificationObj) return
        dispatch(setNotification(notificationObj))
       
      }
     

      if (songError) {
        setIsLoading(false);
        return toast.error('Failed to publish song');
      }

    

      if (imageError) {
        setIsLoading(false);
        return toast.error('Failed to publish image');
      }

      
  
      
    
      setIsLoading(false);
     
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }

  const removeSongFromPlaylist = (song: SongReference)=> {
    if(!newPlaylist) return

  const playlist = {
    ...newPlaylist,
    songs: [...newPlaylist.songs].filter((item)=> item.identifier !== song.identifier)
  }
  dispatch(setNewPlayList(playlist))
  }


  return (
    <Modal
      title="Save Playlist"
      description="Publish a new playlist; provide the details you prefer."
      isOpen={uploadModal.isOpen}
      onChange={onChange}
    >
      <form 
        onSubmit={handleSubmit(onSubmit)} 
        className="flex flex-col gap-y-4"
      >
        <Input
          id="title"
          disabled={isLoading}
          maxLength={150}
          {...register('title', {
            maxLength: {
              value: 150,
              message: 'Title must be 150 characters or fewer',
            },
          })}
          placeholder="Playlist title"
        />
        <Textarea
          id="description"
          disabled={isLoading}
          maxLength={4000}
          {...register('description', {
            required: 'Description is required',
            maxLength: {
              value: 4000,
              message: 'Description must be 4000 characters or fewer',
            },
          })}
          placeholder="Describe your playlist"
        />
        {errors?.description && (
          <p className="text-xs text-red-300">
            {String(errors.description.message)}
          </p>
        )}
        <div>
          <div className="pb-1">
            Select an image for the playlist
          </div>
          {prevSavedImg ? <div className='flex items-center gap-1'>
            <img src={prevSavedImg}/>
          <AiOutlineClose className='cursor-pointer' onClick={()=> {
             
             setPrevSavedImg(null)
       
         }} />
            </div> : (
            <Input
            placeholder="test" 
            disabled={isLoading}
            type="file"
            accept="image/*"
            id="image"
            {...register('image', { required: false })}
          />
          )}
          
        </div>
        <div>
          <div className="pb-1">
            Songs
          </div>
          {newPlaylist?.songs?.map((song: SongReference)=> {
            return (
              <div className='flex gap-2 items-center'>
                <p key={song?.title}>{song?.title}</p> 
              <AiOutlineClose className='cursor-pointer' onClick={()=> {
             
                  removeSongFromPlaylist(song)
            
              }} />
              
              </div>
            )
          })}
        </div>
        <Button disabled={isLoading} type="submit">
          Publish
        </Button>
      </form>
    </Modal>
  );
}

export default UploadPlaylistModal;
