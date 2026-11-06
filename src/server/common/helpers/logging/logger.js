import { pino } from 'pino'

import { loggerOptions } from './logger-options.js'

const logger = pino(loggerOptions)

function createLogger () {
  return logger
}

function statusCodeOf (value) {
  const status = value?.status ?? value?.statusCode ?? value?.$metadata?.httpStatusCode ?? value?.response?.status ?? value?.response?.statusCode ?? value?.cause?.status
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined
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
    const statusCode = statusCodeOf(result)
    const failed = statusCode >= 400
    const summary = {
      ...context,
      durationMs: performance.now() - startedAt,
      statusCode,
      outcome: failed ? 'failure' : 'success'
    }
    logger.info(summary, failed ? 'External API call failed' : 'External API call completed')
    logger.debug(summary, 'External API call completed')
    return result
  } catch (error) {
    // Error messages from upstream libraries can contain credentials or request URLs.
    const summary = {
      ...context,
      durationMs: performance.now() - startedAt,
      statusCode: statusCodeOf(error),
      outcome: 'failure'
    }
    logger.info(summary, 'External API call failed')
    logger.debug(summary, 'External API call failed')
    throw error
  }
}

export { createLogger, logExternalCall }
