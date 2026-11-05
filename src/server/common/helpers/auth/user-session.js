import { addSeconds, isPast, parseISO } from 'date-fns'
import { config } from '../../../../config/config.js'

const sessionCookieName = config.get('session.cookie.name')

/**
 * @typedef {object} UserSession
 * @property {string} id
 * @property {string} [email]
 * @property {string} displayName
 * @property {string} [loginHint]
 * @property {boolean} isAuthenticated
 * @property {string} accessToken
 * @property {string} refreshToken
 * @property {number} expiresIn
 * @property {string} expiresAt
 */

/**
 * @typedef {object} AuthClaims
 * @property {string} oid
 * @property {string} [name]
 * @property {string} [email]
 * @property {string} [preferred_username]
 * @property {string} [login_hint]
 */

/**
 * @typedef {object} AuthCredentials
 * @property {number} expiresIn
 * @property {AuthClaims} claims
 * @property {string} accessToken
 * @property {string} refreshToken
 */

/**
 * @typedef {object} SessionCache
 * @property {(key: string, value: UserSession) => Promise<void>} set
 * @property {(key: string) => Promise<void> | void} [drop]
 */

/**
 * @typedef {object} SessionRequest
 * @property {{ session: SessionCache }} server
 * @property {Record<string, { sessionId?: string }>} [state]
 * @property {{ isAuthenticated: boolean, credentials: AuthCredentials }} [auth]
 * @property {{ info: (message: string) => void, debug?: (message: string) => void }} [logger]
 * @property {{ clear: () => void, h?: { unstate: (name: string) => void } }} [sessionCookie]
 */

/**
 * Clear user session - drops session from cache and unsets cookie.
 * @param {SessionRequest} request
 */
async function clearUserSession (request) {
  const sessionId = request.state?.[sessionCookieName]?.sessionId
  if (sessionId && request.server.session.drop) {
    await request.server.session.drop(sessionId)
  }

  if (request.sessionCookie?.h) {
    request.sessionCookie.clear()
    request.sessionCookie.h.unstate(sessionCookieName)
  }
  request.logger?.debug?.('User session cleared')
}

/**
 * Create user session from auth credentials.
 * @param {SessionRequest} request
 * @param {string} sessionId
 * @returns {Promise<UserSession>}
 */
async function createUserSession (request, sessionId) {
  const credentials = request.auth.credentials
  const expiresInSeconds = credentials.expiresIn
  const expiresInMilliSeconds = expiresInSeconds * 1000
  const expiresAt = addSeconds(new Date(), expiresInSeconds).toISOString()

  const claims = credentials.claims

  const session = {
    id: claims.oid,
    displayName: claims.name ?? '',
    email: claims.email ?? claims.preferred_username,
    loginHint: claims.login_hint,
    isAuthenticated: request.auth.isAuthenticated,
    accessToken: credentials.accessToken,
    refreshToken: credentials.refreshToken,
    expiresIn: expiresInMilliSeconds,
    expiresAt
  }

  await request.server.session.set(sessionId, session)
  request.logger?.debug?.('User session created')
  return session
}

/**
 * Update user session with a new token response.
 * @param {SessionRequest} request
 * @param {{access_token: string, refresh_token?: string, expires_in?: number}} refreshTokenResponse
 * @param {UserSession} previousSession
 * @returns {Promise<UserSession>}
 */
async function updateUserSession (request, refreshTokenResponse, previousSession) {
  const expiresInSeconds = refreshTokenResponse.expires_in
  if (!Number.isFinite(expiresInSeconds)) {
    throw new TypeError('Refresh token response did not include expires_in')
  }

  const expiresInMilliSeconds = expiresInSeconds * 1000
  const expiresAt = addSeconds(new Date(), expiresInSeconds).toISOString()

  const session = {
    ...previousSession,
    accessToken: refreshTokenResponse.access_token,
    refreshToken: refreshTokenResponse.refresh_token ?? previousSession.refreshToken,
    expiresIn: expiresInMilliSeconds,
    expiresAt
  }

  const sessionId = request.state?.[sessionCookieName]?.sessionId
  await request.server.session.set(sessionId, session)

  request.logger.info(
    `User session refreshed, UserId: ${session.id}, displayName: ${session.displayName}`
  )

  return session
}

/**
 * @param {(refreshToken: string) => Promise<{access_token: string, refresh_token?: string, expires_in?: number}>} refreshToken
 * @param {SessionRequest} request
 * @param {UserSession} userSession
 * @returns {Promise<UserSession | undefined>}
 */
async function refreshTokenIfExpired (refreshToken, request, userSession) {
  if (!isPast(parseISO(userSession.expiresAt))) {
    return undefined
  }

  request.logger.info(
    `Token for user ${userSession.displayName} has expired, attempting to refresh`
  )

  try {
    const refreshTokenResponse = await refreshToken(userSession.refreshToken)
    return await updateUserSession(request, refreshTokenResponse, userSession)
  } catch (error) {
    await clearUserSession(request)
    throw error
  }
}

export {
  createUserSession,
  updateUserSession,
  clearUserSession,
  refreshTokenIfExpired
}
