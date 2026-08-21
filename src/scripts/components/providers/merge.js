/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isEmptyValue(value) {
	if (value == null || value === '') {
		return true
	}

	if (Array.isArray(value)) {
		return value.length === 0
	}

	if (typeof value === 'object') {
		return Object.values(value).every(isEmptyValue)
	}

	return false
}

/**
 * Fill empty fields on the primary record from a fallback
 * @param {Object|null} primary
 * @param {Object|null} fallback
 * @returns {Object|null}
 */
export function mergeRecords(primary, fallback) {
	if (!primary) {
		return fallback
	}
	if (!fallback) {
		return primary
	}

	const merged = { ...primary }

	for (const [key, fallbackValue] of Object.entries(fallback)) {
		if (isEmptyValue(merged[key]) && !isEmptyValue(fallbackValue)) {
			merged[key] = fallbackValue
			continue
		}

		if (fallbackValue && typeof fallbackValue === 'object' && !Array.isArray(fallbackValue) && merged[key] && typeof merged[key] === 'object' && !Array.isArray(merged[key])) {
			merged[key] = mergeRecords(merged[key], fallbackValue)
		}
	}

	return merged
}
