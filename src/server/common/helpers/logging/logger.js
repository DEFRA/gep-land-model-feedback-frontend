import { pino } from 'pino'

import { loggerOptions } from './logger-options.js'

const logger = pino(loggerOptions)

function createLogger () {
  return logger
}

/**
 * Log an external operation without recording URLs, credentials or payloads.
 * Completion means the response is available; streamed bodies may still be unread.
 * @template T
 * @param {string} service
 * @param {string} operation
 * @param {() => Promise<T>} call
 * @returns {Promise<T>}
 */
async function logExternalCall (service, operation, call) {
  const context = { service, operation }
  const startedAt = performance.now()
  logger.debug(context, 'External API call started')
  try {
    const result = await call()
    const response = /** @type {{ status?: number, statusCode?: number, $metadata?: { httpStatusCode?: number } }} */ (result)
    logger.debug({
      ...context,
      durationMs: performance.now() - startedAt,
      statusCode: response?.status ?? response?.statusCode ?? response?.$metadata?.httpStatusCode
    }, 'External API call completed')
    return result
  } catch (error) {
    // Error messages from upstream libraries can contain credentials or request URLs.
    logger.debug({ ...context, durationMs: performance.now() - startedAt }, 'External API call failed')
    throw error
  }
}

export { createLogger, logExternalCall }
