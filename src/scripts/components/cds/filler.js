import { fillAcfTextByName, fillCoverIfNewPost, filledMessages, setValueIfEmpty } from '../common/fill-utils'
import { formatCdExcerpt } from './extract'

export const cdsFieldsFiller = async (mainWrapper, fetchedDatas = {}) => {
	const postTitle = mainWrapper.querySelector('#title')
	if (!postTitle) {
		return []
	}

	const hasExistingTitle = postTitle.value.length > 0
	setValueIfEmpty(postTitle, fetchedDatas.title, { dispatchInput: true })
	setValueIfEmpty(mainWrapper.querySelector('#excerpt'), formatCdExcerpt(fetchedDatas.excerpt, fetchedDatas.tracklist))
	fillAcfTextByName(mainWrapper, '_artist', fetchedDatas.artist)
	fillAcfTextByName(mainWrapper, '_number', fetchedDatas.idNumber)
	fillAcfTextByName(mainWrapper, '_year', fetchedDatas.year)

	return filledMessages(await fillCoverIfNewPost(hasExistingTitle, fetchedDatas.cover))
}
