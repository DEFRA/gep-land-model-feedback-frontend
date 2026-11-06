/** @vitest-environment jsdom */
import { loadGoogleTagManager, removeAnalyticsCookies, initCookieBanner, initCookiesPage, updateGoogleConsent } from './cookies.js'

const bannerHtml = `
<form action="/cookies" method="post">
  <div class="js-cookies-container" data-crumb="token" data-gtm-key="GTM-TEST123">
    <div class="js-question-banner"><button type="submit" name="analytics" value="true">Accept</button><button type="submit" name="analytics" value="false">Reject</button></div>
    <div class="js-cookies-accepted" hidden><button type="button" class="js-hide">Hide</button></div>
    <div class="js-cookies-rejected" hidden><button type="button" class="js-hide">Hide</button></div>
  </div>
</form>`

function clearCookies () {
  for (const cookie of document.cookie.split(';')) {
    document.cookie = `${cookie.split('=')[0].trim()}=; max-age=0; path=/`
  }
}

beforeEach(() => {
  clearCookies()
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  delete globalThis.dataLayer
  vi.stubGlobal('gtag', vi.fn())
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})
afterEach(() => {
  clearCookies()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('GTM loading', () => {
  test('loads the container only once with its start event', () => {
    loadGoogleTagManager('GTM-TEST123')
    loadGoogleTagManager('GTM-TEST123')
    expect(document.querySelectorAll('script')).toHaveLength(1)
    expect(document.querySelector('script').src).toBe('https://www.googletagmanager.com/gtm.js?id=GTM-TEST123')
    expect(document.querySelector('script').async).toBe(true)
    expect(globalThis.dataLayer).toEqual([{ 'gtm.start': expect.any(Number), event: 'gtm.js' }])
  })
  test.each(['', undefined, 'G-123', 'GTM-<script>', 'gtm-test'])('rejects invalid container %s', (id) => {
    loadGoogleTagManager(id)
    expect(document.querySelector('script')).toBeNull()
  })
})

describe('analytics cleanup', () => {
  test('deletes every analytics family and preserves other cookies', () => {
    for (const name of ['_ga', '_ga_ABC', '_gid', '_gat', '_gat_ABC', '_dc_gtm_ABC', 'essential']) {
      document.cookie = `${name}=value; path=/`
    }
    removeAnalyticsCookies()
    expect(document.cookie).toBe('essential=value')
  })
  test('attempts expiry on the host and every parent domain', () => {
    vi.spyOn(globalThis, 'location', 'get').mockReturnValue({ hostname: 'service.example.gov.uk' })
    const setter = vi.spyOn(document, 'cookie', 'set')
    document.cookie = '_ga=test; path=/'
    setter.mockClear()
    removeAnalyticsCookies()
    for (const domain of ['service.example.gov.uk', '.service.example.gov.uk', '.example.gov.uk', '.gov.uk']) {
      expect(setter).toHaveBeenCalledWith(expect.stringContaining(`domain=${domain}`))
    }
  })
})

describe('banner submissions', () => {
  test('is safe on pages without a banner', () => {
    expect(() => initCookieBanner()).not.toThrow()
  })

  test.each([true, false])('saves choice %s before confirming and loading tracking', async (analytics) => {
    document.body.innerHTML = bannerHtml
    document.cookie = '_ga=old; path=/'
    const append = vi.spyOn(document.head, 'appendChild')
    initCookieBanner()
    document.querySelector(`button[value="${analytics}"]`).click()
    expect(document.querySelector('.js-question-banner').hidden).toBe(false)
    expect(document.querySelector('script')).toBeNull()
    await vi.waitFor(() => expect(document.querySelector('.js-question-banner').hidden).toBe(true))
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/cookies'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analytics, async: true, crumb: 'token' })
    })
    expect(globalThis.gtag).toHaveBeenCalledWith('consent', 'update', {
      analytics_storage: analytics ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    })
    const confirmation = document.querySelector(analytics ? '.js-cookies-accepted' : '.js-cookies-rejected')
    expect(confirmation.hidden).toBe(false)
    expect(document.activeElement).toBe(confirmation)
    confirmation.dispatchEvent(new Event('blur'))
    expect(confirmation.hasAttribute('tabindex')).toBe(false)
    expect(Boolean(document.querySelector('script'))).toBe(analytics)
    if (analytics) {
      expect(globalThis.gtag.mock.invocationCallOrder[0]).toBeLessThan(append.mock.invocationCallOrder[0])
    }
    if (!analytics) {
      expect(document.cookie).not.toContain('_ga')
    }
    confirmation.querySelector('button').click()
    expect(document.querySelector('.js-cookies-container').hidden).toBe(true)
  })

  test.each(['network', 'http'])('falls back to a native form with the chosen preference after %s failure', async (failure) => {
    document.body.innerHTML = bannerHtml
    if (failure === 'network') {
      globalThis.fetch.mockRejectedValue(new Error('offline'))
    } else {
      globalThis.fetch.mockResolvedValue({ ok: false })
    }
    const form = document.querySelector('form')
    const submit = vi.spyOn(form, 'submit').mockImplementation(() => {})
    initCookieBanner()
    document.querySelector('button[value="false"]').click()
    await vi.waitFor(() => expect(submit).toHaveBeenCalledOnce())
    expect(form.querySelector('input[name="analytics"]').value).toBe('false')
    expect(globalThis.gtag).not.toHaveBeenCalled()
    expect(document.querySelector('.js-question-banner').hidden).toBe(false)
    expect(document.querySelector('script')).toBeNull()
  })

  test('does not intercept submissions without a valid choice', () => {
    document.body.innerHTML = bannerHtml
    initCookieBanner()
    const event = new Event('submit', { cancelable: true })
    document.querySelector('form').dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})

describe('page initialisation', () => {
  test('cleans up cookies when no banner or GTM is present', () => {
    document.cookie = '_ga=test; path=/'
    initCookiesPage()
    expect(document.cookie).not.toContain('_ga')
  })
  test.each(['banner', 'gtm'])('preserves cookies when %s is present', (mode) => {
    document.cookie = '_ga=test; path=/'
    if (mode === 'banner') {
      document.body.innerHTML = bannerHtml
    } else {
      loadGoogleTagManager('GTM-TEST123')
    }
    initCookiesPage()
    expect(document.cookie).toContain('_ga')
  })
  test('reloads a restored page to refresh consent', () => {
    const reload = vi.fn()
    vi.spyOn(globalThis, 'location', 'get').mockReturnValue({ hostname: 'localhost', reload })
    let handler
    vi.spyOn(globalThis, 'addEventListener').mockImplementation((name, callback) => {
      if (name === 'pageshow') {
        handler = callback
      }
    })
    initCookiesPage()
    document.cookie = '_ga=test; path=/'
    handler({ persisted: false })
    expect(reload).not.toHaveBeenCalled()
    handler({ persisted: true })
    expect(reload).toHaveBeenCalledOnce()
    expect(document.cookie).not.toContain('_ga')
  })
})

describe('consent updates', () => {
  test('is safe when no Google tag is configured', () => {
    vi.stubGlobal('gtag', undefined)
    expect(() => updateGoogleConsent(true)).not.toThrow()
  })

  test.each([true, false])('preference form updates consent to %s before navigation', (analytics) => {
    document.body.innerHTML = `<form id="cookies-form"><input name="analytics" value="${analytics}" type="radio" checked></form>`
    initCookiesPage()
    document.cookie = '_ga=test; path=/'
    document.querySelector('form').dispatchEvent(new Event('submit'))
    expect(globalThis.gtag).toHaveBeenCalledWith('consent', 'update', {
      analytics_storage: analytics ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    })
    expect(document.cookie.includes('_ga')).toBe(analytics)
  })

  test('leaves consent unchanged when no preference is selected', () => {
    document.body.innerHTML = '<form id="cookies-form"></form>'
    initCookiesPage()
    document.querySelector('form').dispatchEvent(new Event('submit'))
    expect(globalThis.gtag).not.toHaveBeenCalled()
  })
})
