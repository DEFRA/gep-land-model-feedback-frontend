import axios from 'axios'
import { NotifyClient } from 'notifications-node-client'
import { setTimeout as delay } from 'node:timers/promises'
import { config } from '#/config/config.js'
import { logExternalCall } from '#/server/common/helpers/logging/logger.js'

const retryableCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'EPIPE', 'ERR_NETWORK'])

function retryDelay (error, attempt) {
  const status = error.response?.status
  if (!(status === 408 || status === 429 || (status >= 500 && status <= 599) || (!status && retryableCodes.has(error.code)))) return null
  const retryAfter = error.response?.headers?.['retry-after']
  if (retryAfter !== undefined) {
    const milliseconds = /^\d+(?:\.\d+)?$/.test(String(retryAfter)) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now()
    // Longer outages return control to the user instead of holding the request open.
    if (milliseconds > 5000) return null
    if (Number.isFinite(milliseconds)) return Math.max(0, milliseconds)
  }
  return 1000 * (2 ** (attempt - 1))
}

export async function sendIssueEmail (report, rows, logger) {
  const settings = config.get('notify')
  const recipient = config.get('supportMailboxAddress')
  if (!settings.apiKey || !settings.templateId || !recipient) throw new Error('Issue email is not configured')
  const client = new NotifyClient(settings.apiKey)
  client.setClient(axios.create({ timeout: 10000 }))
  const personalisation = {
    email_subject: `${settings.emailSubject.trim()} - ${report.reference}`,
    reference: report.reference,
    answers: rows.map(({ label, lines }) => `${label}:\n${lines.join('\n')}`).join('\n\n'),
    file_downloads: report.answers.files.length
      ? report.answers.files.map(file => `${file.filename}: Download link not yet available`).join('\n')
      : 'No files added'
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await logExternalCall('GOV.UK Notify', 'sendEmail', () => client.sendEmail(settings.templateId, recipient, {
        personalisation,
        reference: report.id
      }))
      if (!response.data?.id) throw new Error('Invalid Notify response')
      logger.info({ reference: report.reference, attempt }, 'Issue email accepted by GOV.UK Notify')
      return { id: response.data.id, recipient }
    } catch (error) {
      const wait = retryDelay(error, attempt)
      const retrying = attempt < 3 && wait !== null
      // SDK errors can include API keys, recipient addresses and submitted answers.
      logger.warn({ reference: report.reference, attempt, statusCode: error.response?.status, retrying }, 'Issue email request failed')
      if (!retrying) throw new Error('Issue email could not be sent')
      await delay(wait)
    }
  }
}
