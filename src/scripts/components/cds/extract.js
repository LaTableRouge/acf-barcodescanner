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

	const artist = XMLUtils.extractAuthor(datafields)

	const idNumber = XMLUtils.getSubfieldText(datafields, '071', 'a') || XMLUtils.getSubfieldText(datafields, '073', 'a')

	const isni = XMLUtils.getSubfieldText(datafields, '710', 'o') || XMLUtils.getSubfieldText(datafields, '700', 'o')

	const height = XMLUtils.getSubfieldText(datafields, '215', 'd')

	// Track titles from linked pieces (464$t), else the contents note (327$a)
	const trackTitles = XMLUtils.getAllSubfieldTexts(datafields, '464', 't')
	const tracklist = trackTitles.length ? trackTitles : XMLUtils.getAllSubfieldTexts(datafields, '327', 'a')

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
