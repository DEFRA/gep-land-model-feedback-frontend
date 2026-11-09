import { config } from '#/config/config.js'
import { uploadUrl } from '#/server/common/services/uploader/client.js'
import { getChangeNavigation } from '../navigation.js'
import { getEvidenceFiles } from '../helpers/answers.js'
import { buildFormPage } from '../helpers/form-errors.js'
import { evidencePath } from './upload-session.js'
import { formatFileTypeLabels } from './mime-type-labels.js'

export function buildViewModel (request, active, errors) {
  const files = getEvidenceFiles(request).map(file => ({
    ...file,
    removeAction: getChangeNavigation(request, `${evidencePath}/remove/${file.fileId}`, evidencePath).formAction
  }))
  return {
    ...buildFormPage('Add any evidence of the issue', errors.map(text => ({ text, href: '#evidence-files' }))),
    ...getChangeNavigation(request, evidencePath, '/report-issue/description'),
    action: uploadUrl(active.id),
    files,
    maxFileSizeMB: config.get('uploader.maxFileSizeMB'),
    excludedFileExtensions: config.get('uploader.excludedFileExtensions').join(', '),
    allowedMimeTypes: config.get('uploader.allowedMimeTypes').join(', '),
    allowedFileTypes: formatFileTypeLabels(config.get('uploader.allowedMimeTypes')),
    fileError: errors.length ? { text: errors.join('. ') } : undefined
  }
}
