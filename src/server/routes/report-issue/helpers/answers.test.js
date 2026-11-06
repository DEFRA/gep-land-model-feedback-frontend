import { getIssueAnswers } from './answers.js'

test.each([
  [{ isAuthenticated: true, credentials: { email: 'reporter@example.com' } }, 'reporter@example.com'],
  [{ isAuthenticated: true, credentials: {} }, null],
  [{ isAuthenticated: false, credentials: { email: 'untrusted@example.com' } }, null],
  [undefined, null]
])('captures a submitter email only from an authenticated session: %j', (auth, expected) => {
  const values = { issueType: 'technical', technicalArea: 'map-viewer', issueDescription: 'Test report' }
  const request = { auth, yar: { get: key => values[key] } }
  expect(getIssueAnswers(request).submitterEmail).toBe(expected)
})
