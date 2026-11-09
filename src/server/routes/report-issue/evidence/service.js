import { config } from '#/config/config.js'
import { isExcludedFile, fileExclusionMessage } from '#/client/common/helpers/file-exclusions.js'
import { fileSchema } from './schema.js'

const rejectionMessages = new Map([
  ['FILE_VIRUS', 'The selected file contains a virus'],
  ['FILE_EMPTY', 'The selected file is empty'],
  ['FILE_INVALID_TYPE', 'The selected file type is not supported']
])
const uploadFailedMessage = 'The selected file could not be uploaded – try again'

/** Validate uploader results before any attachments are added to the report. */
export function parseUploadResults (status, uploadId) {
  const formFiles = status.form.evidenceFiles
  const results = asFileList(formFiles)
  const accepted = []
  const errors = []
  if (!results.length) {
    errors.push('Select a file')
  }
  let rejectedByUploader = 0
  for (const file of results) {
    if (file?.hasError === true || file?.fileStatus === 'rejected') {
      rejectedByUploader++
      errors.push(rejectedFileMessage(file))
      continue
    }
    const validFile = validateAcceptedFile(file, uploadId)
    if (isExcludedFile(validFile.filename, config.get('uploader.excludedFileExtensions'))) {
      errors.push(fileExclusionMessage(validFile.filename))
    } else {
      accepted.push(validFile)
    }
  }
  if (!Number.isInteger(status.numberOfRejectedFiles) || status.numberOfRejectedFiles !== rejectedByUploader) {
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
  const message = file.errorCode === 'FILE_TOO_LARGE'
    ? `The selected file must be ${config.get('uploader.maxFileSizeMB')} MB or smaller`
    : rejectionMessages.get(file.errorCode) ?? uploadFailedMessage
  return typeof file.filename === 'string' ? `${file.filename}: ${message}` : message
}

function validateAcceptedFile (file, uploadId) {
  const { value, error } = fileSchema.validate(file)
  if (error || file.fileStatus !== 'complete') {
    throw new Error('Incomplete evidence upload result')
  }
  if (value.s3Bucket !== config.get('uploader.bucket') || value.s3Key !== `evidence/${uploadId}/${value.fileId}`) {
    throw new Error('Evidence upload result belongs to a different destination')
  }
  return { ...value, uploadId }
}
