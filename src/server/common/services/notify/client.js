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
  if (!settings.apiKey || !settings.templateId || !recipient) {
    logger.warn({ ...context, failureReason: 'configuration' }, 'Issue email is not configured')
    throw new Error('Issue email is not configured')
  }
  const client = new NotifyClient(settings.apiKey)
  client.setClient(axios.create({ timeout: REQUEST_TIMEOUT_MS }))
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
      logger.warn({ ...context, attempt, statusCode: error.response?.status, retrying, retryDelayMs: retrying ? wait : undefined }, 'Issue email request failed')
      if (!retrying) {
        throw new Error('Issue email could not be sent')
      }
      await delay(wait)
    }
  }
  throw new Error('Issue email could not be sent')
}
