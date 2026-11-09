import { config } from '#/config/config.js'
import { isExcludedFile, fileExclusionMessage } from '#/client/common/helpers/file-exclusions.js'
import { getEvidenceFiles } from '../helpers/answers.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { getUploadStatus } from '#/server/common/services/uploader/client.js'

export const evidencePath = '/report-issue/evidence'
export const completePath = `${evidencePath}/complete`
const reviewPath = '/report-issue/check-your-answers'

export const evidenceReturnPath = active => active?.changing ? `${evidencePath}?returnTo=check-your-answers` : evidencePath

export function uploadProblem (request, h, retryUrl = evidencePath) {
  request.logger.warn('CDP Uploader is unavailable or returned an invalid response')
  return h.view('report-issue/evidence/problem', { pageTitle: 'There is a problem uploading your files', retryUrl, continueUrl: request.yar.get('evidenceUpload') ? undefined : reviewPath }).code(statusCodes.serviceUnavailable)
}

// Used at review and Submit as well as the evidence page: pending scans cannot be skipped.
export async function checkEvidenceUpload (request, h) {
  const files = getEvidenceFiles(request)
  const excluded = files.filter(file => isExcludedFile(file.filename, config.get('uploader.excludedFileExtensions')))
  if (excluded.length) {
    request.yar.set('evidenceFiles', files.filter(file => !excluded.includes(file)))
    request.yar.flash('evidenceErrors', excluded.map(file => fileExclusionMessage(file.filename)))
    return h.redirect(evidencePath).code(statusCodes.seeOther)
  }
  const active = request.yar.get('evidenceUpload')
  if (!active) {
    return null
  }
  try {
    const status = await getUploadStatus(active.id, active.token)
    if (status.uploadStatus !== 'initiated') {
      return h.redirect(`${completePath}?uploadId=${active.id}`).code(statusCodes.seeOther)
    }
    return null
  } catch (error) {
    if (error.statusCode === statusCodes.notFound) {
      request.yar.clear('evidenceUpload')
      return null
    }
    return uploadProblem(request, h, `${completePath}?uploadId=${active.id}`)
  }
}
