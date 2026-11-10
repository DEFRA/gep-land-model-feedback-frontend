import { completeReport, ensureReportJourney, isSubmissionComplete, startReport } from './report-session.js'

function session (values = {}) {
  const store = new Map(Object.entries(values))
  return { store, yar: { get: key => store.get(key) ?? null, set: (key, value) => store.set(key, value), clear: key => store.delete(key), flash: vi.fn() } }
}

test('completion retains notification recipients while removing answers and upload references without signing out', () => {
  const answers = {
    issueType: 'data',
    dataset: 'other',
    datasetOtherId: 'id',
    datasetOtherTitle: 'Title',
    issueLocation: { gridReference: 'SK1481' },
    incorrectAttributes: ['soils'],
    technicalArea: 'other',
    technicalOther: 'Previous technical answer',
    issueWhere: 'Near the village',
    issueDescription: 'Private description',
    evidenceFiles: [{ filename: 'private.pdf' }],
    evidenceUpload: { token: 'private-token' }
  }
  const request = session({ ...answers, 'oidc-auth': { verifier: 'login-session' }, reportJourney: { id: 'journey-one', completed: false } })
  completeReport(request, { id: 'report-id', reference: 'ABC123', answers, notification: { id: 'notify-id', recipient: 'support@example.com', submitterCopy: { id: 'copy-id', recipient: 'reporter@example.com', body: 'Private email content' } } })
  for (const key of Object.keys(answers)) {
    expect(request.store.has(key)).toBe(false)
  }
  expect(request.yar.get('reportedIssue')).toEqual({ id: 'report-id', reference: 'ABC123', completed: true, notification: { id: 'notify-id', recipient: 'support@example.com', submitterCopy: { id: 'copy-id', recipient: 'reporter@example.com' } } })
  expect(request.yar.get('reportJourney')).toEqual({ id: 'journey-one', completed: true })
  expect(request.yar.get('oidc-auth')).toEqual({ verifier: 'login-session' })
  expect(request.yar.flash).toHaveBeenCalledWith('evidenceErrors')
})

test('new reports get a distinct journey and remove the old confirmation', () => {
  const request = session({ reportJourney: { id: 'previous-id', completed: true }, reportedIssue: { completed: true } })
  startReport(request)
  expect(request.yar.get('reportedIssue')).toBeNull()
  expect(request.yar.get('reportJourney')).toMatchObject({ id: expect.any(String), completed: false })
  expect(request.yar.get('reportJourney').id).not.toBe('previous-id')
})

test('existing unfinished sessions retain their answers when assigned a journey ID', () => {
  const request = session({ issueDescription: 'Work in progress' })
  const journey = ensureReportJourney(request)
  expect(ensureReportJourney(request)).toEqual(journey)
  expect(request.yar.get('issueDescription')).toBe('Work in progress')
})

test('completion can migrate older sessions and requires both emails when there is a submitter address', () => {
  const request = session()
  const report = { id: 'report-id', reference: 'ABC123', answers: { submitterEmail: 'reporter@example.com' }, notification: { id: 'notify-id', recipient: 'support@example.com' } }
  expect(isSubmissionComplete(report)).toBe(false)
  report.notification.submitterCopy = { id: 'copy-id' }
  expect(isSubmissionComplete(report)).toBe(true)
  completeReport(request, report)
  expect(request.yar.get('reportJourney')).toMatchObject({ id: expect.any(String), completed: true })
  expect(isSubmissionComplete(request.yar.get('reportedIssue'))).toBe(true)
})
