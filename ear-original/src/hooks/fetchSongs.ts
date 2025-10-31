import React, { useCallback, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";


import { RootState } from "../state/store";
import { FavSong, PlayList, SongMeta, addToPlaylistHashMap, setImageCoverHash, setIsLoadingGlobal, setRandomPlaylist, upsertFavorite, upsertMyLibrary, upsertMyPlaylists, upsertPlaylists, upsertQueried, upsertQueriedPlaylist, upsertRecent } from "../state/features/globalSlice";
import { queueFetchAvatars } from "../wrappers/GlobalWrapper";

export const useFetchSongs = () => {
  const dispatch = useDispatch();

  const [userAvatar, setUserAvatar] = useState<string>("");
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const songListLibrary = useSelector((state: RootState) => state.global.songListLibrary);
  const songHash = useSelector((state: RootState) => state.global.songHash);
  const imageCoverHash = useSelector((state: RootState) => state.global.imageCoverHash);
  const songListRecent = useSelector((state: RootState) => state.global.songListRecent);
  const songListQueried = useSelector((state: RootState) => state.global.songListQueried);
  const playlistQueried = useSelector((state: RootState) => state.global.playlistQueried);
  const queriedValuePlaylist = useSelector((state: RootState) => state.global.queriedValuePlaylist);
  const queriedValue = useSelector((state: RootState) => state.global.queriedValue);
  const songsInStore = useSelector((state: RootState) => state.global?.favorites?.songs);
  const favoriteList = useSelector((state: RootState) => state.global.favoriteList);
  const playlistHash = useSelector((state: RootState) => state.global.playlistHash);
  const playlists = useSelector((state: RootState) => state.global.playlists);
  const myPlaylists = useSelector((state: RootState) => state.global.myPlaylists);

  const songList = useMemo(() => {
    if (!songsInStore) return []
    return Object.keys(songsInStore).map((key) => {
      return songsInStore[key]
    })
  }, [songsInStore])
  const getImgCover = async (id: string, name: string, retries: number = 0) => {
    try {
      let url = await qortalRequest({
        action: "GET_QDN_RESOURCE_URL",
        name: name,
        service: "THUMBNAIL",
        identifier: id
      });

      if (url === "Resource does not exist") return;

      dispatch(setImageCoverHash({ url, id }));
    } catch (error) {


    }
  }

  const getYourLibrary = useCallback(async (name: string) => {
    try {
      const offset = songListLibrary.length
      const url = `/arbitrary/resources/search?mode=ALL&service=AUDIO&query=earbump_song_&name=${name}&limit=20&includemetadata=true&offset=${offset}&reverse=true&excludeblocked=true&exactmatchnames=true&includestatus=true`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const responseData = await response.json()
      const structureData = responseData.map((song: any): SongMeta => {
        const description = song?.metadata?.description || ""
        let pairs: string[] = description?.split(';');  // Splits the string into an array based on the semicolon.

        // Define an empty object to hold your title and author
        let obj: { [key: string]: string } = {};

        // Loop through the pairs and further split them on the equals sign.
        for (let i = 0; i < pairs.length; i++) {
          let pair: string[] = pairs[i].split('=');

          // Ensure the pair is a key-value pair before assignment
          if (pair.length !== 2) {
            continue;
          }

          let key: string = pair[0].trim(); // remove whitespace
          let value: string = pair[1].trim(); // remove whitespace

          // Ensure the key is either 'title' or 'author' before assignment
          if (key !== 'title' && key !== 'author') {
            continue;
          }

          obj[key] = value;
        }
        return {
          title: song?.metadata?.title,
          description: song?.metadata?.description,
          created: song.created,
          updated: song.updated,
          name: song.name,
          id: song.identifier,
          status: song?.status,
          ...obj
        }
      })
      dispatch(upsertMyLibrary(structureData))


      for (const content of structureData) {
        if (content.name && content.id) {

          if (!imageCoverHash[content.id]) {
            queueFetchAvatars.push(() => getImgCover(content.id, content.name))
            // getImgCover(content.id, content.name)
          }
        }
      }
    } catch (error) {
    } finally {
    }
  }, [songListLibrary, imageCoverHash]);


  const getQueriedSongs = useCallback(async () => {
    try {
      if (!queriedValue) return
      dispatch(setIsLoadingGlobal(true))
      const offset = songListQueried.length
      const identifier = `earbump_song_`
      const replaceSpacesWithUnderscore = queriedValue.toLowerCase().replace(/ /g, '_');
      const query = replaceSpacesWithUnderscore
      const url = `/arbitrary/resources/search?mode=ALL&service=AUDIO&query=${query}&identifier=${identifier}&limit=20&includemetadata=true&offset=${offset}&reverse=true&excludeblocked=true&includestatus=true`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const responseData = await response.json()
      const structureData = responseData.map((song: any): SongMeta => {
        const description = song?.metadata?.description || ""
        let pairs: string[] = description?.split(';');  // Splits the string into an array based on the semicolon.

        // Define an empty object to hold your title and author
        let obj: { [key: string]: string } = {};

        // Loop through the pairs and further split them on the equals sign.
        for (let i = 0; i < pairs.length; i++) {
          let pair: string[] = pairs[i].split('=');

          // Ensure the pair is a key-value pair before assignment
          if (pair.length !== 2) {
            continue;
          }

          let key: string = pair[0].trim(); // remove whitespace
          let value: string = pair[1].trim(); // remove whitespace

          // Ensure the key is either 'title' or 'author' before assignment
          if (key !== 'title' && key !== 'author') {
            continue;
          }

          obj[key] = value;
        }
        return {
          title: song?.metadata?.title,
          description: song?.metadata?.description,
          created: song.created,
          updated: song.updated,
          name: song.name,
          id: song.identifier,
          status: song?.status,
          ...obj
        }
      })
      dispatch(upsertQueried(structureData))


      for (const content of structureData) {
        if (content.name && content.id) {

          if (!imageCoverHash[content.id]) {
            queueFetchAvatars.push(() => getImgCover(content.id, content.name))
            // getImgCover(content.id, content.name)
          }
        }
      }
    } catch (error) {
    } finally {
      dispatch(setIsLoadingGlobal(false))
    }
  }, [songListQueried, imageCoverHash, queriedValue]);

  const getLikedSongs = useCallback(async () => {
    const offset = favoriteList.length
    const songs = songList.slice(offset, offset + 20)
    let songsToSet = []
    for (const song of songs) {
      try {
        const url = `/arbitrary/resources/search?mode=ALL&service=${song.service}&identifier=${song.identifier}&limit=1&includemetadata=true&offset=${0}&name=${song.name}&includestatus=true`
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        const responseData = await response.json()
        if (responseData.length === 0) continue
        const data = responseData[0]

        const description = data?.metadata?.description || ""
        let pairs: string[] = description?.split(';');  // Splits the string into an array based on the semicolon.

        // Define an empty object to hold your title and author
        let obj: { [key: string]: string } = {};

        // Loop through the pairs and further split them on the equals sign.
        for (let i = 0; i < pairs.length; i++) {
          let pair: string[] = pairs[i].split('=');

          // Ensure the pair is a key-value pair before assignment
          if (pair.length !== 2) {
            continue;
          }

          let key: string = pair[0].trim(); // remove whitespace
          let value: string = pair[1].trim(); // remove whitespace

          // Ensure the key is either 'title' or 'author' before assignment
          if (key !== 'title' && key !== 'author') {
            continue;
          }

          obj[key] = value;
        }
        const object = {
          title: data?.metadata?.title,
          description: data?.metadata?.description,
          created: data.created,
          updated: data.updated,
          name: data.name,
          id: data.identifier,
          status: data?.status,
          ...obj
        }
        songsToSet.push(object)



        if (!imageCoverHash[object.id]) {
          queueFetchAvatars.push(() => getImgCover(object.id, object.name))
          // getImgCover(object.id, object.name)
        }

      } catch (error) {
      } finally {
      }
    }
    dispatch(upsertFavorite(songsToSet))

  }, [imageCoverHash, songList, favoriteList]);


  const getRecentSongs = useCallback(async (offsetParam?: number, limitParam?: number) => {
    try {
      const offset = offsetParam ?? songListRecent.length
      const limit = limitParam ?? 20
      const url = `/arbitrary/resources/search?mode=ALL&service=AUDIO&query=earbump_song_&limit=${limit}&includemetadata=true&offset=${offset}&reverse=true&excludeblocked=true&includestatus=true`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const responseData = await response.json()
      const structureData = responseData.map((song: any): SongMeta => {
        const description = song?.metadata?.description || ""
        let pairs: string[] = description?.split(';');  // Splits the string into an array based on the semicolon.

        // Define an empty object to hold your title and author
        let obj: { [key: string]: string } = {};

        // Loop through the pairs and further split them on the equals sign.
        for (let i = 0; i < pairs.length; i++) {
          let pair: string[] = pairs[i].split('=');

          // Ensure the pair is a key-value pair before assignment
          if (pair.length !== 2) {
            continue;
          }

          let key: string = pair[0].trim(); // remove whitespace
          let value: string = pair[1].trim(); // remove whitespace

          // Ensure the key is either 'title' or 'author' before assignment
          if (key !== 'title' && key !== 'author') {
            continue;
          }

          obj[key] = value;
        }


        return {
          title: song?.metadata?.title,
          description: song?.metadata?.description,
          created: song.created,
          updated: song.updated,
          name: song.name,
          id: song.identifier,
          status: song?.status,
          ...obj
        }
      })
      dispatch(upsertRecent(structureData))
      for (const content of structureData) {
        if (content.name && content.id) {

          if (!imageCoverHash[content.id]) {
            queueFetchAvatars.push(() => getImgCover(content.id, content.name))
            // getImgCover(content.id, content.name)
          }
        }
      }
    } catch (error) {
    } finally {
    }
  }, [songListRecent, imageCoverHash]);


  const checkStructure = (content: any) => {
    let isValid = true

    return isValid
  }



  const fetchAndEvaluatePlaylists = async (data: any) => {
    const getPlaylist = async () => {
      const { user, playlistId, content } = data
      let obj: any = {
        ...content,
        isValid: false
      }

      if (!user || !playlistId) return obj

      try {

        const responseData = await qortalRequest({
          action: 'FETCH_QDN_RESOURCE',
          name: user,
          service: 'PLAYLIST',
          identifier: playlistId
        })
        if (checkStructure(responseData)) {
          obj = {
            ...content,
            ...responseData,
            isValid: true
          }
        }
        return obj
      } catch (error) { }
    }

    const res = await getPlaylist()
    return res
  }


  const getPlaylist = async (user: string, playlistId: string, content: any) => {
    const res = await fetchAndEvaluatePlaylists({
      user,
      playlistId,
      content
    })

    dispatch(addToPlaylistHashMap(res))
  }


  const checkAndUpdatePlaylist = React.useCallback(
    (playlist: PlayList) => {

      const existingPlaylist = playlistHash[playlist.id]
      if (!existingPlaylist) {
        return true
      } else if (
        playlist?.updated &&
        existingPlaylist?.updated &&
        (playlist.updated > existingPlaylist.updated)
      ) {
        return true
      } else {
        return false
      }
    },
    [playlistHash]
  )

  const getPlaylists = useCallback(async () => {
    try {
      const offset = playlists.length
      const url = `/arbitrary/resources/search?mode=ALL&service=PLAYLIST&query=earbump_playlist_&limit=20&includemetadata=false&offset=${offset}&reverse=true&excludeblocked=true&includestatus=false`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const responseData = await response.json()
      const structureData = responseData.map((playlist: any): PlayList => {
        return {
          title: playlist?.metadata?.title,
          category: playlist?.metadata?.category,
          categoryName: playlist?.metadata?.categoryName,
          tags: playlist?.metadata?.tags || [],
          description: playlist?.metadata?.description,
          created: playlist?.created,
          updated: playlist?.updated,
          user: playlist.name,
          image: '',
          songs: [],
          id: playlist.identifier
        }
      })
      dispatch(upsertPlaylists(structureData))

      for (const content of structureData) {
        if (content.user && content.id) {
          const res = checkAndUpdatePlaylist(content)
          if (res) {
            getPlaylist(content.user, content.id, content)

          }
        }
      }

    } catch (error) {
    } finally {
    }
  }, [playlists, imageCoverHash]);

  const getRandomPlaylist = useCallback(async () => {
    try {
      const url = `/arbitrary/resources/search?mode=ALL&service=PLAYLIST&query=earbump_playlist_&limit=50&includemetadata=false&offset=${0}&reverse=true&excludeblocked=false&includestatus=false`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const responseData = await response.json();
      const length = responseData.length;
      const randomIndex = Math.floor(Math.random() * length);
      const randomItem = responseData[randomIndex];

      const structurePlaylist = {
        title: randomItem?.metadata?.title,
        category: randomItem?.metadata?.category,
        categoryName: randomItem?.metadata?.categoryName,
        tags: randomItem?.metadata?.tags || [],
        description: randomItem?.metadata?.description,
        created: randomItem?.created,
        updated: randomItem?.updated,
        user: randomItem.name,
        image: '',
        songs: [],
        id: randomItem.identifier
      }
      dispatch(setRandomPlaylist(structurePlaylist))


      const res = checkAndUpdatePlaylist(structurePlaylist)
      if (res) {
        getPlaylist(structurePlaylist.user, structurePlaylist.id, structurePlaylist)

      }

    } catch (error) {

    }
  }, [])


  const getMyPlaylists = useCallback(async () => {
    try {
      if (!username) return
      const offset = myPlaylists.length
      const url = `/arbitrary/resources/search?mode=ALL&service=PLAYLIST&query=earbump_playlist_&limit=20&includemetadata=false&offset=${offset}&reverse=true&excludeblocked=true&includestatus=false&name=${username}&exactmatchnames=true`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const responseData = await response.json()
      const structureData = responseData.map((playlist: any): PlayList => {
        return {
          title: playlist?.metadata?.title,
          category: playlist?.metadata?.category,
          categoryName: playlist?.metadata?.categoryName,
          tags: playlist?.metadata?.tags || [],
          description: playlist?.metadata?.description,
          created: playlist?.created,
          updated: playlist?.updated,
          user: playlist.name,
          image: '',
          songs: [],
          id: playlist.identifier
        }
      })
      dispatch(upsertMyPlaylists(structureData))

      for (const content of structureData) {
        if (content.user && content.id) {
          const res = checkAndUpdatePlaylist(content)
          if (res) {
            getPlaylist(content.user, content.id, content)

          }
        }
      }

    } catch (error) {
    } finally {
    }
  }, [myPlaylists, imageCoverHash, username]);

  const getPlaylistsQueried = useCallback(async () => {
    try {
      if (!queriedValuePlaylist) return
      const offset = playlistQueried.length
      const identifier = `earbump_playlist_`
      const replaceSpacesWithUnderscore = queriedValuePlaylist.toLowerCase().replace(/ /g, '_');
      const query = replaceSpacesWithUnderscore
      const url = `/arbitrary/resources/search?mode=ALL&service=PLAYLIST&query=${query}&identifier=${identifier}&limit=20&includemetadata=false&offset=${offset}&reverse=true&excludeblocked=true&includestatus=false`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const responseData = await response.json()
      const structureData = responseData.map((playlist: any): PlayList => {
        return {
          title: playlist?.metadata?.title,
          category: playlist?.metadata?.category,
          categoryName: playlist?.metadata?.categoryName,
          tags: playlist?.metadata?.tags || [],
          description: playlist?.metadata?.description,
          created: playlist?.created,
          updated: playlist?.updated,
          user: playlist.name,
          image: '',
          songs: [],
          id: playlist.identifier
        }
      })
      dispatch(upsertQueriedPlaylist(structureData))

      for (const content of structureData) {
        if (content.user && content.id) {
          const res = checkAndUpdatePlaylist(content)
          if (res) {
            getPlaylist(content.user, content.id, content)

          }
        }
      }

    } catch (error) {
    } finally {
    }
  }, [playlistQueried, imageCoverHash, queriedValuePlaylist]);


  return {
    getRecentSongs,
    getYourLibrary,
    getQueriedSongs,
    getLikedSongs,
    getPlaylists,
    getPlaylistsQueried,
    getMyPlaylists,
    getRandomPlaylist
  }
}
