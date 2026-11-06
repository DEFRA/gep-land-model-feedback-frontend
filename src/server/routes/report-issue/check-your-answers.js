import { getEvidenceRedirect, checkEvidenceUpload, evidenceFiles } from './evidence.js'
import { locationOptions, attributeOptions } from './data/controller.js'
import { options as technicalOptions } from './technical/controller.js'

function row (label, value, path) {
  return { label, lines: value.split(/\r?\n/), href: `${path}?returnTo=check-your-answers` }
}

export function checkAnswersRows (request) {
  const dataIssue = request.yar.get('issueType') === 'data'
  const rows = [row('Issue type', dataIssue ? 'Data issue' : 'Technical issue', '/')]
  if (dataIssue && request.yar.get('dataset') === 'other') {
    rows.push(row('Dataset', request.yar.get('datasetOtherTitle'), '/report-issue/data'))
    rows.push(row('Where', request.yar.get('issueWhere'), '/report-issue/description'))
  } else if (dataIssue) {
    const location = request.yar.get('issueLocation')
    const option = locationOptions.find(({ value }) => value === location.locationType)
    rows.push(row(option.value === 'other' ? 'Location' : 'Location ID', location[option.name], '/report-issue/data/location'))
    const selected = request.yar.get('incorrectAttributes')
    rows.push(row('Incorrect attributes', attributeOptions.filter(({ value }) => selected.includes(value)).map(({ text }) => text).join('\n'), '/report-issue/data/attributes'))
  } else {
    const area = request.yar.get('technicalArea')
    const text = area === 'other' ? request.yar.get('technicalOther') : technicalOptions.find(({ value }) => value === area).text
    rows.push(row('Relates to', text, '/report-issue/technical'))
  }
  rows.push(row('Description', request.yar.get('issueDescription'), '/report-issue/description'))
  rows.push(row('Files', evidenceFiles(request).map(file => file.filename).join('\n') || 'No files added', '/report-issue/evidence'))
  return rows
}

export const checkAnswersController = {
  async handler (request, h) {
    const redirect = getEvidenceRedirect(request)
    if (redirect) return h.redirect(redirect).code(303)
    const uploadRedirect = await checkEvidenceUpload(request, h)
    if (uploadRedirect) return uploadRedirect
    return h.view('report-issue/check-your-answers', { pageTitle: 'Check your answers', rows: checkAnswersRows(request) })
  }
}
