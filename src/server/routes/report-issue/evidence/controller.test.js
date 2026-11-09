import { createJourneyClient } from '#/server/common/test-helpers/journey-client.js'
vi.mock('#/server/routes/report-issue/issue-reported/email.js', () => ({ sendIssueEmail: vi.fn(async () => ({ id: 'notify-id', recipient: 'atlas-support@example.com' })) }))
import { load } from 'cheerio'
import { createServer } from '#/server/server.js'
import { config } from '#/config/config.js'
import { initiateUpload, getUploadStatus } from '#/server/common/services/uploader/client.js'
vi.mock('#/server/common/services/uploader/client.js', async original => ({
  ...await original(), initiateUpload: vi.fn(), getUploadStatus: vi.fn()
}))

let server
let client
const path = '/report-issue/evidence'
const review = '/report-issue/check-your-answers'
const id = '11111111-1111-4111-8111-111111111111'
const fileId = '22222222-2222-4222-8222-222222222222'
const secondId = '33333333-3333-4333-8333-333333333333'
const clean = (fileIdValue = fileId, filename = 'evidence.txt') => ({ fileId: fileIdValue, filename, fileStatus: 'complete', contentLength: 20, s3Bucket: config.get('uploader.bucket'), s3Key: `evidence/${id}/${fileIdValue}`, contentType: 'text/plain' })
const ready = files => ({ uploadStatus: 'ready', form: files === undefined ? {} : { evidenceFiles: files }, numberOfRejectedFiles: (Array.isArray(files) ? files : [files]).filter(file => file?.hasError || file?.fileStatus === 'rejected').length })
const originalRestrictions = { size: config.get('uploader.maxFileSizeMB'), types: config.get('uploader.allowedMimeTypes') }
beforeAll(async () => { server = await createServer(); await server.initialize() })
afterAll(async () => server.stop({ timeout: 0 }))
afterEach(() => {
  config.set('uploader.maxFileSizeMB', originalRestrictions.size)
  config.set('uploader.allowedMimeTypes', originalRestrictions.types)
})
beforeEach(() => {
  client = createJourneyClient(server)
  initiateUpload.mockReset().mockResolvedValue(id)
  getUploadStatus.mockReset().mockResolvedValue({ uploadStatus: 'initiated' })
})
const visit = (...args) => client.visit(...args)
const post = (url, fields = {}) => client.submit(url, fields, '/')

async function start (changing = false) {
  await post('/', { issueType: 'technical' })
  await post('/report-issue/technical', { technicalArea: 'map-viewer' })
  await post('/report-issue/description', { issueDescription: 'Test upload issue' })
  return visit(changing ? `${path}?returnTo=check-your-answers` : path)
}
const complete = () => visit(`${path}/complete?uploadId=${id}`)

test('renders a direct multipart form without exposing the application CSRF token or status endpoint', async () => {
  const response = await start()
  const $ = load(response.payload)
  expect(response.statusCode).toBe(200)
  expect($('form[enctype="multipart/form-data"]').attr('action')).toBe(`http://localhost:7337/upload-and-scan/${id}`)
  expect($('form[enctype="multipart/form-data"] input[name="crumb"]')).toHaveLength(0)
  expect($('#evidence-files').is('[multiple]')).toBe(true)
  expect($('form[enctype="multipart/form-data"]').attr('data-evidence-continue')).toBe(review)
  expect($('form[enctype="multipart/form-data"] button[type="submit"]').text().trim()).toBe('Continue')
  expect($('button').filter((_index, element) => $(element).text().trim() === 'Upload files')).toHaveLength(0)
  const clear = $('a[data-clear-files="evidenceFiles"]')
  expect(clear.hasClass('govuk-link')).toBe(true)
  expect(clear.attr('href')).toBe('#evidence-files')
  expect(clear.text().trim()).toBe('Clear files')
  expect(clear.hasClass('govuk-!-display-none')).toBe(true)
  expect($('.govuk-file-upload-wrapper').attr('data-i18n.choose-files-button')).toBe('Choose files')
  expect($('.govuk-file-upload-wrapper').attr('data-i18n.drop-instruction')).toBe('or drop files')
  expect($('.govuk-file-upload-wrapper').attr('data-i18n.no-file-chosen')).toBe('No files chosen')
  expect(response.headers['content-security-policy']).toContain('form-action \'self\' http://localhost:7337')
  const active = response.request.yar.get('evidenceUpload')
  expect(active.token).toBeTruthy()
  expect(response.payload).not.toContain(active.token)
  expect(response.payload).not.toContain(`/status/${id}`)
  expect(initiateUpload).toHaveBeenCalledWith('http://localhost:3004/report-issue/evidence/complete', active.token)
  await visit(path)
  expect(initiateUpload).toHaveBeenCalledOnce()
})

test('pending scans show a refresh link enhanced by JavaScript and block review and Submit', async () => {
  await start()
  getUploadStatus.mockResolvedValue({ uploadStatus: 'pending' })
  const waiting = await complete()
  expect(waiting.statusCode).toBe(200)
  expect(load(waiting.payload)('h1').text()).toBe('Checking your files')
  expect(load(waiting.payload)('meta[http-equiv="refresh"]').length).toBe(0)
  expect(load(waiting.payload)('a.govuk-link[data-scan-refresh]').attr('href')).toBe(`${path}/complete?uploadId=${id}`)
  expect(load(waiting.payload)('a.govuk-button')).toHaveLength(0)
  for (const response of [await visit(path), await visit(review), await post(review)]) {
    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe(`${path}/complete?uploadId=${id}`)
  }
})

test('shows configured restrictions and applies MIME types to the GOV.UK file upload', async () => {
  config.set('uploader.maxFileSizeMB', 2.5)
  config.set('uploader.allowedMimeTypes', ['application/pdf', 'image/png'])
  const $ = load((await start()).payload)
  expect($('#evidence-files').attr('accept')).toBe('application/pdf, image/png')
  expect($('#evidence-files-hint').text()).toContain('2.5 MB or smaller')
  expect($('#evidence-files-hint').text()).toContain('Allowed file types: application/pdf, image/png')
})

test('does not restrict the file picker when the MIME allowlist is empty', async () => {
  const $ = load((await start()).payload)
  expect($('#evidence-files').attr('accept')).toBeUndefined()
  expect($('#evidence-files-hint').text()).not.toContain('Allowed file types:')
})

test.each(['The selected file is too large', 'The selected file type is not supported'])('displays uploader restriction errors: %s', async errorMessage => {
  await start()
  getUploadStatus.mockResolvedValue(ready({ filename: 'evidence.bin', fileStatus: 'rejected', hasError: true, errorMessage }))
  await complete()
  getUploadStatus.mockResolvedValue({ uploadStatus: 'initiated' })
  const response = await visit(path)
  const $ = load(response.payload)
  expect(response.statusCode).toBe(400)
  expect($('.govuk-error-summary__list a').text()).toBe(`evidence.bin: ${errorMessage}`)
  expect($('#evidence-files-error').text()).toContain(errorMessage)
  expect(response.request.yar.get('evidenceFiles')).toEqual([])
})

test('accepts multiple clean files, preserves their private S3 references and displays their names in the review and receipt', async () => {
  await start()
  getUploadStatus.mockResolvedValue(ready([clean(), clean(secondId, 'second.txt')]))
  const result = await complete()
  expect(result.headers.location).toBe(review)
  expect(result.request.yar.get('evidenceFiles')).toHaveLength(2)
  expect(result.request.yar.get('evidenceFiles')[0]).toMatchObject({ fileId, uploadId: id, filename: 'evidence.txt', s3Key: `evidence/${id}/${fileId}` })
  expect(result.request.yar.get('evidenceUpload')).toBeNull()
  getUploadStatus.mockResolvedValue({ uploadStatus: 'initiated' })
  const evidence = await visit(path)
  expect(load(evidence.payload)('.govuk-table').text()).toContain('second.txt')
  const summary = await visit(review)
  expect(summary.payload).toContain('evidence.txt<br>second.txt')
  expect(summary.payload).not.toContain(`evidence/${id}/`)
  const submitted = await post(review)
  expect(submitted.request.yar.get('reportedIssue').answers.files).toHaveLength(2)
})

test('a single-file status is supported and completion replay cannot duplicate the attachment', async () => {
  await start()
  getUploadStatus.mockResolvedValue(ready(clean()))
  const response = await complete()
  expect(response.request.yar.get('evidenceFiles')).toHaveLength(1)
  expect(response.headers.location).toBe(review)
  expect((await complete()).headers.location).toBe(path)
})

test('keeps clean files from a mixed batch and displays rejected-file messages as escaped text', async () => {
  await start(true)
  const rejected = { fileStatus: 'rejected', hasError: true, errorMessage: '<script>Rejected virus</script>' }
  getUploadStatus.mockResolvedValue(ready([clean(), rejected]))
  const response = await complete()
  expect(response.headers.location).toBe(`${path}?returnTo=check-your-answers`)
  expect(response.request.yar.get('evidenceFiles')).toHaveLength(1)
  getUploadStatus.mockResolvedValue({ uploadStatus: 'initiated' })
  const page = await visit(response.headers.location)
  const $ = load(page.payload)
  expect(page.statusCode).toBe(400)
  expect($('.govuk-error-summary__list a').text()).toBe('<script>Rejected virus</script>')
  expect(page.payload).not.toContain('<script>Rejected virus</script>')
  expect($('#evidence-files-error').text()).toContain('Rejected virus')
  expect($('.govuk-table').text()).toContain('evidence.txt')
})

test('an empty upload displays Select a file while evidence remains optional', async () => {
  await start()
  getUploadStatus.mockResolvedValue(ready(undefined))
  await complete()
  getUploadStatus.mockResolvedValue({ uploadStatus: 'initiated' })
  const page = await visit(path)
  expect(page.statusCode).toBe(400)
  expect(load(page.payload)('#evidence-files-error').text()).toContain('Select a file')
  expect((await visit(review)).statusCode).toBe(200)
})

test.each([
  { s3Bucket: 'other-bucket' }, { s3Key: 'foreign/key' }, { fileStatus: 'pending' }, { contentLength: 0 }, { fileId: 'forged' }
])('rejects incomplete or foreign S3 results: %j', async invalid => {
  await start()
  getUploadStatus.mockResolvedValue(ready({ ...clean(), ...invalid }))
  const response = await complete()
  expect(response.statusCode).toBe(503)
  expect(response.request.yar.get('evidenceFiles')).toBeNull()
  expect(response.request.yar.get('evidenceUpload')).toBeTruthy()
})

test('rejects inconsistent rejected counts and uses a fallback for missing rejection text', async () => {
  await start()
  getUploadStatus.mockResolvedValue({ ...ready(clean()), numberOfRejectedFiles: 1 })
  expect((await complete()).statusCode).toBe(503)
  getUploadStatus.mockResolvedValue(ready({ fileStatus: 'rejected', hasError: true }))
  await complete()
  getUploadStatus.mockResolvedValue({ uploadStatus: 'initiated' })
  expect((await visit(path)).payload).toContain('The selected file could not be uploaded')
})

test('removes only the session attachment with CSRF protection', async () => {
  await start()
  getUploadStatus.mockResolvedValue(ready([clean(), clean(secondId)]))
  await complete()
  const $ = load((await visit(path)).payload)
  const remove = $(`form[action="${path}/remove/${fileId}"] button`)
  expect(remove.hasClass('govuk-link')).toBe(true)
  expect(remove.hasClass('govuk-button')).toBe(false)
  expect(remove.attr('type')).toBe('submit')
  expect(remove.text()).toContain('Remove')
  expect(remove.text()).toContain('evidence.txt')
  expect((await visit(`${path}/remove/${fileId}`, {})).statusCode).toBe(403)
  const response = await post(`${path}/remove/${fileId}?returnTo=check-your-answers`)
  expect(response.headers.location).toBe(`${path}?returnTo=check-your-answers`)
  expect(response.request.yar.get('evidenceFiles').map(file => file.fileId)).toEqual([secondId])
})

test('does not trust another session or callback upload ID', async () => {
  await start()
  getUploadStatus.mockClear()
  const response = await visit(`${path}/complete?uploadId=${secondId}`)
  expect(response.headers.location).toBe(path)
  expect(getUploadStatus).not.toHaveBeenCalled()
  const ownClient = client
  client = createJourneyClient(server)
  await post('/', { issueType: 'technical' })
  await post('/report-issue/technical', { technicalArea: 'map-viewer' })
  await post('/report-issue/description', { issueDescription: 'Other session' })
  expect((await complete()).headers.location).toBe(path)
  client = ownClient
  expect((await complete()).statusCode).toBe(200)
})

test('shows retry pages on API failures and allows optional evidence to be skipped if initiation failed', async () => {
  initiateUpload.mockRejectedValueOnce(new Error('Network failure'))
  const response = await start()
  expect(response.statusCode).toBe(503)
  expect(response.payload).toContain('Continue without adding more files')
  expect((await visit(review)).statusCode).toBe(200)
  await visit(path)
  getUploadStatus.mockRejectedValue(new Error('Status failure'))
  expect((await visit(path)).statusCode).toBe(503)
  expect((await complete()).statusCode).toBe(503)
  expect((await visit(review)).statusCode).toBe(503)
  expect((await post(review)).statusCode).toBe(503)
})

test('recovers from expired upload sessions without losing existing attachments', async () => {
  await start()
  getUploadStatus.mockRejectedValueOnce(Object.assign(new Error('Expired'), { statusCode: 404 }))
  expect((await complete()).headers.location).toBe(path)
  const newPage = await visit(path)
  expect(newPage.statusCode).toBe(400)
  expect(newPage.payload).toContain('The upload has expired')
  getUploadStatus.mockRejectedValueOnce(Object.assign(new Error('Expired'), { statusCode: 404 }))
  expect((await visit(review)).statusCode).toBe(200)
})

test('guards workflow steps and authentication on completion and removal', async () => {
  for (const response of [await visit(path), await visit(`${path}/complete`), await post(`${path}/remove/${fileId}`)]) {
    expect(response.headers.location).toBe('/')
  }
  const response = await server.inject({ url: `${path}/complete` })
  expect(response.statusCode).toBe(302)
  expect(response.headers.location).toMatch(/^\/auth\/login/)
})

test('successful uploads from change answers continue straight back to review', async () => {
  await start(true)
  getUploadStatus.mockResolvedValue(ready(clean()))
  const response = await complete()
  expect(response.headers.location).toBe(review)
  expect((await visit(review)).payload).toContain('evidence.txt')
})

test('Continue without a pending upload reaches review with no evidence', async () => {
  await start()
  const response = await visit(review)
  expect(response.statusCode).toBe(200)
  expect(response.request.yar.get('evidenceFiles')).toBeNull()
})
