import { __ } from '@wordpress/i18n'

import { appendRepeaterRow, fillAcfTextByName, fillCoverIfNewPost, setValueIfEmpty } from '../common/fill-utils'
import { XMLUtils } from '../common/xml-utils'

/**
 * Fill number inputs on a repeater row only when empty.
 * @param {Element|null} row
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
async function fillSizesRepeater(mainWrapper, dimensions = {}) {
	const { height, width } = dimensions
	if (width == null && height == null) {
		return
	}

	const sizesFieldWrapper = mainWrapper.querySelector('.acf-field[data-name*="_sizes"]')
	if (!sizesFieldWrapper) {
		return
	}

	const row = sizesFieldWrapper.querySelector('.acf-row:not(.acf-clone)') || (await appendRepeaterRow(sizesFieldWrapper))
	fillRepeaterRowNumbers(row, { sizes_height: height, sizes_width: width })
}

/**
 * Add a volume row (title, number, ISBN, year) to the volumes repeater
 * @param {Element} mainWrapper
 * @param {Object} fetchedDatas
 * @param {{ hasExistingTitle: boolean, postTitle: string }} context
 */
async function fillVolumesRepeater(mainWrapper, fetchedDatas, { hasExistingTitle, postTitle }) {
	const volumesInfosFieldWrapper = mainWrapper.querySelector('.acf-field[data-name*="_volumes-repeater"]')
	if (!volumesInfosFieldWrapper) {
		return
	}

	const row = await appendRepeaterRow(volumesInfosFieldWrapper)
	if (!row) {
		return
	}

	const { isbn, seriesTitle, title: volumeTitle, volumeNumber, year } = fetchedDatas
	const shouldFillVolumeTitle = Boolean(seriesTitle && volumeTitle && !XMLUtils.titlesMatch(volumeTitle, seriesTitle) && (!hasExistingTitle || XMLUtils.titlesMatch(postTitle, seriesTitle)))

	if (shouldFillVolumeTitle) {
		setValueIfEmpty(row.querySelector('.acf-field[data-name="volume_title"] input[type="text"]'), volumeTitle)
	}
	setValueIfEmpty(row.querySelector('.acf-field[data-name="volume_number"] input[type="number"]'), volumeNumber)
	setValueIfEmpty(row.querySelector('.acf-field[data-name="volume_isbn"] input[type="text"]'), isbn)
	setValueIfEmpty(row.querySelector('.acf-field[data-name="volume_year"] input[type="text"]'), year)
}

export const booksFieldsFiller = async (mainWrapper, fetchedDatas = {}) => {
	const postTitle = mainWrapper.querySelector('#title')
	if (!postTitle) {
		return []
	}

	const hasExistingTitle = postTitle.value.length > 0
	setValueIfEmpty(postTitle, fetchedDatas.seriesTitle || fetchedDatas.title, { dispatchInput: true })
	setValueIfEmpty(mainWrapper.querySelector('#excerpt'), fetchedDatas.excerpt)
	fillAcfTextByName(mainWrapper, '_author', fetchedDatas.author)
	fillAcfTextByName(mainWrapper, '_editor', fetchedDatas.editor)

	await fillVolumesRepeater(mainWrapper, fetchedDatas, { hasExistingTitle, postTitle: postTitle.value })
	await fillSizesRepeater(mainWrapper, fetchedDatas.dimensions)

	const coverMessage = await fillCoverIfNewPost(hasExistingTitle, fetchedDatas.cover)
	return [__('Data filled successfully', 'acf-barcodescanner'), ...coverMessage]
}
