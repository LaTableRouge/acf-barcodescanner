import { fillAcfTextByName, fillCoverIfNewPost, filledMessages, setValueIfEmpty } from '../common/fill-utils'

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

	return filledMessages(await fillCoverIfNewPost(hasExistingTitle, fetchedDatas.cover))
}
