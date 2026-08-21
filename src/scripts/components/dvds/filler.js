import { __ } from '@wordpress/i18n'

import { fillAcfTextByName, fillCoverIfNewPost, setValueIfEmpty } from '../common/fill-utils'

export const dvdsFieldsFiller = async (mainWrapper, fetchedDatas = {}) => {
	const postTitle = mainWrapper.querySelector('#title')
	if (!postTitle) {
		return []
	}

	const hasExistingTitle = postTitle.value.length > 0
	setValueIfEmpty(postTitle, fetchedDatas.title, { dispatchInput: true })
	setValueIfEmpty(mainWrapper.querySelector('#excerpt'), fetchedDatas.excerpt)
	fillAcfTextByName(mainWrapper, '_author', fetchedDatas.director)
	fillAcfTextByName(mainWrapper, '_editor', fetchedDatas.editor)
	fillAcfTextByName(mainWrapper, '_number', fetchedDatas.idNumber)
	fillAcfTextByName(mainWrapper, '_date', fetchedDatas.year)

	const coverMessage = await fillCoverIfNewPost(hasExistingTitle, fetchedDatas.cover)
	return [__('Data filled successfully', 'acf-barcodescanner'), ...coverMessage]
}
