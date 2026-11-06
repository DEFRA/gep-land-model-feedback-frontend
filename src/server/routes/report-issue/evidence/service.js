import { config } from '#/config/config.js'
import { fileSchema } from './schema.js'

/** Validate uploader results before any attachments are added to the report. */
export function parseUploadResults (status, uploadId) {
  const formFiles = status.form.evidenceFiles
  const results = asFileList(formFiles)
  const accepted = []
  const errors = []
  if (!results.length) {
    errors.push('Select a file')
  }
  for (const file of results) {
    if (file?.hasError === true || file?.fileStatus === 'rejected') {
      errors.push(rejectedFileMessage(file))
      continue
    }
    accepted.push(validateAcceptedFile(file, uploadId))
  }
  if (!Number.isInteger(status.numberOfRejectedFiles) || status.numberOfRejectedFiles !== results.length - accepted.length) {
    throw new Error('Inconsistent evidence upload results')
  }
  return { accepted, errors }
}

function asFileList (files) {
  if (files === undefined) {
    return []
  }
  return Array.isArray(files) ? files : [files]
}

function rejectedFileMessage (file) {
  const message = typeof file.errorMessage === 'string' ? file.errorMessage : 'The selected file could not be uploaded – try again'
  return typeof file.filename === 'string' ? `${file.filename}: ${message}` : message
}

function validateAcceptedFile (file, uploadId) {
  const { value, error } = fileSchema.validate(file)
  if (error || file.fileStatus !== 'complete') {
    throw new Error('Incomplete evidence upload result')
  }
  if (value.s3Bucket !== config.get('uploader.bucket') || !value.s3Key.startsWith(`evidence/${uploadId}/`)) {
    throw new Error('Evidence upload result belongs to a different destination')
  }
  return { ...value, uploadId }
}
