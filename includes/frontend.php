<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function rego_panel_page_id() {
	return (int) get_option( 'rego_panel_page_id' );
}

function rego_panel_url() {
	$id = rego_panel_page_id();
	return $id ? get_permalink( $id ) : home_url( '/' );
}

function rego_is_panel_user( $user ) {
	return $user && $user->exists() && user_can( $user, 'rego_access' ) && ! user_can( $user, 'manage_options' );
}

/* The panel page renders as a standalone app, outside the theme. */
add_filter( 'template_include', function ( $template ) {
	$id = rego_panel_page_id();
	if ( $id && is_page( $id ) ) {
		return REGO_PANEL_DIR . 'templates/panel.php';
	}
	return $template;
}, 99 );

/* On any other page the shortcode just links to the panel. */
add_shortcode( 'rego_panel', function () {
	return '<p><a class="button" href="' . esc_url( rego_panel_url() ) . '">Rego Panel’e git</a></p>';
} );

/* Panel staff go to the panel after login and never see wp-admin or the admin bar. */
add_filter( 'login_redirect', function ( $redirect, $requested, $user ) {
	if ( ! is_wp_error( $user ) && rego_is_panel_user( $user ) ) {
		return rego_panel_url();
	}
	return $redirect;
}, 10, 3 );

add_action( 'admin_init', function () {
	if ( wp_doing_ajax() || ( defined( 'DOING_CRON' ) && DOING_CRON ) ) {
		return;
	}
	if ( isset( $GLOBALS['pagenow'] ) && 'admin-post.php' === $GLOBALS['pagenow'] ) {
		return;
	}
	if ( rego_is_panel_user( wp_get_current_user() ) ) {
		wp_safe_redirect( rego_panel_url() );
		exit;
	}
} );

add_filter( 'show_admin_bar', function ( $show ) {
	return rego_is_panel_user( wp_get_current_user() ) ? false : $show;
} );

/* Deactivated users cannot sign in. */
add_filter( 'wp_authenticate_user', function ( $user ) {
	if ( $user instanceof WP_User && get_user_meta( $user->ID, 'rego_pasif', true ) ) {
		return new WP_Error( 'rego_pasif', 'Hesabınız pasif durumda. Yöneticinizle görüşün.' );
	}
	return $user;
} );

/* Branded login form handler. */
add_action( 'admin_post_nopriv_rego_giris', 'rego_giris_handler' );
add_action( 'admin_post_rego_giris', 'rego_giris_handler' );
function rego_giris_handler() {
	$back = rego_panel_url();
	if ( ! isset( $_POST['_wpnonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['_wpnonce'] ) ), 'rego_giris' ) ) {
		wp_safe_redirect( add_query_arg( 'giris', 'sure', $back ) );
		exit;
	}
	$user = wp_signon( array(
		'user_login'    => sanitize_text_field( wp_unslash( $_POST['log'] ?? '' ) ),
		'user_password' => (string) wp_unslash( $_POST['pwd'] ?? '' ), // phpcs:ignore
		'remember'      => ! empty( $_POST['rememberme'] ),
	), is_ssl() );
	if ( is_wp_error( $user ) ) {
		$code = 'rego_pasif' === $user->get_error_code() ? 'pasif' : 'hata';
		wp_safe_redirect( add_query_arg( 'giris', $code, $back ) );
		exit;
	}
	wp_safe_redirect( $back );
	exit;
}

/* Link to the panel from wp-admin for site administrators. */
add_action( 'admin_bar_menu', function ( $bar ) {
	if ( current_user_can( 'rego_access' ) ) {
		$bar->add_node( array( 'id' => 'rego-panel', 'title' => 'Rego Panel', 'href' => rego_panel_url() ) );
	}
}, 80 );

add_filter( 'plugin_action_links_' . plugin_basename( REGO_PANEL_FILE ), function ( $links ) {
	array_unshift( $links, '<a href="' . esc_url( rego_panel_url() ) . '">Paneli aç</a>' );
	return $links;
} );
