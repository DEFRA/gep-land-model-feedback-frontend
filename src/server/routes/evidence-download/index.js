import Joi from 'joi'
import { config } from '#/config/config.js'
import { downloadEvidence } from './controller.js'

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
        handler: downloadEvidence
      })
    }
  }
}
