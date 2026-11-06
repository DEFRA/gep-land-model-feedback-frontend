import { config } from '#/config/config.js'
import { sendEmail } from '#/server/common/services/notify/client.js'

export async function sendIssueEmail (report, rows, logger) {
  const settings = config.get('notify')
  const personalisation = {
    email_subject: `${settings.emailSubject.trim()} - ${report.reference}`,
    reference: report.reference,
    answers: rows.map(({ label, lines }) => `${label}:\n${lines.join('\n')}`).join('\n\n'),
    file_downloads: report.answers.files.length
      ? report.answers.files.map(file => `${file.filename}: Download link not yet available`).join('\n')
      : 'No files added'
  }
  return sendEmail({ recipient: config.get('supportMailboxAddress'), reference: report.id, personalisation }, logger)
}
