import Joi from 'joi'
import { config } from '#/config/config.js'
import { logExternalCall } from './logging/logger.js'

async function api (path, options = {}) {
  const response = await logExternalCall('CDP Uploader', options.method ?? 'GET', () => fetch(`${config.get('uploader.apiUrl').replace(/\/$/, '')}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    signal: AbortSignal.timeout(10000)
  }))
  if (!response.ok) {
    await response.body?.cancel()
    throw Object.assign(new Error('CDP Uploader request failed'), { statusCode: response.status })
  }
  return response.json()
}

export function uploadUrl (id) {
  return `${config.get('uploader.publicUrl').replace(/\/$/, '')}/upload-and-scan/${id}`
}

export async function initiateUpload (redirect, token) {
  const result = await api('/initiate', {
    method: 'POST',
    body: JSON.stringify({
      redirect,
      s3Bucket: config.get('uploader.bucket'),
      s3Path: 'evidence',
      maxFileSize: config.get('uploader.maxFileSize'),
      metadata: { evidenceToken: token }
    })
  })
  const { error } = Joi.string().uuid().required().validate(result.uploadId)
  if (error) throw new Error('Invalid CDP Uploader initiation response')
  return result.uploadId
}

export async function getUploadStatus (id, token) {
  // Construct the private endpoint from trusted config, never from browser input or a returned URL.
  const result = await api(`/status/${id}`)
  if (!['initiated', 'pending', 'ready'].includes(result.uploadStatus) || result.metadata?.evidenceToken !== token || !result.form || typeof result.form !== 'object' || Array.isArray(result.form)) {
    throw new Error('Invalid CDP Uploader status response')
  }
  return result
}
