// @vitest-environment jsdom
import { initReportHistory } from './report-history.js'
import { vi } from 'vitest'
import { initCookieBanner, initCookiesPage } from './cookies.js'
import { initScanRefresh } from './scan-refresh.js'
import { initEvidenceFiles } from './evidence-files.js'
import { createAll, Button, Checkboxes, CharacterCount, ErrorSummary, FileUpload, Radios, SkipLink } from 'govuk-frontend'

vi.mock('govuk-frontend', () => ({
  createAll: vi.fn(),
  Button: class {},
  Checkboxes: class {},
  CharacterCount: class {},
  ErrorSummary: class {},
  FileUpload: class {},
  Radios: class {},
  SkipLink: class {}
}))
vi.mock('./report-history.js', () => ({ initReportHistory: vi.fn() }))
vi.mock('./evidence-files.js', () => ({ initEvidenceFiles: vi.fn() }))
vi.mock('./scan-refresh.js', () => ({ initScanRefresh: vi.fn() }))
vi.mock('./cookies.js', () => ({ initCookieBanner: vi.fn(), initCookiesPage: vi.fn() }))

test('boots cookie consent and the GOV.UK controls used by the application', async () => {
  await import('./application.js')
  expect(initReportHistory).toHaveBeenCalledOnce()
  expect(initCookieBanner).toHaveBeenCalledOnce()
  expect(initCookiesPage).toHaveBeenCalledOnce()
  expect(initScanRefresh).toHaveBeenCalledOnce()
  expect(initEvidenceFiles).toHaveBeenCalledOnce()
  for (const component of [Button, Checkboxes, CharacterCount, ErrorSummary, FileUpload, Radios, SkipLink]) {
    expect(createAll).toHaveBeenCalledWith(component)
  }
})
