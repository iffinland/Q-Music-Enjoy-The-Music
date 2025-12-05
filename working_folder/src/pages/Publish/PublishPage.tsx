import PublishForm from '../../components/publish/PublishForm'

export const PublishPage = () => {
  return (
    <div className="px-4 py-6">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-sky-200/70">QDN</p>
        <h1 className="text-2xl font-bold text-white">Publish</h1>
        <p className="text-sm text-sky-200/80">
          Create music, podcast, or audiobook releases with one unified flow.
        </p>
      </div>
      <PublishForm />
    </div>
  )
}

export default PublishPage
