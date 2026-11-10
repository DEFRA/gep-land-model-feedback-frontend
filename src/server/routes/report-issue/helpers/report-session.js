import { randomUUID } from 'node:crypto'

export const expiredPath = '/report-issue/session-expired'
export const newReportPath = '/report-issue/start-new'
export const statusPath = '/report-issue/session-status'
export const confirmationPath = '/report-issue/issue-reported'

const JOURNEY_SESSION_KEY = 'reportJourney'

const answerKeys = [
  'issueType', 'dataset', 'datasetOtherId', 'datasetOtherTitle', 'issueLocation',
  'incorrectAttributes', 'technicalArea', 'technicalOther', 'issueWhere',
  'issueDescription', 'evidenceFiles', 'evidenceUpload'
]

export function isSubmissionComplete (report) {
  return Boolean(report?.completed || (report?.notification && report.answers && (!report.answers.submitterEmail || report.notification.submitterCopy)))
}

function clearAnswers (request) {
  for (const key of answerKeys) {
    request.yar.clear(key)
  }
  request.yar.flash('evidenceErrors')
}

export function ensureReportJourney (request) {
  let journey = request.yar.get(JOURNEY_SESSION_KEY)
  if (!journey) {
    journey = { id: randomUUID(), completed: false }
    request.yar.set(JOURNEY_SESSION_KEY, journey)
  }
  return journey
}

export function startReport (request) {
  clearAnswers(request)
  request.yar.clear('reportedIssue')
  request.yar.set(JOURNEY_SESSION_KEY, { id: randomUUID(), completed: false })
}

export function completeReport (request, report) {
  clearAnswers(request)
  request.yar.set('reportedIssue', {
    id: report.id,
    reference: report.reference,
    completed: true,
    notification: {
      id: report.notification.id,
      recipient: report.notification.recipient,
      ...(report.notification.submitterCopy && {
        submitterCopy: {
          id: report.notification.submitterCopy.id,
          recipient: report.notification.submitterCopy.recipient
        }
      })
    }
  })
  const journey = request.yar.get(JOURNEY_SESSION_KEY)
  request.yar.set(JOURNEY_SESSION_KEY, { id: journey?.id ?? randomUUID(), completed: true })
}
