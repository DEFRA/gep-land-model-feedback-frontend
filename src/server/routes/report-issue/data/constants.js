export const locationOptions = [
  { value: 'grid', name: 'gridReference', id: 'grid-reference', text: 'Grid cell', label: 'Land model grid cell reference (British National Grid)', hint: 'For example, SK1481' },
  { value: 'feature', name: 'featureReference', id: 'feature-reference', text: 'Feature', label: 'Land model feature reference (OSID)', hint: 'For example, 1e2f9011-ece7-4068-80ec-27e837259cf8' },
  { value: 'other', name: 'locationDescription', id: 'location-description', text: 'Other', label: 'Describe the location', hint: 'Enter as much information as possible to help us locate the issue' }
]

export const attributeOptions = [
  { value: 'land-cover', text: 'Land cover' },
  { value: 'land-management', text: 'Land management' },
  { value: 'land-use', text: 'Land use' },
  { value: 'ownership', text: 'Ownership' },
  { value: 'protected-areas', text: 'Protected areas' },
  { value: 'soils', text: 'Soils' }
]
