import { __ } from '@wordpress/i18n'

import { fillAcfTextByName, fillCoverIfNewPost, setValueIfEmpty } from '../common/fill-utils'
import { XMLUtils } from '../common/xml-utils'

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
		const input = row.querySelector(`.acf-field[data-name="${fieldName}"] input`)
		setValueIfEmpty(input, value, { dispatchInput: true })
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

	setValueIfEmpty(postTitle, seriesTitle || volumeTitle, { dispatchInput: true })
	setValueIfEmpty(mainWrapper.querySelector('#excerpt'), fetchedDatas.excerpt)
	fillAcfTextByName(mainWrapper, '_author', fetchedDatas.author)
	fillAcfTextByName(mainWrapper, '_editor', fetchedDatas.editor)

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
						setValueIfEmpty(newlyCreatedRow.querySelector('.acf-field[data-name="volume_title"] input[type="text"]'), volumeTitle)
					}

					setValueIfEmpty(newlyCreatedRow.querySelector('.acf-field[data-name="volume_number"] input[type="number"]'), fetchedDatas.volumeNumber)
					setValueIfEmpty(newlyCreatedRow.querySelector('.acf-field[data-name="volume_isbn"] input[type="text"]'), fetchedDatas.isbn)
					setValueIfEmpty(newlyCreatedRow.querySelector('.acf-field[data-name="volume_year"] input[type="text"]'), fetchedDatas.year)
				}
			}, REPEATER_ROW_DELAY_MS)
		}
	}

	fillSizesRepeater(mainWrapper, fetchedDatas.dimensions)

	const coverMessage = await fillCoverIfNewPost(hasExistingTitle, fetchedDatas.cover)
	return [__('Data filled successfully', 'acf-barcodescanner'), ...coverMessage]
}
