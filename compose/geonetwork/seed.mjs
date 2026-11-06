import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

// This script only writes synthetic data to a loopback development catalogue.
const base = 'http://localhost:8080/geonetwork/srv/api'
const cookies = new Map()
async function api (path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      accept: 'application/json',
      authorization: `Basic ${Buffer.from('admin:admin').toString('base64')}`,
      cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
      'X-XSRF-TOKEN': cookies.get('XSRF-TOKEN') ?? '',
      ...options.headers
    },
    signal: AbortSignal.timeout(60000)
  })
  for (const cookie of response.headers.getSetCookie()) {
    const [name, ...value] = cookie.split(';')[0].split('=')
    cookies.set(name, value.join('='))
  }
  const body = await response.text()
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path}: HTTP ${response.status}: ${body.slice(0, 500)}`)
  }
  return body ? JSON.parse(body) : null
}
const xmlEscape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
await api('/me')
const fixtures = JSON.parse(await readFile(new URL('./datasets.json', import.meta.url)))
const tags = await api('/tags')
for (const name of [...new Set(fixtures.map(record => record.category))]) {
  if (!tags.some(tag => tag.name === name)) {
    const id = Math.max(0, ...tags.map(tag => tag.id)) + 1
    await api('/tags', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, name }) })
    tags.push({ id, name })
  }
}
for (const record of fixtures) {
  const xml = `<gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
    <gmd:fileIdentifier><gco:CharacterString>${record.id}</gco:CharacterString></gmd:fileIdentifier>
    <gmd:language><gmd:LanguageCode codeList="http://www.loc.gov/standards/iso639-2/" codeListValue="eng">English</gmd:LanguageCode></gmd:language>
    <gmd:hierarchyLevel><gmd:MD_ScopeCode codeList="http://standards.iso.org/iso/19139/resources/gmxCodelists.xml#MD_ScopeCode" codeListValue="dataset"/></gmd:hierarchyLevel>
    <gmd:dateStamp><gco:Date>2026-01-01</gco:Date></gmd:dateStamp>
    <gmd:metadataStandardName><gco:CharacterString>ISO 19115:2003/19139</gco:CharacterString></gmd:metadataStandardName>
    <gmd:metadataStandardVersion><gco:CharacterString>1.0</gco:CharacterString></gmd:metadataStandardVersion>
    <gmd:identificationInfo><gmd:MD_DataIdentification>
      <gmd:citation><gmd:CI_Citation><gmd:title><gco:CharacterString>${xmlEscape(record.title)}</gco:CharacterString></gmd:title></gmd:CI_Citation></gmd:citation>
      <gmd:abstract><gco:CharacterString>Synthetic metadata for local ATLAS feedback testing only.</gco:CharacterString></gmd:abstract>
      <gmd:language><gco:CharacterString>eng</gco:CharacterString></gmd:language>
    </gmd:MD_DataIdentification></gmd:identificationInfo>
  </gmd:MD_Metadata>`
  const category = tags.find(tag => tag.name === record.category).id
  const result = await api(`/records?uuidProcessing=OVERWRITE&group=2&publishToAll=true&category=${category}`, {
    method: 'PUT', headers: { 'content-type': 'application/xml' }, body: xml
  })
  if (result.numberOfRecordsWithErrors) {
    throw new Error(`Import failed: ${JSON.stringify(result)}`)
  }
  console.log(`Imported ${record.title} (${record.category})`)
}
// Check publication and indexing through the same anonymous API used by the app.
let verified = false
for (let attempt = 0; attempt < 30; attempt++) {
  const response = await fetch(`${base}/search/records/_search`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ size: 10, _source: ['resourceTitleObject.default'], query: { bool: { filter: [{ term: { isTemplate: 'n' } }, { terms: { 'cat.keyword': ['feedback-test'] } }] } } }),
    signal: AbortSignal.timeout(10000)
  })
  if (!response.ok) {
    throw new Error(`Anonymous verification failed: HTTP ${response.status}`)
  }
  const result = await response.json()
  const ids = result.hits?.hits?.map(hit => hit._id) ?? []
  if (ids.length === 2 && fixtures.filter(record => record.category === 'feedback-test').every(record => ids.includes(record.id))) {
    verified = true
    break
  }
  await delay(1000)
}
if (!verified) {
  throw new Error('Test data was imported but category filtering/public indexing could not be verified')
}
console.log('Verified two public datasets. Use GEONETWORK_DATASET_CATEGORIES=feedback-test to include them.')
