import Dexie, { type Table } from 'dexie'
import type { PublishKind, PublishFormValues } from '../schemas/publish'

export type DraftRecord = {
  id: string
  kind: PublishKind
  payload: PublishFormValues
  files?: unknown
  updatedAt: number
  synced?: boolean
}

class QMusicDB extends Dexie {
  drafts!: Table<DraftRecord, string>

  constructor() {
    super('qmusic_v2')
    this.version(1).stores({
      drafts: '&id, kind, updatedAt'
    })
  }
}

export const db = new QMusicDB()
