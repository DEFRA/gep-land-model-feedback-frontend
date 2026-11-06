export const options = [
  { value: 'map-viewer', text: 'ATLAS Map Viewer' },
  { value: 'data-search', text: 'ATLAS Data Search & Find' },
  { value: 'repository-integration', text: 'ATLAS Repository Integration' },
  { value: 'data-ingestion', text: 'ATLAS data ingestion' },
  { value: 'data-export', text: 'ATLAS data export' }
]
export const allowedAreas = [...options.map(({ value }) => value), 'other']
