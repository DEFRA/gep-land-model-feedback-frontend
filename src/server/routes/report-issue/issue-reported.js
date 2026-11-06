import { randomUUID } from 'node:crypto'
import { getEvidenceRedirect, checkEvidenceUpload, evidenceFiles } from './evidence.js'
import { checkAnswersRows } from './check-your-answers.js'
import { sendIssueEmail } from './notification.js'

function reportAnswers (request) {
  const issueType = request.yar.get('issueType')
  return {
    issueType,
    ...(issueType === 'data'
      ? {
          dataset: request.yar.get('dataset'),
          ...(request.yar.get('dataset') === 'other'
            ? { datasetOtherId: request.yar.get('datasetOtherId'), datasetOtherTitle: request.yar.get('datasetOtherTitle'), issueWhere: request.yar.get('issueWhere') }
            : { location: request.yar.get('issueLocation'), attributes: request.yar.get('incorrectAttributes') })
        }
      : {
          technicalArea: request.yar.get('technicalArea'),
          technicalOther: request.yar.get('technicalOther')
        }),
    description: request.yar.get('issueDescription'),
    files: evidenceFiles(request)
  }
}

export const submitIssueController = {
  async handler (request, h) {
    const redirect = getEvidenceRedirect(request)
    if (redirect) return h.redirect(redirect).code(303)
    const uploadRedirect = await checkEvidenceUpload(request, h)
    if (uploadRedirect) return uploadRedirect
    const answers = reportAnswers(request)
    const previous = request.yar.get('reportedIssue')
    // Repeated submission of the same answers reuses the existing receipt.
    let report = previous
    if (!report || JSON.stringify(report.answers) !== JSON.stringify(answers)) {
      const id = randomUUID()
      report = {
        id,
        reference: id.replaceAll('-', '').slice(0, 12).toUpperCase(),
        answers
      }
      request.yar.set('reportedIssue', report)
    }
    if (!report.notification) {
      try {
        report.notification = await sendIssueEmail(report, checkAnswersRows(request), request.logger)
        request.yar.set('reportedIssue', report)
      } catch {
        request.logger.error({ reference: report.reference }, 'Unable to submit issue email')
        return h.view('report-issue/submission-problem', { pageTitle: 'There is a problem submitting your issue', reference: report.reference }).code(503)
      }
    }
    return h.redirect('/report-issue/issue-reported').code(303)
  }
}

export const issueReportedController = {
  handler (request, h) {
    const reportedIssue = request.yar.get('reportedIssue')
    if (!reportedIssue?.notification) return h.redirect('/report-issue/check-your-answers').code(303)
    return h.view('report-issue/issue-reported', {
      pageTitle: 'Issue reported',
      reference: reportedIssue.reference,
      supportMailboxAddress: reportedIssue.notification.recipient
    })
  }
}
