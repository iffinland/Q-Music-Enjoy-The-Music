import { expect, test } from '@playwright/test'

const AUDIO_DATA_URL =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='

const MOCK_SONG = {
  name: 'tester',
  identifier: 'mock-track',
  title: 'Mock Track',
  author: 'Test Artist'
}

declare global {
  interface Window {
    __qortalCalls?: any[]
    qortalRequest?: (payload: any) => Promise<any>
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ song, audioUrl }) => {
    window.__qortalCalls = []
    window.qortalRequest = async (payload: any) => {
      window.__qortalCalls.push(payload)
      const action = payload?.action
      switch (action) {
        case 'GET_USER_ACCOUNT':
          return { address: 'QTESTADDRESS' }
        case 'GET_ACCOUNT_NAMES':
          return [{ name: 'tester' }]
        case 'SEARCH_QDN_RESOURCES': {
          const identifier = payload?.identifier || payload?.query
          if (typeof identifier === 'string' && identifier.includes(song.identifier)) {
            return [
              {
                name: song.name,
                service: payload?.service || 'AUDIO',
                identifier: song.identifier,
                metadata: {
                  title: song.title,
                  description: `title=${song.title};author=${song.author}`
                },
                status: { status: 'READY', percentLoaded: 100 },
                created: Date.now(),
                updated: Date.now()
              }
            ]
          }
          return []
        }
        case 'GET_QDN_RESOURCE_URL':
          return audioUrl
        case 'GET_QDN_RESOURCE_STATUS':
          return { status: 'READY', percentLoaded: 100 }
        case 'FETCH_QDN_RESOURCE':
          if (payload?.responseType === 'arraybuffer') {
            return new ArrayBuffer(8)
          }
          return { ok: true }
        case 'PUBLISH_QDN_RESOURCE':
          return { signature: 'sig-publish', identifier: payload?.identifier || song.identifier }
        case 'PUBLISH_MULTIPLE_QDN_RESOURCES':
          return { identifiers: payload?.resources?.map((r: any) => r.identifier) }
        case 'DELETE_QDN_RESOURCE':
          return { ok: true }
        case 'SEND_QORTAL_TIP':
          return { signature: 'tip-sig' }
        case 'GET_TX_STATUS':
          return { status: 'CONFIRMED', signature: payload?.signature }
        default:
          return {}
      }
    }
  }, { song: MOCK_SONG, audioUrl: AUDIO_DATA_URL })
})

const readDrafts = async (page: any) => {
  return page.evaluate(() =>
    new Promise<any[]>((resolve, reject) => {
      const request = indexedDB.open('qmusic_v2')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('drafts', 'readonly')
        const store = tx.objectStore('drafts')
        const getAll = store.getAll()
        getAll.onerror = () => reject(getAll.error)
        getAll.onsuccess = () => resolve(getAll.result as any[])
      }
    })
  )
}

test('publish form saves draft and mocked playback flow', async ({ page }) => {
  await page.goto('/publish')

  await page.getByLabel('Title').fill('My Mock Title')
  await page.getByLabel('Description').fill('This is a test publish flow.')
  await page.getByLabel('Language').fill('en')
  await page.getByLabel('Categories').fill('testing')
  await page.getByLabel('Tags').fill('tag1, tag2')

  await page.getByRole('button', { name: 'Save Draft' }).click()
  await page.waitForTimeout(300)
  const drafts = await readDrafts(page)
  expect(drafts.some((draft) => draft?.payload?.title === 'My Mock Title')).toBe(true)

  await page.reload()
  await expect(page.getByText('Create a new release')).toBeVisible()
  const draftsAfterReload = await readDrafts(page)
  expect(draftsAfterReload.length).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Publish' }).click()

  await page.goto('/songs/tester/mock-track')
  await expect(page.getByRole('heading', { name: 'Mock Track' }).first()).toBeVisible()

  const playBadge = page.getByText(/Play This|Play Again/).first()
  const playButton = playBadge.locator('xpath=../button')
  await playButton.click()
  await page.waitForTimeout(500)

  const tipResult = await page.evaluate(async () => {
    const { qdnClient } = await import('/src/state/api/client')
    const tip = await qdnClient.sendTip({ recipient: 'tester', amount: 1 })
    const status = await qdnClient.txStatus({ signature: tip?.signature || 'tip-sig' })
    return { tip, status }
  })

  expect(tipResult.tip?.signature).toBeTruthy()
  expect(tipResult.status?.status).toBe('CONFIRMED')

  const actions = await page.evaluate(() => (window as any).__qortalCalls?.map((entry: any) => entry.action))
  expect(actions).toContain('SEND_QORTAL_TIP')
  expect(actions).toContain('GET_TX_STATUS')
})
