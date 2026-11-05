import {
  createAll,
  Button,
  Checkboxes,
  ErrorSummary,
  Radios,
  SkipLink
} from 'govuk-frontend'
import { initCookieBanner, initCookiesPage } from './cookies.js'

initCookieBanner()
initCookiesPage()

createAll(Button)
createAll(Checkboxes)
createAll(ErrorSummary)
createAll(Radios)
createAll(SkipLink)
