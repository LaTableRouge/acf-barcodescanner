import { coverfetch } from './cover-fetch'

export const booksFieldsFiller = (mainWrapper, fetchedDatas = {}) => {
	const postTitle = mainWrapper.querySelector('#title')
	if (postTitle && !postTitle.value.length && fetchedDatas.title) {
		postTitle.value = fetchedDatas.title
		postTitle.dispatchEvent(new Event('input'))

		const coverUrl = fetchedDatas.cover
		if (coverUrl) {
			coverfetch(coverUrl)
		}
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
	if (heightField && !heightField.value.length && fetchedDatas.dimensions.height) {
		heightField.value = fetchedDatas.dimensions.height
	}
}
