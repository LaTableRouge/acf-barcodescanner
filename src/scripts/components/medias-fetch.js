import { __ } from '@wordpress/i18n'

import { variables } from '../common/variables'

// Function to get text content from a specific tag with a specific attribute
function getSubfieldText(datafields, tag, code) {
	for (let i = 0; i < datafields.length; i++) {
		if (datafields[i].getAttribute('tag') === tag) {
			const subfields = datafields[i].getElementsByTagName('mxc:subfield')
			for (let j = 0; j < subfields.length; j++) {
				if (subfields[j].getAttribute('code') === code) {
					return subfields[j].textContent.trim()
				}
			}
		}
	}
	return ''
}

function getFieldText(fields = [], tag = '') {
	for (let i = 0; i < fields.length; i++) {
		if (fields[i].getAttribute('tag') === tag) {
			return fields[i].textContent.trim()
		}
	}
	return ''
}

export const mediasfetch = async (barcode, postType) => {
	barcode = barcode.replaceAll('-', '')

	const urlToFetchParams = {
		version: '1.2',
		recordSchema: 'unimarcXchange',
		operation: 'searchRetrieve',
		query: `bib.anywhere all '${barcode}'`
	}

	const urltoFetch = `https://catalogue.bnf.fr/api/SRU?${new URLSearchParams(urlToFetchParams)}`

	const phpQueryParams = {
		action: 'acfbcs_fetch_from_barcode',
		url: urltoFetch
	}

	// xml desc: https://www.bnf.fr/sites/default/files/2019-04/service_sru_bnf.pdf
	// Test url: https://catalogue.bnf.fr/api/SRU?version=1.2&recordSchema=unimarcXchange&operation=searchRetrieve&query=bib.anywhere+all+%279782811661427%27
	// Catalogue url: https://catalogue.bnf.fr/ark:/12148/cb46838232d
	return await fetch(`${variables.ajaxURL}?${new URLSearchParams(phpQueryParams)}`)
		.then(async (response) => {
			response = await response.text()

			if (!response) {
				console.error('Error in the response')

				return
			}

			const parser = new DOMParser()
			const xmlDoc = parser.parseFromString(response, 'application/xml')

			// Try accessing the 'record' element without namespaces as a test
			const recordElements = xmlDoc.getElementsByTagName('srw:record')
			if (recordElements.length === 0) {
				console.warn("No 'record' elements found.")

				return
			}

			const recordElement = recordElements[0]
			const datafields = recordElement.getElementsByTagName('mxc:datafield')
			const controlFields = recordElement.getElementsByTagName('mxc:controlfield')
			const coverPageUrl = getFieldText(controlFields, '003')

			const booksPostTypes = ['mangas', 'books', 'bds']
			if (booksPostTypes.includes(postType)) {
				const title = getSubfieldText(datafields, '200', 'a')
				const author = getSubfieldText(datafields, '200', 'f')
				const volumeNumber = getSubfieldText(datafields, '461', 'v')
				const editor = getSubfieldText(datafields, '214', 'c')
				const excerpt = getSubfieldText(datafields, '830', 'a')
				const height = getSubfieldText(datafields, '280', 'd')
				const isbn = getSubfieldText(datafields, '010', 'a')

				const extraRecordData = recordElement.getElementsByTagName('srw:extraRecordData')[0]
				const creationDateAttr = extraRecordData.getElementsByTagName('ixm:attr')
				let year = ''
				for (let i = 0; i < creationDateAttr.length; i++) {
					if (creationDateAttr[i].getAttribute('name') === 'CreationDate') {
						const creationDateStr = creationDateAttr[i].textContent
						const creationDate = new Date(creationDateStr.slice(0, 4), creationDateStr[4] + creationDateStr[5] - 1, creationDateStr[6] + creationDateStr[7])
						year = creationDate.getFullYear()
						break
					}
				}

				return {
					title,
					editor,
					author,
					excerpt,
					isbn,
					dimensions: {
						height
					},
					volumeNumber,
					year,
					cover: coverPageUrl
				}
			} else if (postType === 'cds') {
				const title = getSubfieldText(datafields, '200', 'a')
				const artist = getSubfieldText(datafields, '200', 'f')
				const idNumber = getSubfieldText(datafields, '071', 'a')
				const isni = getSubfieldText(datafields, '710', 'o')
				const height = getSubfieldText(datafields, '215', 'd')

				// Extracting tracklist
				const tracklist = []
				for (let i = 0; i < datafields.length; i++) {
					if (datafields[i].getAttribute('tag') === '464') {
						const subfields = datafields[i].getElementsByTagName('mxc:subfield')
						for (let j = 0; j < subfields.length; j++) {
							if (subfields[j].getAttribute('code') === 't') {
								tracklist.push(subfields[j].textContent.trim())
							}
						}
					}
				}

				const extraRecordData = recordElement.getElementsByTagName('srw:extraRecordData')[0]
				const creationDateAttr = extraRecordData.getElementsByTagName('ixm:attr')
				let year = ''
				for (let i = 0; i < creationDateAttr.length; i++) {
					if (creationDateAttr[i].getAttribute('name') === 'CreationDate') {
						const creationDateStr = creationDateAttr[i].textContent
						const creationDate = new Date(creationDateStr.slice(0, 4), creationDateStr[4] + creationDateStr[5] - 1, creationDateStr[6] + creationDateStr[7])
						year = creationDate.getFullYear()
						break
					}
				}

				return {
					title,
					artist,
					idNumber,
					isni,
					dimensions: {
						height
					},
					excerpt: tracklist.length ? `${__('Tracklist:', 'acf-barcodescanner')} ${tracklist.join(', ')}` : '',
					year,
					cover: coverPageUrl
				}
			} else if (postType === 'dvds') {
				const title = getSubfieldText(datafields, '200', 'a')

				const extraRecordData = recordElement.getElementsByTagName('srw:extraRecordData')[0]
				const creationDateAttr = extraRecordData.getElementsByTagName('ixm:attr')
				let year = ''
				for (let i = 0; i < creationDateAttr.length; i++) {
					if (creationDateAttr[i].getAttribute('name') === 'CreationDate') {
						const creationDateStr = creationDateAttr[i].textContent
						const creationDate = new Date(creationDateStr.slice(0, 4), creationDateStr[4] + creationDateStr[5] - 1, creationDateStr[6] + creationDateStr[7])
						year = creationDate.getFullYear()
						break
					}
				}

				return {
					title,
					year,
					cover: coverPageUrl
				}
			} else {
				return null
			}
		})
		.catch(console.error)
}
