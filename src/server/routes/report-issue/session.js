import { statusCodes } from '#/server/common/constants/status-codes.js'
import { expiredPath, newReportPath, statusPath, confirmationPath, ensureReportJourney, startReport, completeReport, isSubmissionComplete } from './helpers/report-session.js'

function isJourneyPath (path) {
  return path === '/' || path.startsWith('/report-issue/')
}

function guardJourney (request, h) {
  if (!isJourneyPath(request.path)) {
    return h.continue
  }
  const report = request.yar.get('reportedIssue')
  // Also clear completed reports retained by sessions from before this behaviour.
  if (isSubmissionComplete(report) && !report.completed) {
    completeReport(request, report)
  }
  if ([expiredPath, newReportPath, statusPath, confirmationPath].includes(request.path)) {
    return h.continue
  }
  const journey = ensureReportJourney(request)
  const submittedJourney = request.payload?.reportJourneyId
  if (journey.completed || (submittedJourney && submittedJourney !== journey.id)) {
    return h.redirect(expiredPath).code(statusCodes.seeOther).takeover()
  }
  request.app.reportJourneyId = journey.id
  return h.continue
}

export const reportSession = {
  plugin: {
    name: 'report-session',
    register (server) {
      server.ext('onPostAuth', guardJourney)
      server.ext('onPreResponse', (request, h) => {
        if (request.response.variety === 'view' && request.app.reportJourneyId) {
          request.response.source.context.reportJourneyId = request.app.reportJourneyId
        }
        return h.continue
      })
      server.route([
        {
          method: 'GET',
          path: expiredPath,
          handler: (request, h) => h.view('report-issue/session-expired', {
            pageTitle: 'Your session has expired',
            restartReportFormId: 'report-restart-form',
            submissionMade: isSubmissionComplete(request.yar.get('reportedIssue'))
          })
        },
        {
          method: 'POST',
          path: newReportPath,
          handler (request, h) {
            startReport(request)
            return h.redirect('/').code(statusCodes.seeOther)
          }
        },
        {
          method: 'GET',
          path: statusPath,
          handler (request) {
            const journey = request.yar.get('reportJourney')
            return { active: Boolean(journey && !journey.completed && request.query.journeyId === journey.id) }
          }
        }
      ])
    }
  }
}
