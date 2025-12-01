import { coverfetch } from '../cover-fetch'

export const cdsFieldsFiller = (mainWrapper, fetchedDatas = {}) => {
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

	const artistField = mainWrapper.querySelector('.acf-field[data-name*="_artist"] .acf-input input[type="text"]')
	if (artistField && !artistField.value.length && fetchedDatas.artist) {
		artistField.value = fetchedDatas.artist
	}

	const numberField = mainWrapper.querySelector('.acf-field[data-name*="_number"] .acf-input input[type="text"]')
	if (numberField && !numberField.value.length && fetchedDatas.idNumber) {
		numberField.value = fetchedDatas.idNumber
	}

	const yearField = mainWrapper.querySelector('.acf-field[data-name*="_year"] .acf-input input[type="text"]')
	if (yearField && !yearField.value.length && fetchedDatas.year) {
		yearField.value = fetchedDatas.year
	}
}
