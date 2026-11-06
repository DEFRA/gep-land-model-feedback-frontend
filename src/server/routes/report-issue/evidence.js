import { randomUUID } from 'node:crypto'
import Joi from 'joi'
import { config } from '#/config/config.js'
import { initiateUpload, getUploadStatus, uploadUrl } from '#/server/common/helpers/upload.js'
import { getChangeNavigation } from './navigation.js'
import { descriptionSchema, getDescriptionRedirect } from './description.js'

const evidencePath = '/report-issue/evidence'
const completePath = `${evidencePath}/complete`
const reviewPath = '/report-issue/check-your-answers'
const withReturn = active => active?.changing ? `${evidencePath}?returnTo=check-your-answers` : evidencePath
const fileSchema = Joi.object({
  fileId: Joi.string().uuid().required(),
  filename: Joi.string().required(),
  contentLength: Joi.number().integer().positive().required(),
  s3Bucket: Joi.string().required(),
  s3Key: Joi.string().required(),
  contentType: Joi.string().optional(),
  checksumSha256: Joi.string().optional()
}).options({ stripUnknown: true })

export function getEvidenceRedirect (request) {
  return getDescriptionRedirect(request) || ((descriptionSchema.validate(request.yar.get('issueDescription')).error || (request.yar.get('issueType') === 'data' && request.yar.get('dataset') === 'other' && !request.yar.get('issueWhere')))
    ? '/report-issue/description'
    : undefined)
}

export function evidenceFiles (request) {
  return request.yar.get('evidenceFiles') ?? []
}

function problem (request, h, retryUrl = evidencePath) {
  request.logger.warn('CDP Uploader is unavailable or returned an invalid response')
  return h.view('report-issue/evidence-problem', { pageTitle: 'There is a problem uploading your files', retryUrl, continueUrl: request.yar.get('evidenceUpload') ? undefined : reviewPath }).code(503)
}

// Used at review and Submit as well as the evidence page: pending scans cannot be skipped.
export async function checkEvidenceUpload (request, h) {
  const active = request.yar.get('evidenceUpload')
  if (!active) return null
  try {
    const status = await getUploadStatus(active.id, active.token)
    if (status.uploadStatus !== 'initiated') return h.redirect(`${completePath}?uploadId=${active.id}`).code(303)
    return null
  } catch (error) {
    if (error.statusCode === 404) {
      request.yar.clear('evidenceUpload')
      return null
    }
    return problem(request, h, `${completePath}?uploadId=${active.id}`)
  }
}

export const evidenceController = {
  async handler (request, h) {
    const redirect = getEvidenceRedirect(request)
    if (redirect) return h.redirect(redirect).code(303)
    const waiting = await checkEvidenceUpload(request, h)
    if (waiting) return waiting
    let active = request.yar.get('evidenceUpload')
    if (!active) {
      const token = randomUUID()
      const redirectPath = `${completePath}`
      const redirectUrl = config.get('isProduction') ? redirectPath : `${config.get('appBaseUrl').replace(/\/$/, '')}${redirectPath}`
      try {
        const id = await initiateUpload(redirectUrl, token)
        active = { id, token, changing: request.query.returnTo === 'check-your-answers' }
        request.yar.set('evidenceUpload', active)
      } catch {
        return problem(request, h)
      }
    } else {
      active.changing = request.query.returnTo === 'check-your-answers'
      request.yar.set('evidenceUpload', active)
    }
    const messages = request.yar.flash('evidenceErrors')
    const errors = messages.flat()
    return h.view('report-issue/evidence', {
      pageTitle: `${errors.length ? 'Error: ' : ''}Add any evidence of the issue`,
      ...getChangeNavigation(request, evidencePath, '/report-issue/description'),
      action: uploadUrl(active.id),
      files: evidenceFiles(request).map(file => ({ ...file, removeAction: `${evidencePath}/remove/${file.fileId}${request.query.returnTo === 'check-your-answers' ? '?returnTo=check-your-answers' : ''}` })),
      maxFileSizeMB: config.get('uploader.maxFileSizeMB'),
      allowedMimeTypes: config.get('uploader.allowedMimeTypes').join(', '),
      fileError: errors.length ? { text: errors.join('. ') } : undefined,
      errorSummary: errors.length ? { titleText: 'There is a problem', errorList: errors.map(text => ({ text, href: '#evidence-files' })) } : undefined
    }).code(errors.length ? 400 : 200)
  }
}

export const evidenceCompleteController = {
  async handler (request, h) {
    const redirect = getEvidenceRedirect(request)
    if (redirect) return h.redirect(redirect).code(303)
    const active = request.yar.get('evidenceUpload')
    if (!active || (request.query.uploadId && request.query.uploadId !== active.id)) return h.redirect(evidencePath).code(303)
    let status
    try {
      status = await getUploadStatus(active.id, active.token)
    } catch (error) {
      if (error.statusCode === 404) {
        request.yar.clear('evidenceUpload')
        request.yar.flash('evidenceErrors', ['The upload has expired. Select your files again.'])
        return h.redirect(withReturn(active)).code(303)
      }
      return problem(request, h, `${completePath}?uploadId=${active.id}`)
    }
    if (status.uploadStatus !== 'ready') {
      return h.view('report-issue/evidence-wait', { pageTitle: 'Checking your files', refreshUrl: `${completePath}?uploadId=${active.id}` })
    }
    const formFiles = status.form.evidenceFiles
    const results = formFiles === undefined ? [] : Array.isArray(formFiles) ? formFiles : [formFiles]
    const accepted = []
    const errors = []
    if (!results.length) errors.push('Select a file')
    for (const file of results) {
      if (file?.hasError === true || file?.fileStatus === 'rejected') {
        const message = typeof file.errorMessage === 'string' ? file.errorMessage : 'The selected file could not be uploaded – try again'
        errors.push(typeof file.filename === 'string' ? `${file.filename}: ${message}` : message)
        continue
      }
      const { value, error } = fileSchema.validate(file)
      if (error || file.fileStatus !== 'complete' || value.s3Bucket !== config.get('uploader.bucket') || !value.s3Key.startsWith(`evidence/${active.id}/`)) return problem(request, h, `${completePath}?uploadId=${active.id}`)
      accepted.push({ ...value, uploadId: active.id })
    }
    if (!Number.isInteger(status.numberOfRejectedFiles) || status.numberOfRejectedFiles !== results.length - accepted.length) return problem(request, h, `${completePath}?uploadId=${active.id}`)
    const files = new Map(evidenceFiles(request).map(file => [file.fileId, file]))
    for (const file of accepted) files.set(file.fileId, file)
    request.yar.set('evidenceFiles', [...files.values()])
    request.yar.clear('evidenceUpload')
    if (errors.length) request.yar.flash('evidenceErrors', errors)
    return h.redirect(withReturn(active)).code(303)
  }
}

export const removeEvidenceController = {
  handler (request, h) {
    const redirect = getEvidenceRedirect(request)
    if (redirect) return h.redirect(redirect).code(303)
    request.yar.set('evidenceFiles', evidenceFiles(request).filter(file => file.fileId !== request.params.fileId))
    return h.redirect(request.query.returnTo === 'check-your-answers' ? `${evidencePath}?returnTo=check-your-answers` : evidencePath).code(303)
  }
}
