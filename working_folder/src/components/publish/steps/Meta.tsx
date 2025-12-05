import { Controller, type UseFormReturn } from 'react-hook-form'
import type { PublishFormValues } from '../../../schemas/publish'

type MetaProps = {
  form: UseFormReturn<PublishFormValues>
}

const toList = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

const Meta = ({ form }: MetaProps) => {
  const {
    register,
    control,
    formState: { errors }
  } = form

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-sky-100" htmlFor="publish-title">
          Title
        </label>
        <input
          id="publish-title"
          type="text"
          {...register('title')}
          className="mt-2 w-full rounded-md border border-sky-700/60 bg-sky-900/40 px-3 py-2 text-sm text-white outline-none ring-emerald-400/60 focus:ring"
          placeholder="Name your audio"
        />
        {errors.title?.message && (
          <p className="mt-1 text-xs text-red-300">{errors.title.message}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-semibold text-sky-100" htmlFor="publish-description">
          Description
        </label>
        <textarea
          id="publish-description"
          rows={4}
          {...register('description')}
          className="mt-2 w-full rounded-md border border-sky-700/60 bg-sky-900/40 px-3 py-2 text-sm text-white outline-none ring-emerald-400/60 focus:ring"
          placeholder="Share a short story about this release"
        />
        {errors.description?.message && (
          <p className="mt-1 text-xs text-red-300">{errors.description.message}</p>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-sky-100" htmlFor="publish-language">
            Language
          </label>
          <input
            id="publish-language"
            type="text"
            {...register('language')}
            className="mt-2 w-full rounded-md border border-sky-700/60 bg-sky-900/40 px-3 py-2 text-sm text-white outline-none ring-emerald-400/60 focus:ring"
            placeholder="en, es, fr..."
          />
        </div>
        <Controller
          name="categories"
          control={control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-semibold text-sky-100" htmlFor="publish-categories">
                Categories
              </label>
              <input
                id="publish-categories"
                type="text"
                value={field.value?.join(', ') ?? ''}
                onChange={(event) => field.onChange(toList(event.target.value))}
                className="mt-2 w-full rounded-md border border-sky-700/60 bg-sky-900/40 px-3 py-2 text-sm text-white outline-none ring-emerald-400/60 focus:ring"
                placeholder="comma separated"
              />
            </div>
          )}
        />
      </div>
      <Controller
        name="tags"
        control={control}
        render={({ field }) => (
          <div>
            <label className="block text-sm font-semibold text-sky-100" htmlFor="publish-tags">
              Tags
            </label>
            <input
              id="publish-tags"
              type="text"
              value={field.value?.join(', ') ?? ''}
              onChange={(event) => field.onChange(toList(event.target.value))}
              className="mt-2 w-full rounded-md border border-sky-700/60 bg-sky-900/40 px-3 py-2 text-sm text-white outline-none ring-emerald-400/60 focus:ring"
              placeholder="genre, mood, theme"
            />
            <p className="mt-1 text-xs text-sky-200/70">Use commas to separate multiple tags</p>
          </div>
        )}
      />
    </div>
  )
}

export default Meta
