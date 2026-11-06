import { getChangeNavigation } from '../navigation.js'
import { buildFormPage } from '../helpers/form-errors.js'
import { options } from './constants.js'

const question = 'What does the technical issue relate to?'
const areaMessage = 'Select what the technical issue relates to'
const otherMessage = 'Enter what the issue relates to'

export function buildViewModel (request, values, details = []) {
  const areaError = details.some(({ path }) => path[0] === 'technicalArea')
  const otherError = details.some(({ path }) => path[0] === 'technicalOther')
  const errorList = [
    ...(areaError ? [{ text: areaMessage, href: '#technical-area' }] : []),
    ...(otherError ? [{ text: otherMessage, href: '#technical-other' }] : [])
  ]
  return {
    ...getChangeNavigation(request, '/report-issue/technical', '/'),
    ...buildFormPage(question, errorList),
    options,
    technicalArea: typeof values.technicalArea === 'string' ? values.technicalArea : '',
    technicalOther: typeof values.technicalOther === 'string' ? values.technicalOther : '',
    areaError: areaError ? { text: areaMessage } : undefined,
    otherError: otherError ? { text: otherMessage } : undefined,
  }
}
