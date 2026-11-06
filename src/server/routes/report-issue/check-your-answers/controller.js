import { statusCodes } from '#/server/common/constants/status-codes.js'
import { getEvidenceRedirect } from '../helpers/prerequisites.js'
import { getIssueAnswers } from '../helpers/answers.js'
import { checkEvidenceUpload } from '../evidence/upload-session.js'
import { buildSummaryRows } from './view-model.js'

export const checkAnswersController = {
  async handler (request, h) {
    const redirect = getEvidenceRedirect(request)
    if (redirect) return h.redirect(redirect).code(statusCodes.seeOther)
    const uploadRedirect = await checkEvidenceUpload(request, h)
    if (uploadRedirect) return uploadRedirect
    return h.view('report-issue/check-your-answers/index', { pageTitle: 'Check your answers', rows: buildSummaryRows(getIssueAnswers(request)) })
  }
}
