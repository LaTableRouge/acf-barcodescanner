import { BOOKS_POST_TYPES } from '../../common/constants'
import { extractBookData } from '../books/extract'
import { extractCDData } from '../cds/extract'
import { XMLUtils } from '../common/xml-utils'
import { extractDVDData } from '../dvds/extract'
import { fetchRemoteText } from './http'

const MAX_RECORDS = 20
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

	return [`bib.ean all ${id} or bib.fuzzyISBN all ${id}`]
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
 * @returns {Promise<string>}
 */
function fetchSru(query) {
	const urlToFetchParams = {
		maximumRecords: String(MAX_RECORDS),
		operation: 'searchRetrieve',
		query,
		recordSchema: 'unimarcXchange',
		version: '1.2'
	}

	return fetchRemoteText(`${SRU_ENDPOINT}?${new URLSearchParams(urlToFetchParams)}`)
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
		if (extracted) {
			return extracted
		}
	}

	return null
}
