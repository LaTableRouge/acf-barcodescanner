import { __ } from '@wordpress/i18n'

import { XMLUtils } from '../common/xml-utils'

/**
 * @param {string} description
 * @param {string[]} tracks
 * @returns {string}
 */
export function formatCdExcerpt(description = '', tracks = []) {
	const parts = []
	const summary = String(description || '').trim()
	if (summary) {
		parts.push(summary)
	}

	if (tracks.length) {
		const lines = tracks.map((title, index) => `${index + 1}. ${title}`)
		parts.push(`${__('Tracklist:', 'acf-barcodescanner')}\n${lines.join('\n')}`)
	}

	return parts.join('\n\n')
}

/**
 * Extract CD data from XML
 * @param {NodeList|Array} datafields - Collection of datafield elements
 * @param {Element} recordElement - The record element
 * @param {string} coverPageUrl - The cover page URL
 * @returns {Object} Extracted CD data
 */
export function extractCDData(datafields, recordElement, coverPageUrl) {
	const title = XMLUtils.extractTitle(datafields)

	const artist = XMLUtils.extractAuthor(datafields, true)

	const idNumber = XMLUtils.getSubfieldText(datafields, '071', 'a') || XMLUtils.getSubfieldText(datafields, '073', 'a')

	const isni = XMLUtils.getSubfieldText(datafields, '710', 'o') || XMLUtils.getSubfieldText(datafields, '700', 'o')

	const height = XMLUtils.getSubfieldText(datafields, '215', 'd')

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

	if (tracklist.length === 0) {
		const contents = XMLUtils.getAllSubfieldTexts(datafields, '327', 'a')
		for (const line of contents) {
			if (line) {
				tracklist.push(line)
			}
		}
	}

	const year = XMLUtils.extractRecordYear(datafields, recordElement)

	return {
		artist,
		cover: coverPageUrl,
		dimensions: {
			height
		},
		excerpt: XMLUtils.getSubfieldText(datafields, '330', 'a'),
		idNumber,
		isni,
		title,
		tracklist,
		year
	}
}
