import './styles/index.scss'

import { __ } from '@wordpress/i18n'
// import eruda from 'eruda'
import Swal from 'sweetalert2'

import { barcodeScanner } from './scripts/components/barcode-scanner'
import { booksFieldsFiller } from './scripts/components/books/filler'
import { cdsFieldsFiller } from './scripts/components/cds/filler'
import { dvdsFieldsFiller } from './scripts/components/dvds/filler'
import { mediasfetch } from './scripts/components/medias-fetch'

// Mobile debug helper
// const el = document.createElement('div')
// document.body.appendChild(el)

// eruda.init({
//   container: el,
//   tool: ['console', 'elements']
// })

function initField($field) {
	const field = $field[0]
	if (field) {
		const postType = field.dataset.name.split('_')[0]
		const mainWrapper = field.closest('form#post')

		const button = field.querySelector('.js-open-popup')
		if (button) {
			button.addEventListener('click', async (e) => {
				e.preventDefault()
				// const fetchedDatas = await booksfetch('0724387383814', 'dvds')
				// console.log(fetchedDatas)
				// dvdsFieldsFiller(mainWrapper, fetchedDatas)

				Swal.fire({
					title: __('Scannez un code barre', 'acf-barcodescanner'),
					allowOutsideClick: false,
					showCloseButton: true,
					showCancelButton: false,
					input: 'text',
					inputAttributes: {
						autocapitalize: 'off',
						autocomplete: 'off'
					},
					customClass: {
						popup: 'acfbcs__popup'
					},
					showLoaderOnConfirm: true,
					confirmButtonText: __('Récupérer les données', 'acf-barcodescanner'),
					didOpen: (wrapper) => {
						barcodeScanner(wrapper)
					},
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
					preConfirm: async (barcode) => {
						const fetchedDatas = await mediasfetch(barcode, postType)

						if (fetchedDatas) {
							const booksPostTypes = ['mangas', 'books', 'bds']
							let messages = []
							try {
								if (booksPostTypes.includes(postType)) {
									messages = (await booksFieldsFiller(mainWrapper, fetchedDatas)) || []
								} else if (postType === 'cds') {
									messages = (await cdsFieldsFiller(mainWrapper, fetchedDatas)) || []
								} else if (postType === 'dvds') {
									messages = (await dvdsFieldsFiller(mainWrapper, fetchedDatas)) || []
								} else {
									return null
								}
								Swal.fire(__('Success', 'acf-barcodescanner'), messages.join('<br>'), 'success')
							} catch (error) {
								console.error('Error filling fields:', error)
								Swal.fire(__('Error', 'acf-barcodescanner'), __('An error occurred while filling the fields', 'acf-barcodescanner'), 'error')
							}
						} else {
							Swal.fire(__('Error', 'acf-barcodescanner'), __('No data could be retreived', 'acf-barcodescanner'), 'error')
							console.error('No data could be retreived')
						}
					}
				})
			})
		}
	}
}

if (typeof acf.add_action !== 'undefined') {
	/*
	 *  ready & append (ACF5)
	 *
	 *  These two events are called when a field element is ready for initizliation.
	 *  - ready: on page load similar to $(document).ready()
	 *  - append: on new DOM elements appended via repeater field or other AJAX calls
	 *
	 *  @paramn/a
	 *  @returnn/a
	 */

	acf.add_action('ready_field/type=barcodescanner', initField)
	acf.add_action('append_field/type=barcodescanner', initField)
}
