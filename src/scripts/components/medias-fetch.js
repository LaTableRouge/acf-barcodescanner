import { __ } from '@wordpress/i18n'

import { BOOKS_POST_TYPES } from '../common/constants'
import { variables } from '../common/variables'
import { XMLUtils } from './common/xml-utils'
import { fetchBnf } from './providers/bnf'
import { mergeRecords } from './providers/merge'
import { fetchMusicBrainz } from './providers/musicbrainz'
import { fetchOpenLibrary } from './providers/open-library'
import { fetchTmdb } from './providers/tmdb'

/**
 * Fetch media data: BnF first for books/DVDs, MusicBrainz first for CDs.
 * Open Library fills empty book fields. TMDB enriches DVDs when a key is set.
 * @param {string} barcode
 * @param {string} postType
 * @param {(message: string) => void} [onStatus]
 * @returns {Promise<Object|null>}
 */
export async function mediasfetch(barcode, postType, onStatus = () => {}) {
	const normalizedBarcode = XMLUtils.normalizeIdentifier(barcode)
	if (!normalizedBarcode) {
		return null
	}

	try {
		if (BOOKS_POST_TYPES.includes(postType)) {
			onStatus(__('Searching the BnF catalogue…', 'acf-barcodescanner'))
			const bnfData = await fetchBnf(normalizedBarcode, postType)
			if (bnfData?.excerpt) {
				return bnfData
			}

			onStatus(__('Checking Open Library…', 'acf-barcodescanner'))
			return mergeRecords(bnfData, await fetchOpenLibrary(normalizedBarcode))
		}

		if (postType === 'cds') {
			onStatus(__('Searching MusicBrainz…', 'acf-barcodescanner'))
			const musicBrainzData = await fetchMusicBrainz(normalizedBarcode)
			onStatus(__('Completing with the BnF…', 'acf-barcodescanner'))
			return mergeRecords(musicBrainzData, await fetchBnf(normalizedBarcode, postType))
		}

		if (postType === 'dvds') {
			onStatus(__('Searching the BnF catalogue…', 'acf-barcodescanner'))
			const bnfData = await fetchBnf(normalizedBarcode, postType)
			if (!variables.tmdbApiKey || !bnfData?.title) {
				return bnfData
			}

			onStatus(__('Enriching with TMDB…', 'acf-barcodescanner'))
			return mergeRecords(bnfData, await fetchTmdb(bnfData, variables.tmdbApiKey))
		}

		return null
	} catch (error) {
		console.error('Error fetching media data:', error)
		return null
	}
}
