import { statusCodes } from '#/server/common/constants/status-codes.js'
import { getEvidenceRedirect } from '../helpers/prerequisites.js'
import { getIssueAnswers } from '../helpers/answers.js'
import { checkEvidenceUpload } from '../evidence/upload-session.js'
import { buildSummaryRows } from '../check-your-answers/view-model.js'
import { getOrCreateReceipt } from './receipt.js'
import { sendIssueEmail } from './email.js'

export const submitIssueController = {
  async handler (request, h) {
    const redirect = getEvidenceRedirect(request)
    if (redirect) {
      return h.redirect(redirect).code(statusCodes.seeOther)
    }
    const uploadRedirect = await checkEvidenceUpload(request, h)
    if (uploadRedirect) {
      return uploadRedirect
    }
    const answers = getIssueAnswers(request)
    const report = getOrCreateReceipt(answers, request.yar.get('reportedIssue'))
    request.yar.set('reportedIssue', report)
    if (!report.notification) {
      try {
        report.notification = await sendIssueEmail(report, buildSummaryRows(report.answers), request.logger)
        request.yar.set('reportedIssue', report)
      } catch {
        request.logger.error({ reference: report.reference }, 'Unable to submit issue email')
        return h.view('report-issue/issue-reported/problem', { pageTitle: 'There is a problem submitting your issue', reference: report.reference }).code(statusCodes.serviceUnavailable)
      }
    }
    return h.redirect('/report-issue/issue-reported').code(statusCodes.seeOther)
  }
}

export const issueReportedController = {
  handler (request, h) {
    const reportedIssue = request.yar.get('reportedIssue')
    if (!reportedIssue?.notification) {
      return h.redirect('/report-issue/check-your-answers').code(statusCodes.seeOther)
    }
    return h.view('report-issue/issue-reported/index', {
      pageTitle: 'Issue reported',
      reference: reportedIssue.reference,
      supportMailboxAddress: reportedIssue.notification.recipient
    })
  }
}
