// @vitest-environment jsdom
import { vi } from 'vitest'
import cookies from './cookies.js'
import { createAll, Button, Checkboxes, ErrorSummary, Radios, SkipLink } from 'govuk-frontend'

vi.mock('govuk-frontend', () => ({
  createAll: vi.fn(),
  Button: class {},
  Checkboxes: class {},
  ErrorSummary: class {},
  Radios: class {},
  SkipLink: class {}
}))
vi.mock('./cookies.js', () => ({ default: { init: vi.fn() } }))

test('boots cookie consent and the GOV.UK controls used by the application', async () => {
  await import('./application.js')
  expect(cookies.init).toHaveBeenCalledOnce()
  for (const component of [Button, Checkboxes, ErrorSummary, Radios, SkipLink]) {
    expect(createAll).toHaveBeenCalledWith(component)
  }
})
