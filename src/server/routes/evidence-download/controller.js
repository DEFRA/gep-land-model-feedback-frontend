import Boom from '@hapi/boom'
import { config } from '#/config/config.js'
import { getEvidence, getEvidenceMetadata, isMissingEvidence } from '#/server/common/services/evidence/client.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { attachmentDisposition, originalFilename } from '#/server/common/services/evidence/filename.js'
import { logDownload } from './logging.js'

function downloadAccess (request) {
  const role = config.get('evidenceDownload.aadRole').trim()
  const credentials = request.auth.credentials
  const allowAllUsers = config.get('evidenceDownload.allowAllUsers')
  const authenticated = config.get('auth.required') && request.auth.isAuthenticated && credentials?.isAuthenticated
  const allowed = authenticated && (allowAllUsers || (role && Array.isArray(credentials.roles) && credentials.roles.includes(role)))
  return { role, credentials, allowAllUsers, authenticated, allowed }
}

function requireDownloadAccess (request) {
  const { role, credentials, allowAllUsers, authenticated, allowed } = downloadAccess(request)
  // Intentionally log validated identity claims, never session access/refresh tokens.
  logDownload(request, allowed ? 'Evidence download access allowed' : 'Evidence download access denied', {
    userId: credentials?.id,
    claims: credentials?.claims ?? {},
    roles: credentials?.roles ?? [],
    requiredRole: role,
    allowAllUsers,
    authenticated: Boolean(authenticated)
  }, allowed ? 'info' : 'warn')
  if (!allowed) {
    throw Boom.forbidden('You do not have permission to download evidence')
  }
  return credentials
}

async function readEvidence (request, controller, head, userId) {
  try {
    const read = head ? getEvidenceMetadata : getEvidence
    return await read(request.params.uploadId, request.params.fileId, controller.signal)
  } catch (error) {
    controller.abort()
    if (isMissingEvidence(error)) {
      logDownload(request, 'Evidence download file not found', { userId }, 'warn')
      throw Boom.notFound('Evidence file not found')
    }
    logDownload(request, 'Evidence download failed', { userId, reason: 'storage_unavailable' }, 'error')
    throw Boom.serverUnavailable('Evidence is currently unavailable')
  }
}

function readFilename (object, request, controller, head, userId) {
  try {
    const filename = originalFilename(object.Metadata)
    if (!head && !object.Body) {
      throw new Error('Missing evidence content')
    }
    return filename
  } catch {
    controller.abort()
    object.Body?.destroy()
    logDownload(request, 'Evidence download failed', { userId, reason: 'invalid_file_metadata_or_content' }, 'error')
    throw Boom.serverUnavailable('Evidence is currently unavailable')
  }
}

function logStream (request, object, head, userId) {
  logDownload(request, head ? 'Evidence download metadata served' : 'Evidence download started', { userId })
  object.Body?.once('end', () => logDownload(request, 'Evidence download stream ended', { userId }))
  object.Body?.once('error', () => logDownload(request, 'Evidence download stream failed', { userId }, 'error'))
}

function downloadResponse (h, object, filename, head) {
  const response = h.response(head ? null : object.Body)
    .passThrough(false)
    .code(statusCodes.ok)
    .type('application/octet-stream')
    .header('content-disposition', attachmentDisposition(filename))
    .header('cache-control', 'no-store, no-cache, must-revalidate')
    .header('x-content-type-options', 'nosniff')
  if (Number.isSafeInteger(object.ContentLength) && object.ContentLength >= 0) {
    response.header('content-length', String(object.ContentLength))
  }
  return response
}

export async function downloadEvidence (request, h) {
  const credentials = requireDownloadAccess(request)
  const download = { body: null }
  const controller = new AbortController()
  request.raw.res.once('close', () => {
    controller.abort()
    download.body?.destroy()
  })
  const head = request.method === 'head'
  const object = await readEvidence(request, controller, head, credentials.id)
  download.body = object.Body
  const filename = readFilename(object, request, controller, head, credentials.id)
  logStream(request, object, head, credentials.id)
  return downloadResponse(h, object, filename, head)
}
