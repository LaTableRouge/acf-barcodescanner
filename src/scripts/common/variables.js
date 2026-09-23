const variables = {}
const $ = jQuery.noConflict()
variables.ajaxURL = acfbcs_params.ajax_url // Wordpress AJAX url
variables.nonce = acfbcs_params.nonce || ''
variables.tmdbApiKey = acfbcs_params.tmdb_api_key || ''
variables.publisherAliases = acfbcs_params.publisher_aliases || {}

export { $, variables }
