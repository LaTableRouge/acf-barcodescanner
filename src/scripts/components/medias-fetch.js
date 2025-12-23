import { variables } from '../common/variables'
import { extractBookData } from './books/extract'
import { extractCDData } from './cds/extract'
import { XMLUtils } from './common/xml-utils'
import { extractDVDData } from './dvds/extract'

// xml desc: https://www.bnf.fr/sites/default/files/2019-04/service_sru_bnf.pdf
// Test url: https://catalogue.bnf.fr/api/SRU?version=1.2&recordSchema=unimarcXchange&operation=searchRetrieve&query=bib.anywhere+all+%279782811661427%27
// Catalogue url: https://catalogue.bnf.fr/ark:/12148/cb46838232d

// Post types that use book extraction logic
const BOOKS_POST_TYPES = ['mangas', 'books', 'bds']

/**
 * BNF Media Fetcher Class
 * Handles fetching and parsing bibliographic data from BNF SRU service
 */
class BNFMediaFetcher {
	/**
	 * Parse XML response and extract data based on post type
	 * @param {string} xmlResponse - The XML response string
	 * @param {string} postType - The post type (books, cds, dvds, etc.)
	 * @returns {Object|null} Extracted data or null if parsing fails
	 */
	parseXMLResponse(xmlResponse, postType) {
		if (!xmlResponse) {
			console.error('Error: Empty XML response')
			return null
		}

		const parser = new DOMParser()
		const xmlDoc = parser.parseFromString(xmlResponse, 'application/xml')

		// Check for parsing errors
		const parserError = xmlDoc.querySelector('parsererror')
		if (parserError) {
			console.error('XML parsing error:', parserError.textContent)
			return null
		}

		const recordElements = xmlDoc.getElementsByTagName('srw:record')
		if (recordElements.length === 0) {
			console.warn("No 'record' elements found.")
			return null
		}

		const recordElement = recordElements[0]
		const datafields = recordElement.getElementsByTagName('mxc:datafield')
		const controlFields = recordElement.getElementsByTagName('mxc:controlfield')

		// Get cover page URL from controlfield 003
		const coverPageUrl = XMLUtils.getFieldText(controlFields, '003')

		// Extract data based on post type
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
	 * Fetch media data from BNF SRU service
	 * @param {string} barcode - The barcode to search for
	 * @param {string} postType - The post type (books, cds, dvds, etc.)
	 * @returns {Promise<Object|null>} Extracted data or null if fetch fails
	 */
	async fetch(barcode, postType) {
		barcode = barcode.replaceAll('-', '')

		const urlToFetchParams = {
			version: '1.2',
			recordSchema: 'unimarcXchange',
			operation: 'searchRetrieve',
			query: `bib.anywhere all '${barcode}'`
		}

		const urltoFetch = `https://catalogue.bnf.fr/api/SRU?${new URLSearchParams(urlToFetchParams)}`

		const phpQueryParams = {
			action: 'acfbcs_fetch_from_barcode',
			url: urltoFetch
		}

		try {
			const response = await fetch(`${variables.ajaxURL}?${new URLSearchParams(phpQueryParams)}`)
			const xmlResponse = await response.text()

			if (!xmlResponse) {
				console.error('Empty response from server')
				return null
			}

			return this.parseXMLResponse(xmlResponse, postType)
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
