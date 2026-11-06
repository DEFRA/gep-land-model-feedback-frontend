import { setTimeout as delay } from 'node:timers/promises'
import axios from 'axios'
import { NotifyClient } from 'notifications-node-client'

import { config } from '#/config/config.js'
import { logExternalCall } from '../../helpers/logging/logger.js'

const MAX_ATTEMPTS = 3
const REQUEST_TIMEOUT_MS = 10000
const MAX_RETRY_WAIT_MS = 5000
const RETRY_BASE_DELAY_MS = 1000

const retryableCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'EPIPE', 'ERR_NETWORK'])

function retryDelay (error, attempt) {
  const status = error.response?.status
  const temporaryResponse = status === 408 || status === 429 || (status >= 500 && status <= 599)
  const networkFailure = !status && retryableCodes.has(error.code)
  if (!temporaryResponse && !networkFailure) return null
  const retryAfter = error.response?.headers?.['retry-after']
  if (retryAfter !== undefined) {
    const milliseconds = /^\d+(?:\.\d+)?$/.test(String(retryAfter)) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now()
    // Longer outages return control to the user instead of holding the request open.
    if (milliseconds > MAX_RETRY_WAIT_MS) return null
    if (Number.isFinite(milliseconds)) return Math.max(0, milliseconds)
  }
  return RETRY_BASE_DELAY_MS * (2 ** (attempt - 1))
}

/**
 * Send an email through Notify, retrying only temporary failures.
 * @param {{recipient: string, reference: string, personalisation: object}} message
 * @param {import('pino').Logger} logger
 * @returns {Promise<{id: string, recipient: string}>}
 */
export async function sendEmail ({ recipient, reference, personalisation }, logger) {
  const settings = config.get('notify')
  if (!settings.apiKey || !settings.templateId || !recipient) throw new Error('Issue email is not configured')
  const client = new NotifyClient(settings.apiKey)
  client.setClient(axios.create({ timeout: REQUEST_TIMEOUT_MS }))
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await logExternalCall('GOV.UK Notify', 'sendEmail', () => client.sendEmail(settings.templateId, recipient, {
        personalisation,
        reference
      }))
      if (!response.data?.id) throw new Error('Invalid Notify response')
      logger.info({ reference, attempt }, 'Issue email accepted by GOV.UK Notify')
      return { id: response.data.id, recipient }
    } catch (error) {
      const wait = retryDelay(error, attempt)
      const retrying = attempt < MAX_ATTEMPTS && wait !== null
      // SDK errors can include API keys, recipient addresses and submitted answers.
      logger.warn({ reference, attempt, statusCode: error.response?.status, retrying }, 'Issue email request failed')
      if (!retrying) throw new Error('Issue email could not be sent')
      await delay(wait)
    }
  }
}
