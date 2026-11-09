import { isExcludedFile, fileExclusionMessage } from '../common/helpers/file-exclusions.js'

const ARIA_DESCRIBED_BY = 'aria-describedby'
const ARIA_INVALID = 'aria-invalid'

/** Use the same exclusion rule in the browser and when processing scan results. */
export function fileExclusionValidator (form, input) {
  const extensions = (form.dataset.excludedFileExtensions ?? '').split(',').map(value => value.trim()).filter(Boolean)
  const summary = document.querySelector('[data-file-exclusion-summary]')
  const error = form.querySelector('[data-file-exclusion-error]')
  const group = input.closest('.govuk-form-group')
  const hadGroupError = group?.classList.contains('govuk-form-group--error')
  const controls = [input, form.querySelector('button.govuk-file-upload-button')].filter(Boolean)
  const attributes = controls.map(control => ({
    control,
    describedBy: control.getAttribute(ARIA_DESCRIBED_BY),
    invalid: control.getAttribute(ARIA_INVALID)
  }))

  return (focus = false) => {
    const messages = Array.from(input.files).filter(file => isExcludedFile(file.name, extensions)).map(file => fileExclusionMessage(file.name))
    if (!summary || !error) {
      return messages.length === 0
    }
    summary.hidden = messages.length === 0
    error.hidden = messages.length === 0
    error.querySelector('[data-file-exclusion-message]').textContent = messages.join(' ')
    group?.classList.toggle('govuk-form-group--error', hadGroupError || messages.length > 0)
    let list = summary.querySelector('.govuk-error-summary__list')
    if (!list) {
      list = document.createElement('ul')
      list.className = 'govuk-list govuk-error-summary__list'
      summary.querySelector('.govuk-error-summary__body').append(list)
    }
    list.replaceChildren()
    for (const message of messages) {
      const item = document.createElement('li')
      const link = document.createElement('a')
      link.href = '#evidence-files'
      link.textContent = message
      item.append(link)
      list.append(item)
    }
    for (const { control, describedBy, invalid } of attributes) {
      if (messages.length) {
        control.setAttribute(ARIA_INVALID, 'true')
        control.setAttribute(ARIA_DESCRIBED_BY, [describedBy, error.id].filter(Boolean).join(' '))
      } else {
        restoreAttribute(control, ARIA_DESCRIBED_BY, describedBy)
        restoreAttribute(control, ARIA_INVALID, invalid)
      }
    }
    if (focus && messages.length) {
      summary.focus()
    }
    return messages.length === 0
  }
}

function restoreAttribute (element, name, value) {
  if (value === null) {
    element.removeAttribute(name)
  } else {
    element.setAttribute(name, value)
  }
}
