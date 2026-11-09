const SCAN_REFRESH_INTERVAL_MS = 5000

/** Refresh the scanning page once; the next pending page schedules another check. */
export function initScanRefresh (navigate = url => window.location.assign(url)) {
  const link = document.querySelector('[data-scan-refresh]')
  if (!link) {
    return
  }
  const message = document.querySelector('[data-scan-refresh-message]')
  if (message) {
    message.textContent = 'This page will automatically refresh every 5 seconds. You can also select Check again to check now.'
  }
  const timer = window.setTimeout(() => navigate(link.href), SCAN_REFRESH_INTERVAL_MS)
  window.addEventListener('pagehide', () => window.clearTimeout(timer), { once: true })
}
