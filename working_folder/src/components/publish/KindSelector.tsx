import type { PublishKind } from '../../schemas/publish'

type KindSelectorProps = {
  value: PublishKind
  onChange: (kind: PublishKind) => void
}

const options: { value: PublishKind; label: string; helper: string }[] = [
  { value: 'music', label: 'Music', helper: 'Singles or albums' },
  { value: 'podcast', label: 'Podcast', helper: 'Episodes with transcripts' },
  { value: 'audiobook', label: 'Audiobook', helper: 'Long-form narration' }
]

const KindSelector = ({ value, onChange }: KindSelectorProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={[
              'rounded-lg border px-4 py-2 text-left transition',
              isActive
                ? 'border-emerald-400/70 bg-emerald-900/40 text-emerald-100 shadow-sm shadow-emerald-500/30'
                : 'border-sky-700/60 bg-sky-900/50 text-sky-100 hover:border-sky-500/60 hover:text-white'
            ].join(' ')}
          >
            <div className="text-sm font-semibold capitalize">{option.label}</div>
            <div className="text-xs text-slate-200/80">{option.helper}</div>
          </button>
        )
      })}
    </div>
  )
}

export default KindSelector
