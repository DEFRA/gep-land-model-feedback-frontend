import { pino } from 'pino'
import { statusCodes, MIN_HTTP_STATUS, MAX_HTTP_STATUS } from '../../constants/status-codes.js'

import { loggerOptions } from './logger-options.js'

const EXTERNAL_CALL_FAILED_MESSAGE = 'External API call failed'
const EXTERNAL_CALL_COMPLETED_MESSAGE = 'External API call completed'

const logger = pino(loggerOptions)

function createLogger () {
  return logger
}

function statusCodeOf (value) {
  const status = value?.status ?? value?.statusCode ?? value?.$metadata?.httpStatusCode ?? value?.response?.status ?? value?.response?.statusCode ?? value?.cause?.status
  return Number.isInteger(status) && status >= MIN_HTTP_STATUS && status <= MAX_HTTP_STATUS ? status : undefined
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
    const failed = statusCode >= statusCodes.badRequest
    const summary = {
      ...context,
      durationMs: performance.now() - startedAt,
      statusCode,
      outcome: failed ? 'failure' : 'success'
    }
    logger.info(summary, failed ? EXTERNAL_CALL_FAILED_MESSAGE : EXTERNAL_CALL_COMPLETED_MESSAGE)
    logger.debug(summary, EXTERNAL_CALL_COMPLETED_MESSAGE)
    return result
  } catch (error) {
    // Error messages from upstream libraries can contain credentials or request URLs.
    const summary = {
      ...context,
      durationMs: performance.now() - startedAt,
      statusCode: statusCodeOf(error),
      outcome: 'failure'
    }
    logger.info(summary, EXTERNAL_CALL_FAILED_MESSAGE)
    logger.debug(summary, EXTERNAL_CALL_FAILED_MESSAGE)
    throw error
  }
}

export { createLogger, logExternalCall }
