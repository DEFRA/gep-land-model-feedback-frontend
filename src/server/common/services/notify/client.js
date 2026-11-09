import { setTimeout as delay } from 'node:timers/promises'
import axios from 'axios'
import { NotifyClient } from 'notifications-node-client'

import { statusCodes, MAX_HTTP_STATUS } from '#/server/common/constants/status-codes.js'
import { MILLISECONDS_PER_SECOND } from '#/server/common/constants/units.js'
import { config } from '#/config/config.js'
import { logExternalCall } from '../../helpers/logging/logger.js'

const MAX_ATTEMPTS = 3
const REQUEST_TIMEOUT_MS = 10000
const MAX_RETRY_WAIT_MS = 5000
const RETRY_BASE_DELAY_MS = 1000
const RETRY_BACKOFF_MULTIPLIER = 2

const retryableCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'EPIPE', 'ERR_NETWORK'])

const notifyFailureReasons = new Map([
  ['Error: Your system clock must be accurate to within 30 seconds', 'clock_mismatch'],
  ['Invalid token: API key revoked', 'api_key_revoked'],
  ['Invalid token: API key not found', 'api_key_invalid'],
  ['Invalid token: signature, api token not found', 'api_key_invalid'],
  ["Can't send to this recipient using a team-only API key", 'recipient_restricted'],
  ["Can't send to this recipient when service is in trial mode", 'recipient_restricted'],
  ["Can't send to this recipient when service is in trial mode - see https://www.notifications.service.gov.uk/trial-mode", 'recipient_restricted']
])

function failureDiagnostics (error) {
  const errors = error.response?.data?.errors
  if (!Array.isArray(errors)) {
    return {}
  }
  // Emit only fixed categories; upstream messages can contain private values.
  const failureReason = errors.map(entry => notifyFailureReasons.get(entry?.message)).find(Boolean)
  return failureReason ? { failureReason } : {}
}

function isTemporaryFailure (error) {
  const status = error.response?.status
  return status === statusCodes.requestTimeout ||
    status === statusCodes.tooManyRequests ||
    (status >= statusCodes.internalServerError && status <= MAX_HTTP_STATUS) ||
    (!status && retryableCodes.has(error.code))
}

function retryDelay (error, attempt) {
  if (!isTemporaryFailure(error)) {
    return null
  }
  const retryAfter = error.response?.headers?.['retry-after']
  if (retryAfter !== undefined) {
    const milliseconds = /^\d+(?:\.\d+)?$/.test(String(retryAfter)) ? Number(retryAfter) * MILLISECONDS_PER_SECOND : Date.parse(retryAfter) - Date.now()
    // Longer outages return control to the user instead of holding the request open.
    if (milliseconds > MAX_RETRY_WAIT_MS) {
      return null
    }
    if (Number.isFinite(milliseconds)) {
      return Math.max(0, milliseconds)
    }
  }
  return RETRY_BASE_DELAY_MS * (RETRY_BACKOFF_MULTIPLIER ** (attempt - 1))
}

/**
 * Send an email through Notify, retrying only temporary failures.
 * @param {{recipient: string, reference: string, personalisation: object, recipientType?: 'support' | 'submitter'}} message
 * @param {import('pino').Logger} logger
 * @returns {Promise<{id: string, recipient: string}>}
 */
export async function sendEmail ({ recipient, reference, personalisation, recipientType = 'support' }, logger) {
  const settings = config.get('notify')
  const audience = recipientType === 'submitter' ? 'submitter' : 'support'
  const context = { reference, recipientType: audience }
  const operation = audience === 'submitter' ? 'send submitter copy' : 'send support email'
  const client = createNotifyClient(settings, recipient, context, logger)
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await logExternalCall('GOV.UK Notify', operation, () => client.sendEmail(settings.templateId, recipient, {
        personalisation,
        reference
      }))
      if (!response.data?.id) {
        throw new Error('Invalid Notify response')
      }
      logger.info({ ...context, attempt, notificationId: response.data.id }, 'Issue email accepted by GOV.UK Notify')
      return { id: response.data.id, recipient }
    } catch (error) {
      const wait = retryDelay(error, attempt)
      const retrying = attempt < MAX_ATTEMPTS && wait !== null
      // SDK errors can include API keys, recipient addresses and submitted answers.
      logger.warn({ ...context, attempt, statusCode: error.response?.status, ...failureDiagnostics(error), retrying, retryDelayMs: retrying ? wait : undefined }, 'Issue email request failed')
      if (!retrying) {
        throw new Error('Issue email could not be sent')
      }
      await delay(wait)
    }
  }
  throw new Error('Issue email could not be sent')
}

function createNotifyClient (settings, recipient, context, logger) {
  if (!settings.apiKey || !settings.templateId || !recipient) {
    logger.warn({ ...context, failureReason: 'configuration' }, 'Issue email is not configured')
    throw new Error('Issue email is not configured')
  }
  const client = new NotifyClient(settings.apiKey)
  client.setClient(axios.create({ timeout: REQUEST_TIMEOUT_MS }))
  return client
}
