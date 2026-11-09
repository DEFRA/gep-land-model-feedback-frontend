import { isExcludedFile } from './file-exclusions.js'

test.each(['program.exe', 'PROGRAM.EXE', 'photo.pdf.exe', '.exe', 'program.exe. ', 'program.exe:stream', 'folder/program.exe', 'C:\\folder\\program.exe'])('rejects an excluded filename: %s', filename => {
  expect(isExcludedFile(filename, ['.exe'])).toBe(true)
})

test.each(['evidence.pdf', 'exe', 'program.exe.pdf', 'example.txt'])('allows a filename without an excluded suffix: %s', filename => {
  expect(isExcludedFile(filename, ['.exe'])).toBe(false)
})

test('supports custom compound extensions and an empty list', () => {
  expect(isExcludedFile('archive.TAR.GZ', ['.tar.gz'])).toBe(true)
  expect(isExcludedFile('program.exe', [])).toBe(false)
})
