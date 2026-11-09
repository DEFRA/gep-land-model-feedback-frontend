const expiredPath = '/report-issue/session-expired'

/** Revalidate restored forms before revealing answers held in browser history. */
export function initReportHistory ({ navigate = url => window.location.replace(url), fetchStatus = window.fetch?.bind(window) } = {}) {
  const marker = document.querySelector('[data-report-journey-id]')
  if (!marker) {
    return
  }
  const journeyId = marker.dataset.reportJourneyId
  const main = document.querySelector('main')
  const previousJourney = window.history.state?.reportJourneyId
  if (previousJourney && previousJourney !== journeyId) {
    if (main) { main.hidden = true }
    navigate(expiredPath)
    return
  }
  window.history.replaceState({ ...window.history.state, reportJourneyId: journeyId }, '')
  window.addEventListener('pagehide', event => {
    if (event.persisted && main) {
      main.hidden = true
    }
  })
  window.addEventListener('pageshow', async event => {
    if (!event.persisted) {
      return
    }
    if (main) { main.hidden = true }
    try {
      const response = await fetchStatus(`/report-issue/session-status?journeyId=${encodeURIComponent(journeyId)}`, {
        cache: 'no-store', credentials: 'same-origin', redirect: 'error'
      })
      const result = await response.json()
      if (!response.ok || result.active !== true) {
        navigate(expiredPath)
        return
      }
      if (main) { main.hidden = false }
    } catch {
      navigate(expiredPath)
    }
  })
}
