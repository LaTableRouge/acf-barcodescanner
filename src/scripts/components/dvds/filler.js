import { __ } from '@wordpress/i18n'

import { coverfetch } from '../cover-fetch'

export const dvdsFieldsFiller = async (mainWrapper, fetchedDatas = {}) => {
	const postTitle = mainWrapper.querySelector('#title')
	if (!postTitle) {
		return
	}
	if (postTitle.value.length && !fetchedDatas.title) {
		return
	}

	postTitle.value = fetchedDatas.title
	postTitle.dispatchEvent(new Event('input'))

	const postExcerpt = mainWrapper.querySelector('#excerpt')
	if (postExcerpt && !postExcerpt.value.length && fetchedDatas.excerpt) {
		postExcerpt.value = fetchedDatas.excerpt
	}

	const authorField = mainWrapper.querySelector('.acf-field[data-name*="_author"] .acf-input input[type="text"]')
	if (authorField && !authorField.value.length && fetchedDatas.director) {
		authorField.value = fetchedDatas.director
	}

	const editorField = mainWrapper.querySelector('.acf-field[data-name*="_editor"] .acf-input input[type="text"]')
	if (editorField && !editorField.value.length && fetchedDatas.editor) {
		editorField.value = fetchedDatas.editor
	}

	const numberField = mainWrapper.querySelector('.acf-field[data-name*="_number"] .acf-input input[type="text"]')
	if (numberField && !numberField.value.length && fetchedDatas.idNumber) {
		numberField.value = fetchedDatas.idNumber
	}

	const yearField = mainWrapper.querySelector('.acf-field[data-name*="_date"] .acf-input input[type="text"]')
	if (yearField && !yearField.value.length && fetchedDatas.year) {
		yearField.value = fetchedDatas.year
	}

	const coverUrl = fetchedDatas.cover
	let coverMessage = []
	if (coverUrl) {
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
