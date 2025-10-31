import { checkStructure } from './checkStructure'

export const fetchAndEvaluateVideos = async (data: any) => {
  const getVideo = async () => {
    const { user, videoId, content } = data
    let obj: any = {
      ...content,
      isValid: false
    }

    if (!user || !videoId) return obj

    try {
      const url = `/arbitrary/JSON/${user}/${videoId}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const responseData = await response.json()

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

  const res = await getVideo()
  return res
}
