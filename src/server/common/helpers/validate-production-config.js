/** Refuse development authentication and weak session settings in deployed services. */
export function validateProductionConfig (config) {
  if (!config.get('isProduction') || config.get('isTest')) return

  const password = config.get('session.cookie.password')
  if (typeof password !== 'string' || password.trim().length < 32 || password === 'the-password-must-be-at-least-32-characters-long') {
    throw new Error('Production requires a unique SESSION_COOKIE_PASSWORD of at least 32 characters')
  }
  if (!config.get('session.cookie.secure')) {
    throw new Error('Production requires SESSION_COOKIE_SECURE=true')
  }
  if (!config.get('cognito.enabled') || !config.get('cognito.identityPoolId')) {
    throw new Error('Production requires Cognito client assertions and a configured identity pool')
  }
  for (const name of ['appBaseUrl', 'oidc.wellKnownConfigurationUrl']) {
    let url
    try {
      url = new URL(config.get(name))
    } catch {
      throw new Error(`Production requires a valid HTTPS URL for ${name}`)
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
      throw new Error(`Production requires a trusted HTTPS URL without credentials or fragments for ${name}`)
    }
  }
}
