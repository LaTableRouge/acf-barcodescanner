import { XMLUtils } from '../common/xml-utils'

/**
 * Extract book data from XML
 * @param {NodeList|Array} datafields - Collection of datafield elements
 * @param {Element} recordElement - The record element
 * @param {string} coverPageUrl - The cover page URL
 * @returns {Object} Extracted book data
 */
export function extractBookData(datafields, recordElement, coverPageUrl) {
	// Extract title with all subfields (main title, subtitle, parts)
	const title = XMLUtils.extractTitle(datafields)

	// Extract author from proper author fields (700-702, 710-712) with fallback to 200$f
	const author = XMLUtils.extractAuthor(datafields, true)

	// Volume number from field 461 (series) or 225 (series statement)
	const volumeNumber = XMLUtils.getSubfieldText(datafields, '461', 'v') || XMLUtils.getSubfieldText(datafields, '225', 'v')

	// Editor/Publisher from field 214 or 210 (publication, distribution, etc.)
	const editor = XMLUtils.getSubfieldText(datafields, '214', 'c') || XMLUtils.getSubfieldText(datafields, '210', 'c')

	// Excerpt/Summary from field 330 (summary) or 830 (general note)
	const excerpt = XMLUtils.getSubfieldText(datafields, '330', 'a') || XMLUtils.getSubfieldText(datafields, '830', 'a')

	// Physical dimensions from field 215 (physical description) or 280
	const height = XMLUtils.getSubfieldText(datafields, '215', 'd') || XMLUtils.getSubfieldText(datafields, '280', 'd')

	// ISBN from field 010
	const isbn = XMLUtils.getSubfieldText(datafields, '010', 'a')

	// Extract year - prefer publication year from datafields, fallback to cataloging date
	let year = XMLUtils.extractPublicationYear(datafields)
	if (!year) {
		const extraRecordData = recordElement.getElementsByTagName('srw:extraRecordData')[0]
		year = XMLUtils.extractYear(extraRecordData)
	}

	return {
		title,
		editor,
		author,
		excerpt,
		isbn,
		dimensions: {
			height
		},
		volumeNumber,
		year,
		cover: coverPageUrl
	}
}
