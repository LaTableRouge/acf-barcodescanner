import { appendRepeaterRow, fillCoverIfNewPost, filledMessages, setValueIfEmpty } from './fill-utils'

/**
 * Parse the field setting into source/target pairs.
 * Empty lines and lines starting with `#` are skipped.
 * @param {string} raw
 * @returns {{ source: string, target: string }[]}
 */
export function parseFillMap(raw) {
	if (!raw?.trim()) {
		return []
	}

	/** @type {{ source: string, target: string }[]} */
	const mappings = []
	for (const line of raw.split('\n')) {
		const trimmed = line.trim()
		if (!trimmed || trimmed.startsWith('#')) {
			continue
		}

		const separator = trimmed.indexOf('=')
		if (separator === -1) {
			continue
		}

		const source = trimmed.slice(0, separator).trim()
		const target = trimmed.slice(separator + 1).trim()
		if (source && target) {
			mappings.push({ source, target })
		}
	}

	return mappings
}

/**
 * Read a fetched value. Dots walk nested objects (`dimensions.width`).
 * A list of strings or numbers becomes one line per item. Objects are skipped.
 * @param {Record<string, unknown>} data
 * @param {string} path
 * @returns {string|number|undefined}
 */
function valueAtPath(data, path) {
	let current = data
	for (const key of path.split('.')) {
		if (current == null || typeof current !== 'object') {
			return undefined
		}

		current = /** @type {Record<string, unknown>} */ (current)[key]
	}

	if (Array.isArray(current)) {
		return current.filter((item) => (typeof item === 'string' || typeof item === 'number') && item !== '').join('\n')
	}

	if (typeof current === 'string' || typeof current === 'number') {
		return current
	}

	return undefined
}

/**
 * @param {string} name
 * @returns {string}
 */
function fieldSelector(name) {
	return `.acf-field[data-name="${CSS.escape(name)}"]`
}

/**
 * First visible text, number, textarea or select control in an ACF field.
 * @param {Element|null|undefined} field
 * @returns {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement|null}
 */
function fieldControl(field) {
	return field?.querySelector('.acf-input input:not([type="hidden"]), .acf-input textarea, .acf-input select') ?? null
}

/**
 * Top-level ACF field with this data-name, ignoring repeater rows and the clone template.
 * @param {Element} mainWrapper
 * @param {string} name
 * @returns {Element|null}
 */
function findField(mainWrapper, name) {
	const fields = mainWrapper.querySelectorAll(fieldSelector(name))

	return [...fields].find((field) => !field.closest('.acf-row')) ?? null
}

/**
 * One new repeater row per data-name, shared by every subfield of that repeater.
 * @param {Element} mainWrapper
 * @param {string} name
 * @param {Map<string, Element|null>} cache
 * @returns {Promise<Element|null>}
 */
async function repeaterRow(mainWrapper, name, cache) {
	if (cache.has(name)) {
		return cache.get(name) ?? null
	}

	const repeater = findField(mainWrapper, name)
	const row = repeater ? await appendRepeaterRow(repeater) : null
	cache.set(name, row)

	return row
}

/**
 * @param {Element} mainWrapper
 * @param {string} target
 * @param {string|number} value
 * @param {{ hasExistingTitle: boolean, postTitle: Element|null, repeaterRows: Map<string, Element|null> }} context
 * @returns {Promise<string[]>}
 */
async function fillTarget(mainWrapper, target, value, context) {
	if (target === 'post_title') {
		setValueIfEmpty(context.postTitle, value, { dispatchInput: true })
		return []
	}

	if (target === 'post_excerpt') {
		setValueIfEmpty(mainWrapper.querySelector('#excerpt'), value)
		return []
	}

	if (target === 'media') {
		return fillCoverIfNewPost(context.hasExistingTitle, String(value))
	}

	const dot = target.indexOf('.')
	if (dot !== -1) {
		const row = await repeaterRow(mainWrapper, target.slice(0, dot), context.repeaterRows)
		const subfield = row?.querySelector(fieldSelector(target.slice(dot + 1)))
		setValueIfEmpty(fieldControl(subfield), value)
		return []
	}

	const field = findField(mainWrapper, target)
	if (!field?.querySelector('.acf-repeater')) {
		setValueIfEmpty(fieldControl(field), value)
	}

	return []
}

/**
 * Fill the form from the scanner field's mapping.
 * Writes only into empty controls. `post_title`, `post_excerpt` and `media` are special targets.
 * @param {Element} mainWrapper - `form#post`
 * @param {Record<string, unknown>} fetchedDatas
 * @param {{ source: string, target: string }[]} mappings
 * @returns {Promise<string[]>}
 */
export async function applyFillMap(mainWrapper, fetchedDatas, mappings) {
	const postTitle = mainWrapper.querySelector('#title')
	const context = {
		hasExistingTitle: Boolean(postTitle instanceof HTMLInputElement && postTitle.value.length),
		postTitle,
		repeaterRows: new Map()
	}
	/** @type {string[]} */
	const extra = []

	for (const { source, target } of mappings) {
		const value = valueAtPath(fetchedDatas, source)
		if (value == null || value === '') {
			continue
		}

		extra.push(...(await fillTarget(mainWrapper, target, value, context)))
	}

	return filledMessages(extra)
}
