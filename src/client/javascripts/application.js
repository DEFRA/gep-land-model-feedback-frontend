import {
  createAll,
  Button,
  Checkboxes,
  CharacterCount,
  ErrorSummary,
  Radios,
  SkipLink
} from 'govuk-frontend'
import { initCookieBanner, initCookiesPage } from './cookies.js'

initCookieBanner()
initCookiesPage()

createAll(Button)
createAll(Checkboxes)
createAll(CharacterCount)
createAll(ErrorSummary)
createAll(Radios)
createAll(SkipLink)
