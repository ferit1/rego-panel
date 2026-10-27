<?php
/**
 * Plugin Name: Rego Panel
 * Description: Rego Technology için müşteri, proje, fiyat teklifi (PDF), tahsilat ve saha randevusu yönetim paneli.
 * Version: 1.6.4
 * Update URI: https://github.com/ferit1/rego-panel
 * Author: Rego Technology
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Text Domain: rego-panel
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'REGO_PANEL_VERSION', '1.6.4' );
define( 'REGO_PANEL_DB_VERSION', '6' );
define( 'REGO_PANEL_FILE', __FILE__ );
define( 'REGO_PANEL_DIR', plugin_dir_path( __FILE__ ) );
define( 'REGO_PANEL_URL', plugin_dir_url( __FILE__ ) );

require_once REGO_PANEL_DIR . 'includes/install.php';
require_once REGO_PANEL_DIR . 'includes/helpers.php';
require_once REGO_PANEL_DIR . 'includes/rest.php';
require_once REGO_PANEL_DIR . 'includes/pdf.php';
require_once REGO_PANEL_DIR . 'includes/frontend.php';
require_once REGO_PANEL_DIR . 'includes/updater.php';
require_once REGO_PANEL_DIR . 'includes/sunum-koruma.php';
require_once REGO_PANEL_DIR . 'includes/hatirlatma.php';

register_activation_hook( __FILE__, 'rego_panel_activate' );
register_deactivation_hook( __FILE__, 'rego_panel_deactivate' );

add_action( 'plugins_loaded', 'rego_panel_maybe_upgrade' );
add_action( 'rest_api_init', 'rego_panel_register_routes' );
