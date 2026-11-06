import { randomUUID } from 'node:crypto'
import { config } from '#/config/config.js'
import { getEvidenceRedirect } from './evidence.js'

function reportAnswers (request) {
  const issueType = request.yar.get('issueType')
  return {
    issueType,
    ...(issueType === 'data'
      ? {
          dataset: request.yar.get('dataset'),
          location: request.yar.get('issueLocation'),
          attributes: request.yar.get('incorrectAttributes')
        }
      : {
          technicalArea: request.yar.get('technicalArea'),
          technicalOther: request.yar.get('technicalOther')
        }),
    description: request.yar.get('issueDescription')
  }
}

export const submitIssueController = {
  handler (request, h) {
    const redirect = getEvidenceRedirect(request)
    if (redirect) return h.redirect(redirect).code(303)
    const answers = reportAnswers(request)
    const previous = request.yar.get('reportedIssue')
    // Repeated submission of the same answers reuses the existing receipt.
    if (!previous || JSON.stringify(previous.answers) !== JSON.stringify(answers)) {
      const id = randomUUID()
      request.yar.set('reportedIssue', {
        id,
        reference: id.replaceAll('-', '').slice(0, 12).toUpperCase(),
        answers
      })
    }
    return h.redirect('/report-issue/issue-reported').code(303)
  }
}

export const issueReportedController = {
  handler (request, h) {
    const reportedIssue = request.yar.get('reportedIssue')
    if (!reportedIssue) return h.redirect('/report-issue/check-your-answers').code(303)
    return h.view('report-issue/issue-reported', {
      pageTitle: 'Issue reported',
      reference: reportedIssue.reference,
      supportMailboxAddress: config.get('supportMailboxAddress')
    })
  }
}
