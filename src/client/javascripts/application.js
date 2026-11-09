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
import { initReportHistory } from './report-history.js'

initReportHistory()
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
