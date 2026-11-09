/** Match configured suffixes, including Windows trailing-dot/space variations. */
export function isExcludedFile (filename, extensions) {
  const basename = filename.split(/[\\/]/).pop().split(':')[0]
  let end = basename.length
  // Scan once from the end instead of backtracking over a trailing suffix.
  while (end > 0 && /[.\s]/u.test(basename[end - 1])) {
    end--
  }
  const normalised = basename.slice(0, end).toLowerCase()
  return extensions.some(extension => normalised.endsWith(extension))
}

export function fileExclusionMessage (filename) {
  return `${filename}: This file type is not allowed. Choose a different file.`
}
