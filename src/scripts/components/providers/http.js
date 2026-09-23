import { variables } from '../../common/variables'

/**
 * Fetch a remote URL through the WordPress AJAX proxy
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function fetchRemoteText(url) {
	const phpQueryParams = {
		action: 'acfbcs_fetch_from_barcode',
		nonce: variables.nonce,
		url
	}

	const response = await fetch(`${variables.ajaxURL}?${new URLSearchParams(phpQueryParams)}`)
	if (!response.ok) {
		return ''
	}

	const text = await response.text()
	if (!text) {
		return ''
	}

	try {
		const parsed = JSON.parse(text)
		if (parsed && parsed.success === false) {
			return ''
		}
	} catch {
		// Raw XML/text payload
	}

	return text
}

/**
 * Fetch a remote JSON URL through the WordPress AJAX proxy
 * @param {string} url
 * @returns {Promise<Object|null>}
 */
export async function fetchRemoteJson(url) {
	const text = await fetchRemoteText(url)
	if (!text) {
		return null
	}

	try {
		return JSON.parse(text)
	} catch {
		return null
	}
}
