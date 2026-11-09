import { config } from '#/config/config.js'
import { evidenceDownloadPath } from '#/server/common/services/evidence/filename.js'
import { sendEmail } from '#/server/common/services/notify/client.js'

export async function sendIssueEmail (report, rows, logger, onAccepted = async () => {}) {
  const settings = config.get('notify')
  const personalisation = {
    email_subject: `${settings.emailSubject.trim()} - ${report.reference}`,
    reference: report.reference,
    submitter_email: report.answers.submitterEmail ?? 'Not available',
    answers: formatAnswers(rows, report.answers.files, true),
    // Keep older Notify templates usable while their separate download section is removed.
    include_file_downloads: 'no',
    file_downloads: ''
  }
  // Retain acceptance if the second send fails, so a retry only sends the copy.
  if (!report.notification) {
    report.notification = await sendEmail({ recipient: config.get('supportMailboxAddress'), reference: report.id, personalisation }, logger)
    await onAccepted()
  }
  if (report.answers.submitterEmail && !report.notification.submitterCopy) {
    const submitterPersonalisation = { ...personalisation, answers: formatAnswers(rows, report.answers.files) }
    report.notification.submitterCopy = await sendEmail({
      recipient: report.answers.submitterEmail,
      reference: report.id,
      recipientType: 'submitter',
      personalisation: submitterPersonalisation
    }, logger)
    await onAccepted()
  }
  if (!report.answers.submitterEmail) {
    logger.info({ reference: report.id, recipientType: 'submitter' }, 'Submitter copy skipped: no email address available')
  }
  return report.notification
}

function formatAnswers (rows, files, includeLinks = false) {
  const fileLines = files.length
    ? files.map(file => includeLinks ? fileDownloadLink(file) : escapeFilename(file.filename))
    : ['No files added']
  return rows.map(({ label, lines }) => `## ${label}\n${(label === 'Files' ? fileLines : lines).join('\n')}`).join('\n\n')
}

function escapeFilename (filename) {
  return filename.replace(/[\\[\]()*_`<>!#]/g, character => `\\${character}`).replace(/[\r\n]/g, ' ')
}

function fileDownloadLink (file) {
  const url = `${config.get('appBaseUrl').replace(/\/$/, '')}${evidenceDownloadPath(file)}`
  return `[${escapeFilename(file.filename)}](${url})`
}
