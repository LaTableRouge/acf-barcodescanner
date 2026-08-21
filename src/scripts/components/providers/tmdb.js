import { fetchRemoteJson } from './http'

/**
 * Enrich a BnF DVD record with TMDB plot and poster (director only if BnF has none)
 * @param {Object|null} bnfData
 * @param {string} apiKey
 * @returns {Promise<Object|null>}
 */
export async function fetchTmdb(bnfData, apiKey) {
	if (!apiKey || !bnfData?.title) {
		return null
	}

	const title = bnfData.title.split(' : ')[0].trim()
	const searchParams = {
		api_key: apiKey,
		language: 'fr-FR',
		query: title
	}
	if (bnfData.year) {
		searchParams.year = bnfData.year
	}

	const search = await fetchRemoteJson(`https://api.themoviedb.org/3/search/movie?${new URLSearchParams(searchParams)}`)
	const movie = search?.results?.[0]
	if (!movie) {
		return null
	}

	let director = ''
	if (!bnfData.director) {
		const credits = await fetchRemoteJson(`https://api.themoviedb.org/3/movie/${movie.id}/credits?${new URLSearchParams({ api_key: apiKey })}`)
		director = (credits?.crew || []).find((person) => person.job === 'Director')?.name || ''
	}

	return {
		cover: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
		director,
		excerpt: movie.overview || '',
		year: String(movie.release_date || '').slice(0, 4)
	}
}
