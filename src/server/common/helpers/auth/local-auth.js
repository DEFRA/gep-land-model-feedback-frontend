import { config } from '#/config/config.js'

/** Return a loopback bind address only when local authentication is explicitly disabled. */
export function getLocalAuthBypassHost () {
  if (config.get('auth.required') || !config.get('isDevelopment')) {
    return null
  }
  try {
    const { hostname } = new URL(config.get('appBaseUrl'))
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '127.0.0.1'
    }
    return hostname === '[::1]' ? '::1' : null
  } catch {
    return null
  }
}
