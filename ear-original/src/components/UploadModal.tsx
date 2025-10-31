import ShortUniqueId from 'short-unique-id'
import React, { useEffect, useState } from 'react';
import { FieldValues, SubmitHandler, useForm } from 'react-hook-form';
import { toast } from "react-hot-toast";
import Compressor from 'compressorjs'



import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import useUploadModal from "../hooks/useUploadModal";
import { useDispatch, useSelector } from 'react-redux';
import { setNotification } from '../state/features/notificationsSlice';
import { RootState } from '../state/store';
import ImageUploader from './common/ImageUploader';
import { toBase64 } from '../utils/toBase64';
import { addNewSong, setImageCoverHash } from '../state/features/globalSlice';
import { removeTrailingUnderscore } from '../utils/extra';

const uid = new ShortUniqueId()

const UploadModal = () => {
  const username = useSelector((state: RootState) => state?.auth?.user?.name)
  const [songImg, setSongImg] = useState("")
  const dispatch = useDispatch()
  const [isLoading, setIsLoading] = useState(false);

  const uploadModal = useUploadModal();


  const {
    register,
    handleSubmit,
    reset,
  } = useForm<FieldValues>({
    defaultValues: {
      author: '',
      title: '',
      song: null,
      image: null,
    }
  });

  const onChange = (open: boolean) => {
    if (!open) {
      reset();
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
      if(!values.image?.[0]){
        toast.error('Please attach an image cover')
        return;
      }
      setIsLoading(true);
      
      const imageFile = values.image?.[0];
      const songFile = values.song?.[0];
      const title = values.title
      const author = values.author
      if (!imageFile || !songFile || !username || !title || !author) {
        toast.error('Missing fields')
        return;
      }

  

      const songError = null
      const imageError = null

      try {
        const compressedImg = await compressImg(imageFile)
        if(!compressedImg){
          toast.error('Image compression Error')
          return;
        }
        const id = uid(8)
        const titleToUnderscore = title?.replace(/ /g, '_')
        const titleToLowercase = titleToUnderscore.toLowerCase()
        const titleSlice = titleToLowercase.slice(0,20)
        const cleanTitle = removeTrailingUnderscore(titleSlice)
        let identifier = `earbump_song_${cleanTitle}_${id}`
        
        const description = `title=${title};author=${author}`
       
        const fileExtension = imageFile?.name?.split('.')?.pop()
        const fileTitle = title?.replace(/ /g, '_')?.slice(0, 20)
        const filename = `${fileTitle}.${fileExtension}`
        const resources = [
          {
            name: username,
          service: 'AUDIO',
          file: songFile,
          title: title,
          description: description,
          identifier: identifier,
          filename
          },
          {
            name: username,
          service: 'THUMBNAIL',
          data64: compressedImg,
          identifier: identifier
          }
        ]

        const multiplePublish = {
          action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
          resources: resources
        }
        await qortalRequest(multiplePublish)
     
        const songData =  {
          title: title,
          description: description,
          created: Date.now(),
          updated: Date.now(),
          name: username,
          id: identifier,
          author: author
        }
        dispatch(addNewSong(songData))
        dispatch(setImageCoverHash({ url: 'data:image/webp;base64,' + compressedImg , id: identifier }));
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
      toast.success('Song created!');
      reset();
      uploadModal.onClose();
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }



  return (
    <Modal
      title="Add a song"
      description="Upload an audio file- all fields are required"
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
          placeholder="Song title"
        />
        <Input
          id="author"
          disabled={isLoading}
          {...register('author', { required: true })}
          placeholder="Song author"
        />
        <div>
          <div className="pb-1">
            Select a song file
          </div>
          <Input
            placeholder="test" 
            disabled={isLoading}
            type="file"
            accept="audio/*"
            id="song"
            {...register('song', { required: true })}
          />
        </div>
        <div>
          <div className="pb-1">
            Select an image
          </div>
          <Input
            placeholder="test" 
            disabled={isLoading}
            type="file"
            accept="image/*"
            id="image"
            {...register('image', { required: true })}
          />
        </div>
        <Button disabled={isLoading} type="submit">
          Create
        </Button>
      </form>
    </Modal>
  );
}

export default UploadModal;