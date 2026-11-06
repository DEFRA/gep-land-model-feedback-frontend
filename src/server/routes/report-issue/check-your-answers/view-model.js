import { locationOptions, attributeOptions } from '../data/constants.js'
import { options as technicalOptions } from '../technical/constants.js'

function row (label, value, path) {
  return { label, lines: value.split(/\r?\n/), href: `${path}?returnTo=check-your-answers` }
}

export function buildSummaryRows (answers) {
  const dataIssue = answers.issueType === 'data'
  const rows = [row('Issue type', dataIssue ? 'Data issue' : 'Technical issue', '/')]
  if (dataIssue && answers.dataset === 'other') {
    rows.push(
      row('Dataset', answers.datasetOtherTitle, '/report-issue/data'),
      row('Where', answers.issueWhere, '/report-issue/description')
    )
  } else if (dataIssue) {
    const location = answers.location
    const option = locationOptions.find(({ value }) => value === location.locationType)
    rows.push(row(option.value === 'other' ? 'Location' : 'Location ID', location[option.name], '/report-issue/data/location'))
    const selected = answers.attributes
    rows.push(row('Incorrect attributes', attributeOptions.filter(({ value }) => selected.includes(value)).map(({ text }) => text).join('\n'), '/report-issue/data/attributes'))
  } else {
    const area = answers.technicalArea
    const text = area === 'other' ? answers.technicalOther : technicalOptions.find(({ value }) => value === area).text
    rows.push(row('Relates to', text, '/report-issue/technical'))
  }
  rows.push(
    row('Description', answers.description, '/report-issue/description'),
    row('Files', answers.files.map(file => file.filename).join('\n') || 'No files added', '/report-issue/evidence')
  )
  return rows
}
