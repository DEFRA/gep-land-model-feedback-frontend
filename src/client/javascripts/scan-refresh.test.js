// @vitest-environment jsdom
import { initScanRefresh } from './scan-refresh.js'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => {
  window.dispatchEvent(new Event('pagehide'))
  vi.useRealTimers()
  document.body.innerHTML = ''
})

test('checks scan status after five seconds using the manual link destination', () => {
  document.body.innerHTML = '<a href="/report-issue/evidence/complete?uploadId=123" data-scan-refresh>Check again</a>'
  const navigate = vi.fn()
  initScanRefresh(navigate)
  vi.advanceTimersByTime(4999)
  expect(navigate).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1)
  expect(navigate).toHaveBeenCalledExactlyOnceWith(document.querySelector('a').href)
  vi.advanceTimersByTime(5000)
  expect(navigate).toHaveBeenCalledOnce()
})

test('does not refresh other pages', () => {
  const navigate = vi.fn()
  initScanRefresh(navigate)
  vi.advanceTimersByTime(10000)
  expect(navigate).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

test('cancels the refresh when leaving the scanning page', () => {
  document.body.innerHTML = '<a href="/report-issue/evidence/complete?uploadId=123" data-scan-refresh>Check again</a>'
  const navigate = vi.fn()
  initScanRefresh(navigate)
  window.dispatchEvent(new Event('pagehide'))
  vi.advanceTimersByTime(5000)
  expect(navigate).not.toHaveBeenCalled()
})
