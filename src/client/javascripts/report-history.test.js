// @vitest-environment jsdom
import { initReportHistory } from './report-history.js'

let handlers
beforeEach(() => {
  document.body.innerHTML = '<main><input value="Previous answer"></main><span hidden data-report-journey-id="journey-one"></span>'
  window.history.replaceState(null, '')
  handlers = {}
  vi.spyOn(window, 'addEventListener').mockImplementation((name, handler) => { handlers[name] = handler })
})
afterEach(() => vi.restoreAllMocks())

test('hides cached answers and revalidates before revealing an active report', async () => {
  const fetchStatus = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ active: true }) })
  const navigate = vi.fn()
  initReportHistory({ fetchStatus, navigate })
  expect(window.history.state.reportJourneyId).toBe('journey-one')
  handlers.pagehide({ persisted: true })
  expect(document.querySelector('main').hidden).toBe(true)
  await handlers.pageshow({ persisted: true })
  expect(fetchStatus).toHaveBeenCalledWith('/report-issue/session-status?journeyId=journey-one', { cache: 'no-store', credentials: 'same-origin', redirect: 'error' })
  expect(document.querySelector('main').hidden).toBe(false)
  expect(navigate).not.toHaveBeenCalled()
})

test.each([false, undefined])('expired cached pages stay hidden and redirect when active is %s', async active => {
  const navigate = vi.fn()
  initReportHistory({ navigate, fetchStatus: async () => ({ ok: true, json: async () => ({ active }) }) })
  await handlers.pageshow({ persisted: true })
  expect(navigate).toHaveBeenCalledWith('/report-issue/session-expired')
  expect(document.querySelector('main').hidden).toBe(true)
})

test('old history entries cannot display a different, newly started report', () => {
  window.history.replaceState({ reportJourneyId: 'old-journey' }, '')
  const navigate = vi.fn()
  initReportHistory({ navigate })
  expect(navigate).toHaveBeenCalledWith('/report-issue/session-expired')
  expect(document.querySelector('main').hidden).toBe(true)
})

test('does not affect ordinary page loads or pages outside the report journey', async () => {
  const fetchStatus = vi.fn()
  initReportHistory({ fetchStatus })
  handlers.pagehide({ persisted: false })
  await handlers.pageshow({ persisted: false })
  expect(document.querySelector('main').hidden).toBe(false)
  expect(fetchStatus).not.toHaveBeenCalled()
  document.querySelector('[data-report-journey-id]').remove()
  window.addEventListener.mockClear()
  initReportHistory()
  expect(window.addEventListener).not.toHaveBeenCalled()
})

test.each(['request', 'response'])('does not reveal old answers when the session check fails: %s', async failure => {
  const navigate = vi.fn()
  const fetchStatus = failure === 'request'
    ? async () => { throw new Error('Network unavailable') }
    : async () => ({ ok: false, json: async () => ({ active: true }) })
  initReportHistory({ navigate, fetchStatus })
  await handlers.pageshow({ persisted: true })
  expect(navigate).toHaveBeenCalledWith('/report-issue/session-expired')
  expect(document.querySelector('main').hidden).toBe(true)
})
