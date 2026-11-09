import { config } from '#/config/config.js'
import { evidenceDownloadPath } from '#/server/common/services/evidence/filename.js'
import { sendEmail } from '#/server/common/services/notify/client.js'

export async function sendIssueEmail (report, rows, logger) {
  const settings = config.get('notify')
  const personalisation = {
    email_subject: `${settings.emailSubject.trim()} - ${report.reference}`,
    reference: report.reference,
    submitter_email: report.answers.submitterEmail ?? 'Not available',
    answers: rows.map(({ label, lines }) => `## ${label}\n${lines.join('\n')}`).join('\n\n'),
    file_downloads: report.answers.files.length
      ? report.answers.files.map(file => {
        const label = file.filename.replace(/[\\[\]()*_`<>!]/g, character => `\\${character}`).replace(/[\r\n]/g, ' ')
        const url = `${config.get('appBaseUrl').replace(/\/$/, '')}${evidenceDownloadPath(file)}`
        return `[${label}](${url})`
      }).join('\n\n')
      : 'No files added'
  }
  return sendEmail({ recipient: config.get('supportMailboxAddress'), reference: report.id, personalisation }, logger)
}
