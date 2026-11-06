import { statusCodes } from '#/server/common/constants/status-codes.js'
import { technicalGetController, technicalPostController } from './controller.js'

export const technicalIssue = {
  plugin: {
    name: 'report-issue-technical',
    register (server) {
      server.route([
        {
          method: 'GET',
          path: '/report-issue/technical',
          ...technicalGetController
        },
        {
          method: 'POST',
          path: '/report-issue/technical',
          ...technicalPostController
        },
        {
          method: 'GET',
          path: '/report-issue/technical/description',
          handler: (request, h) => h.redirect('/report-issue/description').code(statusCodes.seeOther)
        }
      ])
    }
  }
}
