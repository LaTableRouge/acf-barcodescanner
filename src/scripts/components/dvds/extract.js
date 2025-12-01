import { XMLUtils } from '../common/xml-utils'

/**
 * Extract director from DVD datafields
 * Checks field 702 with role code 300 (director) or falls back to 200$f
 * @param {NodeList|Array} datafields - Collection of datafield elements
 * @returns {string} Director name or empty string
 */
function extractDirector(datafields) {
	// Try to find director in field 702 with role code 300 (director)
	const directorFields = XMLUtils.getAllDatafieldsByTag(datafields, '702')
	for (const field of directorFields) {
		const subfields = field.getElementsByTagName('mxc:subfield')
		let isDirector = false
		for (let j = 0; j < subfields.length; j++) {
			if (subfields[j].getAttribute('code') === '4' && subfields[j].textContent.trim() === '300') {
				isDirector = true
				break
			}
		}

		if (isDirector) {
			const surname = XMLUtils.getSubfieldText([field], '702', 'a')
			const firstName = XMLUtils.getSubfieldText([field], '702', 'b')

			if (surname || firstName) {
				return XMLUtils.formatPersonName(firstName, surname)
			}
		}
	}

	// Fallback to statement of responsibility (200$f) - usually contains director info
	const statement = XMLUtils.getSubfieldText(datafields, '200', 'f')
	if (statement) {
		// Clean up common prefixes and extract director name
		// Format is usually "Name, réal., scénario" or similar
		return statement.split(',')[0].trim()
	}

	return ''
}

/**
 * Extract DVD data from XML
 * @param {NodeList|Array} datafields - Collection of datafield elements
 * @param {Element} recordElement - The record element
 * @param {string} coverPageUrl - The cover page URL
 * @returns {Object} Extracted DVD data
 */
export function extractDVDData(datafields, recordElement, coverPageUrl) {
	// Extract title with all subfields
	const title = XMLUtils.extractTitle(datafields)

	// Extract director/author
	const director = extractDirector(datafields)

	// Editor/Publisher from field 210$c
	const editor = XMLUtils.getSubfieldText(datafields, '210', 'c')

	// ID number from field 073$a (EAN/barcode) - this is the actual barcode number
	const idNumber = XMLUtils.getSubfieldText(datafields, '073', 'a')

	// Excerpt/Summary from field 330$a (summary) if available, otherwise skip
	// Field 300$a contains bonus features and technical notes, not the movie summary
	const excerpt = XMLUtils.getSubfieldText(datafields, '330', 'a')

	// Extract year - prefer publication year from datafields, fallback to cataloging date
	let year = XMLUtils.extractPublicationYear(datafields)
	if (!year) {
		const extraRecordData = recordElement.getElementsByTagName('srw:extraRecordData')[0]
		year = XMLUtils.extractYear(extraRecordData)
	}

	return {
		title,
		director,
		editor,
		idNumber,
		excerpt,
		year,
		cover: coverPageUrl
	}
}
