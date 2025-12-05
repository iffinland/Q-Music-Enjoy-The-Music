import type { PublishFormValues } from '../../../schemas/publish'

type PreviewProps = {
  values?: Partial<PublishFormValues>
}

const Preview = ({ values }: PreviewProps) => {
  return (
    <div className="rounded-md border border-sky-700/60 bg-sky-900/40 p-4 text-sm text-sky-100/80">
      <p className="font-semibold text-white">Preview</p>
      <p className="mt-2">We will show a richer preview for your publish payload here.</p>
      {values?.title && (
        <div className="mt-2 rounded-md border border-sky-700/50 bg-sky-950/60 p-3 text-xs text-sky-200/80">
          {JSON.stringify(values, null, 2)}
        </div>
      )}
    </div>
  )
}

export default Preview
