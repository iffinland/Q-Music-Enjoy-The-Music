import ShortUniqueId from 'short-unique-id'
import React, { useEffect, useRef, useState } from 'react';
import { FieldValues, SubmitHandler, useForm } from 'react-hook-form';
import { toast } from "react-hot-toast";
import Compressor from 'compressorjs'



import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import Textarea from './TextArea';
import useUploadModal from "../hooks/useUploadModal";
import { useDispatch, useSelector } from 'react-redux';
import { setNotification } from '../state/features/notificationsSlice';
import { RootState } from '../state/store';
import { toBase64 } from '../utils/toBase64';
import { addNewSong, setImageCoverHash } from '../state/features/globalSlice';
import { removeTrailingUnderscore } from '../utils/extra';
import { useNavigate } from 'react-router-dom';
import { MUSIC_CATEGORIES } from '../constants/categories';

const uid = new ShortUniqueId()

const UploadModal = () => {
  const username = useSelector((state: RootState) => state?.auth?.user?.name)
  const dispatch = useDispatch()
  const [isLoading, setIsLoading] = useState(false);

  const uploadModal = useUploadModal();
  const navigate = useNavigate();
  const successRedirectDelay = 1600;
  const successTimeoutRef = useRef<number | null>(null);

  const sanitizeMetadataValue = (value?: string) => {
    if (!value) return '';
    return value.replace(/[;=]/g, ' ').trim();
  };

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);


  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FieldValues>({
    defaultValues: {
      author: '',
      title: '',
      song: null,
      image: null,
      genre: '',
      mood: '',
      language: '',
      notes: '',
    }
  });

  const onChange = (open: boolean) => {
    if (!open) {
      reset();
      uploadModal.closeSingle();
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
          error(compressionError) {
            console.error('Image compression failed', compressionError);
            resolve();
          }
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
        toast.error('Log in to continue')
        return;
      }
      if(!values.image?.[0]){
        toast.error('Please attach an image cover')
        return;
      }

      const imageFile = values.image?.[0];
      const songFile = values.song?.[0];
      if(!songFile){
        toast.error('Please attach an audio file')
        return;
      }
      const title = (values.title as string)?.trim();
      const author = (values.author as string)?.trim();
      const genre = sanitizeMetadataValue(values.genre);
      const mood = sanitizeMetadataValue(values.mood);
      const language = sanitizeMetadataValue(values.language);
      const notes = sanitizeMetadataValue(values.notes);

      if (!imageFile || !songFile || !username || !title || !author || !genre) {
        toast.error('Missing fields')
        return;
      }

      setIsLoading(true);

      const songError = null
      const imageError = null

      try {
        const compressedImg = await compressImg(imageFile)
        if(!compressedImg){
          toast.error('Image compression Error')
          setIsLoading(false);
          return;
        }
        const id = uid(8)
        const titleToUnderscore = title?.replace(/ /g, '_')
        const titleToLowercase = titleToUnderscore.toLowerCase()
        const titleSlice = titleToLowercase.slice(0,20)
        const cleanTitle = removeTrailingUnderscore(titleSlice)
        const identifier = `enjoymusic_song_${cleanTitle}_${id}`
        
        const metadataPairs: string[] = [
          `title=${sanitizeMetadataValue(title)}`,
          `author=${sanitizeMetadataValue(author)}`,
        ];

        if (genre) metadataPairs.push(`genre=${genre}`);
        if (mood) metadataPairs.push(`mood=${mood}`);
        if (language) metadataPairs.push(`language=${language}`);
        if (notes) metadataPairs.push(`notes=${notes}`);

        const description = metadataPairs.join(';')
       
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
      } catch (error: unknown) {
        let notificationObj = null
        if (typeof error === 'string') {
          notificationObj = {
            msg: error || 'Failed to publish audio',
            alertType: 'error'
          }
        } else if (typeof error === 'object' && error !== null) {
          const maybeError = error as { error?: string; message?: string };
          if (typeof maybeError.error === 'string') {
            notificationObj = {
              msg: maybeError.error,
              alertType: 'error',
            };
          } else if (typeof maybeError.message === 'string') {
            notificationObj = {
              msg: maybeError.message,
              alertType: 'error',
            };
          }
        }
        if (notificationObj) {
          dispatch(setNotification(notificationObj))
        } else {
          console.error('Failed to publish audio', error)
        }
      
      }
     

      if (songError) {
        setIsLoading(false);
        return toast.error('Failed song publish');
      }

    

      if (imageError) {
        setIsLoading(false);
        return toast.error('Failed image publish');
      }

      
  
      
    
      setIsLoading(false);
      toast.success('The song was published successfully! Redirects...', { duration: successRedirectDelay });
      successTimeoutRef.current = window.setTimeout(() => {
        reset();
        uploadModal.closeSingle();
        navigate('/');
        successTimeoutRef.current = null;
      }, successRedirectDelay);
    } catch (error) {
      console.error('Unexpected error while publishing audio', error);
      toast.error('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }



  return (
    <Modal
      title="Publish new a song"
      description="Publish an audio file; add as much detail as you wish."
      isOpen={uploadModal.isSingleOpen}
      onChange={onChange}
    >
      <form 
        onSubmit={handleSubmit(onSubmit)} 
        className="flex flex-col gap-y-4"
      >
        <div>
          <Input
            id="title"
            disabled={isLoading}
            maxLength={150}
            aria-invalid={errors?.title ? 'true' : 'false'}
            {...register('title', {
              maxLength: {
                value: 150,
                message: 'Title must be 150 characters or fewer',
              },
            })}
            placeholder="Song title"
          />
          {errors?.title && (
            <p className="mt-1 text-xs text-red-300">
              {String(errors.title.message)}
            </p>
          )}
        </div>
        <div>
          <Input
            id="author"
            disabled={isLoading}
            maxLength={150}
            aria-invalid={errors?.author ? 'true' : 'false'}
            {...register('author', {
              maxLength: {
                value: 150,
                message: 'Performer name must be 150 characters or fewer',
              },
            })}
            placeholder="Song singer / band"
          />
          {errors?.author && (
            <p className="mt-1 text-xs text-red-300">
              {String(errors.author.message)}
            </p>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="pb-1 text-sm font-semibold text-sky-200/80">
              Category <span className="text-red-300">*</span>
            </div>
            <select
              id="genre"
              disabled={isLoading}
              className="w-full rounded-md bg-sky-950/70 border border-sky-900/60 px-3 py-3 text-sm text-sky-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              defaultValue=""
              {...register('genre', {
                required: 'Please choose a category',
              })}
              aria-invalid={errors?.genre ? 'true' : 'false'}
            >
              <option value="" disabled>
                Select a category
              </option>
              {MUSIC_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {errors?.genre && (
              <p className="mt-1 text-xs text-red-300">
                {String(errors.genre.message || 'Please choose a category')}
              </p>
            )}
          </div>
          <Input
            id="mood"
            disabled={isLoading}
            {...register('mood')}
            placeholder="Mood / vibe (optional)"
          />
          <Input
            id="language"
            disabled={isLoading}
            {...register('language')}
            placeholder="Language (optional)"
          />
        </div>
        <Textarea
          id="notes"
          disabled={isLoading}
          {...register('notes')}
          placeholder="Additional notes, instruments, credits…"
          className="h-24 resize-none"
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
        <Button
          disabled={isLoading}
          type="submit"
        >
          Publish
        </Button>
      </form>
    </Modal>
  );
}

export default UploadModal;
