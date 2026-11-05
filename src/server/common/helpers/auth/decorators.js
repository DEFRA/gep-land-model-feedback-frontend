import { config } from '../../../../config/config.js'

const sessionCookieName = config.get('session.cookie.name')

/**
 * @param {string} [sessionId]
 * @returns {Promise<import('./user-session.js').UserSession | null>}
 */
async function getUserSession (
  sessionId = this.state?.[sessionCookieName]?.sessionId
) {
  return sessionId ? this.server.session.get(sessionId) : null
}

export { getUserSession }
