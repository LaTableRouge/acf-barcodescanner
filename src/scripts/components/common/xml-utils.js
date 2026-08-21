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
	 * Get all text contents for a datafield tag + subfield code
	 * @param {NodeList|Array} datafields - Collection of datafield elements
	 * @param {string} tag - The datafield tag number
	 * @param {string} code - The subfield code
	 * @returns {string[]} Matching subfield values
	 */
	static getAllSubfieldTexts(datafields, tag, code) {
		const values = []
		const fields = this.getAllDatafieldsByTag(datafields, tag)
		for (const field of fields) {
			const subfields = field.getElementsByTagName('mxc:subfield')
			for (let j = 0; j < subfields.length; j++) {
				if (subfields[j].getAttribute('code') === code) {
					const text = subfields[j].textContent.trim()
					if (text) {
						values.push(text)
					}
				}
			}
		}
		return values
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
	 * Strip hyphens/spaces from an ISBN, EAN or commercial number
	 * @param {string} value
	 * @returns {string}
	 */
	static normalizeIdentifier(value) {
		return String(value || '')
			.replace(/[^\dX]/gi, '')
			.toUpperCase()
	}

	/**
	 * Comparable ISBN core (9 digits) for ISBN-10 / ISBN-13-978 matching
	 * @param {string} digits - Normalized identifier
	 * @returns {string}
	 */
	static isbnComparableCore(digits) {
		if (digits.length === 13 && digits.startsWith('978')) {
			return digits.slice(3, 12)
		}
		if (digits.length === 10) {
			return digits.slice(0, 9)
		}
		return digits
	}

	/**
	 * Whether two identifiers refer to the same ISBN/EAN
	 * @param {string} left
	 * @param {string} right
	 * @returns {boolean}
	 */
	static identifiersMatch(left, right) {
		const leftDigits = this.normalizeIdentifier(left)
		const rightDigits = this.normalizeIdentifier(right)
		if (!leftDigits || !rightDigits) {
			return false
		}
		if (leftDigits === rightDigits) {
			return true
		}
		const leftCore = this.isbnComparableCore(leftDigits)
		const rightCore = this.isbnComparableCore(rightDigits)
		return Boolean(leftCore) && leftCore === rightCore
	}

	/**
	 * Collect ISBN / EAN / commercial numbers from a UNIMARC record
	 * @param {NodeList|Array} datafields
	 * @returns {string[]}
	 */
	static collectRecordIdentifiers(datafields) {
		return ['073', '010', '071'].flatMap((tag) => this.getAllSubfieldTexts(datafields, tag, 'a'))
	}

	/**
	 * Whether a record's identifiers match the scanned barcode
	 * @param {NodeList|Array} datafields
	 * @param {string} barcode
	 * @returns {boolean}
	 */
	static recordMatchesBarcode(datafields, barcode) {
		return this.collectRecordIdentifiers(datafields).some((identifier) => this.identifiersMatch(identifier, barcode))
	}

	/**
	 * Last modification date from extraRecordData (YYYYMMDD)
	 * @param {Element} recordElement
	 * @returns {string}
	 */
	static getLastModificationDate(recordElement) {
		const extraRecordData = recordElement.getElementsByTagName('srw:extraRecordData')[0]
		if (!extraRecordData) {
			return ''
		}

		const attrs = extraRecordData.getElementsByTagName('ixm:attr')
		for (let i = 0; i < attrs.length; i++) {
			if (attrs[i].getAttribute('name') === 'LastModificationDate') {
				return attrs[i].textContent.trim()
			}
		}
		return ''
	}

	/**
	 * Pick the record whose identifiers match the barcode; prefer the most recently modified
	 * @param {NodeList|Array} recordElements
	 * @param {string} barcode
	 * @returns {Element|null}
	 */
	static selectBestRecord(recordElements, barcode) {
		const records = Array.from(recordElements)
		if (records.length === 0) {
			return null
		}

		const scored = records.map((record, index) => {
			const datafields = record.getElementsByTagName('mxc:datafield')
			return {
				index,
				lastMod: this.getLastModificationDate(record),
				matches: this.recordMatchesBarcode(datafields, barcode),
				record
			}
		})

		scored.sort((a, b) => {
			if (a.matches !== b.matches) {
				return a.matches ? -1 : 1
			}
			if (a.lastMod !== b.lastMod) {
				return b.lastMod.localeCompare(a.lastMod)
			}
			return a.index - b.index
		})

		return scored[0].record
	}

	/**
	 * Extract title from field 200 with all relevant subfields
	 * UNIMARC field 200 can have: $a (title), $e (subtitle), $h (part number), $i (part name)
	 * @param {NodeList|Array} datafields - Collection of datafield elements
	 * @returns {string} Full title or empty string
	 */
	static extractTitle(datafields) {
		const title = this.getSubfieldTextMultiple(datafields, '200', ['a', 'e', 'h', 'i'], ' : ')
		if (title) {
			return title
		}

		return this.getSubfieldText(datafields, '200', 'a')
	}

	/**
	 * Album / volume title from 200, without the part number ($h)
	 * Repeated $a (common for BD) are kept, $b (GMD like "Texte imprimé") is ignored
	 * @param {NodeList|Array} datafields
	 * @returns {string}
	 */
	static extractVolumeTitle(datafields) {
		const title = this.getSubfieldTextMultiple(datafields, '200', ['a', 'e', 'i'], ' : ')
		return this.cleanDisplayTitle(title || this.getSubfieldText(datafields, '200', 'a'))
	}

	/**
	 * Strip trailing dots and collapse whitespace for display
	 * @param {string} value
	 * @returns {string}
	 */
	static cleanDisplayTitle(value) {
		return String(value || '')
			.replace(/[.]+$/g, '')
			.replace(/\s+/g, ' ')
			.trim()
	}

	/**
	 * Compare titles ignoring trailing punctuation and case
	 * @param {string} left
	 * @param {string} right
	 * @returns {boolean}
	 */
	static titlesMatch(left, right) {
		const normalize = (value) =>
			this.cleanDisplayTitle(value)
				.replace(/[.,;:!?]+$/g, '')
				.toLowerCase()
		const leftNormalized = normalize(left)
		const rightNormalized = normalize(right)
		return Boolean(leftNormalized) && leftNormalized === rightNormalized
	}

	/**
	 * Volume / part number: 461$v (set), 200$h (part), 225$v / 410$v (series)
	 * @param {NodeList|Array} datafields
	 * @returns {string}
	 */
	static extractVolumeNumber(datafields) {
		const candidates = [this.getSubfieldText(datafields, '461', 'v'), this.getSubfieldText(datafields, '200', 'h'), this.getSubfieldText(datafields, '225', 'v'), this.getSubfieldText(datafields, '410', 'v')]

		for (const candidate of candidates) {
			if (!candidate) {
				continue
			}
			const numeric = candidate.match(/\d+/)
			return numeric ? numeric[0] : candidate.trim()
		}

		return ''
	}

	/**
	 * Series / set title used as the post title for BD and manga
	 * Prefer 461 (work/set). Use 225 only when it has a volume number (not a publisher collection).
	 * @param {NodeList|Array} datafields
	 * @returns {string}
	 */
	static extractSeriesTitle(datafields) {
		const setTitle = this.cleanDisplayTitle(this.getSubfieldText(datafields, '461', 't'))
		if (setTitle) {
			return setTitle
		}

		const seriesStatementVolume = this.getSubfieldText(datafields, '225', 'v')
		const seriesStatementTitle = this.cleanDisplayTitle(this.getSubfieldText(datafields, '225', 'a'))
		if (seriesStatementVolume && seriesStatementTitle) {
			return seriesStatementTitle
		}

		const partNumber = this.getSubfieldText(datafields, '200', 'h')
		const mainTitle = this.cleanDisplayTitle(this.getSubfieldText(datafields, '200', 'a'))
		if (partNumber && mainTitle) {
			return mainTitle
		}

		return ''
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
		const dateFields = ['214', '210']
		for (const fieldTag of dateFields) {
			const dateStrings = this.getAllSubfieldTexts(datafields, fieldTag, 'd')
			for (const dateStr of dateStrings) {
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
	 * Publication year from 214/210, else cataloging date on the record
	 * @param {NodeList|Array} datafields
	 * @param {Element} recordElement
	 * @returns {string}
	 */
	static extractRecordYear(datafields, recordElement) {
		const year = this.extractPublicationYear(datafields)
		if (year) {
			return year
		}

		const extraRecordData = recordElement?.getElementsByTagName('srw:extraRecordData')[0]
		return this.extractYear(extraRecordData)
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
	 * @returns {string} Author names joined with commas, or empty string
	 */
	static extractAuthor(datafields, includeFallback = true) {
		const names = []
		const seen = new Set()

		const addName = (name) => {
			const normalized = name.trim()
			const key = normalized.toLowerCase()
			if (normalized && !seen.has(key)) {
				seen.add(key)
				names.push(normalized)
			}
		}

		const personalNameFields = ['700', '701', '702']
		for (const fieldTag of personalNameFields) {
			const authorFields = this.getAllDatafieldsByTag(datafields, fieldTag)
			for (const field of authorFields) {
				const surname = this.getSubfieldText([field], fieldTag, 'a')
				const firstName = this.getSubfieldText([field], fieldTag, 'b')
				if (surname || firstName) {
					addName(this.formatPersonName(firstName, surname))
				}
			}
		}

		if (names.length === 0) {
			const corporateNameFields = ['710', '711', '712']
			for (const fieldTag of corporateNameFields) {
				const authorFields = this.getAllDatafieldsByTag(datafields, fieldTag)
				for (const field of authorFields) {
					const name = this.getSubfieldText([field], fieldTag, 'a')
					if (name) {
						addName(name)
					}
				}
			}
		}

		if (names.length === 0 && includeFallback) {
			const statement = this.getSubfieldText(datafields, '200', 'f')
			if (statement) {
				addName(statement.replace(/^(\[.*?\]|par|de|par\s+)\s*/i, ''))
			}
		}

		return names.join(', ')
	}

	/**
	 * Convert centimeters to millimeters (rounded integer for ACF number fields).
	 * @param {number|string} cm
	 * @returns {number|null}
	 */
	static cmToMm(cm) {
		const value = typeof cm === 'number' ? cm : parseFloat(String(cm).replace(',', '.'))
		if (Number.isNaN(value)) {
			return null
		}
		return Math.round(value * 10)
	}

	/**
	 * Parse UNIMARC field 215 $d (physical dimensions) into width/height in mm.
	 * Examples: "18 cm", "18 x 12 cm", "12 × 18 cm"
	 * Single value is treated as height; two values use smaller as width, larger as height.
	 * @param {string} raw - Raw subfield text
	 * @returns {{ width: number|null, height: number|null }}
	 */
	static parsePhysicalDimensions(raw) {
		if (!raw) {
			return { width: null, height: null }
		}

		const trimmed = raw.trim()

		const twoDimMatch = trimmed.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*cm/i)
		if (twoDimMatch) {
			const first = parseFloat(twoDimMatch[1].replace(',', '.'))
			const second = parseFloat(twoDimMatch[2].replace(',', '.'))
			const smaller = Math.min(first, second)
			const larger = Math.max(first, second)
			return {
				width: this.cmToMm(smaller),
				height: this.cmToMm(larger)
			}
		}

		const oneDimMatch = trimmed.match(/(\d+(?:[.,]\d+)?)\s*cm/i)
		if (oneDimMatch) {
			return {
				width: null,
				height: this.cmToMm(oneDimMatch[1])
			}
		}

		const mmMatch = trimmed.match(/(\d+(?:[.,]\d+)?)\s*mm/i)
		if (mmMatch) {
			const mm = Math.round(parseFloat(mmMatch[1].replace(',', '.')))
			return { width: null, height: Number.isNaN(mm) ? null : mm }
		}

		return { width: null, height: null }
	}
}
