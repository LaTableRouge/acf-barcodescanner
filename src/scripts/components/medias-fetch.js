import { variables } from '../common/variables'
import { extractBookData } from './books/extract'
import { extractCDData } from './cds/extract'
import { XMLUtils } from './common/xml-utils'
import { extractDVDData } from './dvds/extract'

// SRU docs: https://api.bnf.fr/fr/api-sru-catalogue-general
// Test url: https://catalogue.bnf.fr/api/SRU?version=1.2&recordSchema=unimarcXchange&operation=searchRetrieve&maximumRecords=20&query=bib.fuzzyISBN+all+%229782811661427%22
// Catalogue url: https://catalogue.bnf.fr/ark:/12148/cb46838232d

const BOOKS_POST_TYPES = ['mangas', 'books', 'bds']
const MAX_RECORDS = 20
const SRU_ENDPOINT = 'https://catalogue.bnf.fr/api/SRU'

/**
 * BNF Media Fetcher Class
 * Handles fetching and parsing bibliographic data from BNF SRU service
 */
class BNFMediaFetcher {
	/**
	 * Build SRU queries from most specific to fallback
	 * @param {string} barcode - Normalized barcode
	 * @param {string} postType - The post type (books, cds, dvds, etc.)
	 * @returns {string[]} CQL queries to try in order
	 */
	buildSearchQueries(barcode, postType) {
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
	 * Parse an XML string into a document
	 * @param {string} xmlResponse
	 * @returns {Document|null}
	 */
	parseXmlDocument(xmlResponse) {
		if (!xmlResponse) {
			console.error('Error: Empty XML response')
			return null
		}

		const parser = new DOMParser()
		const xmlDoc = parser.parseFromString(xmlResponse, 'application/xml')
		const parserError = xmlDoc.querySelector('parsererror')
		if (parserError) {
			console.error('XML parsing error:', parserError.textContent)
			return null
		}

		return xmlDoc
	}

	/**
	 * Parse XML response and extract data based on post type
	 * @param {Document} xmlDoc - Parsed SRU response
	 * @param {string} postType - The post type (books, cds, dvds, etc.)
	 * @param {string} barcode - Normalized barcode used to pick the best record
	 * @returns {Object|null} Extracted data or null if parsing fails
	 */
	extractFromDocument(xmlDoc, postType, barcode) {
		const recordElements = xmlDoc.getElementsByTagName('srw:record')
		if (recordElements.length === 0) {
			console.warn("No 'record' elements found.")
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
		} else if (postType === 'cds') {
			return extractCDData(datafields, recordElement, coverPageUrl)
		} else if (postType === 'dvds') {
			return extractDVDData(datafields, recordElement, coverPageUrl)
		}

		return null
	}

	/**
	 * Fetch one SRU query through the WordPress AJAX proxy
	 * @param {string} query - CQL query
	 * @returns {Promise<string>} Raw XML
	 */
	async fetchXml(query) {
		const urlToFetchParams = {
			maximumRecords: String(MAX_RECORDS),
			operation: 'searchRetrieve',
			query,
			recordSchema: 'unimarcXchange',
			version: '1.2'
		}

		const urltoFetch = `${SRU_ENDPOINT}?${new URLSearchParams(urlToFetchParams)}`
		const phpQueryParams = {
			action: 'acfbcs_fetch_from_barcode',
			url: urltoFetch
		}

		const response = await fetch(`${variables.ajaxURL}?${new URLSearchParams(phpQueryParams)}`)
		return response.text()
	}

	/**
	 * Fetch media data from BNF SRU service
	 * @param {string} barcode - The barcode to search for
	 * @param {string} postType - The post type (books, cds, dvds, etc.)
	 * @returns {Promise<Object|null>} Extracted data or null if fetch fails
	 */
	async fetch(barcode, postType) {
		const normalizedBarcode = XMLUtils.normalizeIdentifier(barcode)
		if (!normalizedBarcode) {
			console.error('Error: Empty barcode')
			return null
		}

		try {
			const queries = this.buildSearchQueries(normalizedBarcode, postType)

			for (const query of queries) {
				const xmlResponse = await this.fetchXml(query)
				const xmlDoc = this.parseXmlDocument(xmlResponse)
				if (!xmlDoc) {
					continue
				}

				const recordElements = xmlDoc.getElementsByTagName('srw:record')
				if (recordElements.length === 0) {
					continue
				}

				return this.extractFromDocument(xmlDoc, postType, normalizedBarcode)
			}

			console.warn('No matching BNF records found')
			return null
		} catch (error) {
			console.error('Error fetching media data:', error)
			return null
		}
	}
}

// Create singleton instance
const bnfMediaFetcher = new BNFMediaFetcher()

// Export the fetch function for backward compatibility
export const mediasfetch = (barcode, postType) => bnfMediaFetcher.fetch(barcode, postType)
