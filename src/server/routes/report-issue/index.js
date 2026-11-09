import { reportSession } from './session.js'
import { dataIssue } from './data/index.js'
import { technicalIssue } from './technical/index.js'
import { description } from './description/index.js'
import { evidence } from './evidence/index.js'
import { checkAnswers } from './check-your-answers/index.js'
import { issueReported } from './issue-reported/index.js'

export const reportIssue = {
  plugin: {
    name: 'report-issue',
    async register (server) {
      await server.register([reportSession, dataIssue, technicalIssue, description, evidence, checkAnswers, issueReported])
    }
  }
}
