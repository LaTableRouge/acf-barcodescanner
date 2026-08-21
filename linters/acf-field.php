<?php

/**
 * Dummy ACF base class so PHPStan can analyse this plugin without ACF installed.
 * Loaded via scanFiles only — not shipped or autoloaded at runtime.
 */
class acf_field {
    /** @var string */
    public $name;

    /** @var string */
    public $label;

    /** @var string */
    public $category;

    /** @var array<string, string> */
    public $l10n;

    public function __construct() {
    }
}
