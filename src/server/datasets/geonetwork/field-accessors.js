/**
 * @param {string} name
 * @returns {(src: object) => string[]}
 */
function allDefaults (name) {
  return (src) => (src[name] ?? []).map((entry) => entry?.default).filter(Boolean)
}

/**
 * @param {string} name
 * @param {string} type
 * @returns {(src: object) => string | null}
 */
function datedEntry (name, type) {
  return (src) => {
    const entry = (src[name] ?? []).find((e) => e?.type === type)
    return entry?.date ?? null
  }
}

/**
 * @param {string} name
 * @param {string | null} [fallback]
 * @returns {(src: object) => string | null}
 */
function firstDefault (name, fallback = null) {
  return (src) => src[name]?.[0]?.default ?? fallback
}

/**
 * @param {string} name
 * @returns {(src: object) => string | null}
 */
function firstNestedCode (name) {
  return (src) => src[name]?.[0]?.code ?? null
}

/**
 * @param {string} name
 * @returns {(src: object) => string | null}
 */
function latestNestedDate (name) {
  return (src) => {
    const dates = (src[name] ?? [])
      .map((entry) => entry?.date)
      .filter(Boolean)
    return dates.length === 0 ? null : dates.reduce((a, b) => (Date.parse(a) > Date.parse(b) ? a : b))
  }
}

/**
 * @param {string} name
 * @param {Record<string, string>} valueMap
 * @returns {(src: object) => string | null}
 */
function mappedValue (name, valueMap) {
  return (src) => valueMap[src[name]] ?? null
}

/**
 * @param {string} name
 * @param {string | null} [fallback]
 * @returns {(src: object) => string | null}
 */
function objectDefault (name, fallback = null) {
  return (src) => src[name]?.default ?? fallback
}

/**
 * @param {string} name
 * @returns {(src: object) => string[]}
 */
function rawArray (name) {
  return (src) => src[name] ?? []
}

/**
 * @param {object} src
 * @returns {import('./catalogue.js').SpatialResolution | null}
 */
function resolution (src) {
  const scaleDenominators = (src.resolutionScaleDenominator ?? [])
    .map(Number)
    .filter((value) => Number.isSafeInteger(value) && value > 0)
  const distances = (src.resolutionDistance ?? [])
    .filter((value) => typeof value === 'string' && value.trim())

  return scaleDenominators.length || distances.length
    ? { scaleDenominators, distances }
    : null
}

export {
  allDefaults,
  datedEntry,
  firstDefault,
  firstNestedCode,
  latestNestedDate,
  mappedValue,
  objectDefault,
  rawArray,
  resolution
}
