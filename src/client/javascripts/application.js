import {
  createAll,
  Button,
  Checkboxes,
  CharacterCount,
  ErrorSummary,
  FileUpload,
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
createAll(FileUpload)
createAll(Radios)
createAll(SkipLink)
