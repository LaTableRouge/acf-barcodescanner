import { BOOKS_POST_TYPES } from '../../common/constants'
import { variables } from '../../common/variables'
import { extractBookData } from '../books/extract'
import { extractCDData } from '../cds/extract'
import { XMLUtils } from '../common/xml-utils'
import { extractDVDData } from '../dvds/extract'
import { fetchRemoteText } from './http'

const MAX_RECORDS = 20
const SERIES_MAX_RECORDS = 100
const SRU_ENDPOINT = 'https://catalogue.bnf.fr/api/SRU'

/**
 * @param {string} barcode
 * @param {string} postType
 * @returns {string[]}
 */
function buildSearchQueries(barcode, postType) {
	const id = `"${barcode}"`

	if (BOOKS_POST_TYPES.includes(postType)) {
		return [`bib.fuzzyISBN all ${id} and bib.doctype all "a" and bib.recordtype all "mon"`, `bib.fuzzyISBN all ${id}`]
	}

	if (postType === 'cds') {
		return [`(bib.ean all ${id} or bib.comref all ${id}) and bib.doctype all "g"`, `bib.ean all ${id} or bib.comref all ${id}`]
	}

	if (postType === 'dvds') {
		return [`bib.ean all ${id} and bib.doctype all "h"`, `bib.ean all ${id}`]
	}

	return []
}

/**
 * @param {string} xmlResponse
 * @returns {Document|null}
 */
function parseXmlDocument(xmlResponse) {
	if (!xmlResponse) {
		return null
	}

	const parser = new DOMParser()
	const xmlDoc = parser.parseFromString(xmlResponse, 'application/xml')
	if (xmlDoc.querySelector('parsererror')) {
		return null
	}

	return xmlDoc
}

/**
 * @param {Document} xmlDoc
 * @param {string} postType
 * @param {string} barcode
 * @returns {Object|null}
 */
function extractFromDocument(xmlDoc, postType, barcode) {
	const recordElements = xmlDoc.getElementsByTagName('srw:record')
	if (recordElements.length === 0) {
		return null
	}

	const recordElement = XMLUtils.selectBestRecord(recordElements, barcode)
	if (!recordElement) {
		return null
	}

	const datafields = recordElement.getElementsByTagName('mxc:datafield')
	const controlFields = recordElement.getElementsByTagName('mxc:controlfield')
	const coverPageUrl = XMLUtils.getFieldText(controlFields, '003')

	if (BOOKS_POST_TYPES.includes(postType)) {
		return extractBookData(datafields, recordElement, coverPageUrl)
	}
	if (postType === 'cds') {
		return extractCDData(datafields, recordElement, coverPageUrl)
	}
	if (postType === 'dvds') {
		return extractDVDData(datafields, recordElement, coverPageUrl)
	}

	return null
}

/**
 * @param {string} query
 * @param {number} [maxRecords]
 * @returns {Promise<string>}
 */
function fetchSru(query, maxRecords = MAX_RECORDS) {
	const urlToFetchParams = {
		maximumRecords: String(maxRecords),
		operation: 'searchRetrieve',
		query,
		recordSchema: 'unimarcXchange',
		version: '1.2'
	}

	return fetchRemoteText(`${SRU_ENDPOINT}?${new URLSearchParams(urlToFetchParams)}`)
}

/**
 * Replace a catalogued publisher with its imprint (`acfbcs_publisher_aliases` filter), case-insensitively
 * @example resolvePublisherAlias('IDP Home Video Music') // 'Meian' with { 'IDP home video music': 'Meian' }
 * @param {string} publisher
 * @returns {string}
 */
function resolvePublisherAlias(publisher) {
	const key = publisher.trim().toLowerCase()
	const match = Object.entries(variables.publisherAliases).find(([name]) => name.trim().toLowerCase() === key)
	return match ? match[1] : publisher
}

/**
 * Publisher shared by most volumes of a series, so one miscatalogued record
 * (e.g. the distributor in 214$c and the imprint in 225$a) does not win.
 * Aliases are applied before counting. Keeps `fallback` on ties or when the series cannot be fetched.
 * @example resolveSeriesPublisher('TenPuru', 'IDP home video music') // 'Meian' (5 volumes against 1)
 * @param {string} seriesTitle
 * @param {string} fallback - Publisher of the scanned record, already aliased
 * @returns {Promise<string>}
 */
async function resolveSeriesPublisher(seriesTitle, fallback) {
	const title = seriesTitle.replace(/"/g, '')
	const xmlDoc = parseXmlDocument(await fetchSru(`bib.title all "${title}" and bib.doctype all "a" and bib.recordtype all "mon"`, SERIES_MAX_RECORDS))
	if (!xmlDoc) {
		return fallback
	}

	const counts = new Map()
	for (const record of xmlDoc.getElementsByTagName('srw:record')) {
		const datafields = record.getElementsByTagName('mxc:datafield')
		const publisher = resolvePublisherAlias(XMLUtils.extractPublisher(datafields))
		if (publisher && XMLUtils.titlesMatch(XMLUtils.extractSeriesTitle(datafields), seriesTitle)) {
			const key = publisher.toLowerCase()
			counts.set(key, { count: (counts.get(key)?.count || 0) + 1, publisher })
		}
	}

	const fallbackCount = counts.get(fallback.toLowerCase())?.count || 0
	const best = [...counts.values()].reduce((top, entry) => (entry.count > top.count ? entry : top), { count: fallbackCount, publisher: fallback })

	return best.publisher
}

/**
 * Fetch bibliographic data from the BnF SRU catalogue
 * @param {string} barcode
 * @param {string} postType
 * @returns {Promise<Object|null>}
 */
export async function fetchBnf(barcode, postType) {
	for (const query of buildSearchQueries(barcode, postType)) {
		const xmlDoc = parseXmlDocument(await fetchSru(query))
		if (!xmlDoc) {
			continue
		}

		const extracted = extractFromDocument(xmlDoc, postType, barcode)
		if (!extracted) {
			continue
		}

		if (BOOKS_POST_TYPES.includes(postType) && extracted.editor) {
			const editor = resolvePublisherAlias(extracted.editor)
			extracted.editor = extracted.seriesTitle ? await resolveSeriesPublisher(extracted.seriesTitle, editor) : editor
		}

		return extracted
	}

	return null
}
