import { checkAnswersController } from './controller.js'
import { submitIssueController } from '../issue-reported/controller.js'

export const checkAnswers = {
  plugin: {
    name: 'report-issue-check-your-answers',
    register (server) {
      server.route([
        {
          method: 'GET',
          path: '/report-issue/check-your-answers',
          ...checkAnswersController
        },
        {
          method: 'POST',
          path: '/report-issue/check-your-answers',
          ...submitIssueController
        }
      ])
    }
  }
}
