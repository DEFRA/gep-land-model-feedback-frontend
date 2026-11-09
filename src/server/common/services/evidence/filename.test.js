import { attachmentDisposition, evidenceDownloadPath, originalFilename } from './filename.js'

const file = { uploadId: '11111111-1111-4111-8111-111111111111', fileId: '22222222-2222-4222-8222-222222222222', filename: 'original.pdf' }
test('links to the application using uploader UUIDs only', () => {
  expect(evidenceDownloadPath(file)).toBe(`/evidence/download/${file.uploadId}/${file.fileId}`)
  expect(() => evidenceDownloadPath({ ...file, fileId: '../../private' })).toThrow()
})

test('reads ASCII and RFC 2047 encoded uploader filename metadata', () => {
  expect(originalFilename({ filename: 'original.pdf' })).toBe('original.pdf')
  expect(originalFilename({ encodedfilename: '=?UTF-8?Q?=C3=A9tude_1.pdf?=' })).toBe('étude 1.pdf')
  expect(originalFilename({ encodedfilename: '=?UTF-8?B?w6l0dWRl?= =?UTF-8?B?LnBkZg==?=' })).toBe('étude.pdf')
})

test.each([{}, { filename: '../file' }, { filename: 'file\r\nInjected: value' }])('rejects unusable or unsafe filename metadata: %j', metadata => {
  expect(() => originalFilename(metadata)).toThrow('Invalid evidence filename metadata')
})

test('builds a safe attachment header with a UTF-8 filename', () => {
  expect(attachmentDisposition('étude "1".pdf')).toBe('attachment; filename="_tude _1_.pdf"; filename*=UTF-8\'\'%C3%A9tude%20%221%22.pdf')
})
