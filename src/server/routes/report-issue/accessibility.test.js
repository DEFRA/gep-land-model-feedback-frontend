/** @vitest-environment jsdom */
import axe from 'axe-core'

import { createServer } from '#/server/server.js'
import { createJourneyClient } from '#/server/common/test-helpers/journey-client.js'
import { getUploadStatus, initiateUpload } from '#/server/common/services/uploader/client.js'
import { sendIssueEmail } from './issue-reported/email.js'

vi.hoisted(() => vi.stubEnv('GOOGLE_TAG_MANAGER_KEY', 'GTM-TEST123'))
vi.mock('#/server/common/services/geonetwork/client.js', () => ({ listDatasets: vi.fn(async () => [{ id: 'dataset-id', title: 'Example dataset' }]) }))
vi.mock('#/server/common/services/uploader/client.js', async original => ({
  ...await original(),
  initiateUpload: vi.fn(),
  getUploadStatus: vi.fn()
}))
vi.mock('./issue-reported/email.js', () => ({ sendIssueEmail: vi.fn() }))

const uploadId = '11111111-1111-4111-8111-111111111111'
const fileId = '22222222-2222-4222-8222-222222222222'
let server
let client

beforeAll(async () => { server = await createServer(); await server.initialize() })
afterAll(async () => { await server.stop({ timeout: 0 }); vi.unstubAllEnvs() })
beforeEach(() => {
  client = createJourneyClient(server)
  initiateUpload.mockReset().mockResolvedValue(uploadId)
  getUploadStatus.mockReset().mockResolvedValue({ uploadStatus: 'initiated' })
  sendIssueEmail.mockReset().mockResolvedValue({ id: 'notify-id', submitterCopy: { id: 'copy-id', recipient: 'reporter@example.com' }, recipient: 'support@example.com' })
})

async function audit (response) {
  expect(response.statusCode).toBeLessThan(400)
  return auditHtml(response.payload)
}

async function auditHtml (html) {
  const parsed = new globalThis.DOMParser().parseFromString(html, 'text/html')
  document.documentElement.replaceWith(document.importNode(parsed.documentElement, true))
  const result = await axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    // JSDOM has no layout engine. Contrast and responsive layout are checked in a browser.
    rules: { 'color-contrast': { enabled: false } }
  })
  expect(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([])
}

async function dataJourney (other = false) {
  await client.submit('/', { issueType: 'data' })
  await client.submit('/report-issue/data', other ? { dataset: 'other', datasetOtherId: 'dataset-id' } : { dataset: 'land-model' })
}

async function technicalJourney () {
  await client.submit('/', { issueType: 'technical' })
  await client.submit('/report-issue/technical', { technicalArea: 'map-viewer' })
  await client.submit('/report-issue/description', { issueDescription: 'Example issue' })
}

test.each(['/', '/about', '/privacy', '/accessibility-statement', '/cookies'])('accessible page structure at %s', async path => {
  await audit(await client.visit(path))
})

test('home and technical validation states', async () => {
  await auditHtml((await client.submit('/', {})).payload)
  await client.submit('/', { issueType: 'technical' })
  await audit(await client.visit('/report-issue/technical'))
  await auditHtml((await client.submit('/report-issue/technical', { technicalArea: 'other' })).payload)
})

test('dataset, conditional select and catalogue validation states', async () => {
  await client.submit('/', { issueType: 'data' })
  await audit(await client.visit('/report-issue/data'))
  await auditHtml((await client.submit('/report-issue/data', {})).payload)
  await auditHtml((await client.submit('/report-issue/data', { dataset: 'other' })).payload)
})

test('location, conditional field errors and attributes', async () => {
  await dataJourney()
  await audit(await client.visit('/report-issue/data/location'))
  for (const locationType of ['grid', 'feature', 'other']) {
    await auditHtml((await client.submit('/report-issue/data/location', { locationType })).payload)
  }
  for (const fields of [{ locationType: 'grid', gridReference: 'ZZ' }, { locationType: 'feature', featureReference: 'invalid' }]) {
    await auditHtml((await client.submit('/report-issue/data/location', fields)).payload)
  }
  await client.submit('/report-issue/data/location', { locationType: 'grid', gridReference: 'SE' })
  await audit(await client.visit('/report-issue/data/attributes'))
  await auditHtml((await client.submit('/report-issue/data/attributes', {})).payload)
})

test.each([false, true])('description and validation for other dataset=%s', async other => {
  await dataJourney(other)
  if (!other) {
    await client.submit('/report-issue/data/location', { locationType: 'grid', gridReference: 'SE' })
    await client.submit('/report-issue/data/attributes', { attributes: 'land-cover' })
  }
  await audit(await client.visit('/report-issue/description'))
  await auditHtml((await client.submit('/report-issue/description', {})).payload)
  await auditHtml((await client.submit('/report-issue/description', { issueWhere: 'Near the village', issueDescription: 'x'.repeat(2001) })).payload)
})

test('evidence, completed attachments, review and confirmation', async () => {
  await technicalJourney()
  await audit(await client.visit('/report-issue/evidence'))
  getUploadStatus.mockResolvedValue({
    uploadStatus: 'ready',
    numberOfRejectedFiles: 0,
    form: { evidenceFiles: { fileId, filename: 'evidence.txt', fileStatus: 'complete', contentLength: 10, s3Bucket: 'atlas-feedback-evidence', s3Key: `evidence/${uploadId}/${fileId}` } }
  })
  await client.visit('/report-issue/evidence/complete')
  getUploadStatus.mockResolvedValue({ uploadStatus: 'initiated' })
  await audit(await client.visit('/report-issue/evidence'))
  await audit(await client.visit('/report-issue/check-your-answers'))
  await client.submit('/report-issue/check-your-answers')
  await audit(await client.visit('/report-issue/issue-reported'))
})

test('pending checks and service failure pages', async () => {
  await technicalJourney()
  await client.visit('/report-issue/evidence')
  getUploadStatus.mockResolvedValue({ uploadStatus: 'pending' })
  await audit(await client.visit('/report-issue/evidence/complete'))
  getUploadStatus.mockRejectedValue(new Error('Unavailable'))
  await auditHtml((await client.visit('/report-issue/evidence')).payload)
  getUploadStatus.mockResolvedValue({ uploadStatus: 'initiated' })
  sendIssueEmail.mockRejectedValue(new Error('Unavailable'))
  await auditHtml((await client.submit('/report-issue/check-your-answers')).payload)
})

test('cookie settings confirmation', async () => {
  await client.submit('/cookies', { analytics: 'false', async: 'false' })
  await audit(await client.visit('/cookies?updated=true'))
})

test('rejected evidence and accepted files share accessible error and table markup', async () => {
  await technicalJourney()
  await client.visit('/report-issue/evidence')
  getUploadStatus.mockResolvedValue({
    uploadStatus: 'ready',
    numberOfRejectedFiles: 1,
    form: {
      evidenceFiles: [
        { fileId, filename: 'evidence.txt', fileStatus: 'complete', contentLength: 10, s3Bucket: 'atlas-feedback-evidence', s3Key: `evidence/${uploadId}/${fileId}` },
        { filename: 'rejected.txt', fileStatus: 'rejected', errorMessage: 'The selected file contains a virus' }
      ]
    }
  })
  await client.visit('/report-issue/evidence/complete')
  getUploadStatus.mockResolvedValue({ uploadStatus: 'initiated' })
  const response = await client.visit('/report-issue/evidence')
  expect(response.statusCode).toBe(400)
  await auditHtml(response.payload)
})
