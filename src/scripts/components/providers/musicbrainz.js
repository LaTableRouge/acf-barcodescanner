import { fetchRemoteJson } from './http'

/**
 * @param {Object} release
 * @returns {string}
 */
function formatArtist(release) {
	return (release['artist-credit'] || [])
		.map((credit) => credit.name || credit.artist?.name || '')
		.filter(Boolean)
		.join(', ')
}

/**
 * @param {Object} release
 * @returns {string[]}
 */
function extractTrackTitles(release) {
	const titles = []
	for (const medium of release.media || []) {
		for (const track of medium.tracks || []) {
			const title = track.title || track.recording?.title
			if (title) {
				titles.push(title)
			}
		}
	}
	return titles
}

/**
 * CD metadata from MusicBrainz + Cover Art Archive
 * @param {string} barcode
 * @returns {Promise<Object|null>}
 */
export async function fetchMusicBrainz(barcode) {
	const search = await fetchRemoteJson(`https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(`barcode:${barcode}`)}&fmt=json`)
	const hit = search?.releases?.[0]
	if (!hit?.id) {
		return null
	}

	const release = (await fetchRemoteJson(`https://musicbrainz.org/ws/2/release/${hit.id}?fmt=json&inc=artists+recordings`)) || hit
	const tracks = extractTrackTitles(release)
	const coverArt = await fetchRemoteJson(`https://coverartarchive.org/release/${release.id}`)

	return {
		artist: formatArtist(release),
		cover: coverArt?.images?.length ? `https://coverartarchive.org/release/${release.id}/front-500` : '',
		excerpt: '',
		idNumber: release.barcode || barcode,
		title: release.title || '',
		tracklist: tracks,
		year: String(release.date || '').slice(0, 4)
	}
}
