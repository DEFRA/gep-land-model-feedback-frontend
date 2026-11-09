import { createLogger, logExternalCall } from '../logging/logger.js'
import * as openid from 'openid-client'
import Boom from '@hapi/boom'

import { config } from '../../../../config/config.js'
import { asExternalUrl } from '../url/url-helpers.js'
import { getSafeRedirect } from '../get-safe-redirect.js'

const logger = createLogger()
const SIGN_IN_FAILURE_MESSAGE = 'Unable to sign in. Try again.'
const callbackPath = '/auth/callback'
const authPathPrefix = '/auth/'
const schemeName = 'federated-oidc'

const federatedOidc = {
  plugin: {
    name: schemeName,
    dependencies: ['oidc-client'],
    register: (server) => {
      const options = {
        redirectUri: config.get('appBaseUrl') + callbackPath,
        sessionName: 'oidc-auth',
        scope: server.oidc.scope
      }

      server.auth.scheme(schemeName, scheme)
      server.auth.strategy(schemeName, schemeName, options)
    }
  }
}

export { federatedOidc }

function scheme (_server, options) {
  return {
    authenticate: async function (request, h) {
      if (request.query.error) {
        logger.error('OIDC authorization error')
        return Boom.unauthorized(SIGN_IN_FAILURE_MESSAGE)
      }

      let oidcConfig
      try {
        oidcConfig = await request.server.oidc.getConfig()
      } catch (error) {
        logOidcFailure(error, 'OIDC discovery failed')
        return Boom.unauthorized(SIGN_IN_FAILURE_MESSAGE)
      }

      const isPreLogin = !request.query.code

      if (isPreLogin) {
        try {
          const redirectTo = await preLogin(request, oidcConfig, options)
          return h.redirect(redirectTo).takeover()
        } catch (e) {
          logOidcFailure(e, 'OIDC pre-login failed')
          return Boom.unauthorized(SIGN_IN_FAILURE_MESSAGE)
        }
      } else {
        try {
          const credentials = await postLogin(request, oidcConfig, options)
          return h.authenticated({ credentials })
        } catch (e) {
          logOidcFailure(e, 'OIDC post-login failed')
          return Boom.unauthorized(SIGN_IN_FAILURE_MESSAGE)
        }
      }
    }
  }
}

function logOidcFailure (error, message) {
  const oidcError = oidcErrorDetails(error)
  logger.error({ oidcError }, message)
  // Keep diagnostics visible when the hosting log pipeline drops custom fields.
  console.error(`${message}: ${JSON.stringify(oidcError)}`)
}

function oidcErrorDetails (error) {
  const cause = error?.cause
  // Select diagnostic fields instead of logging tokens, requests or entire causes.
  return {
    name: error?.name,
    message: error?.message,
    code: error?.code,
    statusCode: error?.status ?? error?.response?.status,
    oauthError: error?.error ?? cause?.error,
    oauthDescription: error?.error_description ?? cause?.error_description,
    causeCode: cause?.code,
    correlationId: cause?.correlation_id,
    traceId: cause?.trace_id
  }
}

/**
 * @param {import('@hapi/hapi').Request} request
 * @param {import('openid-client').Configuration} oidcConfig
 * @param {{redirectUri: string, scope: string, sessionName: string}} options
 * @returns {Promise<URL>}
 */
async function preLogin (request, oidcConfig, options) {
  const codeVerifier = openid.randomPKCECodeVerifier()
  const codeChallenge = await openid.calculatePKCECodeChallenge(codeVerifier)
  let nonce

  const parameters = {
    redirect_uri: options.redirectUri,
    scope: options.scope,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  }

  if (!oidcConfig.serverMetadata().supportsPKCE()) {
    logger.debug('OIDC metadata does not advertise S256 PKCE; adding a nonce')
    nonce = openid.randomNonce()
    parameters.nonce = nonce
  }

  const referrer = getReturnPath(request)

  request.yar.set(options.sessionName, {
    codeVerifier,
    nonce,
    referrer
  })

  return openid.buildAuthorizationUrl(oidcConfig, parameters)
}

/**
 * @param {import('@hapi/hapi').Request} request
 * @param {import('openid-client').Configuration} oidcConfig
 * @param {{sessionName: string}} options
 * @returns {Promise<{expiresIn: number, accessToken: string, refreshToken: string, idToken: string, claims: object, referrer: string | undefined}>}
 */
async function postLogin (request, oidcConfig, options) {
  const state = request.yar.get(options.sessionName, true)
  const { codeVerifier, nonce, referrer } = state || /** @type {any} */ ({})
  if (!codeVerifier) {
    throw Boom.unauthorized('No verifier set in session, try logging in again.')
  }

  const currentUrl = asExternalUrl(request.url, config.get('appBaseUrl'))

  logger.info('Exchanging authorization code for tokens')
  const token = await logExternalCall('OIDC', 'authorizationCodeGrant', () => openid.authorizationCodeGrant(oidcConfig, currentUrl, {
    pkceCodeVerifier: codeVerifier,
    expectedNonce: nonce,
    idTokenExpected: true
  }))

  const expiresIn = token.expiresIn()
  if (!expiresIn || !token.refresh_token) {
    throw Boom.unauthorized('Token response missing required fields (expires_in or refresh_token)')
  }

  const claims = token.claims()
  return {
    expiresIn,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    idToken: token.id_token,
    claims,
    referrer
  }
}

/**
 * Path to return to after login, from the `next` query param that the session
 * strategy's `appendNext` adds.
 * @param {import('@hapi/hapi').Request} request
 * @returns {string}
 */
function getReturnPath (request) {
  const path = getSafeRedirect(request.query?.next)
  if (path.startsWith(authPathPrefix)) {
    return '/'
  }

  return path
}
