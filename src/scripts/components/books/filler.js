import { __ } from '@wordpress/i18n'

import { XMLUtils } from '../common/xml-utils'
import { coverfetch } from '../cover-fetch'

const REPEATER_ROW_DELAY_MS = 100

/**
 * Fill number inputs on a repeater row only when empty.
 * @param {Element} row
 * @param {Record<string, number|null|undefined>} fieldValues - data-name → value (mm)
 */
function fillRepeaterRowNumbers(row, fieldValues) {
	if (!row) {
		return
	}
	for (const [fieldName, value] of Object.entries(fieldValues)) {
		if (value == null || value === '') {
			continue
		}
		const input = row.querySelector(`.acf-field[data-name="${fieldName}"] input`)
		if (input && !input.value.length) {
			input.value = value
			input.dispatchEvent(new Event('input'))
		}
	}
}

/**
 * Fill sizes repeater (Longueur / Hauteur in mm). Adds a row when none exist.
 * @param {Element} mainWrapper
 * @param {{ width?: number|null, height?: number|null }} dimensions
 */
function fillSizesRepeater(mainWrapper, dimensions = {}) {
	const { height, width } = dimensions
	if (width == null && height == null) {
		return
	}

	const sizesFieldWrapper = mainWrapper.querySelector('.acf-field[data-name*="_sizes"]')
	if (!sizesFieldWrapper) {
		return
	}

	const fieldValues = {
		sizes_width: width,
		sizes_height: height
	}

	const existingRows = sizesFieldWrapper.querySelectorAll('.acf-row:not(.acf-clone)')
	if (existingRows.length > 0) {
		fillRepeaterRowNumbers(existingRows[0], fieldValues)
		return
	}

	const addRowButton = sizesFieldWrapper.querySelector('.acf-repeater-add-row')
	if (!addRowButton) {
		return
	}

	addRowButton.click()
	setTimeout(() => {
		const rows = sizesFieldWrapper.querySelectorAll('.acf-row:not(.acf-clone)')
		fillRepeaterRowNumbers(rows[rows.length - 1], fieldValues)
	}, REPEATER_ROW_DELAY_MS)
}

export const booksFieldsFiller = async (mainWrapper, fetchedDatas = {}) => {
	const postTitle = mainWrapper.querySelector('#title')
	if (!postTitle) {
		return []
	}

	const hasExistingTitle = postTitle.value.length > 0
	const seriesTitle = fetchedDatas.seriesTitle
	const volumeTitle = fetchedDatas.title
	const postTitleToUse = seriesTitle || volumeTitle

	if (!hasExistingTitle && postTitleToUse) {
		postTitle.value = postTitleToUse
		postTitle.dispatchEvent(new Event('input'))
	}

	const postExcerpt = mainWrapper.querySelector('#excerpt')
	if (postExcerpt && !postExcerpt.value.length && fetchedDatas.excerpt) {
		postExcerpt.value = fetchedDatas.excerpt
	}

	const authorField = mainWrapper.querySelector('.acf-field[data-name*="_author"] .acf-input input[type="text"]')
	if (authorField && !authorField.value.length && fetchedDatas.author) {
		authorField.value = fetchedDatas.author
	}

	const editorField = mainWrapper.querySelector('.acf-field[data-name*="_editor"] .acf-input input[type="text"]')
	if (editorField && !editorField.value.length && fetchedDatas.editor) {
		editorField.value = fetchedDatas.editor
	}

	const volumesInfosFieldWrapper = mainWrapper.querySelector('.acf-field[data-name*="_volumes-repeater"]')
	if (volumesInfosFieldWrapper) {
		const addRowButton = volumesInfosFieldWrapper.querySelector('.acf-repeater-add-row')
		if (addRowButton) {
			const rows = volumesInfosFieldWrapper.querySelectorAll('.acf-row:not(.acf-clone)')
			addRowButton.click()
			setTimeout(() => {
				const updatedRows = volumesInfosFieldWrapper.querySelectorAll('.acf-row:not(.acf-clone)')

				let newlyCreatedRow = rows.length
					? [...updatedRows].filter(function (obj) {
							return [...rows].indexOf(obj) == -1
						})
					: [...updatedRows]
				if (newlyCreatedRow.length) {
					newlyCreatedRow = newlyCreatedRow[0]

					const shouldFillVolumeTitle = Boolean(seriesTitle && volumeTitle && !XMLUtils.titlesMatch(volumeTitle, seriesTitle) && (!hasExistingTitle || XMLUtils.titlesMatch(postTitle.value, seriesTitle)))

					if (shouldFillVolumeTitle) {
						const volumeTitleField = newlyCreatedRow.querySelector('.acf-field[data-name="volume_title"] input[type="text"]')
						if (volumeTitleField && !volumeTitleField.value.length) {
							volumeTitleField.value = volumeTitle
						}
					}

					const volumeNumberField = newlyCreatedRow.querySelector('.acf-field[data-name="volume_number"] input[type="number"]')
					if (volumeNumberField && !volumeNumberField.value.length && fetchedDatas.volumeNumber) {
						volumeNumberField.value = fetchedDatas.volumeNumber
					}

					const isbnField = newlyCreatedRow.querySelector('.acf-field[data-name="volume_isbn"] input[type="text"]')
					if (isbnField && !isbnField.value.length && fetchedDatas.isbn) {
						isbnField.value = fetchedDatas.isbn
					}

					const yearField = newlyCreatedRow.querySelector('.acf-field[data-name="volume_year"] input[type="text"]')
					if (yearField && !yearField.value.length && fetchedDatas.year) {
						yearField.value = fetchedDatas.year
					}
				}
			}, REPEATER_ROW_DELAY_MS)
		}
	}

	fillSizesRepeater(mainWrapper, fetchedDatas.dimensions)

	const coverUrl = fetchedDatas.cover
	let coverMessage = []
	if (coverUrl && !hasExistingTitle) {
		try {
			const coverResponse = await coverfetch(coverUrl)
			if (coverResponse?.data?.message) {
				coverMessage.push(coverResponse.data.message)
			}
		} catch (error) {
			console.error('Error fetching cover:', error)
		}
	}

	return [__('Data filled successfully', 'acf-barcodescanner'), ...coverMessage]
}
