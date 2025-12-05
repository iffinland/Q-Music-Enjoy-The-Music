import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  PublishSchema,
  type PublishFormValues,
  type PublishKind,
  type PublishPayload
} from '../../schemas/publish'
import useDraft from '../../features/drafts/useDraft'
import { useAppDispatch, useAppSelector } from '../../state/hooks'
import { mergePayload, setKind } from '../../state/slices/publishSlice'
import KindSelector from './KindSelector'
import LivePreview from './LivePreview'
import MetaStep from './steps/Meta'
import FilesStep from './steps/Files'
import PreviewStep from './steps/Preview'
import SignStep from './steps/Sign'
import PublishStep from './steps/Publish'

const PublishForm = () => {
  const dispatch = useAppDispatch()
  const publish = useAppSelector((state) => state.publish)
  const form = useForm<PublishFormValues>({
    resolver: zodResolver<PublishFormValues, any, PublishPayload>(PublishSchema),
    defaultValues: {
      kind: publish.kind,
      title: publish.payload.title ?? '',
      description: publish.payload.description ?? '',
      tags: publish.payload.tags ?? [],
      language: publish.payload.language ?? '',
      categories: publish.payload.categories ?? [],
      transcriptCid: publish.payload.transcriptCid ?? '',
      episodes: publish.payload.episodes ?? [],
      narrator: publish.payload.narrator ?? '',
      chapters: publish.payload.chapters ?? []
    }
  })

  const watchedValues = form.watch()

  const { saveDraft, isSaving } = useDraft({
    enabled: true,
    payload: form.getValues()
  })

  const handleKindChange = (nextKind: PublishKind) => {
    form.setValue('kind', nextKind, { shouldDirty: true })
    dispatch(setKind(nextKind))
  }

  const handleSaveDraft = () => {
    const values = form.getValues()
    dispatch(mergePayload(values))
    void saveDraft(values)
  }

  const onSubmit = form.handleSubmit((values) => {
    dispatch(mergePayload(values))
  })

  const renderStep = () => {
    switch (publish.step) {
      case 'files':
        return <FilesStep />
      case 'preview':
        return <PreviewStep values={watchedValues} />
      case 'sign':
        return <SignStep />
      case 'publish':
        return <PublishStep />
      case 'meta':
      default:
        return <MetaStep form={form} />
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <div className="rounded-xl border border-sky-800/70 bg-sky-900/50 p-5 shadow-lg shadow-sky-900/40">
          <div className="flex flex-col gap-3 border-b border-sky-800/60 pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-sky-200/70">QDN publish</p>
              <h2 className="text-xl font-bold text-white">Create a new release</h2>
            </div>
            <KindSelector value={watchedValues.kind} onChange={handleKindChange} />
          </div>
          <div className="mt-4 space-y-4">{renderStep()}</div>
          <div className="mt-6 flex flex-col gap-3 border-t border-sky-800/60 pt-4 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="rounded-md border border-sky-700/60 bg-sky-900/40 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:border-emerald-500/60 hover:text-white disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              type="submit"
              className="rounded-md bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
            >
              Publish
            </button>
          </div>
        </div>
      </div>
      <LivePreview values={watchedValues} />
    </form>
  )
}

export default PublishForm
