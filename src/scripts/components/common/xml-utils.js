/**
 * Common XML parsing utilities for UNIMARC data extraction
 * Shared methods used across all media type extractors
 */
export class XMLUtils {
	/**
	 * Get text content from a specific datafield tag with a specific subfield code
	 * @param {NodeList|Array} datafields - Collection of datafield elements
	 * @param {string} tag - The datafield tag number (e.g., '200', '700')
	 * @param {string} code - The subfield code (e.g., 'a', 'f')
	 * @returns {string} The text content or empty string
	 */
	static getSubfieldText(datafields, tag, code) {
		for (let i = 0; i < datafields.length; i++) {
			if (datafields[i].getAttribute('tag') === tag) {
				const subfields = datafields[i].getElementsByTagName('mxc:subfield')
				for (let j = 0; j < subfields.length; j++) {
					if (subfields[j].getAttribute('code') === code) {
						return subfields[j].textContent.trim()
					}
				}
			}
		}
		return ''
	}

	/**
	 * Get multiple subfields from a datafield and concatenate them
	 * @param {NodeList|Array} datafields - Collection of datafield elements
	 * @param {string} tag - The datafield tag number
	 * @param {string[]} codes - Array of subfield codes to extract in order
	 * @param {string} separator - Separator between subfields
	 * @returns {string} Concatenated text content or empty string
	 */
	static getSubfieldTextMultiple(datafields, tag, codes, separator = ' ') {
		for (let i = 0; i < datafields.length; i++) {
			if (datafields[i].getAttribute('tag') === tag) {
				const subfields = datafields[i].getElementsByTagName('mxc:subfield')
				const parts = []
				for (let j = 0; j < subfields.length; j++) {
					const code = subfields[j].getAttribute('code')
					if (codes.includes(code)) {
						const text = subfields[j].textContent.trim()
						if (text) {
							parts.push(text)
						}
					}
				}
				if (parts.length > 0) {
					return parts.join(separator)
				}
			}
		}
		return ''
	}

	/**
	 * Get all occurrences of a datafield with a specific tag
	 * @param {NodeList|Array} datafields - Collection of datafield elements
	 * @param {string} tag - The datafield tag number
	 * @returns {Array} Array of matching datafield elements
	 */
	static getAllDatafieldsByTag(datafields, tag) {
		const matches = []
		for (let i = 0; i < datafields.length; i++) {
			if (datafields[i].getAttribute('tag') === tag) {
				matches.push(datafields[i])
			}
		}
		return matches
	}

	/**
	 * Get text content from a controlfield with a specific tag
	 * @param {NodeList|Array} fields - Collection of controlfield elements
	 * @param {string} tag - The controlfield tag number
	 * @returns {string} The text content or empty string
	 */
	static getFieldText(fields = [], tag = '') {
		for (let i = 0; i < fields.length; i++) {
			if (fields[i].getAttribute('tag') === tag) {
				return fields[i].textContent.trim()
			}
		}
		return ''
	}

	/**
	 * Extract title from field 200 with all relevant subfields
	 * UNIMARC field 200 can have: $a (title), $e (subtitle), $h (part number), $i (part name)
	 * @param {NodeList|Array} datafields - Collection of datafield elements
	 * @returns {string} Full title or empty string
	 */
	static extractTitle(datafields) {
		// Try to get complete title with subtitle and parts
		const title = this.getSubfieldTextMultiple(datafields, '200', ['a', 'e', 'h', 'i'], ' : ')
		if (title) {
			return title
		}

		// Fallback to just main title
		return this.getSubfieldText(datafields, '200', 'a')
	}

	/**
	 * Extract year from CreationDate in extraRecordData (cataloging date)
	 * Handles various date formats and errors gracefully
	 * @param {Element|null} extraRecordData - The extraRecordData element
	 * @returns {string} Year as string or empty string
	 */
	static extractYear(extraRecordData) {
		if (!extraRecordData) {
			return ''
		}

		const creationDateAttr = extraRecordData.getElementsByTagName('ixm:attr')
		for (let i = 0; i < creationDateAttr.length; i++) {
			if (creationDateAttr[i].getAttribute('name') === 'CreationDate') {
				const creationDateStr = creationDateAttr[i].textContent.trim()
				if (!creationDateStr || creationDateStr.length < 4) {
					continue
				}

				try {
					// Date format is typically YYYYMMDD
					const year = creationDateStr.substring(0, 4)
					// Validate it's a valid year
					const yearNum = parseInt(year, 10)
					if (yearNum >= 1000 && yearNum <= 9999) {
						return year
					}
				} catch (e) {
					console.warn('Error parsing CreationDate:', e)
				}
			}
		}

		return ''
	}

	/**
	 * Extract publication year from datafields (field 214$d or 210$d)
	 * Handles various date formats like "impr. 2024", "2024", "c2024", etc.
	 * @param {NodeList|Array} datafields - Collection of datafield elements
	 * @returns {string} Year as string or empty string
	 */
	static extractPublicationYear(datafields) {
		// Try field 214$d (publication date) first, then 210$d
		const dateFields = ['214', '210']
		for (const fieldTag of dateFields) {
			const dateStr = this.getSubfieldText(datafields, fieldTag, 'd')
			if (dateStr) {
				// Extract 4-digit year from strings like "impr. 2024", "2024", "c2024", etc.
				const yearMatch = dateStr.match(/\b(19|20)\d{2}\b/)
				if (yearMatch) {
					const year = yearMatch[0]
					const yearNum = parseInt(year, 10)
					if (yearNum >= 1000 && yearNum <= 9999) {
						return year
					}
				}
			}
		}
		return ''
	}

	/**
	 * Format a person's name from first name and surname
	 * @param {string} firstName - First name
	 * @param {string} surname - Surname
	 * @param {string} dates - Optional dates to append
	 * @returns {string} Formatted name
	 */
	static formatPersonName(firstName, surname) {
		const nameParts = []
		if (firstName) {
			nameParts.push(firstName)
		}
		if (surname) {
			nameParts.push(surname)
		}

		return nameParts.join(' ')
	}

	/**
	 * Extract author names from various UNIMARC fields
	 * Checks fields 700, 701, 702 (personal names) and 710, 711, 712 (corporate names)
	 * Falls back to 200$f (statement of responsibility) if no author fields found
	 * @param {NodeList|Array} datafields - Collection of datafield elements
	 * @param {boolean} includeFallback - Whether to include fallback to 200$f (default: true)
	 * @returns {string} Author name or empty string
	 */
	static extractAuthor(datafields, includeFallback = true) {
		// Try personal name fields first (700, 701, 702)
		const personalNameFields = ['700', '701', '702']
		for (const fieldTag of personalNameFields) {
			const authorFields = this.getAllDatafieldsByTag(datafields, fieldTag)
			for (const field of authorFields) {
				const surname = this.getSubfieldText([field], fieldTag, 'a')
				const firstName = this.getSubfieldText([field], fieldTag, 'b')

				if (surname || firstName) {
					return this.formatPersonName(firstName, surname)
				}
			}
		}

		// Try corporate name fields (710, 711, 712)
		const corporateNameFields = ['710', '711', '712']
		for (const fieldTag of corporateNameFields) {
			const authorFields = this.getAllDatafieldsByTag(datafields, fieldTag)
			for (const field of authorFields) {
				const name = this.getSubfieldText([field], fieldTag, 'a')
				if (name) {
					return name
				}
			}
		}

		// Fallback to statement of responsibility (200$f) if enabled
		if (includeFallback) {
			const statement = this.getSubfieldText(datafields, '200', 'f')
			if (statement) {
				// Clean up common prefixes like "par", "de", "[illustrations de]", etc.
				return statement.replace(/^(\[.*?\]|par|de|par\s+)\s*/i, '').trim()
			}
		}

		return ''
	}
}
