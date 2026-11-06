import { getOrCreateReceipt } from './receipt.js'

test('reuses accepted receipts even when snapshot properties were stored in a different order', () => {
  const answers = { issueType: 'technical', description: 'Example', files: [] }
  const previous = { id: 'existing-id', answers: { files: [], description: 'Example', issueType: 'technical' }, notification: { id: 'accepted-id' } }
  expect(getOrCreateReceipt(answers, previous)).toBe(previous)
})

test('new receipts hold a snapshot independent of subsequent input changes', () => {
  const answers = { issueType: 'data', attributes: ['land-cover'], files: [{ filename: 'example.pdf' }] }
  const report = getOrCreateReceipt(answers)
  answers.attributes.push('soils')
  answers.files[0].filename = 'changed.pdf'
  expect(report.answers.attributes).toEqual(['land-cover'])
  expect(report.answers.files[0].filename).toBe('example.pdf')
  expect(getOrCreateReceipt(answers, report).id).not.toBe(report.id)
})
