import { variables } from '../common/variables'

export const coverfetch = async (pageurl) => {
	const phpQueryParams = {
		action: 'acfbcs_fetch_cover_from_url',
		nonce: variables.nonce,
		url: pageurl
	}

	try {
		const response = await fetch(`${variables.ajaxURL}?${new URLSearchParams(phpQueryParams)}`)
		return await response.json()
	} catch (error) {
		console.error(error)
		return null
	}
}
