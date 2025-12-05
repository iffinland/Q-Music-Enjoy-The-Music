import { vi } from 'vitest'

if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    // minimal matchMedia stub for components that expect it
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })
  }

  if (!window.scrollTo) {
    window.scrollTo = () => {}
  }
}
