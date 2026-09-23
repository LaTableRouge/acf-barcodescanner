<?php

namespace ACFBarcodeScanner\Fields;

use DOMDocument;
use DOMElement;
use DOMXPath;
use WP_Error;
use const ACFBarcodeScanner\NONCE_ACTION;
use const ACFBarcodeScanner\USER_AGENT;

// exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * ACF Field Type: Barcode Scanner
 *
 * This class extends the ACF field base class to provide a barcode scanner field type
 * that allows users to scan barcodes and fetch related data.
 *
 * @since 5.0.0
 */
class BarcodeScannerField extends \acf_field {
    /**
     * Hosts allowed for the AJAX proxy (SSRF guard)
     *
     * @var list<string>
     */
    private const ALLOWED_REMOTE_HOSTS = [
        'api.themoviedb.org',
        'catalogue.bnf.fr',
        'coverartarchive.org',
        'covers.openlibrary.org',
        'image.tmdb.org',
        'musicbrainz.org',
        'openlibrary.org',
    ];

    /**
     * Hosts serving cover images directly (no HTML page to scrape)
     *
     * @var list<string>
     */
    private const DIRECT_COVER_HOSTS = [
        'coverartarchive.org',
        'covers.openlibrary.org',
        'image.tmdb.org',
    ];

    private const BNF_COVER_URL = 'https://catalogue.bnf.fr/couverture';

    /**
     * Plugin URL for assets
     *
     * @var string
     */
    private string $url;

    /**
     * Plugin file path
     *
     * @var string
     */
    private string $path;

    /**
     * Language files path
     *
     * @var string
     */
    private string $lang_path;

    /**
     * Constructor - Sets up the field type data
     *
     * @since 5.0.0
     * @param array{version?: string, url: string, path: string, lang_path?: string, base_name?: string} $settings Plugin settings containing URL, path, and optional configuration.
     */
    public function __construct(array $settings) {
        // Set ACF field properties (MUST be set before parent::__construct())
        $this->name = 'barcodescanner';
        $this->label = __('Barcode scanner', 'acf-barcodescanner');
        $this->category = 'custom';
        $this->l10n = [];

        // Set plugin paths
        $this->url = $settings['url'];
        $this->path = $settings['path'];
        $this->lang_path = $settings['lang_path'] ?? $settings['path'] . 'lang';

        // Initialize parent class (required by ACF)
        // MUST be called AFTER setting name, label, and category
        parent::__construct();

        // Register AJAX handlers
        add_action('wp_ajax_acfbcs_fetch_from_barcode', [$this, 'fetch_from_barcode']);
        add_action('wp_ajax_acfbcs_fetch_cover_from_url', [$this, 'fetch_cover_from_url']);
    }

    /**
     * AJAX handler: Fetch data from barcode URL
     *
     * Proxies an allowlisted remote URL (BnF, Open Library, MusicBrainz, TMDB) and echoes its body.
     *
     * @since 1.0.0
     * @return never Exits script execution after sending response.
     */
    public function fetch_from_barcode(): void {
        $remote = $this->request_remote($this->get_requested_url());
        if (is_wp_error($remote)) {
            wp_send_json_error(['message' => $remote->get_error_message()]);
        }

        header('Content-Type: ' . ($remote['content_type'] !== '' ? $remote['content_type'] : 'text/plain; charset=utf-8'));
        echo $remote['body'];
        wp_die();
    }

    /**
     * AJAX handler: Fetch cover image from URL
     *
     * Uploads a cover image to the media library. BnF catalogue pages are scraped for their cover image first.
     *
     * @since 1.0.0
     * @return never Exits script execution after sending response.
     */
    public function fetch_cover_from_url(): void {
        $url = $this->get_requested_url();
        $cover = $this->is_direct_cover_url($url) ? $url : $this->extract_bnf_cover_from_html($url);
        if ($cover === '') {
            wp_send_json_error(['message' => __('Cover image not found', 'acf-barcodescanner')]);
        }

        $wp_media_id = media_sideload_image($cover . '#.jpg', 0, null, 'id');
        if (is_wp_error($wp_media_id)) {
            wp_send_json_error([
                'message' => sprintf(__('Error uploading image: %s', 'acf-barcodescanner'), $wp_media_id->get_error_message())
            ]);
        }

        wp_send_json_success([
            'cover_url' => $cover,
            'id' => $wp_media_id,
            'message' => __('Cover fetched and uploaded successfully', 'acf-barcodescanner')
        ]);
    }

    /**
     * Render field
     *
     * Creates the HTML interface for the barcode scanner field.
     * Displays a button that opens a popup for scanning barcodes.
     *
     * @since 3.6
     * @param array<string, mixed> $field The field being rendered.
     * @return void
     */
    public function render_field(array $field): void { ?>
        <div class="acfbcs__field-wrapper">
            <button 
                class="field-wrapper__button button button-primary js-open-popup"
                title="<?php esc_attr_e('Scan', 'acf-barcodescanner'); ?>"
                type="button"
            >
                <span><?php esc_html_e('Scan', 'acf-barcodescanner'); ?></span>
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
                    <path d="M0 64h64v320h-64zM96 64h32v320h-32zM160 64h32v320h-32zM256 64h32v320h-32zM384 64h32v320h-32zM480 64h32v320h-32zM320 64h16v320h-16zM224 64h16v320h-16zM432 64h16v320h-16zM0 416h32v32h-32zM96 416h32v32h-32zM160 416h32v32h-32zM320 416h32v32h-32zM480 416h32v32h-32zM384 416h64v32h-64zM224 416h64v32h-64z"></path>
                </svg>
            </button>
            <button
                class="field-wrapper__button button js-count-volumes"
                title="<?php esc_attr_e('Check released volumes (BnF)', 'acf-barcodescanner'); ?>"
                type="button"
                hidden
            >
                <span><?php esc_html_e('Check released volumes (BnF)', 'acf-barcodescanner'); ?></span>
            </button>
        </div>
    <?php }

    /**
     * Enqueue scripts and styles for admin
     *
     * Loads the necessary JavaScript and CSS files for the field in the WordPress admin.
     * Handles RTL (right-to-left) language support and script translations.
     *
     * @since 1.0.0
     * @return void
     */
    public function input_admin_enqueue_scripts(): void {
        $asset_file = $this->path . 'build/index.asset.php';

        if (!file_exists($asset_file)) {
            return;
        }

        $asset = include $asset_file;
        if (!is_array($asset)) {
            return;
        }

        $scripts_handle = 'acfbcs_scripts';
        $styles_handle = 'acfbcs_styles';
        $dependencies = $asset['dependencies'] ?? [];
        $version = $asset['version'] ?? '1.0.0';

        // Register and enqueue JavaScript
        wp_register_script(
            $scripts_handle,
            $this->url . 'build/index.js',
            $dependencies,
            $version,
            ['in_footer' => true]
        );

        // Localize script with AJAX URL
        wp_localize_script(
            $scripts_handle,
            'acfbcs_params',
            [
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce(NONCE_ACTION),
                // define('ACFBCS_TMDB_API_KEY', '…') in wp-config.php, or filter acfbcs_tmdb_api_key
                'tmdb_api_key' => (string) apply_filters(
                    'acfbcs_tmdb_api_key',
                    defined('ACFBCS_TMDB_API_KEY') ? (string) constant('ACFBCS_TMDB_API_KEY') : ''
                ),
                // Catalogued publisher → imprint, e.g. ['IDP home video music' => 'Meian']
                'publisher_aliases' => (object) apply_filters('acfbcs_publisher_aliases', []),
            ]
        );
        wp_enqueue_script($scripts_handle);

        // Enqueue styles (RTL support)
        $style_file = is_rtl() ? 'build/index-rtl.css' : 'build/index.css';
        wp_enqueue_style(
            $styles_handle,
            $this->url . $style_file,
            [],
            $version,
            'screen'
        );

        // Set script translations
        wp_set_script_translations(
            $scripts_handle,
            'acf-barcodescanner',
            $this->lang_path
        );
    }

    /**
     * Validate the AJAX request and return its allowlisted `url` parameter
     *
     * Sends a JSON error and exits on a missing nonce, missing capability or disallowed URL.
     *
     * @return string
     */
    private function get_requested_url(): string {
        check_ajax_referer(NONCE_ACTION, 'nonce');

        if (!current_user_can('edit_posts')) {
            wp_send_json_error(['message' => __('You are not allowed to edit this post.', 'acf-barcodescanner')], 403);
        }

        if (!isset($_GET['url']) || !is_string($_GET['url'])) {
            wp_send_json_error(['message' => __('Invalid URL parameter', 'acf-barcodescanner')]);
        }

        $url = sanitize_url(wp_unslash($_GET['url']));
        if ($url === '' || !$this->is_allowed_remote_url($url)) {
            wp_send_json_error(['message' => __('Invalid or empty URL', 'acf-barcodescanner')]);
        }

        return $url;
    }

    /**
     * Whether a URL host is one of the given hosts or a subdomain of them
     *
     * @param string $url
     * @param list<string> $hosts
     */
    private function url_matches_hosts(string $url, array $hosts): bool {
        $host = wp_parse_url($url, PHP_URL_HOST);
        if (!is_string($host) || $host === '') {
            return false;
        }

        $host = strtolower($host);
        foreach ($hosts as $allowed) {
            if ($host === $allowed || str_ends_with($host, '.' . $allowed)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Whether a URL host is allowed for outbound plugin requests
     *
     * @param string $url
     */
    private function is_allowed_remote_url(string $url): bool {
        return $this->url_matches_hosts($url, self::ALLOWED_REMOTE_HOSTS);
    }

    /**
     * Direct image URLs that must not be parsed as HTML
     *
     * @param string $url
     */
    private function is_direct_cover_url(string $url): bool {
        if (str_contains($url, self::BNF_COVER_URL) || $this->url_matches_hosts($url, self::DIRECT_COVER_HOSTS)) {
            return true;
        }

        return (bool) preg_match('/\.(jpe?g|png|webp|gif)(\?|$)/i', (string) wp_parse_url($url, PHP_URL_PATH));
    }

    /**
     * Scrape a BnF catalogue HTML page for the cover image URL
     *
     * @param string $url
     */
    private function extract_bnf_cover_from_html(string $url): string {
        $remote = $this->request_remote($url);
        if (is_wp_error($remote) || $remote['body'] === '') {
            return '';
        }

        $doc = new DOMDocument();
        libxml_use_internal_errors(true);
        $loaded = $doc->loadHTML($remote['body']);
        libxml_clear_errors();

        if (!$loaded) {
            return '';
        }

        $imgs = (new DOMXPath($doc))->query('//img');
        if ($imgs === false) {
            return '';
        }

        foreach ($imgs as $img) {
            if (!$img instanceof DOMElement) {
                continue;
            }

            $src = $img->getAttribute('src');
            if (str_contains($src, self::BNF_COVER_URL)) {
                return $src;
            }
        }

        return '';
    }

    /**
     * HTTP GET with the plugin User-Agent (required by MusicBrainz)
     *
     * @param string $url
     * @return array{body: string, content_type: string}|WP_Error
     */
    private function request_remote(string $url): array|WP_Error {
        $response = wp_safe_remote_get($url, [
            'headers' => ['Accept' => '*/*'],
            'redirection' => 5,
            'timeout' => 30,
            'user-agent' => USER_AGENT,
        ]);

        if (is_wp_error($response)) {
            return new WP_Error('acfbcs_request_error', sprintf(__('Request error: %s', 'acf-barcodescanner'), $response->get_error_message()));
        }

        $status = (int) wp_remote_retrieve_response_code($response);
        if ($status >= 400) {
            return new WP_Error('acfbcs_http_error', sprintf(__('HTTP Error: %s', 'acf-barcodescanner'), (string) $status));
        }

        return [
            'body' => wp_remote_retrieve_body($response),
            'content_type' => (string) wp_remote_retrieve_header($response, 'content-type'),
        ];
    }
}
