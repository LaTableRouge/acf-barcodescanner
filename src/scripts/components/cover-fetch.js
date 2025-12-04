import { variables } from '../common/variables'

export const coverfetch = async (pageurl) => {
	const phpQueryParams = {
		action: 'acfbcs_fetch_cover_from_url',
		url: pageurl
	}

	return await fetch(`${variables.ajaxURL}?${new URLSearchParams(phpQueryParams)}`)
		.then(async (response) => {
			return await response.json()
		})
		.catch(console.error)
}
