import { variables } from '../common/variables'

export const coverfetch = async (pageurl) => {
	const phpQueryParams = {
		action: 'acfbcs_fetch_cover_from_url',
		url: pageurl
	}

	return await fetch(`${variables.ajaxURL}?${new URLSearchParams(phpQueryParams)}`)
		.then(async (response) => {
			response = await response.json()

			if (!response) {
				console.error('Error in the response')

				return
			}

			if (!Object.keys(response).length) {
				console.warn("No 'cover' found.")

				return
			}

			return response.cover_url
		})
		.catch(console.error)
}
