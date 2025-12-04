import { __ } from '@wordpress/i18n'

import { XMLUtils } from '../common/xml-utils'

/**
 * Extract CD data from XML
 * @param {NodeList|Array} datafields - Collection of datafield elements
 * @param {Element} recordElement - The record element
 * @param {string} coverPageUrl - The cover page URL
 * @returns {Object} Extracted CD data
 */
export function extractCDData(datafields, recordElement, coverPageUrl) {
	// Extract title with all subfields
	const title = XMLUtils.extractTitle(datafields)

	// Extract artist - for CDs, check performer fields (700-702) first, no fallback to 200$f
	let artist = XMLUtils.extractAuthor(datafields, false)
	if (!artist) {
		// Fallback: try field 200$f (statement of responsibility)
		artist = XMLUtils.getSubfieldText(datafields, '200', 'f')
	}

	// ID number from field 071 (standard number for sound recordings)
	const idNumber = XMLUtils.getSubfieldText(datafields, '071', 'a')

	// ISNI from field 710 (corporate name) subfield 'o' or field 700 (personal name) subfield 'o'
	const isni = XMLUtils.getSubfieldText(datafields, '710', 'o') || XMLUtils.getSubfieldText(datafields, '700', 'o')

	// Physical dimensions from field 215
	const height = XMLUtils.getSubfieldText(datafields, '215', 'd')

	// Extracting tracklist from field 464 (analytical entry for sound recording)
	const tracklist = []
	const trackFields = XMLUtils.getAllDatafieldsByTag(datafields, '464')
	for (const field of trackFields) {
		const subfields = field.getElementsByTagName('mxc:subfield')
		for (let j = 0; j < subfields.length; j++) {
			if (subfields[j].getAttribute('code') === 't') {
				const trackTitle = subfields[j].textContent.trim()
				if (trackTitle) {
					tracklist.push(trackTitle)
				}
			}
		}
	}

	// Extract year - prefer publication year from datafields, fallback to cataloging date
	let year = XMLUtils.extractPublicationYear(datafields)
	if (!year) {
		const extraRecordData = recordElement.getElementsByTagName('srw:extraRecordData')[0]
		year = XMLUtils.extractYear(extraRecordData)
	}

	return {
		title,
		artist,
		idNumber,
		isni,
		dimensions: {
			height
		},
		excerpt: tracklist.length ? `${__('Tracklist:', 'acf-barcodescanner')} ${tracklist.join(', ')}` : '',
		year,
		cover: coverPageUrl
	}
}
