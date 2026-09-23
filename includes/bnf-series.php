<?php

/**
 * Count published volumes of a series via the BnF SRU catalogue API (free, no key).
 *
 * @see https://api.bnf.fr/fr/api-sru-catalogue-general
 *
 * @package ACFBarcodeScanner
 */

declare(strict_types=1);

namespace ACFBarcodeScanner\BnfSeries;

use DOMDocument;
use DOMElement;
use DOMXPath;
use WP_Error;
use const ACFBarcodeScanner\NONCE_ACTION;
use const ACFBarcodeScanner\USER_AGENT;

if (!defined('ABSPATH')) {
    exit;
}

const SRU_ENDPOINT = 'https://catalogue.bnf.fr/api/SRU';
const AJAX_ACTION = 'acfbcs_count_series_volumes';
const PAGE_SIZE = 1000;
const MAX_PAGES = 3;

/**
 * Series title / volume number pairs, by priority: linked series (461), series statement (225), title proper (200).
 */
const SERIES_FIELDS = [
    ['tag' => '461', 'title' => 't', 'number' => 'v'],
    ['tag' => '225', 'title' => 'a', 'number' => 'v'],
    ['tag' => '200', 'title' => 'a', 'number' => 'h'],
];

/**
 * Normalize a title for loose comparison ("One Piece" === "one piece", "Shônen" === "shonen").
 *
 * @example normalize_title('L’Attaque des Titans !') // 'l attaque des titans'
 */
function normalize_title(string $title): string {
    $title = remove_accents(html_entity_decode($title, ENT_QUOTES, 'UTF-8'));
    $title = mb_strtolower($title, 'UTF-8');
    $title = (string) preg_replace('/[^\p{L}\p{N}]+/u', ' ', $title);

    return trim($title);
}

/**
 * Extract a volume number from values like "56", "T. 56", "Tome 3". Returns null for "HS", "3.5", etc.
 */
function parse_volume_number(string $value): ?int {
    if (preg_match('/^(?:t(?:ome)?\.?\s*)?(\d{1,4})$/i', trim($value), $matches) !== 1) {
        return null;
    }

    $number = (int) $matches[1];

    return $number > 0 ? $number : null;
}

function build_query(string $title, string $publisher): string {
    $escape = static fn (string $value): string => str_replace(['\\', '"'], ['\\\\', '\\"'], $value);

    $query = sprintf('bib.title all "%s"', $escape($title));
    if ($publisher !== '') {
        $query .= sprintf(' and bib.publisher all "%s"', $escape($publisher));
    }

    return $query;
}

/**
 * @return string|WP_Error Raw SRU XML response
 */
function fetch_page(string $query, int $start_record): string|WP_Error {
    $url = add_query_arg(
        array_map('rawurlencode', [
            'version' => '1.2',
            'operation' => 'searchRetrieve',
            'query' => $query,
            'recordSchema' => 'unimarcxchange',
            'maximumRecords' => (string) PAGE_SIZE,
            'startRecord' => (string) $start_record,
        ]),
        SRU_ENDPOINT
    );

    $response = wp_remote_get($url, ['timeout' => 30, 'user-agent' => USER_AGENT]);
    if (is_wp_error($response)) {
        return $response;
    }

    $code = (int) wp_remote_retrieve_response_code($response);
    if ($code !== 200) {
        return new WP_Error('bnf_http_error', sprintf(__('HTTP Error: %s', 'acf-barcodescanner'), (string) $code));
    }

    return wp_remote_retrieve_body($response);
}

function get_subfield(DOMXPath $xpath, DOMElement $datafield, string $code): string {
    $nodes = $xpath->query(sprintf('mxc:subfield[@code="%s"]', $code), $datafield);
    $node = $nodes !== false ? $nodes->item(0) : null;

    return $node ? trim($node->textContent) : '';
}

function find_volume_number(DOMXPath $xpath, DOMElement $record, string $series): ?int {
    foreach (SERIES_FIELDS as $field) {
        $datafields = $xpath->query(sprintf('mxc:datafield[@tag="%s"]', $field['tag']), $record);
        if ($datafields === false) {
            continue;
        }

        foreach ($datafields as $datafield) {
            if (!$datafield instanceof DOMElement) {
                continue;
            }

            if (normalize_title(get_subfield($xpath, $datafield, $field['title'])) !== $series) {
                continue;
            }

            $number = parse_volume_number(get_subfield($xpath, $datafield, $field['number']));
            if ($number !== null) {
                return $number;
            }
        }
    }

    return null;
}

/**
 * @return array{next_record: int, records: int, numbers: list<int>}|WP_Error `next_record` is 0 on the last page.
 */
function parse_page(string $xml, string $series): array|WP_Error {
    $document = new DOMDocument();
    if ($xml === '' || !@$document->loadXML($xml)) {
        return new WP_Error('bnf_invalid_xml', __('The BnF catalogue returned an invalid response.', 'acf-barcodescanner'));
    }

    $xpath = new DOMXPath($document);
    $xpath->registerNamespace('srw', 'http://www.loc.gov/zing/srw/');
    $xpath->registerNamespace('mxc', 'info:lc/xmlns/marcxchange-v2');

    $numbers = [];
    $records = $xpath->query('//mxc:record');
    if ($records === false) {
        return new WP_Error('bnf_invalid_xml', __('The BnF catalogue returned an invalid response.', 'acf-barcodescanner'));
    }

    foreach ($records as $record) {
        if (!$record instanceof DOMElement) {
            continue;
        }

        $number = find_volume_number($xpath, $record, $series);
        if ($number !== null) {
            $numbers[] = $number;
        }
    }

    return [
        // BnF answers HTTP 500 when startRecord goes past the last record, so only follow its own pointer
        'next_record' => (int) $xpath->evaluate('number(//srw:nextRecordPosition)'),
        'records' => (int) $xpath->evaluate('count(//srw:record)'),
        'numbers' => $numbers,
    ];
}

/**
 * Split a multi-publisher field value ("Dargaud, le Lombard") into distinct publishers.
 *
 * @example parse_publishers('Dargaud, le Lombard , dargaud') // ['Dargaud', 'le Lombard']
 *
 * @return list<string> Empty string alone when no publisher, so the search runs on the title only.
 */
function parse_publishers(string $value): array {
    $publishers = [];
    foreach (explode(',', $value) as $publisher) {
        $publisher = trim($publisher);
        $key = normalize_title($publisher);
        if ($key !== '' && !isset($publishers[$key])) {
            $publishers[$key] = $publisher;
        }
    }

    return $publishers ? array_values($publishers) : [''];
}

/**
 * @param array<int> $numbers
 * @return list<int>
 */
function unique_sorted_numbers(array $numbers): array {
    $numbers = array_values(array_unique($numbers));
    sort($numbers);

    return $numbers;
}

/**
 * @return array{publisher: string, query: string, total: int, max: int, numbers: list<int>, records: int}|WP_Error
 */
function search_publisher_volumes(string $title, string $publisher): array|WP_Error {
    $series = normalize_title($title);
    $query = build_query($title, $publisher);
    $numbers = [];
    $records = 0;
    $start_record = 1;

    for ($page = 0; $page < MAX_PAGES && $start_record > 0; $page++) {
        $xml = fetch_page($query, $start_record);
        if (is_wp_error($xml)) {
            return $xml;
        }

        $result = parse_page($xml, $series);
        if (is_wp_error($result)) {
            return $result;
        }

        $numbers = array_merge($numbers, $result['numbers']);
        $records += $result['records'];
        $start_record = $result['records'] > 0 ? $result['next_record'] : 0;
    }

    $numbers = unique_sorted_numbers($numbers);

    return [
        'publisher' => $publisher,
        'query' => $query,
        'total' => count($numbers),
        'max' => $numbers ? max($numbers) : 0,
        'numbers' => $numbers,
        'records' => $records,
    ];
}

/**
 * Run one search per publisher and merge the volume numbers.
 *
 * @example search_volumes('Léonard', 'Dargaud, le Lombard') // ['total' => 54, 'max' => 54, …]
 *
 * @return array{total: int, max: int, numbers: list<int>, records: int, publishers: list<array{publisher: string, query: string, total: int, max: int, numbers: list<int>, records: int}>}|WP_Error
 */
function search_volumes(string $title, string $publishers_value): array|WP_Error {
    $publishers = [];
    foreach (parse_publishers($publishers_value) as $publisher) {
        $result = search_publisher_volumes($title, $publisher);
        if (is_wp_error($result)) {
            return $result;
        }

        $publishers[] = $result;
    }

    $numbers = unique_sorted_numbers(array_merge([], ...array_column($publishers, 'numbers')));

    return [
        'total' => count($numbers),
        'max' => $numbers ? max($numbers) : 0,
        'numbers' => $numbers,
        'records' => (int) array_sum(array_column($publishers, 'records')),
        'publishers' => $publishers,
    ];
}

/**
 * AJAX handler: count the volumes of the series being edited.
 *
 * Reads the title and publisher from the request so unsaved edits are taken into account.
 *
 * @return never
 */
function ajax_count_series_volumes(): void {
    check_ajax_referer(NONCE_ACTION, 'nonce');

    $post_id = isset($_POST['post_id']) ? absint($_POST['post_id']) : 0;
    if ($post_id === 0 || !current_user_can('edit_post', $post_id)) {
        wp_send_json_error(['message' => __('You are not allowed to edit this post.', 'acf-barcodescanner')], 403);
    }

    $title = isset($_POST['title']) && is_string($_POST['title']) ? trim(sanitize_text_field(wp_unslash($_POST['title']))) : '';
    $publisher = isset($_POST['publisher']) && is_string($_POST['publisher']) ? sanitize_text_field(wp_unslash($_POST['publisher'])) : '';

    if ($title === '') {
        wp_send_json_error(['message' => __('The post has no title.', 'acf-barcodescanner')], 400);
    }

    $volumes = search_volumes($title, $publisher);
    if (is_wp_error($volumes)) {
        wp_send_json_error(['message' => $volumes->get_error_message()], 502);
    }

    wp_send_json_success($volumes);
}

add_action('wp_ajax_' . AJAX_ACTION, __NAMESPACE__ . '\ajax_count_series_volumes');
