import type { PublishFormValues } from '../../schemas/publish'

type LivePreviewProps = {
  values: Partial<PublishFormValues>
}

const formatList = (items?: string[]) => {
  if (!items || items.length === 0) return '—'
  return items.join(', ')
}

const LivePreview = ({ values }: LivePreviewProps) => {
  const { title, description, tags, language, categories, kind } = values
  return (
    <aside className="rounded-xl border border-sky-800/70 bg-sky-900/50 p-4 shadow-inner shadow-sky-900/50">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-sky-200/70">Live preview</div>
          <div className="text-lg font-semibold text-white">{title || 'Untitled draft'}</div>
        </div>
        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold uppercase text-emerald-100">
          {kind ?? 'music'}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-sky-100/90">
        {description || 'Start filling in your publish details to see them here.'}
      </p>
      <dl className="mt-4 space-y-2 text-sm text-sky-100/80">
        <div className="flex gap-2">
          <dt className="w-24 font-semibold text-sky-200/90">Language</dt>
          <dd>{language || '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 font-semibold text-sky-200/90">Tags</dt>
          <dd>{formatList(tags)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 font-semibold text-sky-200/90">Categories</dt>
          <dd>{formatList(categories)}</dd>
        </div>
      </dl>
    </aside>
  )
}

export default LivePreview
