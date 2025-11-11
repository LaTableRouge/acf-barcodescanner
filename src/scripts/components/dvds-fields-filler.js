import { coverfetch } from './cover-fetch'

export const dvdsFieldsFiller = (mainWrapper, fetchedDatas = {}) => {
	const postTitle = mainWrapper.querySelector('#title')
	if (postTitle && !postTitle.value.length && fetchedDatas.title) {
		postTitle.value = fetchedDatas.title
		postTitle.dispatchEvent(new Event('input'))

		const coverUrl = fetchedDatas.cover
		if (coverUrl) {
			coverfetch(coverUrl)
		}
	}

	const yearField = mainWrapper.querySelector('.acf-field[data-name*="_date"] .acf-input input[type="text"]')
	if (yearField && !yearField.value.length && fetchedDatas.year) {
		yearField.value = fetchedDatas.year
	}
}
