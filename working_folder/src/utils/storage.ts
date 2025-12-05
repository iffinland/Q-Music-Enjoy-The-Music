export const readJson = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = window?.localStorage?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch (error) {
    console.error('Failed to read storage key', key, error)
    return null
  }
}

export const writeJson = async (key: string, value: unknown): Promise<void> => {
  try {
    window?.localStorage?.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error('Failed to persist storage key', key, error)
  }
}

export const removeKey = async (key: string): Promise<void> => {
  try {
    window?.localStorage?.removeItem(key)
  } catch (error) {
    console.error('Failed to remove storage key', key, error)
  }
}
