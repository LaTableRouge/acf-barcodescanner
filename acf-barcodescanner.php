<?php

/*
Plugin Name: Advanced Custom Fields: Barcode scanner
Plugin URI: https://github.com/LaTableRouge/acf-barcodescanner
Description: Add Barcode scanner
Version: 2.2.0
Author: Author: LaTableRouge
Author URI: https://mlnop.fr
License: GPLv2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html
*/

namespace ACFBarcodeScanner;

// exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

const VERSION = '2.2.0';
const NONCE_ACTION = 'acfbcs';
const USER_AGENT = 'acf-barcodescanner/' . VERSION . ' (https://github.com/LaTableRouge/acf-barcodescanner)';

/**
 * Main plugin class for ACF Barcode Scanner
 *
 * @since 1.0.0
 */
class Plugin {
    /**
     * Plugin settings array
     *
     * @var array<string, string>
     */
    public array $settings;

    /**
     * Constructor - Sets up the class functionality
     *
     * @since 1.0.0
     */
    public function __construct() {
        // settings
        // - these will be passed into the field class.
        $this->settings = [
            'version' => VERSION,
            'url' => plugin_dir_url(__FILE__),
            'path' => plugin_dir_path(__FILE__),
            'lang_path' => plugin_dir_path(__FILE__) . '/lang',
            'base_name' => basename(dirname(__FILE__)),
        ];

        add_action('plugins_loaded', [$this, 'load_includes']);
        add_action('acf/include_field_types', [$this, 'include_field']); // v5
        add_action('acf/register_fields', [$this, 'include_field']); // v4
    }

    /**
     * Load PHP modules that must run outside the admin (WP-Cron, AJAX).
     */
    public function load_includes(): void {
        include_once __DIR__ . '/includes/bnf-series.php';
        include_once __DIR__ . '/includes/bnf-series-cron.php';
    }

    /**
     * Include the field type class
     *
     * @since 1.0.0
     * @param int|false $version Major ACF version. Defaults to false.
     * @return void
     */
    public function include_field(int|false $version = false): void {
        // load acf-barcodescanner
        load_plugin_textdomain('acf-barcodescanner', false, plugin_basename(dirname(__FILE__)) . '/lang');

        include_once __DIR__ . '/fields/class-my-acf-field-barcodescanner.php';

        // Initialize the field
        if (class_exists(__NAMESPACE__ . '\Fields\BarcodeScannerField')) {
            new Fields\BarcodeScannerField($this->settings);
        }
    }
}

// initialize
new Plugin();

register_activation_hook(__FILE__, static function (): void {
    if (!function_exists('wp_schedule_event')) {
        return;
    }

    require_once __DIR__ . '/includes/bnf-series.php';
    require_once __DIR__ . '/includes/bnf-series-cron.php';
    BnfSeries\schedule_volume_cron_events();
});

register_deactivation_hook(__FILE__, static function (): void {
    require_once __DIR__ . '/includes/bnf-series-cron.php';
    BnfSeries\clear_volume_cron_events();
});

