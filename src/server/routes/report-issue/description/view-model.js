import { getChangeNavigation } from '../navigation.js'
import { buildFormPage } from '../helpers/form-errors.js'
import { isOtherDataset } from '../helpers/prerequisites.js'

const question = 'Enter a description of the issue'

function backLink (request) {
  if (request.yar.get('issueType') !== 'data') return '/report-issue/technical'
  return isOtherDataset(request) ? '/report-issue/data' : '/report-issue/data/attributes'
}

function fieldError (detail) {
  if (detail.path[0] === 'issueWhere') {
    return { text: 'Enter the location of the issue', href: '#issue-where' }
  }
  return {
    text: detail.type === 'string.max' ? 'The description must be 2,000 characters or fewer' : question,
    href: '#issue-description'
  }
}

export function buildViewModel (request, description, error) {
  const errorList = error?.details.map(fieldError) ?? []
  const whereError = errorList.find(({ href }) => href === '#issue-where')
  const descriptionError = errorList.find(({ href }) => href === '#issue-description')
  const issueWhere = request.method === 'post' ? request.payload?.issueWhere : request.yar.get('issueWhere')
  return {
    ...buildFormPage(question, errorList),
    ...getChangeNavigation(request, '/report-issue/description', backLink(request)),
    isOtherDataset: isOtherDataset(request),
    issueWhere: typeof issueWhere === 'string' ? issueWhere : '',
    issueDescription: typeof description === 'string' ? description : '',
    whereError: whereError ? { text: whereError.text } : undefined,
    descriptionError: descriptionError ? { text: descriptionError.text } : undefined
  }
}
