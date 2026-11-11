<?php

/**
 * Weekly WP-Cron sync of {post_type}_volumes-total for ongoing book series (BnF).
 *
 * @package ACFBarcodeScanner
 */

declare(strict_types=1);

namespace ACFBarcodeScanner\BnfSeries;

use WP_Error;
use WP_Post;
use WP_Query;

if (!defined('ABSPATH')) {
    exit;
}

const CRON_HOOK_WEEKLY = 'acfbcs_weekly_series_volumes';
const CRON_HOOK_BATCH = 'acfbcs_batch_series_volumes';
const QUEUE_OPTION = 'acfbcs_series_volume_cron_queue';

const SYNC_META_PREFIX = 'acfbcs_last_volume_sync';

/**
 * @return bool
 */
function volume_cron_enabled(): bool {
    return (bool) apply_filters('acfbcs_volume_cron_enabled', true);
}

/**
 * @return list<string>
 */
function volume_cron_post_types(): array {
    $types = apply_filters('acfbcs_volume_cron_post_types', SERIES_POST_TYPES);

    return array_values(array_filter(array_map('sanitize_key', (array) $types)));
}

/**
 * @return positive-int
 */
function volume_cron_batch_size(): int {
    return max(1, (int) apply_filters('acfbcs_volume_cron_batch_size', 5));
}

/**
 * Seconds between batch runs when the queue is not empty.
 *
 * @return positive-int
 */
function volume_cron_batch_delay_seconds(): int {
    return max(60, (int) apply_filters('acfbcs_volume_cron_batch_delay_seconds', 120));
}

function volume_cron_ongoing_status(): string {
    $status = apply_filters('acfbcs_volume_cron_ongoing_status', SERIES_ONGOING_STATUS);

    return is_string($status) && $status !== '' ? $status : SERIES_ONGOING_STATUS;
}

/**
 * @return list<string>
 */
function volume_cron_post_statuses(): array {
    $statuses = apply_filters('acfbcs_volume_cron_post_statuses', ['publish']);

    return array_values(array_filter(array_map('sanitize_key', (array) $statuses)));
}

function series_field_name(string $post_type, string $suffix): string {
    $name = $post_type . '_' . $suffix;

    return (string) apply_filters('acfbcs_volume_cron_field_name', $name, $post_type, $suffix);
}

function read_series_acf_value(int $post_id, string $field_name): mixed {
    if (function_exists('get_field')) {
        return get_field($field_name, $post_id);
    }

    return get_post_meta($post_id, $field_name, true);
}

function read_series_field_string(int $post_id, string $field_name): string {
    $value = read_series_acf_value($post_id, $field_name);

    if (is_string($value)) {
        return trim($value);
    }
    if (is_int($value) || is_float($value)) {
        return trim((string) $value);
    }
    if (is_bool($value)) {
        return $value ? '1' : '0';
    }

    return '';
}

function read_volumes_total(int $post_id, string $field_name): int {
    $value = read_series_acf_value($post_id, $field_name);

    return is_numeric($value) ? (int) $value : 0;
}

function write_volumes_total_field(int $post_id, string $field_name, int $value): void {
    if (!function_exists('update_field')) {
        update_post_meta($post_id, $field_name, $value);

        return;
    }

    if (function_exists('acf_get_field')) {
        $field = acf_get_field($field_name);
        if (is_array($field) && isset($field['key']) && is_string($field['key'])) {
            update_field($field['key'], $value, $post_id);

            return;
        }
    }

    update_field($field_name, $value, $post_id);
}

function store_volume_sync_report(int $post_id, int $current, int $bnf_max, bool $updated, string $error = ''): void {
    update_post_meta($post_id, SYNC_META_PREFIX, (string) time());
    update_post_meta($post_id, SYNC_META_PREFIX . '_bnf_max', (string) $bnf_max);
    update_post_meta($post_id, SYNC_META_PREFIX . '_previous', (string) $current);
    update_post_meta($post_id, SYNC_META_PREFIX . '_updated', $updated ? '1' : '0');

    if ($error !== '') {
        update_post_meta($post_id, SYNC_META_PREFIX . '_error', $error);
    } else {
        delete_post_meta($post_id, SYNC_META_PREFIX . '_error');
    }
}

/**
 * @return list<int>
 */
function collect_ongoing_series_post_ids(): array {
    $post_types = volume_cron_post_types();
    if ($post_types === []) {
        return [];
    }

    $status_value = volume_cron_ongoing_status();
    $query = new WP_Query([
        'fields' => 'ids',
        'no_found_rows' => true,
        'orderby' => 'ID',
        'order' => 'ASC',
        'post_status' => volume_cron_post_statuses(),
        'post_type' => $post_types,
        'posts_per_page' => -1,
    ]);

    $ids = [];
    foreach ($query->posts as $post_id) {
        $post_id = (int) $post_id;
        $post_type = get_post_type($post_id);
        if (!is_string($post_type) || !in_array($post_type, $post_types, true)) {
            continue;
        }

        if (read_series_field_string($post_id, series_field_name($post_type, 'status')) !== $status_value) {
            continue;
        }

        $ids[] = $post_id;
    }

    return $ids;
}

/**
 * Raise `{post_type}_volumes-total` when BnF reports a higher max (never lower).
 *
 * @return true|WP_Error
 */
function sync_post_volumes_from_bnf(int $post_id): true|WP_Error {
    $post = get_post($post_id);
    if (!$post instanceof WP_Post) {
        return new WP_Error('acfbcs_invalid_post', __('Invalid post.', 'acf-barcodescanner'));
    }

    $post_type = $post->post_type;
    if (!in_array($post_type, volume_cron_post_types(), true)) {
        return true;
    }

    $title = trim($post->post_title);
    if ($title === '') {
        return true;
    }

    $total_field = series_field_name($post_type, 'volumes-total');
    $publisher = resolve_publisher_aliases(read_series_field_string($post_id, series_field_name($post_type, 'editor')));
    $current = read_volumes_total($post_id, $total_field);

    $volumes = search_volumes($title, $publisher);
    if (is_wp_error($volumes)) {
        store_volume_sync_report($post_id, $current, 0, false, $volumes->get_error_message());

        return $volumes;
    }

    $max = (int) $volumes['max'];
    $updated = $max > $current;
    if ($updated) {
        write_volumes_total_field($post_id, $total_field, $max);
    }

    store_volume_sync_report($post_id, $current, $max, $updated);

    return true;
}

function save_volume_sync_queue(array $queue): void {
    update_option(
        QUEUE_OPTION,
        array_values(array_filter(array_map('intval', $queue), static fn (int $id): bool => $id > 0)),
        false
    );
}

/**
 * @return list<int>
 */
function get_volume_sync_queue(): array {
    $queue = get_option(QUEUE_OPTION, []);

    return is_array($queue)
        ? array_values(array_filter(array_map('intval', $queue), static fn (int $id): bool => $id > 0))
        : [];
}

function cron_weekly_series_volumes(): void {
    if (!volume_cron_enabled()) {
        return;
    }

    $ids = collect_ongoing_series_post_ids();
    if ($ids === []) {
        delete_option(QUEUE_OPTION);

        return;
    }

    save_volume_sync_queue($ids);
    wp_clear_scheduled_hook(CRON_HOOK_BATCH);
    wp_schedule_single_event(time() + 10, CRON_HOOK_BATCH);
}

function cron_batch_series_volumes(): void {
    if (!volume_cron_enabled()) {
        delete_option(QUEUE_OPTION);
        wp_clear_scheduled_hook(CRON_HOOK_BATCH);

        return;
    }

    $queue = get_volume_sync_queue();
    if ($queue === []) {
        return;
    }

    if (function_exists('set_time_limit')) {
        set_time_limit(120);
    }

    $batch = array_splice($queue, 0, volume_cron_batch_size());
    save_volume_sync_queue($queue);

    foreach ($batch as $post_id) {
        sync_post_volumes_from_bnf($post_id);
    }

    if ($queue !== []) {
        wp_schedule_single_event(time() + volume_cron_batch_delay_seconds(), CRON_HOOK_BATCH);
    }
}

function schedule_volume_cron_events(): void {
    if (!volume_cron_enabled()) {
        return;
    }

    if (wp_next_scheduled(CRON_HOOK_WEEKLY) === false) {
        wp_schedule_event(time() + HOUR_IN_SECONDS, 'weekly', CRON_HOOK_WEEKLY);
    }
}

function clear_volume_cron_events(): void {
    wp_clear_scheduled_hook(CRON_HOOK_WEEKLY);
    wp_clear_scheduled_hook(CRON_HOOK_BATCH);
    delete_option(QUEUE_OPTION);
}

add_action(CRON_HOOK_WEEKLY, __NAMESPACE__ . '\cron_weekly_series_volumes');
add_action(CRON_HOOK_BATCH, __NAMESPACE__ . '\cron_batch_series_volumes');
add_action('init', __NAMESPACE__ . '\schedule_volume_cron_events');
