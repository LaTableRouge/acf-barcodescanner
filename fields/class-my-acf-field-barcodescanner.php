<?php

namespace ACFBarcodeScanner\Fields;

use DOMDocument;
use DOMXPath;

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

    private const USER_AGENT = 'acf-barcodescanner/1.3.0 (https://github.com/LaTableRouge/acf-barcodescanner)';

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
     * Fetches XML data from a remote URL based on the scanned barcode.
     * This is used to retrieve book information from external APIs.
     *
     * @since 1.0.0
     * @return never Exits script execution after sending response.
     */
    public function fetch_from_barcode(): void {
        if (!isset($_GET['url']) || !is_string($_GET['url'])) {
            wp_send_json_error(['message' => __('Invalid URL parameter', 'acf-barcodescanner')]);
        }

        $url = sanitize_url($_GET['url']);
        if (empty($url) || !$this->is_allowed_remote_url($url)) {
            wp_send_json_error(['message' => __('Invalid or empty URL', 'acf-barcodescanner')]);
        }

        $remote = $this->request_remote($url);
        if ($remote === null) {
            wp_send_json_error(['message' => __('Failed to initialize cURL', 'acf-barcodescanner')]);
        }

        if ($remote['error'] !== '') {
            wp_send_json_error(['message' => sprintf(__('CURL Error: %s', 'acf-barcodescanner'), $remote['error'])]);
        }

        if ($remote['status'] >= 400) {
            wp_send_json_error(['message' => sprintf(__('HTTP Error: %s', 'acf-barcodescanner'), (string) $remote['status'])]);
        }

        $content_type = $remote['content_type'] !== '' ? $remote['content_type'] : 'text/plain; charset=utf-8';
        header('Content-Type: ' . $content_type);
        echo $remote['body'];
        wp_die();
    }

    /**
     * AJAX handler: Fetch cover image from URL
     *
     * Scrapes a webpage to find a book cover image URL and uploads it to WordPress media library.
     * Specifically looks for images from the BNF (Bibliothèque nationale de France) catalogue.
     *
     * @since 1.0.0
     * @return never Exits script execution after sending response.
     */
    public function fetch_cover_from_url(): void {
        if (!isset($_GET['url']) || !is_string($_GET['url'])) {
            wp_send_json_error(['message' => __('Invalid URL parameter', 'acf-barcodescanner')]);
        }

        $url = sanitize_url($_GET['url']);
        if (empty($url) || !$this->is_allowed_remote_url($url)) {
            wp_send_json_error(['message' => __('Invalid or empty URL', 'acf-barcodescanner')]);
        }

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
     * Render field settings
     *
     * Create extra settings for your field. These are visible when editing a field.
     * Currently, no additional settings are configured, but this method can be extended
     * to add custom field options.
     *
     * @since 3.6
     * @param array<string, mixed> $field The field being edited.
     * @return void
     */
    public function render_field_settings(array $field): void {
        // Add field settings here using acf_render_field_setting()
        // Example:
        // acf_render_field_setting($field, [
        //     'label' => __('Setting Label', 'acf-barcodescanner'),
        //     'instructions' => __('Setting Instructions', 'acf-barcodescanner'),
        //     'type' => 'text',
        //     'name' => 'setting_name',
        // ]);
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
                title="<?php _e('Scan', 'acf-barcodescanner'); ?>"
                type="button"
            >
                <span><?php _e('Scan', 'acf-barcodescanner'); ?></span>
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
                    <path d="M0 64h64v320h-64zM96 64h32v320h-32zM160 64h32v320h-32zM256 64h32v320h-32zM384 64h32v320h-32zM480 64h32v320h-32zM320 64h16v320h-16zM224 64h16v320h-16zM432 64h16v320h-16zM0 416h32v32h-32zM96 416h32v32h-32zM160 416h32v32h-32zM320 416h32v32h-32zM480 416h32v32h-32zM384 416h64v32h-64zM224 416h64v32h-64z"></path>
                </svg>
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
                // define('ACFBCS_TMDB_API_KEY', '…') in wp-config.php, or filter acfbcs_tmdb_api_key
                'tmdb_api_key' => (string) apply_filters(
                    'acfbcs_tmdb_api_key',
                    defined('ACFBCS_TMDB_API_KEY') ? (string) constant('ACFBCS_TMDB_API_KEY') : ''
                ),
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
     * Whether a URL host is allowed for outbound plugin requests
     *
     * @param string $url
     */
    private function is_allowed_remote_url(string $url): bool {
        $host = wp_parse_url($url, PHP_URL_HOST);
        if (!is_string($host) || $host === '') {
            return false;
        }

        $host = strtolower($host);
        foreach (self::ALLOWED_REMOTE_HOSTS as $allowed) {
            if ($host === $allowed || str_ends_with($host, '.' . $allowed)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Direct image URLs that must not be parsed as HTML
     *
     * @param string $url
     */
    private function is_direct_cover_url(string $url): bool {
        $host = strtolower((string) wp_parse_url($url, PHP_URL_HOST));
        $path = (string) wp_parse_url($url, PHP_URL_PATH);

        if (str_contains($url, 'catalogue.bnf.fr/couverture')) {
            return true;
        }
        if (str_contains($host, 'covers.openlibrary.org')) {
            return true;
        }
        if (str_contains($host, 'coverartarchive.org')) {
            return true;
        }
        if (str_contains($host, 'image.tmdb.org')) {
            return true;
        }

        return (bool) preg_match('/\.(jpe?g|png|webp|gif)(\?|$)/i', $path);
    }

    /**
     * Scrape a BnF catalogue HTML page for the cover image URL
     *
     * @param string $url
     */
    private function extract_bnf_cover_from_html(string $url): string {
        $doc = new DOMDocument();
        libxml_use_internal_errors(true);
        $loaded = @$doc->loadHTMLFile($url);
        libxml_clear_errors();

        if (!$loaded) {
            return '';
        }

        $xpath = new DOMXPath($doc);
        $imgs = $xpath->query('//img');
        if ($imgs === false) {
            return '';
        }

        foreach ($imgs as $img) {
            if (!($img instanceof \DOMElement)) {
                continue;
            }

            $src = $img->getAttribute('src');
            if ($src !== '' && str_contains($src, 'https://catalogue.bnf.fr/couverture')) {
                return $src;
            }
        }

        return '';
    }

    /**
     * HTTP GET with a required User-Agent (MusicBrainz)
     *
     * @param string $url
     * @return array{body: string, content_type: string, error: string, status: int}|null
     */
    private function request_remote(string $url): ?array {
        $ch = curl_init($url);
        if ($ch === false) {
            return null;
        }

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Accept: */*',
            ],
            CURLOPT_TIMEOUT => 30,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_USERAGENT => self::USER_AGENT,
        ]);

        $response = curl_exec($ch);
        $error = curl_error($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $content_type = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        curl_close($ch);

        return [
            'body' => is_string($response) ? $response : '',
            'content_type' => is_string($content_type) ? $content_type : '',
            'error' => ($response === false || $error !== '') ? $error : '',
            'status' => $http_code,
        ];
    }
}
