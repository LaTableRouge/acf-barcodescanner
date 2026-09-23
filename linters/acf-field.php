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

/**
 * Render one setting row in the field-group editor.
 *
 * @param array<string, mixed> $field   Field being edited. The setting value is copied from `$field[ $setting['name'] ]`.
 * @param array<string, mixed> $setting Setting field (label, name, type, …).
 * @param bool                 $global  Whether the setting applies to every field type.
 */
function acf_render_field_setting(array $field, array $setting, bool $global = false): void {
}
