import {
  allDefaults,
  datedEntry,
  firstDefault,
  firstNestedCode,
  latestNestedDate,
  mappedValue,
  objectDefault,
  rawArray,
  resolution
} from './field-accessors.js'

const accessLevelMap = { true: 'Open data', false: 'Restricted access' }

/**
 * @typedef {object} FieldOperation
 * @property {string} field GeoNetwork Elasticsearch field used for this operation.
 * @property {number} [boost] Full-text search boost, only used by search operations.
 */

/**
 * @typedef {object} Field
 * @property {string[]} source Elasticsearch source paths required to build this field.
 * @property {FieldOperation} [search] Full-text field used by multi_match.
 * @property {FieldOperation} [sort] Field used to sort results.
 * @property {boolean} [inSearchResult] Include this field in search result rows.
 * @property {(src: object) => *} hitAccessor Maps a GeoNetwork _source object into the domain value.
 */

/** @type {Record<Exclude<keyof import('./catalogue.js').DatasetMetadata, 'id'>, Field>} */
const fields = {
  title: {
    source: ['resourceTitleObject.default'],
    search: { field: 'resourceTitleObject.default', boost: 3 },
    sort: { field: 'resourceTitleObject.default.keyword' },
    inSearchResult: true,
    hitAccessor: objectDefault('resourceTitleObject', '')
  },
  inspireTheme: {
    source: ['th_httpinspireeceuropaeutheme-theme'],
    inSearchResult: true,
    hitAccessor: firstDefault('th_httpinspireeceuropaeutheme-theme', 'Other datasets')
  },
  abstract: {
    source: ['resourceAbstractObject.default'],
    search: { field: 'resourceAbstractObject.default' },
    hitAccessor: objectDefault('resourceAbstractObject', '')
  },
  owner: {
    source: ['OrgForResourceObject.default'],
    hitAccessor: objectDefault('OrgForResourceObject')
  },
  accessLevel: {
    source: ['isOpenData'],
    hitAccessor: mappedValue('isOpenData', accessLevelMap)
  },
  updateFrequency: {
    source: ['cl_maintenanceAndUpdateFrequency'],
    hitAccessor: firstDefault('cl_maintenanceAndUpdateFrequency')
  },
  categories: {
    source: ['cl_topic'],
    hitAccessor: allDefaults('cl_topic')
  },
  catalogueCategories: {
    source: ['cat'],
    hitAccessor: rawArray('cat')
  },
  updatedAt: {
    source: ['resourceDate.date'],
    hitAccessor: latestNestedDate('resourceDate')
  },
  licence: {
    source: ['MD_ConstraintsUseLimitationObject'],
    hitAccessor: firstDefault('MD_ConstraintsUseLimitationObject')
  },
  format: {
    source: ['format'],
    hitAccessor: rawArray('format')
  },
  coordinateReferenceSystem: {
    source: ['crsDetails'],
    hitAccessor: firstNestedCode('crsDetails')
  },
  places: {
    source: ['keywordType-place'],
    hitAccessor: allDefaults('keywordType-place')
  },
  resolution: {
    source: ['resolutionScaleDenominator', 'resolutionDistance'],
    hitAccessor: resolution
  },
  creationDate: {
    source: ['resourceDate.date', 'resourceDate.type'],
    hitAccessor: datedEntry('resourceDate', 'creation')
  }
}

const searchSourceIncludes = Object.values(fields)
  .filter((field) => field.inSearchResult)
  .flatMap((field) => field.source)

const recordSourceIncludes = Object.values(fields)
  .flatMap((field) => field.source)

const searchFields = Object.values(fields)
  .filter((field) => field.search)
  .map((field) => {
    return field.search.boost
      ? `${field.search.field}^${field.search.boost}`
      : field.search.field
  })

export {
  fields,
  searchSourceIncludes,
  recordSourceIncludes,
  searchFields
}
