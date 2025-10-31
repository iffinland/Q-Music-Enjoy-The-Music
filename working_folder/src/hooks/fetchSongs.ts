import React, { useCallback, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";


import { RootState } from "../state/store";
import { FavSong, PlayList, SongMeta, addToPlaylistHashMap, setImageCoverHash, upsertFavorite, upsertMyLibrary, upsertMyPlaylists, upsertPlaylists, upsertQueriedPlaylist } from "../state/features/globalSlice";
import { queueFetchAvatars } from "../wrappers/GlobalWrapper";
import { searchQdnResources, SearchQdnResourcesParams } from "../utils/qortalApi";
import { shouldHideQdnResource } from "../utils/qdnResourceFilters";

const SONG_PREFIXES = ["enjoymusic_song_", "earbump_song_"] as const;
const PLAYLIST_PREFIXES = ["enjoymusic_playlist_", "earbump_playlist_"] as const;

const isFulfilled = <T,>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> => result.status === "fulfilled";

const combinePrefixResults = async (
  prefixes: readonly string[],
  buildParams: (prefix: string) => SearchQdnResourcesParams,
) => {
  const settled = await Promise.allSettled(
    prefixes.map((prefix) => searchQdnResources(buildParams(prefix)))
  );

  const combined = settled
    .filter(isFulfilled)
    .flatMap((entry) => (Array.isArray(entry.value) ? entry.value : []));

  return combined.sort((a: any, b: any) => {
    const aTime = typeof a?.updated === "number" ? a.updated : typeof a?.created === "number" ? a.created : 0;
    const bTime = typeof b?.updated === "number" ? b.updated : typeof b?.created === "number" ? b.created : 0;
    return bTime - aTime;
  });
};

const uniqueByIdentifier = <T extends { identifier?: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const item of items) {
    const id = typeof item?.identifier === "string" ? item.identifier : "";
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    deduped.push(item);
  }
  return deduped;
};

export const useFetchSongs = () => {
  const dispatch = useDispatch();

  const [userAvatar, setUserAvatar] = useState<string>("");
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const songListLibrary = useSelector((state: RootState) => state.global.songListLibrary);
  const songHash = useSelector((state: RootState) => state.global.songHash);
  const imageCoverHash = useSelector((state: RootState) => state.global.imageCoverHash);
  const playlistQueried = useSelector((state: RootState) => state.global.playlistQueried);
  const queriedValuePlaylist = useSelector((state: RootState) => state.global.queriedValuePlaylist);
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
  // in-flight map to coalesce duplicate cover URL fetches per id
  const coverInflight = React.useRef<Map<string, Promise<string | null>>>(new Map());

  const getImgCover = async (id: string, name: string, retries = 0) => {
    try {
      if (!id || !name) return;

      // reuse redux cache first
      const existing = imageCoverHash[id];
      if (existing) return;

      // coalesce concurrent requests
      const inflight = coverInflight.current.get(id);
      if (inflight) {
        await inflight;
        return;
      }

      const p = (async () => {
        let url = await qortalRequest({
          action: "GET_QDN_RESOURCE_URL",
          name: name,
          service: "THUMBNAIL",
          identifier: id
        });

        if (url === "Resource does not exist") {
          url = null;
        }

        if (url) {
          dispatch(setImageCoverHash({ url, id }));
        }
        return url as string | null;
      })().finally(() => {
        coverInflight.current.delete(id);
      });

      coverInflight.current.set(id, p);
      await p;
    } catch (error) {
      // swallow errors; retry strategy could be added if needed
    }
  }

  const getYourLibrary = useCallback(async (name: string) => {
    try {
      const offset = songListLibrary.length;
      const limit = 20;
      const fetchCount = offset + limit;

      const combined = await combinePrefixResults(SONG_PREFIXES, (prefix) => ({
        mode: 'ALL',
        service: 'AUDIO',
        query: prefix,
        name,
        limit: fetchCount,
        includeMetadata: true,
        offset: 0,
        reverse: true,
        excludeBlocked: true,
        exactMatchNames: true,
        includeStatus: true,
      }));

      const filteredPage = uniqueByIdentifier(
        combined.filter((song: any) => !shouldHideQdnResource(song)),
      ).slice(offset, offset + limit);

      const structureData = filteredPage.map((song: any): SongMeta => {
        const description = song?.metadata?.description || ""
        const pairs: string[] = description?.split(';');  // Splits the string into an array based on the semicolon.

        // Define an empty object to hold your title and author
        const obj: { [key: string]: string } = {};

        // Loop through the pairs and further split them on the equals sign.
        for (let i = 0; i < pairs.length; i++) {
          const pair: string[] = pairs[i].split('=');

          // Ensure the pair is a key-value pair before assignment
          if (pair.length !== 2) {
            continue;
          }

          const key: string = pair[0].trim(); // remove whitespace
          const value: string = pair[1].trim(); // remove whitespace

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


  const getLikedSongs = useCallback(async () => {
    const offset = favoriteList.length
    const songs = songList.slice(offset, offset + 20)
    const songsToSet = []
    for (const song of songs) {
      try {
        const responseData = await searchQdnResources({
          mode: 'ALL',
          service: song.service,
          identifier: song.identifier,
          limit: 1,
          includeMetadata: true,
          offset: 0,
          name: song.name,
          includeStatus: true,
        });
        if (responseData.length === 0) continue
        const data = responseData[0]
        if (shouldHideQdnResource(data)) continue;

        const description = data?.metadata?.description || ""
        const pairs: string[] = description?.split(';');  // Splits the string into an array based on the semicolon.

        // Define an empty object to hold your title and author
        const obj: { [key: string]: string } = {};

        // Loop through the pairs and further split them on the equals sign.
        for (let i = 0; i < pairs.length; i++) {
          const pair: string[] = pairs[i].split('=');

          // Ensure the pair is a key-value pair before assignment
          if (pair.length !== 2) {
            continue;
          }

          const key: string = pair[0].trim(); // remove whitespace
          const value: string = pair[1].trim(); // remove whitespace

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


  const checkStructure = (content: any) => {
    const isValid = true

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

  const getPlaylists = useCallback(async (offsetParam?: number, limitParam?: number) => {
    try {
      const offset = offsetParam ?? playlists.length
      const limit = limitParam ?? 20
      const fetchCount = offset + limit

      const combined = await combinePrefixResults(PLAYLIST_PREFIXES, (prefix) => ({
        mode: 'ALL',
        service: 'PLAYLIST',
        query: prefix,
        limit: fetchCount,
        includeMetadata: true,
        offset: 0,
        reverse: true,
        excludeBlocked: true,
        includeStatus: false,
      }));

      const filteredPage = uniqueByIdentifier(
        combined.filter((playlist: any) => !shouldHideQdnResource(playlist)),
      ).slice(offset, offset + limit);

      const structureData = filteredPage.map((playlist: any): PlayList => {
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

  const getMyPlaylists = useCallback(async () => {
    try {
      if (!username) return
      const offset = myPlaylists.length
      const limit = 20
      const fetchCount = offset + limit

      const combined = await combinePrefixResults(PLAYLIST_PREFIXES, (prefix) => ({
        mode: 'ALL',
        service: 'PLAYLIST',
        query: prefix,
        limit: fetchCount,
        includeMetadata: true,
        offset: 0,
        reverse: true,
        excludeBlocked: true,
        includeStatus: false,
        name: username,
        exactMatchNames: true,
      }));

      const filteredPage = uniqueByIdentifier(
        combined.filter((playlist: any) => !shouldHideQdnResource(playlist)),
      ).slice(offset, offset + limit);

      const structureData = filteredPage.map((playlist: any): PlayList => {
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
      const replaceSpacesWithUnderscore = queriedValuePlaylist.toLowerCase().replace(/ /g, '_');
      const query = replaceSpacesWithUnderscore
      const limit = 20
      const fetchCount = offset + limit

      const combined = await combinePrefixResults(PLAYLIST_PREFIXES, (prefix) => ({
        mode: 'ALL',
        service: 'PLAYLIST',
        query,
        identifier: prefix,
        limit: fetchCount,
        includeMetadata: true,
        offset: 0,
        reverse: true,
        excludeBlocked: true,
        includeStatus: false,
      }));

      const filteredPage = uniqueByIdentifier(
        combined.filter((playlist: any) => !shouldHideQdnResource(playlist)),
      ).slice(offset, offset + limit);

      const structureData = filteredPage.map((playlist: any): PlayList => {
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
    getYourLibrary,
    getLikedSongs,
    getPlaylists,
    getPlaylistsQueried,
    getMyPlaylists,
  }
}
