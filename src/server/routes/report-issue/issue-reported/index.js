import { issueReportedController } from './controller.js'

export const issueReported = {
  plugin: {
    name: 'report-issue-issue-reported',
    register (server) {
      server.route([
        {
          method: 'GET',
          path: '/report-issue/issue-reported',
          ...issueReportedController
        }
      ])
    }
  }
}
