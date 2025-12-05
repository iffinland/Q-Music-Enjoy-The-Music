import { useCallback, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { db, type DraftRecord } from '../../db'
import type { PublishFormValues } from '../../schemas/publish'
import { useAppDispatch, useAppSelector } from '../../state/hooks'
import { mergePayload, setDraftId } from '../../state/slices/publishSlice'

type UseDraftOptions = {
  enabled?: boolean
  payload: PublishFormValues
}

const AUTOSAVE_DELAY_MS = 3000

const useDraft = ({ enabled = true, payload }: UseDraftOptions) => {
  const dispatch = useAppDispatch()
  const draftId = useAppSelector((state) => state.publish.draftId)
  const [isSaving, setIsSaving] = useState(false)
  const lastPayloadHashRef = useRef<string>('')
  const timerRef = useRef<number | null>(null)

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const saveDraft = useCallback(
    async (overridePayload?: PublishFormValues) => {
      if (!enabled) return
      const currentPayload = overridePayload ?? payload
      const id = draftId ?? nanoid()
      const record: DraftRecord = {
        id,
        kind: currentPayload.kind,
        payload: currentPayload,
        updatedAt: Date.now(),
        synced: false
      }
      setIsSaving(true)
      try {
        await db.drafts.put(record)
        if (!draftId) {
          dispatch(setDraftId(id))
        }
        dispatch(mergePayload(currentPayload))
      } catch (error) {
        console.error('Failed to save draft', error)
      } finally {
        setIsSaving(false)
      }
    },
    [dispatch, draftId, enabled, payload]
  )

  useEffect(() => {
    if (!enabled) return undefined
    const nextHash = JSON.stringify(payload)
    if (nextHash === lastPayloadHashRef.current) {
      return undefined
    }
    lastPayloadHashRef.current = nextHash
    clearTimer()
    timerRef.current = window.setTimeout(() => {
      void saveDraft()
    }, AUTOSAVE_DELAY_MS)

    return () => {
      clearTimer()
    }
  }, [enabled, payload, saveDraft])

  useEffect(() => clearTimer, [])

  return { saveDraft, isSaving }
}

export default useDraft
