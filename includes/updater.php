<?php
/**
 * Self-updates from the public GitHub repository: reads update.json on the main branch and,
 * when it lists a newer version, offers (and auto-installs) the tagged release archive.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'REGO_PANEL_REPO', 'ferit1/rego-panel' );
if ( ! defined( 'REGO_PANEL_MANIFEST' ) ) {
	define( 'REGO_PANEL_MANIFEST', 'https://raw.githubusercontent.com/' . REGO_PANEL_REPO . '/main/update.json' );
}

function rego_upd_basename() {
	return plugin_basename( REGO_PANEL_FILE );
}

/** Latest release info from the manifest, cached for 6 hours. */
function rego_upd_remote( $force = false ) {
	$cached = get_site_transient( 'rego_panel_update' );
	if ( ! $force && is_array( $cached ) ) {
		return $cached;
	}
	$res = wp_remote_get( REGO_PANEL_MANIFEST . '?t=' . time(), array( 'timeout' => 10, 'headers' => array( 'Accept' => 'application/json' ) ) );
	if ( is_wp_error( $res ) || 200 !== wp_remote_retrieve_response_code( $res ) ) {
		set_site_transient( 'rego_panel_update', array( 'error' => is_wp_error( $res ) ? $res->get_error_message() : 'HTTP ' . wp_remote_retrieve_response_code( $res ) ), HOUR_IN_SECONDS );
		return get_site_transient( 'rego_panel_update' );
	}
	$j = json_decode( wp_remote_retrieve_body( $res ), true );
	if ( ! is_array( $j ) || empty( $j['version'] ) || empty( $j['package'] ) ) {
		return array( 'error' => 'Güncelleme bilgisi okunamadı.' );
	}
	$info = array(
		'version' => sanitize_text_field( $j['version'] ),
		'package' => esc_url_raw( $j['package'] ),
		'notes'   => sanitize_textarea_field( $j['notes'] ?? '' ),
		'date'    => sanitize_text_field( $j['date'] ?? '' ),
	);
	set_site_transient( 'rego_panel_update', $info, 6 * HOUR_IN_SECONDS );
	return $info;
}

function rego_upd_has_new( $info ) {
	return is_array( $info ) && ! empty( $info['version'] ) && version_compare( $info['version'], REGO_PANEL_VERSION, '>' );
}

/* Tell WordPress about the new version. */
add_filter( 'pre_set_site_transient_update_plugins', function ( $transient ) {
	if ( ! is_object( $transient ) ) {
		return $transient;
	}
	$info = rego_upd_remote();
	$base = rego_upd_basename();
	$item = (object) array(
		'id'          => 'github.com/' . REGO_PANEL_REPO,
		'slug'        => 'rego-panel',
		'plugin'      => $base,
		'new_version' => rego_upd_has_new( $info ) ? $info['version'] : REGO_PANEL_VERSION,
		'url'         => 'https://github.com/' . REGO_PANEL_REPO,
		'package'     => rego_upd_has_new( $info ) ? $info['package'] : '',
		'icons'       => array( 'default' => REGO_PANEL_URL . 'assets/icon.png' ),
	);
	if ( rego_upd_has_new( $info ) ) {
		$transient->response[ $base ] = $item;
	} else {
		unset( $transient->response[ $base ] );
		$transient->no_update[ $base ] = $item;
	}
	return $transient;
} );

/* "View details" popup in Plugins. */
add_filter( 'plugins_api', function ( $res, $action, $args ) {
	if ( 'plugin_information' !== $action || empty( $args->slug ) || 'rego-panel' !== $args->slug ) {
		return $res;
	}
	$info = rego_upd_remote();
	return (object) array(
		'name'          => 'Rego Panel',
		'slug'          => 'rego-panel',
		'version'       => $info['version'] ?? REGO_PANEL_VERSION,
		'author'        => 'Rego Technology',
		'homepage'      => 'https://github.com/' . REGO_PANEL_REPO,
		'last_updated'  => $info['date'] ?? '',
		'sections'      => array( 'changelog' => nl2br( esc_html( $info['notes'] ?? '' ) ) ),
		'download_link' => $info['package'] ?? '',
	);
}, 10, 3 );

/* GitHub archives unpack to "rego-panel-1.2.0/"; rename to the plugin's folder. */
add_filter( 'upgrader_source_selection', function ( $source, $remote_source, $upgrader, $hook_extra = array() ) {
	global $wp_filesystem;
	if ( empty( $hook_extra['plugin'] ) || rego_upd_basename() !== $hook_extra['plugin'] ) {
		return $source;
	}
	$target = trailingslashit( $remote_source ) . 'rego-panel/';
	if ( untrailingslashit( $source ) === untrailingslashit( $target ) ) {
		return $source;
	}
	if ( $wp_filesystem && $wp_filesystem->move( $source, $target, true ) ) {
		return $target;
	}
	return $source;
}, 10, 4 );

/* Install new versions automatically in the background. */
add_filter( 'auto_update_plugin', function ( $update, $item ) {
	if ( isset( $item->plugin ) && rego_upd_basename() === $item->plugin ) {
		return true;
	}
	return $update;
}, 20, 2 );

/* Panel: check for and install an update right now. */
add_action( 'rest_api_init', function () {
	register_rest_route( 'rego/v1', '/guncelleme', array(
		array(
			'methods'             => 'GET',
			'callback'            => function () {
				$info = rego_upd_remote( true );
				return array(
					'current' => REGO_PANEL_VERSION,
					'latest'  => $info['version'] ?? null,
					'notes'   => $info['notes'] ?? '',
					'new'     => rego_upd_has_new( $info ),
					'error'   => $info['error'] ?? null,
				);
			},
			'permission_callback' => function () { return current_user_can( 'rego_ayarlar' ); },
		),
		array(
			'methods'             => 'POST',
			'callback'            => 'rego_upd_install_now',
			'permission_callback' => function () { return current_user_can( 'rego_ayarlar' ); },
		),
	) );
} );

function rego_upd_install_now() {
	$info = rego_upd_remote( true );
	if ( ! rego_upd_has_new( $info ) ) {
		return array( 'updated' => false, 'message' => 'Panel güncel (' . REGO_PANEL_VERSION . ').' );
	}
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/misc.php';
	require_once ABSPATH . 'wp-admin/includes/plugin.php';
	require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
	if ( ! WP_Filesystem() ) {
		return new WP_Error( 'rego_fs', 'Sunucu dosyalara doğrudan yazmaya izin vermiyor. Güncellemeyi WordPress yönetiminde Eklentiler sayfasından yapın.', array( 'status' => 500 ) );
	}
	delete_site_transient( 'update_plugins' );
	wp_update_plugins();
	$base    = rego_upd_basename();
	$skin    = new Automatic_Upgrader_Skin();
	$up      = new Plugin_Upgrader( $skin );
	$result  = $up->upgrade( $base );
	// The upgrader deactivates the plugin outside cron; put it back without loading the new code twice.
	$active = (array) get_option( 'active_plugins', array() );
	if ( ! in_array( $base, $active, true ) ) {
		$active[] = $base;
		update_option( 'active_plugins', $active );
	}
	if ( is_wp_error( $result ) || ! $result ) {
		$msg = is_wp_error( $result ) ? $result->get_error_message() : implode( ' ', array_map( 'wp_strip_all_tags', (array) $skin->get_upgrade_messages() ) );
		return new WP_Error( 'rego_upd', 'Güncelleme kurulamadı: ' . $msg, array( 'status' => 500 ) );
	}
	return array( 'updated' => true, 'version' => $info['version'], 'message' => 'Panel ' . $info['version'] . ' sürümüne güncellendi.' );
}
