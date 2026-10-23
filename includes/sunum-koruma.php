<?php
/**
 * Stricter access for the password-protected presentation page (/sunum):
 * - the password is asked again after 30 minutes or when the tab is closed,
 * - the browser is not offered to save the password.
 * Works with any template: it only relies on WordPress' own page password.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'REGO_SUNUM_SURE', (int) apply_filters( 'rego_sunum_sure', 30 * MINUTE_IN_SECONDS ) );

function rego_sunum_koruma_id() {
	static $id = null;
	if ( null === $id ) {
		$p  = get_page_by_path( 'sunum' );
		$id = ( $p && '' !== $p->post_password ) ? (int) $p->ID : 0;
	}
	return $id;
}

function rego_sunum_imza( $t ) {
	return hash_hmac( 'sha256', 'rego-sunum|' . $t, wp_salt( 'auth' ) );
}

function rego_sunum_cerez_sil() {
	$opts = array( 'expires' => time() - YEAR_IN_SECONDS, 'path' => COOKIEPATH, 'domain' => COOKIE_DOMAIN, 'secure' => is_ssl(), 'samesite' => 'Lax' );
	setcookie( 'wp-postpass_' . COOKIEHASH, '', $opts );
	setcookie( 'rego_sunum_at', '', $opts + array( 'httponly' => true ) );
	unset( $_COOKIE[ 'wp-postpass_' . COOKIEHASH ], $_COOKIE['rego_sunum_at'] );
}

/* Page password cookies last 30 minutes instead of 10 days; a signed login time goes with them. */
add_filter( 'post_password_expires', function ( $expires ) {
	if ( ! rego_sunum_koruma_id() ) {
		return $expires;
	}
	$t = time();
	setcookie( 'rego_sunum_at', $t . '|' . rego_sunum_imza( $t ), array(
		'expires' => $t + REGO_SUNUM_SURE, 'path' => COOKIEPATH, 'domain' => COOKIE_DOMAIN,
		'secure' => is_ssl(), 'httponly' => true, 'samesite' => 'Lax',
	) );
	return $t + REGO_SUNUM_SURE;
}, 99 );

/* Server side: a missing, forged or older-than-30-minutes login time means the password is asked again. */
add_action( 'template_redirect', function () {
	$id = rego_sunum_koruma_id();
	if ( ! $id || ! is_page( $id ) ) {
		return;
	}
	if ( isset( $_GET['rego_sunum_cikis'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
		rego_sunum_cerez_sil();
		nocache_headers();
		wp_safe_redirect( get_permalink( $id ) );
		exit;
	}
	if ( empty( $_COOKIE[ 'wp-postpass_' . COOKIEHASH ] ) ) {
		return;
	}
	$ok = false;
	if ( ! empty( $_COOKIE['rego_sunum_at'] ) ) {
		$parts = explode( '|', sanitize_text_field( wp_unslash( $_COOKIE['rego_sunum_at'] ) ) );
		if ( 2 === count( $parts ) && hash_equals( rego_sunum_imza( $parts[0] ), $parts[1] ) && time() - (int) $parts[0] < REGO_SUNUM_SURE ) {
			$ok = true;
		}
	}
	if ( ! $ok ) {
		rego_sunum_cerez_sil();
	}
	nocache_headers();
}, 0 );

/* Browser side: per-tab session (closing the tab ends it), 30-minute timer, no "save password" offer. */
add_action( 'template_redirect', function () {
	$id = rego_sunum_koruma_id();
	if ( ! $id || ! is_page( $id ) ) {
		return;
	}
	$locked = post_password_required( $id );
	$cikis  = add_query_arg( 'rego_sunum_cikis', '1', get_permalink( $id ) );
	ob_start( function ( $html ) use ( $locked, $cikis ) {
		$js = '<script>(function(){'
			. 'var K="rego_sunum_oturum",S=' . (int) REGO_SUNUM_SURE . ',OUT=' . wp_json_encode( $cikis ) . ',locked=' . ( $locked ? 'true' : 'false' ) . ';'
			. 'var ss;try{ss=window.sessionStorage;}catch(e){ss=null;}'
			. 'function get(){try{return ss&&ss.getItem(K);}catch(e){return null;}}'
			. 'if(locked){try{ss&&ss.removeItem(K);}catch(e){}'
			// Hide the password from the browser's password manager: submit it through a hidden field.
			. 'document.addEventListener("DOMContentLoaded",function(){'
			. 'var f=document.querySelector("form[action*=\'postpass\']");if(!f)return;'
			. 'f.setAttribute("autocomplete","off");'
			. 'var p=f.querySelector("input[name=\'post_password\']");if(!p)return;'
			. 'p.setAttribute("autocomplete","new-password");p.setAttribute("autocorrect","off");p.setAttribute("autocapitalize","off");p.setAttribute("spellcheck","false");'
			. 'p.removeAttribute("name");if(window.CSS&&CSS.supports&&CSS.supports("-webkit-text-security","disc")){p.type="text";p.classList.add("rego-gizli");}'
			. 'var h=document.createElement("input");h.type="hidden";h.name="post_password";f.appendChild(h);'
			. 'f.addEventListener("submit",function(){h.value=p.value;p.value="";p.disabled=true;try{ss&&ss.setItem(K,String(Date.now()));}catch(e){}});'
			. '});'
			. '}else{'
			. 'var t=+get();'
			. 'if(!t){document.documentElement.style.visibility="hidden";location.replace(OUT);return;}'
			. 'var kalan=S*1000-(Date.now()-t);'
			. 'if(kalan<=0){document.documentElement.style.visibility="hidden";location.replace(OUT);return;}'
			. 'setTimeout(function(){location.replace(OUT);},kalan);'
			. '}'
			. '})();</script>'
			. '<style>.rego-gizli{-webkit-text-security:disc;text-security:disc;font-family:text-security-disc,inherit}</style>';
		$pos = stripos( $html, '</head>' );
		return false !== $pos ? substr_replace( $html, $js, $pos, 0 ) : $js . $html;
	} );
}, 1 );
