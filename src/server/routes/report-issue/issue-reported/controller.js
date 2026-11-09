import { statusCodes } from '#/server/common/constants/status-codes.js'
import { getEvidenceRedirect } from '../helpers/prerequisites.js'
import { getIssueAnswers } from '../helpers/answers.js'
import { checkEvidenceUpload } from '../evidence/upload-session.js'
import { buildSummaryRows } from '../check-your-answers/view-model.js'
import { getOrCreateReceipt } from './receipt.js'
import { sendIssueEmail } from './email.js'
import { isSubmissionComplete, completeReport } from '../helpers/report-session.js'

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
    if (!isSubmissionComplete(report)) {
      let failureStage = 'session'
      const persistReport = async () => {
        failureStage = 'session'
        request.yar.set('reportedIssue', report)
        await request.yar.commit(h)
        failureStage = 'email'
      }
      try {
        await persistReport()
        report.notification = await sendIssueEmail(report, buildSummaryRows(report.answers), request.logger, persistReport)
        request.yar.set('reportedIssue', report)
      } catch {
        request.yar.set('reportedIssue', report)
        const supportEmailAccepted = Boolean(report.notification)
        request.logger.error({ reference: report.reference, failureStage, supportEmailAccepted, submitterCopyAccepted: Boolean(report.notification?.submitterCopy) }, 'Unable to complete issue submission')
        return h.view('report-issue/issue-reported/problem', {
          pageTitle: supportEmailAccepted ? 'There is a problem sending your confirmation email' : 'There is a problem submitting your issue',
          reference: report.reference,
          supportEmailAccepted
        }).code(statusCodes.serviceUnavailable)
      }
    }
    completeReport(request, report)
    return h.redirect('/report-issue/issue-reported').code(statusCodes.seeOther)
  }
}

export const issueReportedController = {
  handler (request, h) {
    const reportedIssue = request.yar.get('reportedIssue')
    if (!isSubmissionComplete(reportedIssue)) {
      return h.redirect('/report-issue/check-your-answers').code(statusCodes.seeOther)
    }
    return h.view('report-issue/issue-reported/index', {
      pageTitle: 'Issue reported',
      reference: reportedIssue.reference,
      supportMailboxAddress: reportedIssue.notification.recipient
    })
  }
}
