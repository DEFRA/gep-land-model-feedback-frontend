import { runInNewContext } from 'node:vm'
import { load } from 'cheerio'
import { vi } from 'vitest'

describe.each([undefined, '', 'GTM-TEST123'])('analytics configuration %s', (key) => {
  let server
  let cookieName
  const policy = (analytics, confirmed = true) => `${cookieName}=${Buffer.from(JSON.stringify({ essential: true, confirmed, analytics })).toString('base64')}`

  beforeAll(async () => {
    vi.stubEnv('GOOGLE_TAG_MANAGER_KEY', key)
    vi.resetModules()
    const { createServer } = await import('../../server.js')
    const { config } = await import('#/config/config.js')
    cookieName = config.get('cookieConsent.name')
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    vi.unstubAllEnvs()
  })

  test('only asks for optional cookies on other pages when GTM is configured', async () => {
    const response = await server.inject('/')
    expect(response.statusCode).toBe(200)
    const $ = load(response.payload)
    expect($('.js-cookies-container')).toHaveLength(key ? 1 : 0)
    expect(response.payload).not.toContain('gtm.start')
    if (key) expect($('input[name="returnUrl"]').val()).toBe('/')
  })

  test('always hides the banner on the cookies page and gates optional controls', async () => {
    const response = await server.inject('/cookies')
    expect(response.statusCode).toBe(200)
    const $ = load(response.payload)
    expect($('.js-cookies-container')).toHaveLength(0)
    expect(response.payload).toContain('Essential cookies')
    expect(response.payload).toContain(cookieName)
    expect($('#cookies-form input[name="analytics"]')).toHaveLength(key ? 2 : 0)
    expect(response.payload.includes('Analytics cookies (optional)')).toBe(Boolean(key))
    expect(response.payload.includes('Change your cookie settings')).toBe(Boolean(key))
    expect(response.payload.includes('_ga')).toBe(Boolean(key))
  })

  test.each([true, false])('loads GTM only with configuration and confirmed consent (%s)', async (analytics) => {
    const response = await server.inject({ url: '/', headers: { cookie: policy(analytics) } })
    expect(response.statusCode).toBe(200)
    const $ = load(response.payload)
    const tracking = $('script').filter((_, script) => $(script).text().includes('gtm.start'))
    expect(tracking).toHaveLength(key && analytics ? 1 : 0)
    if (key && analytics) {
      expect(tracking.text()).toContain(key)
      expect(response.headers['content-security-policy']).toContain(`'nonce-${tracking.attr('nonce')}'`)
      expect($('noscript').html()).toContain('https://www.googletagmanager.com/ns.html?id=' + key)
    }
    expect($('.js-cookies-container')).toHaveLength(0)
  })

  test('native consent submissions preserve the original query string', async () => {
    if (!key) return
    const response = await server.inject('/?q=water&sort=titleAsc')
    const $ = load(response.payload)
    expect($('input[name="returnUrl"]').val()).toBe('/?q=water&sort=titleAsc')
    const result = await server.inject({
      method: 'POST',
      url: '/cookies',
      headers: { cookie: response.headers['set-cookie'].map((value) => value.split(';')[0]).join('; ') },
      payload: { analytics: 'true', async: 'false', crumb: $('input[name="crumb"]').val(), returnUrl: $('input[name="returnUrl"]').val() }
    })
    expect(result.statusCode).toBe(302)
    expect(result.headers.location).toBe('/?q=water&sort=titleAsc')
  })

  test('queues Consent Mode defaults before any GTM load', async () => {
    const response = await server.inject({ url: '/', headers: { cookie: policy(true) } })
    const $ = load(response.payload)
    const script = $('script').filter((_, element) => $(element).text().includes("'consent', 'default'"))
    expect(script).toHaveLength(key ? 1 : 0)
    if (!key) return
    const window = {}
    runInNewContext(script.text(), { window, gtag: (...args) => window.gtag(...args) })
    const consent = window.dataLayer.map((args) => Array.from(args))
    expect(consent).toEqual([
      ['consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }],
      ['consent', 'update', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]
    ])
    expect(response.headers['content-security-policy']).toContain(`'nonce-${script.attr('nonce')}'`)
    expect(response.payload.indexOf("'consent', 'default'")).toBeLessThan(response.payload.indexOf('gtm.start'))
  })

  test('does not load tracking for an unconfirmed preference', async () => {
    const response = await server.inject({ url: '/', headers: { cookie: policy(true, false) } })
    expect(response.statusCode).toBe(200)
    expect(response.payload).not.toContain('gtm.start')
    expect(load(response.payload)('.js-cookies-container')).toHaveLength(key ? 1 : 0)
  })

  test.each(['invalid-json', Buffer.from('null').toString('base64'), Buffer.from('{"essential":true,"confirmed":true,"analytics":"true"}').toString('base64')])('safely resets invalid consent %s', async (value) => {
    const response = await server.inject({ url: '/', headers: { cookie: `${cookieName}=${value}` } })
    expect(response.statusCode).toBe(200)
    expect(response.payload).not.toContain('gtm.start')
    const cookie = response.headers['set-cookie'].find((value) => value.startsWith(`${cookieName}=`))
    const decoded = JSON.parse(Buffer.from(cookie.split(';')[0].slice(cookieName.length + 1), 'base64').toString())
    expect(decoded).toEqual({ essential: true, confirmed: false, analytics: false })
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Path=/')
  })
})
