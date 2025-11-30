# Advanced Custom Fields: Barcode Scanner

A WordPress plugin that adds a barcode scanner field type to Advanced Custom Fields (ACF),
allowing users to scan barcodes and automatically fetch related data,
particularly useful for book cataloging with BNF (Bibliothèque nationale de France) integration.

## Description

This plugin extends ACF by adding a custom field type that enables barcode scanning functionality. When a barcode is scanned, the plugin can:

- Fetch XML data from external APIs based on the scanned barcode
- Automatically retrieve book cover images from BNF catalogue
- Upload cover images directly to WordPress media library
- Fill ACF fields with book information

Perfect for libraries, bookstores, or any WordPress site that needs to catalog items by barcode.

> **Note:** This plugin is primarily developed for my personal use and personal use case. However, you are welcome to fork it and adapt it to your own needs!

## Features

- 📱 **Barcode Scanner Field**: Custom ACF field type with scanner interface
- 📚 **BNF Integration**: Automatic book cover image fetching from Bibliothèque nationale de France
- 🖼️ **Media Library Integration**: Automatically uploads cover images to WordPress
- 🌐 **AJAX-powered**: Fast, asynchronous data fetching
- 🌍 **i18n Ready**: Translation-ready with text domain support

## Requirements

- WordPress 5.0 or higher
- Advanced Custom Fields (ACF) Pro 5.0+ or ACF Free 5.0+
- PHP 7.4 or higher (PHP 8.0+ recommended)
- cURL extension enabled (for API requests)
- DOM extension enabled (for HTML parsing)

## Installation

### Manual Installation

1. Download or clone this repository into your WordPress plugins directory:

   ```bash
   cd wp-content/plugins
   git clone https://github.com/LaTableRouge/acf-barcodescanner.git acf-barcodescanner
   ```

2. Navigate to the plugin directory:

   ```bash
   cd acf-barcodescanner
   ```

3. Install dependencies:

   ```bash
   composer install
   npm install
   ```

4. Build assets:

   ```bash
   npm run build
   ```

5. Activate the plugin through the WordPress admin panel under **Plugins**

### Development Setup

For development, you can use the watch mode to automatically rebuild assets:

```bash
npm run watch
```

## Usage

### Adding the Field to ACF

1. Go to **Custom Fields** in your WordPress admin
2. Create a new field group or edit an existing one
3. Add a new field and select **Barcode scanner** as the field type
4. Configure the field settings as needed
5. Save the field group

### Using the Scanner

1. When editing a post/page with the barcode scanner field:
   - Click the **Scanner** button
   - A popup will open allowing you to scan a barcode
   - The plugin will automatically fetch data based on the scanned barcode

### AJAX Endpoints

The plugin provides two AJAX endpoints:

- `acfbcs_fetch_from_barcode`: Fetches XML data from a barcode URL
- `acfbcs_fetch_cover_from_url`: Fetches and uploads book cover images

## Development

### Project Structure

```text
acf-barcodescanner/
├── fields/
│   └── class-my-acf-field-barcodescanner.php  # Main field class
├── src/
│   ├── scripts/                               # JavaScript source files
│   └── styles/                                # SCSS source files
├── build/                                     # Compiled assets (generated)
├── lang/                                      # Translation files
├── linters/                                   # Linting configurations
├── acf-barcodescanner.php                     # Main plugin file
├── composer.json                              # PHP dependencies
└── package.json                               # Node.js dependencies
```

### Available Scripts

#### Build Scripts

- `npm run build` - Build production assets
- `npm run watch` - Watch mode for development

#### Linting & Formatting

- `npm run lint:js` - Lint JavaScript files
- `npm run lint:scss` - Lint SCSS files
- `npm run lint:php` - Lint PHP files
- `npm run lint:md` - Lint Markdown files
- `npm run prettier:js` - Format JavaScript files
- `npm run prettier:scss` - Format SCSS files
- `npm run prettier:php` - Format PHP files
- `npm run beautify:all` - Run all formatting and linting

### Code Quality

The project uses:

- **PHPStan** (level 5) for PHP static analysis
- **ESLint** for JavaScript linting
- **Stylelint** for SCSS linting
- **Prettier** for code formatting

### PHP Standards

- PHP 8.0+ with type hints
- PSR-12 coding standards
- Namespaced code (`ACFBarcodeScanner` namespace)
- Comprehensive PHPDoc comments

## Customization

### Translation (i18n)

**Generate .pot file (from the plugin's directory):**

```bash
wp i18n make-pot . lang/acf-barcodescanner.pot --domain=acf-barcodescanner --exclude=node_modules,vendor,lang,build --include=*.php
```

**Generate JSON translation files for JavaScript (from the plugin's directory):**

```bash
wp i18n make-json lang/ --no-purge
```

## Troubleshooting

### Field Not Rendering

- Ensure ACF is installed and activated
- Check that the field type "Barcode scanner" appears in the field type dropdown
- Verify PHP version is 7.4 or higher

### AJAX Errors

- Check browser console for JavaScript errors
- Verify cURL is enabled in PHP
- Check WordPress AJAX URL is correct
- Ensure proper permissions for media uploads

### Cover Images Not Loading

- Verify the BNF catalogue URL is accessible
- Check that the image URL pattern matches: `https://catalogue.bnf.fr/couverture`
- Ensure WordPress media library has write permissions
-

## Support

For issues, feature requests, or contributions, please open an issue on the [GitHub repository](https://github.com/LaTableRouge/acf-barcodescanner).

## Credits

- Built with [Advanced Custom Fields](https://www.advancedcustomfields.com/)
- Uses [barcode-detection-api-demo](https://github.com/tony-xlh/barcode-detection-api-demo/blob/main/scanner.js)
- Uses [SweetAlert2](https://sweetalert2.github.io/) for UI components
- Integrates with [Bibliothèque nationale de France](https://www.bnf.fr/) catalogue
