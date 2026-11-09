import Boom from '@hapi/boom'
import { logDownload } from './logging.js'
import Joi from 'joi'
import { config } from '#/config/config.js'
import { getEvidence } from '#/server/common/services/evidence/client.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { attachmentDisposition, originalFilename } from '#/server/common/services/evidence/filename.js'

export const evidenceDownload = {
  plugin: {
    name: 'evidence-download',
    register (server) {
      server.route({
        method: 'GET',
        path: '/evidence/download/{uploadId}/{fileId}',
        options: {
          // Auth bypass must never expose evidence. The handler denies all access in that mode.
          auth: config.get('auth.required') ? { strategy: 'session', mode: 'required' } : false,
          validate: {
            params: Joi.object({ uploadId: Joi.string().uuid().required(), fileId: Joi.string().uuid().required() })
          }
        },
        async handler (request, h) {
          const role = config.get('evidenceDownload.aadRole').trim()
          const credentials = request.auth.credentials
          const allowAllUsers = config.get('evidenceDownload.allowAllUsers')
          const authenticated = config.get('auth.required') && request.auth.isAuthenticated && credentials?.isAuthenticated
          const allowed = authenticated && (allowAllUsers || (role && Array.isArray(credentials.roles) && credentials.roles.includes(role)))
          // Intentionally log the validated identity claims for role/group diagnostics.
          // Never log the session credentials, access token or refresh token.
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
          let object
          try {
            object = await getEvidence(request.params.uploadId, request.params.fileId)
          } catch (error) {
            if (error?.$metadata?.httpStatusCode === statusCodes.notFound || error?.name === 'NoSuchKey') {
              logDownload(request, 'Evidence download file not found', { userId: credentials.id }, 'warn')
              throw Boom.notFound('Evidence file not found')
            }
            logDownload(request, 'Evidence download failed', { userId: credentials.id, reason: 'storage_unavailable' }, 'error')
            throw Boom.serverUnavailable('Evidence is currently unavailable')
          }
          let filename
          try {
            filename = originalFilename(object.Metadata)
            if (!object.Body) {
              throw new Error('Missing evidence content')
            }
          } catch {
            object.Body?.destroy()
            logDownload(request, 'Evidence download failed', { userId: credentials.id, reason: 'invalid_file_metadata_or_content' }, 'error')
            throw Boom.serverUnavailable('Evidence is currently unavailable')
          }
          logDownload(request, 'Evidence download started', { userId: credentials.id })
          object.Body.once('end', () => logDownload(request, 'Evidence download stream ended', { userId: credentials.id }))
          object.Body.once('error', () => logDownload(request, 'Evidence download stream failed', { userId: credentials.id }, 'error'))
          return h.response(object.Body)
            .type('application/octet-stream')
            .header('content-disposition', attachmentDisposition(filename))
            .header('cache-control', 'no-store, no-cache, must-revalidate')
            .header('x-content-type-options', 'nosniff')
        }
      })
    }
  }
}
