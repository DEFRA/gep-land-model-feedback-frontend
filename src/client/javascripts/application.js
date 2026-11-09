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
import { initScanRefresh } from './scan-refresh.js'
import { initEvidenceFiles } from './evidence-files.js'

initCookieBanner()
initCookiesPage()
initScanRefresh()

createAll(Button)
createAll(Checkboxes)
createAll(CharacterCount)
createAll(ErrorSummary)
createAll(FileUpload)
createAll(Radios)
createAll(SkipLink)

initEvidenceFiles()
