// src/global.d.ts
interface QortalRequestOptions {
  action: string
  name?: string
  service?: string
  data64?: string
  title?: string
  description?: string
  category?: string
  tags?: string[]
  identifier?: string
  address?: string
  metaData?: string
  encoding?: string
  includeMetadata?: boolean
  limit?: number
  offset?: number
  reverse?: boolean
  resources?: any[]
  filename?: string
  list_name?: string
  item?: string
  items?: string[]
  tag1?: string
  tag2?: string
  tag3?: string
  tag4?: string
  tag5?: string
  coin?: string
  destinationAddress?: string
  recipient?: string
  amount?: number
  blob?: Blob
  mimeType?: string
  file?: File
  encryptedData?: string
  responseType?: string
  headers?: Record<string, string>
}

declare function qortalRequest(options: QortalRequestOptions): Promise<any>
declare function qortalRequestWithTimeout(
  options: QortalRequestOptions,
  time: number
): Promise<any>

declare global {
  interface Window {
    _qdnBase: any // Replace 'any' with the appropriate type if you know it
    _qdnTheme: string
  }
}

declare global {
  interface Window {
    showSaveFilePicker: (
      options?: SaveFilePickerOptions
    ) => Promise<FileSystemFileHandle>
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
  }
}

interface FileSystemHandle {
  kind: 'file' | 'directory'
  name: string
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file'
  getFile(): Promise<File>
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory'
  values?: () => AsyncIterableIterator<FileSystemHandle>
  entries?: () => AsyncIterableIterator<[string, FileSystemHandle]>
}

declare module 'use-sound';
