// @vitest-environment jsdom
import { vi } from 'vitest'
import { initCookieBanner, initCookiesPage } from './cookies.js'
import { createAll, Button, Checkboxes, CharacterCount, ErrorSummary, Radios, SkipLink } from 'govuk-frontend'

vi.mock('govuk-frontend', () => ({
  createAll: vi.fn(),
  Button: class {},
  Checkboxes: class {},
  CharacterCount: class {},
  ErrorSummary: class {},
  Radios: class {},
  SkipLink: class {}
}))
vi.mock('./cookies.js', () => ({ initCookieBanner: vi.fn(), initCookiesPage: vi.fn() }))

test('boots cookie consent and the GOV.UK controls used by the application', async () => {
  await import('./application.js')
  expect(initCookieBanner).toHaveBeenCalledOnce()
  expect(initCookiesPage).toHaveBeenCalledOnce()
  for (const component of [Button, Checkboxes, CharacterCount, ErrorSummary, Radios, SkipLink]) {
    expect(createAll).toHaveBeenCalledWith(component)
  }
})
