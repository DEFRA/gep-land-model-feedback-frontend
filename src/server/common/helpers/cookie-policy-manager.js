import { config } from '#/config/config.js'

const cookieNamePolicy = config.get('cookieConsent.name')
const cookiePolicy = config.get('cookieConsent.policy')
const cookieConfig = config.get('cookieConsent.config')

function getCurrentPolicy (request, h) {
  let cookiesPolicy = request.state[cookieNamePolicy]

  if (cookiesPolicy?.essential !== true ||
      typeof cookiesPolicy?.confirmed !== 'boolean' ||
      typeof cookiesPolicy?.analytics !== 'boolean') {
    cookiesPolicy = createDefaultPolicy(h)
  }

  return cookiesPolicy
}

function createDefaultPolicy (h) {
  const cookiesPolicy = { confirmed: false, essential: true, analytics: false }

  h.state(cookieNamePolicy, cookiesPolicy, { ...cookiePolicy, ...cookieConfig })

  return cookiesPolicy
}

function updatePolicy (request, h, analytics) {
  const cookiesPolicy = getCurrentPolicy(request, h)

  cookiesPolicy.analytics = analytics
  cookiesPolicy.confirmed = true

  h.state(cookieNamePolicy, cookiesPolicy, { ...cookiePolicy, ...cookieConfig })

  if (!analytics) {
    removeAnalytics(request, h)
  }
}

function removeAnalytics (request, h) {
  const googleCookiesRegex = /^_ga$|^_ga_.*$|^_gid$|^_gat(?:_.*)?$|^_dc_gtm_.*$/

  for (const cookieName of Object.keys(request.state)) {
    if (googleCookiesRegex.test(cookieName)) {
      h.unstate(cookieName)
    }
  }
}

export { getCurrentPolicy, updatePolicy, removeAnalytics }
