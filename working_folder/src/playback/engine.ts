type EventMap = {
  timeupdate: (currentTime: number, duration: number) => void
  ended: () => void
  play: () => void
  pause: () => void
  error: (err: unknown) => void
}

export class AudioEngine {
  private audio: HTMLAudioElement
  private listeners: Partial<Record<keyof EventMap, Array<(...args: any[]) => void>>> = {}

  constructor() {
    this.audio = new Audio()
    this.audio.preload = 'auto'
    this.audio.addEventListener('timeupdate', () => {
      this.emit('timeupdate', this.audio.currentTime, this.audio.duration || 0)
    })
    this.audio.addEventListener('ended', () => this.emit('ended'))
    this.audio.addEventListener('play', () => this.emit('play'))
    this.audio.addEventListener('pause', () => this.emit('pause'))
    this.audio.addEventListener('error', () => this.emit('error', this.audio.error))
  }

  on<K extends keyof EventMap>(event: K, handler: EventMap[K]) {
    const handlers = (this.listeners[event] as EventMap[K][]) ?? []
    handlers.push(handler)
    this.listeners[event] = handlers
  }

  off<K extends keyof EventMap>(event: K, handler: EventMap[K]) {
    const handlers = (this.listeners[event] as EventMap[K][]) ?? []
    this.listeners[event] = handlers.filter((fn) => fn !== handler)
  }

  private emit<K extends keyof EventMap>(event: K, ...args: Parameters<EventMap[K]>) {
    const handlers = (this.listeners[event] as EventMap[K][]) ?? []
    handlers.forEach((handler) => {
      ;(handler as (...params: Parameters<EventMap[K]>) => void)(...args)
    })
  }

  setSrc(src: string | null) {
    if (!src) {
      this.audio.removeAttribute('src')
      this.audio.load()
      return
    }
    this.audio.src = src
  }

  play() {
    return this.audio.play()
  }

  pause() {
    this.audio.pause()
  }

  seek(seconds: number) {
    this.audio.currentTime = Math.max(0, seconds)
  }

  setVolume(volume: number) {
    this.audio.volume = Math.max(0, Math.min(1, volume))
  }

  get currentTime() {
    return this.audio.currentTime
  }

  get duration() {
    return this.audio.duration || 0
  }
}

export const engine = new AudioEngine()
