/** Match configured suffixes, including Windows trailing-dot/space variations. */
export function isExcludedFile (filename, extensions) {
  const basename = filename.split(/[\\/]/).pop().split(':')[0].replace(/[.\s]+$/u, '').toLowerCase()
  return extensions.some(extension => basename.endsWith(extension))
}

export function fileExclusionMessage (filename) {
  return `${filename}: This file type is not allowed. Choose a different file.`
}
