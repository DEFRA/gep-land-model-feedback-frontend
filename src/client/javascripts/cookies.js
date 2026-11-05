const GA_COOKIE_PREFIXES = ['_ga', '_gid', '_gat', '_dc_gtm_']

export function updateGoogleConsent (analytics) {
  // The head snippet defines gtag and queues defaults before GTM can load.
  globalThis.gtag?.('consent', 'update', {
    analytics_storage: analytics ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  })
}

export function loadGoogleTagManager (containerId) {
  if (!/^GTM-[A-Z0-9]+$/.test(containerId || '') ||
      document.querySelector('script[src*="googletagmanager.com/gtm.js"]')) {
    return
  }

  globalThis.dataLayer = globalThis.dataLayer || []
  globalThis.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
  const script = document.createElement('script')
  script.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}`
  script.async = true
  document.head.appendChild(script)
}

export function removeAnalyticsCookies () {
  const hostname = globalThis.location.hostname
  const parts = hostname.split('.')
  const domains = new Set([hostname, `.${hostname}`])
  for (let i = 1; i < parts.length - 1; i++) {
    domains.add(`.${parts.slice(i).join('.')}`)
  }

  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0].trim()
    if (GA_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix))) {
      document.cookie = `${name}=; path=/; max-age=0`
      for (const domain of domains) {
        document.cookie = `${name}=; path=/; max-age=0; domain=${domain}`
      }
    }
  }
}

export function initCookieBanner () {
  /** @type {HTMLElement | null} */
  const banner = document.querySelector('.js-cookies-container')
  if (!banner) {
    return
  }

  const form = banner.closest('form')
  form.addEventListener('submit', async (event) => {
    const choice = event.submitter instanceof globalThis.HTMLButtonElement ? event.submitter.value : undefined
    if (choice !== 'true' && choice !== 'false') {
      return
    }
    event.preventDefault()
    const analytics = choice === 'true'

    try {
      const response = await globalThis.fetch(form.action, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analytics, async: true, crumb: banner.dataset.crumb })
      })
      if (!response.ok) {
        throw new Error('Cookie preference could not be saved')
      }
    } catch {
      // Native submit omits the clicked button, so preserve its value explicitly.
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = 'analytics'
      input.value = choice
      form.appendChild(input)
      form.submit()
      return
    }

    updateGoogleConsent(analytics)
    if (analytics) {
      loadGoogleTagManager(banner.dataset.gtmKey)
    } else {
      removeAnalyticsCookies()
    }
    const question = /** @type {HTMLElement} */ (banner.querySelector('.js-question-banner'))
    question.hidden = true
    /** @type {HTMLElement} */
    const confirmation = banner.querySelector(analytics ? '.js-cookies-accepted' : '.js-cookies-rejected')
    confirmation.hidden = false
    confirmation.setAttribute('tabindex', '-1')
    confirmation.focus()
    confirmation.addEventListener('blur', () => confirmation.removeAttribute('tabindex'), { once: true })
  })

  for (const button of banner.querySelectorAll('.js-hide')) {
    button.addEventListener('click', () => { banner.hidden = true })
  }
}

export function initCookiesPage () {
  document.getElementById('cookies-form')?.addEventListener('submit', () => {
    /** @type {HTMLInputElement | null} */
    const selected = document.querySelector('#cookies-form input[name="analytics"]:checked')
    if (selected) {
      const analytics = selected.value === 'true'
      updateGoogleConsent(analytics)
      if (!analytics) {
        removeAnalyticsCookies()
      }
    }
  })

  // Remove stale cookies on pages rendered without analytics, including after withdrawal.
  if (!document.querySelector('.js-cookies-container') &&
      !document.querySelector('script[src*="googletagmanager.com/gtm.js"]')) {
    removeAnalyticsCookies()
  }

  globalThis.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      removeAnalyticsCookies()
      globalThis.location.reload()
    }
  })
}
