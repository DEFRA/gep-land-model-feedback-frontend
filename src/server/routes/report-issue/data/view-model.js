import { getChangeNavigation } from '../navigation.js'
import { buildFormPage } from '../helpers/form-errors.js'
import { locationOptions, attributeOptions } from './constants.js'

const datasetQuestion = 'Which dataset is the issue within?'
const locationQuestion = 'Enter the location of the issue'
const attributesQuestion = 'Which attributes are incorrect?'
const attributesMessage = 'Select which attributes are incorrect'

export function buildDatasetViewModel (request, values, datasets, errorField, catalogueError = false) {
  const text = errorField === 'datasetOtherId' ? 'Select a dataset' : 'Select which dataset the issue is within'
  const errorList = errorField ? [{ text, href: errorField === 'datasetOtherId' ? '#dataset-other' : '#dataset' }] : []
  if (catalogueError && values.dataset === 'other') {
    errorList.push({ text: 'Datasets could not be loaded. Try again.', href: '#dataset-other' })
  }
  return {
    ...getChangeNavigation(request, '/report-issue/data', '/'),
    ...buildFormPage(datasetQuestion, errorList),
    dataset: values.dataset,
    datasetOtherId: typeof values.datasetOtherId === 'string' ? values.datasetOtherId : '',
    datasets: datasets.map(({ id, title }) => ({ value: id, text: title })),
    catalogueError,
    datasetError: errorField === 'dataset' ? { text } : undefined,
    otherError: errorField === 'datasetOtherId' ? { text } : undefined
  }
}

export function buildLocationViewModel (request, values = {}, details = []) {
  const fieldErrors = new Map(details.map(detail => [detail.path[0], detail.message]))
  const typeError = fieldErrors.has('locationType') ? { text: 'Select how you want to identify the location of the issue' } : undefined
  const options = locationOptions.map(option => ({
    ...option,
    inputValue: typeof values[option.name] === 'string' ? values[option.name] : '',
    error: fieldErrors.has(option.name) ? { text: fieldErrors.get(option.name) } : undefined
  }))
  return {
    ...getChangeNavigation(request, '/report-issue/data/location', '/report-issue/data'),
    ...buildFormPage(locationQuestion, [
      ...(typeError ? [{ text: typeError.text, href: '#location-type' }] : []),
      ...options.filter(({ error }) => error).map(({ error, id }) => ({ text: error.text, href: `#${id}` }))
    ]),
    locationType: typeof values.locationType === 'string' ? values.locationType : '',
    typeError,
    options
  }
}

export function buildAttributesViewModel (request, attributes, invalid = false) {
  const values = Array.isArray(attributes) ? attributes : [attributes]
  return {
    ...getChangeNavigation(request, '/report-issue/data/attributes', '/report-issue/data/location'),
    ...buildFormPage(attributesQuestion, invalid ? [{ text: attributesMessage, href: '#attributes' }] : []),
    attributeOptions,
    attributes: values.filter(value => attributeOptions.some(option => option.value === value)),
    attributesError: invalid ? { text: attributesMessage } : undefined
  }
}
