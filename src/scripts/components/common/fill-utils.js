import { coverfetch } from '../cover-fetch'

/**
 * Set an input value only when it is empty
 * @param {Element|null} input
 * @param {string|number|null|undefined} value
 * @param {{ dispatchInput?: boolean }} [options]
 */
export function setValueIfEmpty(input, value, options = {}) {
	if (!input || value == null || value === '' || input.value.length) {
		return
	}

	input.value = value
	if (options.dispatchInput) {
		input.dispatchEvent(new Event('input'))
	}
}

/**
 * @param {Element} wrapper
 * @param {string} nameFragment data-name substring
 * @param {string|number|null|undefined} value
 */
export function fillAcfTextByName(wrapper, nameFragment, value) {
	const input = wrapper.querySelector(`.acf-field[data-name*="${nameFragment}"] .acf-input input[type="text"]`)
	setValueIfEmpty(input, value)
}

const REPEATER_ROW_DELAY_MS = 100

/**
 * Add a row to an ACF repeater and resolve with it once ACF has rendered it
 * @param {Element} repeaterField - Repeater `.acf-field`
 * @returns {Promise<Element|null>}
 */
export function appendRepeaterRow(repeaterField) {
	const addRowButton = repeaterField.querySelector('.acf-repeater-add-row')
	if (!addRowButton) {
		return Promise.resolve(null)
	}

	const getRows = () => [...repeaterField.querySelectorAll('.acf-row:not(.acf-clone)')]
	const previousRows = getRows()
	addRowButton.click()

	return new Promise((resolve) => {
		setTimeout(() => resolve(getRows().find((row) => !previousRows.includes(row)) || null), REPEATER_ROW_DELAY_MS)
	})
}

/**
 * Sideload a cover only when creating a new post
 * @param {boolean} hasExistingTitle
 * @param {string} [coverUrl]
 * @returns {Promise<string[]>}
 */
export async function fillCoverIfNewPost(hasExistingTitle, coverUrl) {
	if (!coverUrl || hasExistingTitle) {
		return []
	}

	try {
		const coverResponse = await coverfetch(coverUrl)
		return coverResponse?.data?.message ? [coverResponse.data.message] : []
	} catch (error) {
		console.error('Error fetching cover:', error)
		return []
	}
}
