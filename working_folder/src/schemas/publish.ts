import { z } from 'zod'

const BasePublishFields = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  tags: z.array(z.string().min(1)).default([]),
  language: z.string().optional(),
  categories: z.array(z.string().min(1)).default([])
})

export const MusicSchema = BasePublishFields.extend({
  kind: z.literal('music')
})

export const PodcastSchema = BasePublishFields.extend({
  kind: z.literal('podcast'),
  transcriptCid: z.string().optional(),
  episodes: z.array(z.string().min(1)).default([])
})

export const AudiobookSchema = BasePublishFields.extend({
  kind: z.literal('audiobook'),
  narrator: z.string().optional(),
  chapters: z.array(z.string().min(1)).default([])
})

export const PublishSchema = z.discriminatedUnion('kind', [
  MusicSchema,
  PodcastSchema,
  AudiobookSchema
])

export type PublishPayload = z.output<typeof PublishSchema>
export type PublishKind = PublishPayload['kind']

export interface PublishFormValues {
  kind: PublishKind
  title: string
  description: string
  tags?: string[]
  language?: string
  categories?: string[]
  transcriptCid?: string
  episodes?: string[]
  narrator?: string
  chapters?: string[]
}
