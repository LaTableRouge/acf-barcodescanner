const variables = {}
const $ = jQuery.noConflict()
variables.ajaxURL = acfbcs_params.ajax_url // Wordpress AJAX url
variables.tmdbApiKey = acfbcs_params.tmdb_api_key || ''

export { $, variables }
