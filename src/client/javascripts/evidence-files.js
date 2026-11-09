/** Clear pending files and make Continue upload only when files are selected. */
export function initEvidenceFiles (navigate = url => window.location.assign(url)) {
  for (const link of document.querySelectorAll('[data-clear-files]')) {
    // GOV.UK enhancement changes the input ID, but preserves its form field name.
    const form = link.closest('form')
    const input = form?.elements.namedItem(link.dataset.clearFiles)
    if (!input || input.type !== 'file') {
      continue
    }
    const updateVisibility = () => link.classList.toggle('govuk-!-display-none', input.files.length === 0)
    input.addEventListener('change', updateVisibility)
    link.addEventListener('click', event => {
      event.preventDefault()
      input.value = ''
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    if (form.dataset.evidenceContinue) {
      form.addEventListener('submit', event => {
        if (input.files.length === 0) {
          event.preventDefault()
          navigate(form.dataset.evidenceContinue)
        }
      })
    }
    updateVisibility()
  }
}
