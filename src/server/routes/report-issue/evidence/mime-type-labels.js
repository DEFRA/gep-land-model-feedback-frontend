const mimeTypeLabels = new Map([
  ['application/pdf', 'PDF'],
  ['text/plain', 'TXT'],
  ['text/csv', 'CSV'],
  ['application/csv', 'CSV'],
  ['application/msword', 'DOC'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'DOCX'],
  ['application/vnd.ms-excel', 'XLS'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'XLSX'],
  ['application/vnd.ms-powerpoint', 'PPT'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'PPTX'],
  ['image/jpeg', 'JPEG'],
  ['image/jpg', 'JPEG'],
  ['image/png', 'PNG'],
  ['image/gif', 'GIF'],
  ['image/webp', 'WEBP'],
  ['image/tiff', 'TIFF'],
  ['application/zip', 'ZIP'],
  ['application/x-zip-compressed', 'ZIP'],
  ['application/gzip', 'GZIP'],
  ['application/json', 'JSON'],
  ['application/geo+json', 'GeoJSON'],
  ['application/xml', 'XML'],
  ['text/xml', 'XML'],
  ['application/vnd.google-earth.kml+xml', 'KML'],
  ['application/vnd.google-earth.kmz', 'KMZ']
])

/** Preserve unknown MIME types rather than guessing which extensions they allow. */
export function formatFileTypeLabels (mimeTypes) {
  return [...new Set(mimeTypes.map(type => mimeTypeLabels.get(type) ?? type))].join(', ')
}
