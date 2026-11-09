// @vitest-environment jsdom
import { FileUpload } from 'govuk-frontend'
import { initEvidenceFiles } from './evidence-files.js'

beforeEach(() => {
  document.body.innerHTML = `<form action="/upload-and-scan/test" method="post" data-evidence-continue="/report-issue/check-your-answers">
    <div data-module="govuk-file-upload"><label for="evidence-files">Evidence</label><input id="evidence-files" name="evidenceFiles" type="file" multiple></div>
    <input name="other" value="keep me">
    <a href="#evidence-files" class="govuk-link govuk-!-display-none" data-clear-files="evidenceFiles">Clear files</a>
  </form><div id="uploaded-files">Already uploaded.pdf</div>`
})
afterEach(() => { document.body.innerHTML = '' })

function selectFile (input) {
  // Model browser selection and clearing; scripts cannot assign a native file input value.
  Object.defineProperty(input, 'value', { value: 'C:\\fakepath\\pending.pdf', writable: true, configurable: true })
  Object.defineProperty(input, 'files', { get: () => input.value ? [new File(['evidence'], 'pending.pdf')] : [], configurable: true })
}

test('clears only the pending selection and emits change to update the upload component', () => {
  const input = document.getElementById('evidence-files')
  selectFile(input)
  const changed = vi.fn()
  input.addEventListener('change', changed)
  const submit = vi.fn(event => event.preventDefault())
  document.querySelector('form').addEventListener('submit', submit)
  initEvidenceFiles()
  const link = document.querySelector('[data-clear-files]')
  expect(link.classList.contains('govuk-!-display-none')).toBe(false)
  const click = new window.MouseEvent('click', { bubbles: true, cancelable: true })
  link.dispatchEvent(click)
  expect(click.defaultPrevented).toBe(true)
  expect(input.value).toBe('')
  expect(link.classList.contains('govuk-!-display-none')).toBe(true)
  expect(changed).toHaveBeenCalledOnce()
  expect(document.querySelector('[name="other"]').value).toBe('keep me')
  expect(document.getElementById('uploaded-files').textContent).toBe('Already uploaded.pdf')
  expect(submit).not.toHaveBeenCalled()
})

test('leaves the clear link hidden when there is no matching file input', () => {
  document.getElementById('evidence-files').remove()
  initEvidenceFiles()
  expect(document.querySelector('[data-clear-files]').classList.contains('govuk-!-display-none')).toBe(true)
})

test('shows the clear link after the real GOV.UK component renames the input and updates its display', () => {
  document.body.classList.add('govuk-frontend-supported')
  try {
    const component = new FileUpload(document.querySelector('[data-module="govuk-file-upload"]'))
    const input = document.querySelector('input[type="file"]')
    expect(input.id).toBe('evidence-files-input')
    const link = document.querySelector('[data-clear-files]')
    initEvidenceFiles()
    expect(link.classList.contains('govuk-!-display-none')).toBe(true)
    selectFile(input)
    input.dispatchEvent(new Event('change', { bubbles: true }))
    expect(link.classList.contains('govuk-!-display-none')).toBe(false)
    expect(component.$status.innerText).toBe('pending.pdf')
    link.click()
    expect(input.value).toBe('')
    expect(link.classList.contains('govuk-!-display-none')).toBe(true)
    expect(component.$status.innerText).toBe('No file chosen')
    expect(component.$button.classList.contains('govuk-file-upload-button--empty')).toBe(true)
  } finally {
    document.body.classList.remove('govuk-frontend-supported')
  }
})

test('hides the link again when the file selection becomes empty', () => {
  const input = document.querySelector('input[type="file"]')
  const link = document.querySelector('[data-clear-files]')
  initEvidenceFiles()
  expect(link.classList.contains('govuk-!-display-none')).toBe(true)
  selectFile(input)
  input.dispatchEvent(new Event('change', { bubbles: true }))
  expect(link.classList.contains('govuk-!-display-none')).toBe(false)
  input.value = ''
  input.dispatchEvent(new Event('change', { bubbles: true }))
  expect(link.classList.contains('govuk-!-display-none')).toBe(true)
})

test('Continue skips uploading when no files are selected', () => {
  const navigate = vi.fn()
  initEvidenceFiles(navigate)
  const event = new Event('submit', { bubbles: true, cancelable: true })
  document.querySelector('form').dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  expect(navigate).toHaveBeenCalledExactlyOnceWith('/report-issue/check-your-answers')
})

test('Continue submits selected files directly to CDP Uploader', () => {
  selectFile(document.querySelector('input[type="file"]'))
  const navigate = vi.fn()
  initEvidenceFiles(navigate)
  const form = document.querySelector('form')
  const event = new Event('submit', { bubbles: true, cancelable: true })
  form.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(false)
  expect(form.getAttribute('action')).toBe('/upload-and-scan/test')
  expect(navigate).not.toHaveBeenCalled()
})

test('clearing selected files makes Continue skip uploading', () => {
  selectFile(document.querySelector('input[type="file"]'))
  const navigate = vi.fn()
  initEvidenceFiles(navigate)
  document.querySelector('[data-clear-files]').click()
  const event = new Event('submit', { bubbles: true, cancelable: true })
  document.querySelector('form').dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  expect(navigate).toHaveBeenCalledExactlyOnceWith('/report-issue/check-your-answers')
})
