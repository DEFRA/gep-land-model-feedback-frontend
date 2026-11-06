import { evidenceController, evidenceCompleteController, removeEvidenceController } from './controller.js'

export const evidence = {
  plugin: {
    name: 'report-issue-evidence',
    register (server) {
      server.route([
        {
          method: 'GET',
          path: '/report-issue/evidence',
          ...evidenceController
        },
        {
          method: 'GET',
          path: '/report-issue/evidence/complete',
          ...evidenceCompleteController
        },
        {
          method: 'POST',
          path: '/report-issue/evidence/remove/{fileId}',
          ...removeEvidenceController
        }
      ])
    }
  }
}
