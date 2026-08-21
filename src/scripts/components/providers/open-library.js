import { fetchRemoteJson } from './http'

/**
 * Fallback book metadata (title, excerpt, cover) from Open Library
 * @param {string} isbn
 * @returns {Promise<Object|null>}
 */
export async function fetchOpenLibrary(isbn) {
	const edition = await fetchRemoteJson(`https://openlibrary.org/isbn/${isbn}.json`)
	if (!edition || edition.error) {
		return null
	}

	let excerpt = ''
	if (typeof edition.description === 'string') {
		excerpt = edition.description.trim()
	} else if (edition.description?.value) {
		excerpt = String(edition.description.value).trim()
	}

	const coverMeta = await fetchRemoteJson(`https://covers.openlibrary.org/b/isbn/${isbn}-L.json`)
	const cover = coverMeta ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : ''

	return {
		cover,
		excerpt,
		title: edition.title || ''
	}
}
