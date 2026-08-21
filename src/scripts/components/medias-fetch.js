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
 * @param {(message: string) => void} onStatus
 * @param {string} message
 */
function reportStatus(onStatus, message) {
	if (typeof onStatus === 'function') {
		onStatus(message)
	}
}

/**
 * Fetch media data: BnF first for books/DVDs, MusicBrainz first for CDs.
 * Open Library fills empty book fields. TMDB enriches DVDs when a key is set.
 * @param {string} barcode
 * @param {string} postType
 * @param {(message: string) => void} [onStatus]
 * @returns {Promise<Object|null>}
 */
export async function mediasfetch(barcode, postType, onStatus) {
	const normalizedBarcode = XMLUtils.normalizeIdentifier(barcode)
	if (!normalizedBarcode) {
		return null
	}

	try {
		if (BOOKS_POST_TYPES.includes(postType)) {
			reportStatus(onStatus, __('Searching the BnF catalogue…', 'acf-barcodescanner'))
			const bnfData = await fetchBnf(normalizedBarcode, postType)
			if (bnfData?.excerpt) {
				return bnfData
			}

			reportStatus(onStatus, __('Checking Open Library…', 'acf-barcodescanner'))
			return mergeRecords(bnfData, await fetchOpenLibrary(normalizedBarcode))
		}

		if (postType === 'cds') {
			reportStatus(onStatus, __('Searching MusicBrainz…', 'acf-barcodescanner'))
			const musicBrainzData = await fetchMusicBrainz(normalizedBarcode)
			reportStatus(onStatus, __('Completing with the BnF…', 'acf-barcodescanner'))
			return mergeRecords(musicBrainzData, await fetchBnf(normalizedBarcode, postType))
		}

		if (postType === 'dvds') {
			reportStatus(onStatus, __('Searching the BnF catalogue…', 'acf-barcodescanner'))
			const bnfData = await fetchBnf(normalizedBarcode, postType)
			if (!variables.tmdbApiKey || !bnfData?.title) {
				return bnfData
			}

			reportStatus(onStatus, __('Enriching with TMDB…', 'acf-barcodescanner'))
			return mergeRecords(bnfData, await fetchTmdb(bnfData, variables.tmdbApiKey))
		}

		reportStatus(onStatus, __('Searching the BnF catalogue…', 'acf-barcodescanner'))
		return fetchBnf(normalizedBarcode, postType)
	} catch (error) {
		console.error('Error fetching media data:', error)
		return null
	}
}
