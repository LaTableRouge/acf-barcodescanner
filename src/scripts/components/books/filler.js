import { __ } from '@wordpress/i18n'

import { coverfetch } from '../cover-fetch'

export const booksFieldsFiller = async (mainWrapper, fetchedDatas = {}) => {
	const postTitle = mainWrapper.querySelector('#title')
	if (!postTitle) {
		return []
	}

	const hasExistingTitle = postTitle.value.length > 0
	if (!hasExistingTitle && fetchedDatas.title) {
		postTitle.value = fetchedDatas.title
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

					// If postTitle is already filled and datafield 225 (series title) matches the postTitle,
					// fill the volume_title field with the book title
					if (hasExistingTitle && fetchedDatas.seriesTitle && fetchedDatas.title) {
						const postTitleValue = postTitle.value.trim()
						const seriesTitleValue = fetchedDatas.seriesTitle.trim()

						if (postTitleValue === seriesTitleValue) {
							const volumeTitleField = newlyCreatedRow.querySelector('.acf-field[data-name="volume_title"] input[type="text"]')
							if (volumeTitleField && !volumeTitleField.value.length) {
								volumeTitleField.value = fetchedDatas.title
							}
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
			}, 100)
		}
	}

	const heightField = mainWrapper.querySelector('.acf-field[data-name*="_sizes"] .acf-field[data-name="height"] input[type="text"]')
	if (heightField && !heightField.value.length && fetchedDatas.dimensions?.height) {
		heightField.value = fetchedDatas.dimensions.height
	}

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
