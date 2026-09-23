import './styles/index.scss'

import { __ } from '@wordpress/i18n'
// import eruda from 'eruda'
import Swal from 'sweetalert2'

import { BOOKS_POST_TYPES } from './scripts/common/constants'
import { barcodeScanner } from './scripts/components/barcode-scanner'
import { booksFieldsFiller } from './scripts/components/books/filler'
import { seriesCount, seriesCountAfterScan } from './scripts/components/books/series-count'
import { cdsFieldsFiller } from './scripts/components/cds/filler'
import { dvdsFieldsFiller } from './scripts/components/dvds/filler'
import { mediasfetch } from './scripts/components/medias-fetch'

const fillBookFields = async (mainWrapper, fetchedDatas, postType) => [...(await booksFieldsFiller(mainWrapper, fetchedDatas)), ...(await seriesCountAfterScan(mainWrapper, postType, setPopupStatus))]

/**
 * Fill the form from fetched data, per post type. Each filler resolves to the messages to display.
 * @type {Record<string, (mainWrapper: Element, fetchedDatas: Object, postType: string) => Promise<string[]>>}
 */
const FIELDS_FILLERS = {
	...Object.fromEntries(BOOKS_POST_TYPES.map((postType) => [postType, fillBookFields])),
	cds: cdsFieldsFiller,
	dvds: dvdsFieldsFiller
}

function setPopupStatus(message) {
	const popup = Swal.getPopup()
	if (!popup) {
		return
	}

	let status = popup.querySelector('.acfbcs__status')
	if (!status) {
		status = document.createElement('p')
		status.className = 'acfbcs__status'
		status.setAttribute('aria-live', 'polite')
		const title = popup.querySelector('#swal2-title')
		if (title) {
			title.after(status)
		} else {
			popup.prepend(status)
		}
	}

	status.textContent = message
}

/**
 * @param {string} barcode
 * @param {string} postType
 * @param {Element} mainWrapper - `form#post`
 */
async function fetchAndFill(barcode, postType, mainWrapper) {
	const fillFields = FIELDS_FILLERS[postType]
	if (!fillFields) {
		return
	}

	const fetchedDatas = await mediasfetch(barcode, postType, setPopupStatus)
	if (!fetchedDatas) {
		console.error('No data could be retrieved')
		Swal.fire(__('Error', 'acf-barcodescanner'), __('No data could be retrieved', 'acf-barcodescanner'), 'error')
		return
	}

	try {
		setPopupStatus(__('Filling in the fields…', 'acf-barcodescanner'))
		const messages = await fillFields(mainWrapper, fetchedDatas, postType)
		Swal.fire(__('Success', 'acf-barcodescanner'), messages.join('<br>'), 'success')
	} catch (error) {
		console.error('Error filling fields:', error)
		Swal.fire(__('Error', 'acf-barcodescanner'), __('An error occurred while filling the fields', 'acf-barcodescanner'), 'error')
	}
}

function initField($field) {
	const field = $field[0]
	if (!field) {
		return
	}

	const postType = field.dataset.name.split('_')[0]
	const mainWrapper = field.closest('form#post')

	if (BOOKS_POST_TYPES.includes(postType)) {
		seriesCount(field, mainWrapper, postType)
	}

	const button = field.querySelector('.js-open-popup')
	if (!button) {
		return
	}

	button.addEventListener('click', (e) => {
		e.preventDefault()

		let scanner = null
		Swal.fire({
			title: __('Scan a barcode', 'acf-barcodescanner'),
			allowOutsideClick: false,
			showCloseButton: true,
			closeButtonAriaLabel: __('Close', 'acf-barcodescanner'),
			input: 'text',
			inputAttributes: {
				autocapitalize: 'off',
				autocomplete: 'off'
			},
			customClass: {
				popup: 'acfbcs__popup'
			},
			showLoaderOnConfirm: true,
			confirmButtonText: __('Fetch the data', 'acf-barcodescanner'),
			didOpen: (wrapper) => {
				scanner = barcodeScanner(wrapper)
			},
			willClose: () => scanner?.stop(),
			html: /* html */ `
            <div class="acfbcs__scanner-wrapper">
              <div class="scanner-wrapper__choices">
                <button id="startButton">${__('Start Scan', 'acf-barcodescanner')}</button>
              </div>
              <div 
                class="scanner-wrapper__scanner js-barecode-scan" 
                style="display:none;"
              >
                <select id="cameraSelect"></select>
                <div class="scanner__video-wrapper">
                  <svg id="polygon" class="polygon-wrapper js-polygon"></svg>
                  <video class="camera fullscreen" muted autoplay="autoplay" playsinline="playsinline" webkit-playsinline></video>
                </div>
              </div>
          </div>`,
			preConfirm: (barcode) => {
				scanner?.stop()
				return fetchAndFill(barcode, postType, mainWrapper)
			}
		})
	})
}

if (typeof acf.add_action !== 'undefined') {
	/*
	 *  ready & append (ACF5)
	 *
	 *  These two events are called when a field element is ready for initialization.
	 *  - ready: on page load similar to $(document).ready()
	 *  - append: on new DOM elements appended via repeater field or other AJAX calls
	 */
	acf.add_action('ready_field/type=barcodescanner', initField)
	acf.add_action('append_field/type=barcodescanner', initField)
}
