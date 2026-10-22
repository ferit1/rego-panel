<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function rego_t( $name ) {
	global $wpdb;
	return $wpdb->prefix . 'rego_' . $name;
}

function rego_settings() {
	$s = get_option( 'rego_panel_settings' );
	return wp_parse_args( is_array( $s ) ? $s : array(), rego_panel_default_settings() );
}

function rego_now() {
	return current_time( 'mysql' );
}

function rego_today() {
	return current_time( 'Y-m-d' );
}

/** Turkish number format; decimals only when the value has them (25.000 / 1.500,50). */
function rego_num( $n ) {
	$n = (float) $n;
	$dec = ( abs( $n - round( $n ) ) > 0.0001 ) ? 2 : 0;
	return number_format( $n, $dec, ',', '.' );
}

function rego_date_tr( $ymd ) {
	if ( ! $ymd ) {
		return '';
	}
	$t = strtotime( $ymd );
	return $t ? gmdate( 'd.m.Y', $t ) : '';
}

/** Current user's capabilities relevant to the panel. */
function rego_user_caps( $user_id = 0 ) {
	$user = $user_id ? get_user_by( 'id', $user_id ) : wp_get_current_user();
	$out  = array();
	foreach ( rego_panel_role_caps()['rego_yonetici']['caps'] as $c ) {
		$out[ $c ] = $user && $user->exists() && user_can( $user, $c );
	}
	return $out;
}

function rego_user_role_key( $user ) {
	foreach ( array( 'rego_yonetici', 'rego_satis', 'rego_saha' ) as $r ) {
		if ( in_array( $r, (array) $user->roles, true ) ) {
			return $r;
		}
	}
	return in_array( 'administrator', (array) $user->roles, true ) ? 'administrator' : '';
}

function rego_user_public( $user ) {
	return array(
		'id'    => (int) $user->ID,
		'ad'    => $user->display_name,
		'email' => $user->user_email,
		'tel'   => (string) get_user_meta( $user->ID, 'rego_tel', true ),
		'rol'   => rego_user_role_key( $user ),
		'login' => $user->user_login,
	);
}

/**
 * Small text markup used in quote terms (written by staff in a textarea):
 *   "- item"        bullet            "  - item" / "-- item"  sub-bullet
 *   "| a | b |"     table row (first row is the header)
 *   **bold**        [text](https://link)
 *   blank line      paragraph break
 */
function rego_markup( $text ) {
	$text  = str_replace( array( "\r\n", "\r" ), "\n", (string) $text );
	$lines = explode( "\n", $text );
	$html  = '';
	$list  = 0; // open list depth
	$base  = 1; // marker depth of the outermost open list
	$table = array();
	$para  = array();

	$inline = function ( $s ) {
		$s = esc_html( $s );
		$s = preg_replace( '/\*\*(.+?)\*\*/u', '<b>$1</b>', $s );
		$s = preg_replace_callback(
			'/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/u',
			function ( $m ) {
				return '<a href="' . esc_url( html_entity_decode( $m[2] ) ) . '">' . $m[1] . '</a>';
			},
			$s
		);
		return $s;
	};
	$close_list = function () use ( &$html, &$list ) {
		while ( $list > 0 ) {
			$html .= '</li></ul>';
			$list--;
		}
	};
	$flush_para = function () use ( &$html, &$para ) {
		if ( $para ) {
			$html .= '<p>' . implode( '<br>', $para ) . '</p>';
			$para  = array();
		}
	};
	$flush_table = function () use ( &$html, &$table, $inline ) {
		if ( ! $table ) {
			return;
		}
		$html .= '<table class="mt">';
		foreach ( $table as $i => $row ) {
			$html .= '<tr>';
			foreach ( $row as $cell ) {
				$tag   = 0 === $i ? 'th' : 'td';
				$html .= "<$tag>" . $inline( trim( $cell ) ) . "</$tag>";
			}
			$html .= '</tr>';
		}
		$html .= '</table>';
		$table = array();
	};

	foreach ( $lines as $raw ) {
		$line = rtrim( $raw );
		if ( '' === trim( $line ) ) {
			$flush_para();
			$close_list();
			$flush_table();
			continue;
		}
		if ( preg_match( '/^\s*\|(.+)\|\s*$/u', $line, $m ) ) {
			$flush_para();
			$close_list();
			$table[] = explode( '|', $m[1] );
			continue;
		}
		$flush_table();
		if ( preg_match( '/^(\s*)(--|[-•*])\s+(.*)$/u', $line, $m ) ) {
			$flush_para();
			$depth = ( '--' === $m[2] || strlen( $m[1] ) >= 2 ) ? 2 : 1;
			if ( 0 === $list ) {
				// A list may start directly at sub-level (e.g. under a plain sentence).
				$html .= '<ul class="l' . $depth . '"><li>';
				$list  = 1;
				$base  = $depth;
			} elseif ( $depth - $base + 1 > $list ) {
				$html .= '<ul class="l2"><li>';
				$list++;
			} else {
				$want = max( 1, $depth - $base + 1 );
				while ( $list > $want ) {
					$html .= '</li></ul>';
					$list--;
				}
				$html .= '</li><li>';
			}
			$html .= $inline( $m[3] );
			continue;
		}
		$close_list();
		$para[] = $inline( trim( $line ) );
	}
	$flush_para();
	$close_list();
	$flush_table();
	return $html;
}

/** Shapes a DB row for the API. */
function rego_row( $type, $r ) {
	if ( ! $r ) {
		return null;
	}
	$r = (array) $r;
	foreach ( array( 'id', 'musteri_id', 'teklif_id', 'proje_id', 'gonderen_id', 'created_by' ) as $k ) {
		if ( isset( $r[ $k ] ) ) {
			$r[ $k ] = (int) $r[ $k ];
		}
	}
	if ( 'teklif' === $type ) {
		$r['kalemler']      = json_decode( $r['kalemler'] ?: '[]', true ) ?: array();
		$r['kosullar']      = json_decode( $r['kosullar'] ?: '[]', true ) ?: array();
		$r['ek_yeni_sayfa'] = (int) $r['ek_yeni_sayfa'];
		$r['toplam_goster'] = (int) $r['toplam_goster'];
		$r['toplamlar']     = rego_teklif_toplam( $r['kalemler'] );
	}
	if ( 'hareket' === $type ) {
		$r['tutar']      = (float) $r['tutar'];
		$r['sonraki_id'] = (int) $r['sonraki_id'];
	}
	if ( 'fatura' === $type ) {
		$r['tutar']  = (float) $r['tutar'];
		$r['odendi'] = (int) $r['odendi'];
	}
	return $r;
}

/** Totals per currency for quote lines. */
function rego_teklif_toplam( $kalemler ) {
	$t = array();
	foreach ( (array) $kalemler as $k ) {
		$para       = isset( $k['para'] ) && '' !== $k['para'] ? $k['para'] : '₺';
		$t[ $para ] = ( $t[ $para ] ?? 0 ) + (float) ( $k['miktar'] ?? 0 ) * (float) ( $k['fiyat'] ?? 0 );
	}
	return $t;
}
