// @vitest-environment jsdom
import { vi } from 'vitest'
import cookies from './cookies.js'

let requests
let submit

function renderBanner (gtmKey = 'GTM-TEST123') {
  document.body.innerHTML = `
    <form action="/cookies" method="post">
      <div class="js-cookies-container js-cookies-banner" data-crumb="csrf-token" data-gtm-key="${gtmKey}">
        <div class="js-question-banner">
          <button type="button" class="js-cookies-button-accept">Accept</button>
          <button type="button" class="js-cookies-button-reject">Reject</button>
        </div>
        <div class="js-cookies-accepted" hidden><button type="button" class="js-hide">Hide</button></div>
        <div class="js-cookies-rejected" hidden><button type="button" class="js-hide">Hide</button></div>
      </div>
    </form>`
  submit = vi.spyOn(document.querySelector('form'), 'submit').mockImplementation(() => {})
  cookies.setupCookieComponentListeners()
}

beforeEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  for (const cookie of document.cookie.split(';')) {
    document.cookie = `${cookie.split('=')[0].trim()}=; Max-Age=0; path=/`
  }
  delete globalThis.dataLayer
  requests = []
  vi.stubGlobal('XMLHttpRequest', class {
    constructor () {
      this.open = vi.fn()
      this.setRequestHeader = vi.fn()
      this.send = vi.fn()
      requests.push(this)
    }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('accept persists consent with CSRF and loads GTM without navigating', () => {
  renderBanner()
  expect(document.querySelector('script')).toBeNull()
  document.querySelector('.js-cookies-button-accept').click()
  expect(requests[0].open).toHaveBeenCalledWith('POST', '/cookies', true)
  expect(requests[0].setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/json')
  expect(JSON.parse(requests[0].send.mock.calls[0][0])).toEqual({ analytics: true, async: true, crumb: 'csrf-token' })
  expect(document.querySelector('script').src).toBe('https://www.googletagmanager.com/gtm.js?id=GTM-TEST123')
  expect(globalThis.dataLayer[0].event).toBe('gtm.js')
  const confirmation = document.querySelector('.js-cookies-accepted')
  expect(confirmation.hidden).toBe(false)
  expect(document.activeElement).toBe(confirmation)
  confirmation.dispatchEvent(new Event('blur'))
  expect(confirmation.hasAttribute('tabindex')).toBe(false)
  requests[0].status = 204
  requests[0].onload()
  expect(submit).not.toHaveBeenCalled()
  confirmation.querySelector('button').click()
  expect(document.querySelector('.js-cookies-banner').hidden).toBe(true)
})

test('reject removes analytics cookies while keeping essential cookies', () => {
  renderBanner()
  document.cookie = '_ga=tracking; path=/'
  document.cookie = '_gid=tracking; path=/'
  document.cookie = 'essential=keep; path=/'
  document.querySelector('.js-cookies-button-reject').click()
  expect(document.cookie).not.toContain('_ga=')
  expect(document.cookie).not.toContain('_gid=')
  expect(document.cookie).toContain('essential=keep')
  expect(document.querySelector('script')).toBeNull()
  expect(JSON.parse(requests[0].send.mock.calls[0][0]).analytics).toBe(false)
  requests[0].status = 200
  requests[0].onload()
  expect(submit).not.toHaveBeenCalled()
  document.querySelector('.js-cookies-rejected .js-hide').click()
  expect(document.querySelector('.js-cookies-banner').hidden).toBe(true)
})

test.each(['', 'https://untrusted.example/script.js'])('does not load an invalid GTM key: %s', (key) => {
  renderBanner(key)
  document.querySelector('.js-cookies-button-accept').click()
  expect(document.querySelector('script')).toBeNull()
})

test.each(['http', 'network'])('falls back to a native POST on %s failure', (failure) => {
  renderBanner()
  document.querySelector('.js-cookies-button-accept').click()
  if (failure === 'http') {
    requests[0].status = 403
    requests[0].onload()
  } else {
    requests[0].onerror()
  }
  expect(submit).toHaveBeenCalledOnce()
})

test('cleans stale analytics cookies only without a banner or GTM', () => {
  document.cookie = '_ga=tracking; path=/'
  renderBanner()
  cookies.cleanupStaleCookies()
  expect(document.cookie).toContain('_ga=')
  document.body.innerHTML = ''
  document.head.innerHTML = '<script src="https://www.googletagmanager.com/gtm.js?id=GTM-TEST123"></script>'
  cookies.cleanupStaleCookies()
  expect(document.cookie).toContain('_ga=')
  document.head.innerHTML = ''
  cookies.cleanupStaleCookies()
  expect(document.cookie).not.toContain('_ga=')
})

test('initialises on pages without a banner and clears tracking on a cached restore', () => {
  const reload = vi.fn()
  vi.stubGlobal('location', { hostname: 'service.example.gov.uk', reload })
  const addEventListener = vi.spyOn(globalThis, 'addEventListener')
  cookies.init()
  const onPageShow = addEventListener.mock.calls.find(([type]) => type === 'pageshow')[1]
  onPageShow({ persisted: false })
  expect(reload).not.toHaveBeenCalled()
  document.cookie = '_ga=tracking; path=/'
  onPageShow({ persisted: true })
  expect(document.cookie).not.toContain('_ga=')
  expect(reload).toHaveBeenCalledOnce()
})
