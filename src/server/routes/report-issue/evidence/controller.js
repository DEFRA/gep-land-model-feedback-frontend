import { statusCodes } from '#/server/common/constants/status-codes.js'
import { randomUUID } from 'node:crypto'

import { config } from '#/config/config.js'
import { initiateUpload, getUploadStatus } from '#/server/common/services/uploader/client.js'
import { getEvidenceRedirect } from '../helpers/prerequisites.js'
import { getEvidenceFiles } from '../helpers/answers.js'
import { parseUploadResults } from './service.js'
import { buildViewModel } from './view-model.js'
import { checkEvidenceUpload, uploadProblem, evidencePath, completePath, evidenceReturnPath } from './upload-session.js'

const EVIDENCE_UPLOAD_KEY = 'evidenceUpload'

export const evidenceController = {
  async handler (request, h) {
    const redirect = getEvidenceRedirect(request)
    if (redirect) {
      return h.redirect(redirect).code(statusCodes.seeOther)
    }
    const waiting = await checkEvidenceUpload(request, h)
    if (waiting) {
      return waiting
    }
    let active = request.yar.get(EVIDENCE_UPLOAD_KEY)
    if (!active) {
      const token = randomUUID()
      const redirectPath = completePath
      const redirectUrl = config.get('isProduction') ? redirectPath : `${config.get('appBaseUrl').replace(/\/$/, '')}${redirectPath}`
      try {
        const id = await initiateUpload(redirectUrl, token)
        active = { id, token, changing: request.query.returnTo === 'check-your-answers' }
        request.yar.set(EVIDENCE_UPLOAD_KEY, active)
      } catch {
        return uploadProblem(request, h)
      }
    } else {
      active.changing = request.query.returnTo === 'check-your-answers'
      request.yar.set(EVIDENCE_UPLOAD_KEY, active)
    }
    const errors = request.yar.flash('evidenceErrors').flat()
    return h.view('report-issue/evidence/index', buildViewModel(request, active, errors)).code(errors.length ? statusCodes.badRequest : statusCodes.ok)
  }
}

export const evidenceCompleteController = {
  async handler (request, h) {
    const redirect = getEvidenceRedirect(request)
    if (redirect) {
      return h.redirect(redirect).code(statusCodes.seeOther)
    }
    const active = request.yar.get(EVIDENCE_UPLOAD_KEY)
    if (!active || (request.query.uploadId && request.query.uploadId !== active.id)) {
      return h.redirect(evidencePath).code(statusCodes.seeOther)
    }
    let status
    try {
      status = await getUploadStatus(active.id, active.token)
    } catch (error) {
      if (error.statusCode === statusCodes.notFound) {
        request.yar.clear(EVIDENCE_UPLOAD_KEY)
        request.yar.flash('evidenceErrors', ['The upload has expired. Select your files again.'])
        return h.redirect(evidenceReturnPath(active)).code(statusCodes.seeOther)
      }
      return uploadProblem(request, h, `${completePath}?uploadId=${active.id}`)
    }
    if (status.uploadStatus !== 'ready') {
      return h.view('report-issue/evidence/wait', { pageTitle: 'Checking your files', refreshUrl: `${completePath}?uploadId=${active.id}` })
    }
    let result
    try {
      result = parseUploadResults(status, active.id)
    } catch {
      return uploadProblem(request, h, `${completePath}?uploadId=${active.id}`)
    }
    const { accepted, errors } = result
    const files = new Map(getEvidenceFiles(request).map(file => [file.fileId, file]))
    for (const file of accepted) { files.set(file.fileId, file) }
    request.yar.set('evidenceFiles', [...files.values()])
    request.yar.clear(EVIDENCE_UPLOAD_KEY)
    if (errors.length) {
      request.yar.flash('evidenceErrors', errors)
    }
    return h.redirect(evidenceReturnPath(active)).code(statusCodes.seeOther)
  }
}

export const removeEvidenceController = {
  handler (request, h) {
    const redirect = getEvidenceRedirect(request)
    if (redirect) {
      return h.redirect(redirect).code(statusCodes.seeOther)
    }
    request.yar.set('evidenceFiles', getEvidenceFiles(request).filter(file => file.fileId !== request.params.fileId))
    return h.redirect(request.query.returnTo === 'check-your-answers' ? `${evidencePath}?returnTo=check-your-answers` : evidencePath).code(statusCodes.seeOther)
  }
}
