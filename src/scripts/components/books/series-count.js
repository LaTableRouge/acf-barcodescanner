import { __, sprintf } from '@wordpress/i18n'
import Swal from 'sweetalert2'

import { $, variables } from '../../common/variables'

const ONGOING_STATUS = 'ongoing'

/**
 * Form controls read and written by the volume counter
 * @param {Element} mainWrapper - `form#post`
 * @param {string} postType
 */
function getControls(mainWrapper, postType) {
	return {
		postId: mainWrapper.querySelector('#post_ID'),
		publisher: mainWrapper.querySelector(`.acf-field[data-name="${postType}_editor"] .acf-input input[type="text"]`),
		status: mainWrapper.querySelector(`.acf-field[data-name="${postType}_status"] .acf-input select`),
		title: mainWrapper.querySelector('#title'),
		volumesTotal: mainWrapper.querySelector(`.acf-field[data-name="${postType}_volumes-total"] .acf-input input`)
	}
}

/**
 * @param {{ postId: string, publisher: string, title: string }} params
 * @returns {Promise<{ total: number, max: number, numbers: number[] }>}
 */
async function requestSeriesVolumes({ postId, publisher, title }) {
	const response = await fetch(variables.ajaxURL, {
		body: new URLSearchParams({
			action: 'acfbcs_count_series_volumes',
			nonce: variables.nonce,
			post_id: postId,
			publisher,
			title
		}),
		credentials: 'same-origin',
		method: 'POST'
	})

	const payload = await response.json().catch(() => null)
	if (!payload?.success) {
		throw new Error(payload?.data?.message || __('The BnF catalogue could not be reached.', 'acf-barcodescanner'))
	}

	return payload.data
}

/**
 * Raise the total volumes input to `found`, never lower it
 * @param {HTMLInputElement|null} input
 * @param {number} found
 * @returns {{ previous: number, current: number, updated: boolean }|null}
 */
function raiseVolumesTotal(input, found) {
	if (!input) {
		return null
	}

	const previous = parseInt(input.value, 10) || 0
	if (found <= previous) {
		return { current: previous, previous, updated: false }
	}

	input.value = String(found)
	input.dispatchEvent(new Event('input', { bubbles: true }))
	input.dispatchEvent(new Event('change', { bubbles: true }))

	return { current: found, previous, updated: true }
}

/**
 * @param {{ total: number, max: number }} volumes
 * @param {{ previous: number, current: number, updated: boolean }|null} totalUpdate
 * @returns {string}
 */
function buildResultMessage(volumes, totalUpdate) {
	if (volumes.total === 0) {
		return __('No volume found in the BnF catalogue.', 'acf-barcodescanner')
	}

	const lines = [
		/* translators: %d: number of distinct volumes found */
		sprintf(__('%d volumes found in the BnF catalogue.', 'acf-barcodescanner'), volumes.total),
		/* translators: %d: highest volume number found */
		sprintf(__('Highest volume number: %d.', 'acf-barcodescanner'), volumes.max)
	]

	if (totalUpdate?.updated) {
		/* translators: 1: previous total volumes, 2: new total volumes */
		lines.push(sprintf(__('Total volumes updated: %1$d → %2$d.', 'acf-barcodescanner'), totalUpdate.previous, totalUpdate.current), __('Save the post to keep it.', 'acf-barcodescanner'))
	} else if (totalUpdate) {
		/* translators: %d: current total volumes */
		lines.push(sprintf(__('Total volumes unchanged (%d).', 'acf-barcodescanner'), totalUpdate.current))
	}

	return lines.join('<br>')
}

/**
 * One-line summary appended to the scan result
 * @param {{ total: number, max: number }} volumes
 * @returns {string}
 */
function buildSummaryMessage(volumes) {
	if (volumes.total === 0) {
		return __('No volume found in the BnF catalogue.', 'acf-barcodescanner')
	}

	/* translators: %d: highest volume number */
	return sprintf(__('BnF: up to volume %d.', 'acf-barcodescanner'), volumes.max)
}

/**
 * Search the BnF and raise the total volumes input
 * @param {ReturnType<typeof getControls>} controls
 * @returns {Promise<{ volumes: { total: number, max: number }, totalUpdate: { previous: number, current: number, updated: boolean }|null }>}
 */
async function countSeriesVolumes(controls) {
	const volumes = await requestSeriesVolumes({
		postId: controls.postId?.value || '',
		publisher: controls.publisher?.value || '',
		title: controls.title?.value || ''
	})
	const totalUpdate = volumes.max > 0 ? raiseVolumesTotal(controls.volumesTotal, volumes.max) : null

	return { totalUpdate, volumes }
}

/**
 * @param {ReturnType<typeof getControls>} controls
 */
async function checkSeriesVolumes(controls) {
	Swal.fire({
		allowOutsideClick: false,
		customClass: { popup: 'acfbcs__popup' },
		didOpen: () => Swal.showLoading(),
		showConfirmButton: false,
		text: __('Searching the BnF catalogue…', 'acf-barcodescanner'),
		title: __('Released volumes', 'acf-barcodescanner')
	})

	try {
		const { totalUpdate, volumes } = await countSeriesVolumes(controls)

		Swal.fire({
			customClass: { popup: 'acfbcs__popup' },
			html: buildResultMessage(volumes, totalUpdate),
			icon: volumes.total > 0 ? 'success' : 'info',
			title: __('Released volumes', 'acf-barcodescanner')
		})
	} catch (error) {
		console.error('Error counting series volumes:', error)
		Swal.fire(__('Error', 'acf-barcodescanner'), error.message, 'error')
	}
}

/**
 * Count the released volumes after a scan filled the form, when the series is ongoing
 * @param {Element} mainWrapper - `form#post`
 * @param {string} postType
 * @param {(message: string) => void} [onStatus]
 * @returns {Promise<string[]>} Lines to append to the scan result, empty when skipped
 */
export async function seriesCountAfterScan(mainWrapper, postType, onStatus = () => {}) {
	const controls = getControls(mainWrapper, postType)
	if (!controls.title?.value || controls.status?.value !== ONGOING_STATUS) {
		return []
	}

	onStatus(__('Searching the BnF catalogue…', 'acf-barcodescanner'))
	let summary
	try {
		const { volumes } = await countSeriesVolumes(controls)
		summary = buildSummaryMessage(volumes)
	} catch (error) {
		console.error('Error counting series volumes:', error)
		summary = error.message
	}

	return [`<span class="acfbcs__series-summary">${summary}</span>`]
}

/**
 * Wire the "Check released volumes" button, shown only while the series status is ongoing
 * @param {Element} field - Barcode scanner `.acf-field`
 * @param {Element} mainWrapper - `form#post`
 * @param {string} postType
 */
export function seriesCount(field, mainWrapper, postType) {
	const button = field.querySelector('.js-count-volumes')
	if (!button || !mainWrapper) {
		return
	}

	const controls = getControls(mainWrapper, postType)
	if (!controls.status || !controls.title) {
		return
	}

	const syncVisibility = () => {
		button.hidden = controls.status.value !== ONGOING_STATUS
	}

	syncVisibility()
	// jQuery listener: ACF's select2 UI only triggers jQuery change events
	$(controls.status).on('change', syncVisibility)

	button.addEventListener('click', async (e) => {
		e.preventDefault()
		button.disabled = true
		await checkSeriesVolumes(controls)
		button.disabled = false
	})
}
