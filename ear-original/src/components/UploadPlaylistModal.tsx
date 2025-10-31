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
import ImageUploader from './common/ImageUploader';
import { objectToBase64, toBase64 } from '../utils/toBase64';
import { SongReference, addNewSong, addToPlaylistHashMap, setImageCoverHash, setNewPlayList, upsertPlaylists } from '../state/features/globalSlice';
import Textarea from './TextArea';
import {AiOutlineClose} from  "react-icons/ai";
import { Song } from '../types';
import { removeTrailingUnderscore } from '../utils/extra';
const uid = new ShortUniqueId()

const UploadPlaylistModal = () => {
  const username = useSelector((state: RootState) => state?.auth?.user?.name)
  const [playlistImg, setPlaylistImg] = useState("")
  const dispatch = useDispatch()
  const [isLoading, setIsLoading] = useState(false);
  const newPlaylist = useSelector((state: RootState) => state?.global.newPlayList);
  const [prevSavedImg, setPrevSavedImg] = useState<null | string>(null)
  const uploadModal = useUploadModal();
  console.log({newPlaylist})
  const currentPlaylist = useRef<any>(null)
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue
  } = useForm<FieldValues>({
    defaultValues: {
      description: newPlaylist?.description,
      title: newPlaylist?.title || '',
      image: null,
    }
  });


  useEffect(()=> {
    if(currentPlaylist?.current?.id === newPlaylist?.id) return
    if(newPlaylist)  reset({
      description: newPlaylist?.description,
      title: newPlaylist?.title || '',
      image: null,
    })
    if(newPlaylist && newPlaylist?.image) setPrevSavedImg(newPlaylist.image)
    if(newPlaylist?.id){
      currentPlaylist.current = newPlaylist
    }
  }, [reset, newPlaylist])

  const onChange = async (open: boolean) => {
    if (!open) {
      if(newPlaylist){
        const title = watch("title"); 
        const description = watch("description"); 
        const image = watch("image"); 
        console.log({image})
        let playlistImage = null
        if(image && image[0]){
          try {
            const compressedImg = await compressImg(image[0])
            playlistImage = 'data:image/webp;base64,' + compressedImg
          } catch (error) {
            console.log({error})
          }
       
        }
        console.log({title})
        dispatch(setNewPlayList({
          ...newPlaylist,
          title,
          description,
          image: playlistImage
        }))

      
      } 
     
      // reset();
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
        toast.error('Please authenticate')
        return;
      }
      if(!values.image?.[0] && !prevSavedImg){
        toast.error('Please attach an image cover')
        return;
      }

      if(!newPlaylist) return
      setIsLoading(true);
      
      const imageFile = values.image?.[0];
      const title = values.title
      const description = values.description
      if ((!imageFile && !prevSavedImg) || !username || !title || !description) {
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
        let identifier = newPlaylist?.id ? newPlaylist.id : `earbump_playlist_${cleanTitle}_${id}`
        const descriptionSnipped = description.slice(0, 140)
       
        // const fileExtension = imageFile?.name?.split('.')?.pop()
        const fileTitle = title?.replace(/ /g, '_')?.slice(0, 20)
        const filename = `${fileTitle}.json`
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
      toast.success('Song created!');
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
      reset();
      dispatch(setNewPlayList(null))
      uploadModal.onClose();
      
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
        return toast.error('Failed song upload');
      }

    

      if (imageError) {
        setIsLoading(false);
        return toast.error('Failed image upload');
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
      description="Upload playlist- all fields are required"
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
          {...register('title', { required: true , maxLength: 35})}
          placeholder="Playlist title"
        />
        <Textarea
          id="description"
          disabled={isLoading}
          {...register('description', { required: true })}
          placeholder="Describe your playlist"
        />
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