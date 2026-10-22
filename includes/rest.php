<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resource definitions: table, writable fields (with sanitizer), and the capability
 * needed to read and to write. Cookie auth + X-WP-Nonce is enforced by WordPress core.
 */
function rego_resources() {
	$text  = 'sanitize_text_field';
	$area  = 'sanitize_textarea_field';
	$date  = 'rego_clean_date';
	$int   = 'absint';
	return array(
		'musteri' => array(
			'read'   => 'rego_access',
			'write'  => 'rego_musteri_edit',
			'order'  => 'firma ASC',
			'fields' => array(
				'firma' => $text, 'kisi' => $text, 'hitap' => $text, 'email' => 'sanitize_email', 'tel' => $text,
				'sehir' => $text, 'sektor' => $text, 'notlar' => $area,
			),
			'required' => array( 'firma' ),
		),
		'proje' => array(
			'read'   => 'rego_access',
			'write'  => 'rego_proje_edit',
			'order'  => 'id DESC',
			'fields' => array(
				'musteri_id' => $int, 'teklif_id' => $int, 'ad' => $text, 'hizmet' => $text,
				'asama' => 'rego_clean_asama', 'teslim' => $date, 'notlar' => $area,
			),
			'required' => array( 'ad' ),
		),
		'teklif' => array(
			'read'   => 'rego_teklif',
			'write'  => 'rego_teklif',
			'order'  => 'tarih DESC, id DESC',
			'fields' => array(
				'musteri_id' => $int, 'firma' => $text, 'kisi' => $text, 'kisi_email' => $text, 'kisi_tel' => $text,
				'hitap' => $text, 'tarih' => $date, 'gonderen_id' => $int, 'durum' => 'rego_clean_durum',
				'gonderen_ad' => $text, 'gonderen_email' => 'sanitize_email', 'gonderen_tel' => $text,
				'kalemler' => 'rego_clean_kalemler', 'kosullar' => 'rego_clean_kosullar',
				'ek_baslik' => $text, 'ek_metin' => $area, 'ek_yeni_sayfa' => 'rego_clean_bool', 'toplam_goster' => 'rego_clean_bool',
			),
			'required' => array( 'firma' ),
		),
		'fatura' => array(
			'read'   => 'rego_fatura',
			'write'  => 'rego_fatura',
			'order'  => 'tarih DESC, id DESC',
			'fields' => array(
				'no' => $text, 'musteri_id' => $int, 'teklif_id' => $int, 'tarih' => $date, 'vade' => $date,
				'tutar' => 'rego_clean_money', 'para' => 'rego_clean_para', 'odendi' => 'rego_clean_bool',
				'odeme_tarihi' => $date, 'notlar' => $area,
			),
			'required' => array( 'musteri_id' ),
		),
		'hareket' => array(
			'read'   => 'rego_kasa',
			'write'  => 'rego_kasa',
			'order'  => 'tarih DESC, id DESC',
			'fields' => array(
				'tur' => 'rego_clean_tur', 'tarih' => $date, 'tutar' => 'rego_clean_money', 'para' => 'rego_clean_para',
				'kategori' => $text, 'aciklama' => $text, 'musteri_id' => $int, 'hesap' => $text,
				'durum' => 'rego_clean_odeme', 'odeme_tarihi' => $date, 'tekrar' => 'rego_clean_tekrar', 'notlar' => $area,
			),
			'required' => array( 'tarih', 'tutar' ),
		),
		'saha' => array(
			'read'   => 'rego_access',
			'write'  => 'rego_saha_edit',
			'order'  => 'tarih ASC, saat ASC',
			'fields' => array(
				'tarih' => $date, 'saat' => 'rego_clean_time', 'musteri_id' => $int, 'proje_id' => $int,
				'konum' => $text, 'is_tanimi' => $text, 'ekip' => $text, 'durum' => $text,
			),
			'required' => array( 'tarih', 'is_tanimi' ),
		),
	);
}

/* ---------- sanitizers ---------- */
function rego_clean_date( $v ) {
	$v = sanitize_text_field( (string) $v );
	return preg_match( '/^\d{4}-\d{2}-\d{2}$/', $v ) ? $v : null;
}
function rego_clean_time( $v ) {
	$v = sanitize_text_field( (string) $v );
	return preg_match( '/^\d{2}:\d{2}$/', $v ) ? $v : '';
}
function rego_clean_bool( $v ) {
	return $v ? 1 : 0;
}
function rego_clean_money( $v ) {
	return round( (float) $v, 2 );
}
function rego_clean_para( $v ) {
	return in_array( $v, array( '₺', '$', '€', '£' ), true ) ? $v : '₺';
}
function rego_clean_tur( $v ) {
	return 'gelir' === $v ? 'gelir' : 'gider';
}
function rego_clean_odeme( $v ) {
	return 'bekliyor' === $v ? 'bekliyor' : 'odendi';
}
function rego_clean_tekrar( $v ) {
	return in_array( $v, array( 'aylik', 'yillik' ), true ) ? $v : 'yok';
}
function rego_clean_asama( $v ) {
	return in_array( $v, array( 'onay', 'tarama', 'model', 'teslim' ), true ) ? $v : 'onay';
}
function rego_clean_durum( $v ) {
	return in_array( $v, array( 'taslak', 'gonderildi', 'onaylandi', 'reddedildi', 'faturalandi' ), true ) ? $v : 'taslak';
}
function rego_clean_kalemler( $v ) {
	$out = array();
	foreach ( (array) $v as $k ) {
		if ( ! is_array( $k ) ) {
			continue;
		}
		$ad = sanitize_textarea_field( $k['ad'] ?? '' );
		if ( '' === trim( $ad ) ) {
			continue;
		}
		$out[] = array(
			'ad'     => $ad,
			'miktar' => (float) ( $k['miktar'] ?? 1 ),
			'birim'  => sanitize_text_field( $k['birim'] ?? 'Adet' ),
			'fiyat'  => round( (float) ( $k['fiyat'] ?? 0 ), 2 ),
			'para'   => rego_clean_para( $k['para'] ?? '₺' ),
			'teslim' => sanitize_text_field( $k['teslim'] ?? '' ),
		);
	}
	return wp_json_encode( $out, JSON_UNESCAPED_UNICODE );
}
function rego_clean_kosullar( $v ) {
	$out = array();
	foreach ( (array) $v as $k ) {
		if ( ! is_array( $k ) ) {
			continue;
		}
		$b = sanitize_text_field( $k['baslik'] ?? '' );
		$m = sanitize_textarea_field( $k['metin'] ?? '' );
		if ( '' === $b && '' === trim( $m ) ) {
			continue;
		}
		$out[] = array( 'baslik' => $b, 'metin' => $m );
	}
	return wp_json_encode( $out, JSON_UNESCAPED_UNICODE );
}

/* ---------- routes ---------- */
function rego_panel_register_routes() {
	$ns = 'rego/v1';
	register_rest_route( $ns, '/bootstrap', array(
		'methods' => 'GET', 'callback' => 'rego_api_bootstrap',
		'permission_callback' => function () { return current_user_can( 'rego_access' ); },
	) );
	foreach ( array_keys( rego_resources() ) as $type ) {
		register_rest_route( $ns, "/$type", array(
			'methods' => 'POST', 'callback' => function ( $req ) use ( $type ) { return rego_api_save( $type, 0, $req ); },
			'permission_callback' => function () use ( $type ) { return current_user_can( rego_resources()[ $type ]['write'] ); },
		) );
		register_rest_route( $ns, "/$type/(?P<id>\d+)", array(
			array(
				'methods' => 'PUT,PATCH', 'callback' => function ( $req ) use ( $type ) { return rego_api_save( $type, (int) $req['id'], $req ); },
				'permission_callback' => function () use ( $type ) { return current_user_can( rego_resources()[ $type ]['write'] ); },
			),
			array(
				'methods' => 'DELETE', 'callback' => function ( $req ) use ( $type ) { return rego_api_delete( $type, (int) $req['id'] ); },
				'permission_callback' => function () use ( $type ) { return current_user_can( rego_resources()[ $type ]['write'] ) && current_user_can( 'rego_sil' ); },
			),
		) );
	}
	register_rest_route( $ns, '/teklif/(?P<id>\d+)/kopyala', array(
		'methods' => 'POST', 'callback' => 'rego_api_teklif_kopyala',
		'permission_callback' => function () { return current_user_can( 'rego_teklif' ); },
	) );
	register_rest_route( $ns, '/teklif/(?P<id>\d+)/faturala', array(
		'methods' => 'POST', 'callback' => 'rego_api_teklif_faturala',
		'permission_callback' => function () { return current_user_can( 'rego_teklif' ) && current_user_can( 'rego_fatura' ); },
	) );
	register_rest_route( $ns, '/ayarlar', array(
		'methods' => 'POST', 'callback' => 'rego_api_ayarlar',
		'permission_callback' => function () { return current_user_can( 'rego_ayarlar' ); },
	) );
	register_rest_route( $ns, '/sablon', array(
		'methods' => 'POST', 'callback' => 'rego_api_sablon',
		'permission_callback' => function () { return current_user_can( 'rego_teklif' ); },
	) );
	register_rest_route( $ns, '/profil', array(
		'methods' => 'POST', 'callback' => 'rego_api_profil',
		'permission_callback' => function () { return current_user_can( 'rego_access' ); },
	) );
	register_rest_route( $ns, '/kullanici', array(
		'methods' => 'POST', 'callback' => 'rego_api_kullanici',
		'permission_callback' => function () { return current_user_can( 'rego_kullanici' ); },
	) );
	register_rest_route( $ns, '/kullanici/(?P<id>\d+)/sifre', array(
		'methods' => 'POST', 'callback' => 'rego_api_kullanici_sifre',
		'permission_callback' => function () { return current_user_can( 'rego_kullanici' ); },
	) );
	register_rest_route( $ns, '/kullanici/(?P<id>\d+)', array(
		'methods' => 'PUT,PATCH', 'callback' => 'rego_api_kullanici_rol',
		'permission_callback' => function () { return current_user_can( 'rego_kullanici' ); },
	) );
}

function rego_panel_users() {
	$users  = get_users( array( 'role__in' => array( 'administrator', 'rego_yonetici', 'rego_satis', 'rego_saha' ), 'orderby' => 'display_name' ) );
	$pasif  = get_users( array( 'meta_key' => 'rego_pasif', 'meta_value' => '1', 'role' => 'subscriber' ) );
	$out    = array_map( 'rego_user_public', $users );
	foreach ( $pasif as $u ) {
		$row        = rego_user_public( $u );
		$row['rol'] = 'pasif';
		$out[]      = $row;
	}
	return $out;
}

function rego_api_bootstrap() {
	global $wpdb;
	$res  = rego_resources();
	$data = array();
	foreach ( $res as $type => $def ) {
		if ( ! current_user_can( $def['read'] ) ) {
			continue;
		}
		$rows          = $wpdb->get_results( 'SELECT * FROM ' . rego_t( $type ) . ' ORDER BY ' . $def['order'], ARRAY_A ); // phpcs:ignore
		$data[ $type ] = array_map( function ( $r ) use ( $type ) { return rego_row( $type, $r ); }, $rows );
	}
	$s = rego_settings();
	if ( ! current_user_can( 'rego_finans' ) ) {
		// Field staff do not see invoice amounts or customer balances.
		unset( $data['fatura'] );
	}
	return array(
		'me'       => rego_user_public( wp_get_current_user() ),
		'caps'     => rego_user_caps(),
		'users'    => rego_panel_users(),
		'settings' => current_user_can( 'rego_teklif' ) || current_user_can( 'rego_ayarlar' ) ? $s : array(
			'birimler' => $s['birimler'], 'hizmetler' => $s['hizmetler'], 'firma_unvan' => $s['firma_unvan'],
		),
		'data'     => $data,
		'today'    => rego_today(),
		'pdf_url'  => admin_url( 'admin-post.php?action=rego_teklif_pdf' ),
		'pdf_nonce'=> wp_create_nonce( 'rego_teklif_pdf' ),
		'logout'   => wp_logout_url( rego_panel_url() ),
		'admin'    => current_user_can( 'manage_options' ) ? admin_url() : '',
		'version'  => REGO_PANEL_VERSION,
	);
}

function rego_api_get( $type, $id ) {
	global $wpdb;
	return rego_row( $type, $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . rego_t( $type ) . ' WHERE id = %d', $id ), ARRAY_A ) ); // phpcs:ignore
}

function rego_next_code( $type ) {
	global $wpdb;
	$year = current_time( 'Y' );
	if ( 'teklif' === $type ) {
		$prefix = rego_settings()['teklif_onek'] . '-' . $year . '-';
		$col    = 'no';
	} else {
		$prefix = 'REG-' . substr( $year, 2 ) . '-';
		$col    = 'kod';
	}
	$last = $wpdb->get_var( $wpdb->prepare( "SELECT $col FROM " . rego_t( $type ) . " WHERE $col LIKE %s ORDER BY id DESC LIMIT 1", $wpdb->esc_like( $prefix ) . '%' ) ); // phpcs:ignore
	$n    = $last ? (int) substr( $last, strlen( $prefix ) ) + 1 : 1;
	return $prefix . str_pad( (string) $n, 'teklif' === $type ? 4 : 3, '0', STR_PAD_LEFT );
}

function rego_api_save( $type, $id, WP_REST_Request $req ) {
	global $wpdb;
	$def    = rego_resources()[ $type ];
	$params = $req->get_json_params() ?: $req->get_body_params();
	$row    = array();
	foreach ( $def['fields'] as $f => $clean ) {
		if ( array_key_exists( $f, (array) $params ) ) {
			$row[ $f ] = call_user_func( $clean, $params[ $f ] );
		}
	}

	// Field staff may only move a project through its stages; other project fields stay with the office.
	if ( 'proje' === $type && $id && ! current_user_can( 'rego_finans' ) && ! current_user_can( 'rego_ayarlar' ) ) {
		$row = array_intersect_key( $row, array( 'asama' => 1, 'notlar' => 1 ) );
	}

	// A quote may name a firm that is not a customer yet: create the customer from the quote's contact.
	if ( 'teklif' === $type && empty( $row['musteri_id'] ) && ! empty( $row['firma'] ) ) {
		$found = $wpdb->get_var( $wpdb->prepare( 'SELECT id FROM ' . rego_t( 'musteri' ) . ' WHERE firma = %s LIMIT 1', $row['firma'] ) ); // phpcs:ignore
		if ( ! $found ) {
			$wpdb->insert( rego_t( 'musteri' ), array(
				'firma' => $row['firma'], 'kisi' => $row['kisi'] ?? '', 'email' => $row['kisi_email'] ?? '',
				'tel' => $row['kisi_tel'] ?? '', 'created_at' => rego_now(), 'created_by' => get_current_user_id(),
			) );
			$found = $wpdb->insert_id;
		}
		$row['musteri_id'] = (int) $found;
	}

	if ( ! $id ) {
		foreach ( $def['required'] as $r ) {
			if ( empty( $row[ $r ] ) ) {
				return new WP_Error( 'rego_eksik', 'Zorunlu alan boş: ' . $r, array( 'status' => 400 ) );
			}
		}
		$row['created_at'] = rego_now();
		if ( 'musteri' === $type || 'hareket' === $type ) {
			$row['created_by'] = get_current_user_id();
		}
		if ( 'hareket' === $type && 'odendi' === ( $row['durum'] ?? 'odendi' ) && empty( $row['odeme_tarihi'] ) ) {
			$row['odeme_tarihi'] = min( $row['tarih'], rego_today() );
		}
		if ( 'teklif' === $type ) {
			$row['no']         = rego_next_code( 'teklif' );
			$row['updated_at'] = rego_now();
			$row['tarih']      = $row['tarih'] ?? rego_today();
			$row['gonderen_id']= $row['gonderen_id'] ?? get_current_user_id();
		}
		if ( 'proje' === $type ) {
			$row['kod'] = rego_next_code( 'proje' );
		}
		if ( 'fatura' === $type ) {
			$row['tarih'] = $row['tarih'] ?? rego_today();
		}
		if ( false === $wpdb->insert( rego_t( $type ), $row ) ) {
			return new WP_Error( 'rego_db', 'Kayıt eklenemedi.', array( 'status' => 500 ) );
		}
		$id = $wpdb->insert_id;
	} else {
		if ( ! rego_api_get( $type, $id ) ) {
			return new WP_Error( 'rego_yok', 'Kayıt bulunamadı.', array( 'status' => 404 ) );
		}
		if ( 'teklif' === $type ) {
			$row['updated_at'] = rego_now();
		}
		if ( 'fatura' === $type && isset( $row['odendi'] ) && $row['odendi'] && empty( $row['odeme_tarihi'] ) ) {
			$row['odeme_tarihi'] = rego_today();
		}
		if ( $row && false === $wpdb->update( rego_t( $type ), $row, array( 'id' => $id ) ) ) {
			return new WP_Error( 'rego_db', 'Kayıt güncellenemedi.', array( 'status' => 500 ) );
		}
	}
	$out = array( 'item' => rego_api_get( $type, $id ) );
	if ( 'hareket' === $type ) {
		$next = rego_hareket_tekrarla( $out['item'] );
		if ( $next ) {
			$out['item']  = rego_api_get( 'hareket', $id );
			$out['extra'] = $next;
		}
	}
	if ( 'teklif' === $type ) {
		$out['musteri'] = rego_api_get( 'musteri', $out['item']['musteri_id'] );
	}
	return $out;
}

/** A paid recurring entry opens the next period's pending entry (once). */
function rego_hareket_tekrarla( $h ) {
	global $wpdb;
	if ( ! $h || 'odendi' !== $h['durum'] || 'yok' === $h['tekrar'] || (int) $h['sonraki_id'] ) {
		return null;
	}
	$d = new DateTime( $h['tarih'] );
	$day = (int) $d->format( 'j' );
	$d->modify( 'first day of this month' )->modify( 'aylik' === $h['tekrar'] ? '+1 month' : '+1 year' );
	$d->setDate( (int) $d->format( 'Y' ), (int) $d->format( 'n' ), min( $day, (int) $d->format( 't' ) ) );
	$wpdb->insert( rego_t( 'hareket' ), array(
		'tur' => $h['tur'], 'tarih' => $d->format( 'Y-m-d' ), 'tutar' => $h['tutar'], 'para' => $h['para'],
		'kategori' => $h['kategori'], 'aciklama' => $h['aciklama'], 'musteri_id' => (int) $h['musteri_id'], 'hesap' => $h['hesap'],
		'durum' => 'bekliyor', 'tekrar' => $h['tekrar'], 'created_at' => rego_now(), 'created_by' => get_current_user_id(),
	) );
	$nid = (int) $wpdb->insert_id;
	$wpdb->update( rego_t( 'hareket' ), array( 'sonraki_id' => $nid ), array( 'id' => (int) $h['id'] ) );
	return rego_api_get( 'hareket', $nid );
}

function rego_api_delete( $type, $id ) {
	global $wpdb;
	$wpdb->delete( rego_t( $type ), array( 'id' => $id ) );
	return array( 'deleted' => $id );
}

function rego_api_teklif_kopyala( WP_REST_Request $req ) {
	global $wpdb;
	$t = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . rego_t( 'teklif' ) . ' WHERE id = %d', (int) $req['id'] ), ARRAY_A ); // phpcs:ignore
	if ( ! $t ) {
		return new WP_Error( 'rego_yok', 'Teklif bulunamadı.', array( 'status' => 404 ) );
	}
	unset( $t['id'] );
	$t['no']          = rego_next_code( 'teklif' );
	$t['tarih']       = rego_today();
	$t['durum']       = 'taslak';
	$t['gonderen_id'] = get_current_user_id();
	$t['created_at']  = $t['updated_at'] = rego_now();
	$wpdb->insert( rego_t( 'teklif' ), $t );
	return array( 'item' => rego_api_get( 'teklif', $wpdb->insert_id ) );
}

/** Records an invoice per currency for an approved quote (KDV added); e-invoicing stays in the separate system. */
function rego_api_teklif_faturala( WP_REST_Request $req ) {
	global $wpdb;
	$t = rego_api_get( 'teklif', (int) $req['id'] );
	if ( ! $t ) {
		return new WP_Error( 'rego_yok', 'Teklif bulunamadı.', array( 'status' => 404 ) );
	}
	$p     = (array) $req->get_json_params();
	$kdv   = isset( $p['kdv'] ) ? (float) $p['kdv'] : 20;
	$vade  = rego_clean_date( $p['vade'] ?? '' ) ?: gmdate( 'Y-m-d', strtotime( rego_today() . ' +15 days' ) );
	$items = array();
	foreach ( $t['toplamlar'] as $para => $tutar ) {
		$wpdb->insert( rego_t( 'fatura' ), array(
			'no' => sanitize_text_field( $p['no'] ?? '' ), 'musteri_id' => $t['musteri_id'], 'teklif_id' => $t['id'],
			'tarih' => rego_today(), 'vade' => $vade, 'tutar' => round( $tutar * ( 1 + $kdv / 100 ), 2 ),
			'para' => $para, 'odendi' => 0, 'created_at' => rego_now(),
		) );
		$items[] = rego_api_get( 'fatura', $wpdb->insert_id );
	}
	$wpdb->update( rego_t( 'teklif' ), array( 'durum' => 'faturalandi', 'updated_at' => rego_now() ), array( 'id' => $t['id'] ) );
	return array( 'items' => $items, 'teklif' => rego_api_get( 'teklif', $t['id'] ) );
}

function rego_api_ayarlar( WP_REST_Request $req ) {
	$p = (array) $req->get_json_params();
	$s = rego_settings();
	foreach ( array( 'firma_unvan', 'vergi_no', 'telefon', 'email', 'web', 'teklif_baslik', 'teklif_onek', 'teyit_alt' ) as $k ) {
		if ( isset( $p[ $k ] ) ) {
			$s[ $k ] = sanitize_text_field( $p[ $k ] );
		}
	}
	foreach ( array( 'adres', 'giris_metni', 'kdv_notu', 'teyit_metni' ) as $k ) {
		if ( isset( $p[ $k ] ) ) {
			$s[ $k ] = sanitize_textarea_field( $p[ $k ] );
		}
	}
	foreach ( array( 'birimler', 'hizmetler', 'gider_kategorileri', 'gelir_kategorileri', 'hesaplar' ) as $k ) {
		if ( isset( $p[ $k ] ) ) {
			$s[ $k ] = array_values( array_filter( array_map( 'sanitize_text_field', (array) $p[ $k ] ) ) );
		}
	}
	if ( isset( $p['sablonlar'] ) ) {
		$s['sablonlar'] = rego_clean_sablonlar( $p['sablonlar'] );
	}
	if ( isset( $p['hazirlayanlar'] ) ) {
		$h = array();
		foreach ( (array) $p['hazirlayanlar'] as $x ) {
			$ad = sanitize_text_field( $x['ad'] ?? '' );
			if ( '' !== $ad ) {
				$h[] = array( 'ad' => $ad, 'email' => sanitize_email( $x['email'] ?? '' ), 'tel' => sanitize_text_field( $x['tel'] ?? '' ) );
			}
		}
		$s['hazirlayanlar'] = $h;
	}
	update_option( 'rego_panel_settings', $s, false );
	return array( 'settings' => $s );
}

function rego_clean_sablonlar( $list ) {
	$out = array();
	foreach ( (array) $list as $sb ) {
		if ( empty( $sb['ad'] ) ) {
			continue;
		}
		$out[] = array(
			'ad'            => sanitize_text_field( $sb['ad'] ),
			'kosullar'      => json_decode( rego_clean_kosullar( $sb['kosullar'] ?? array() ), true ),
			'ek_baslik'     => sanitize_text_field( $sb['ek_baslik'] ?? '' ),
			'ek_metin'      => sanitize_textarea_field( $sb['ek_metin'] ?? '' ),
			'ek_yeni_sayfa' => empty( $sb['ek_yeni_sayfa'] ) ? 0 : 1,
		);
	}
	return $out;
}

/** Saves the terms of a quote as a reusable template (adds or replaces by name). */
function rego_api_sablon( WP_REST_Request $req ) {
	$p   = (array) $req->get_json_params();
	$new = rego_clean_sablonlar( array( $p ) );
	if ( ! $new ) {
		return new WP_Error( 'rego_eksik', 'Şablon adı gerekli.', array( 'status' => 400 ) );
	}
	$s    = rego_settings();
	$list = array_values( array_filter( $s['sablonlar'], function ( $x ) use ( $new ) { return $x['ad'] !== $new[0]['ad']; } ) );
	$list[]         = $new[0];
	$s['sablonlar'] = $list;
	update_option( 'rego_panel_settings', $s, false );
	return array( 'sablonlar' => $list );
}

function rego_api_profil( WP_REST_Request $req ) {
	$p   = (array) $req->get_json_params();
	$uid = get_current_user_id();
	$upd = array( 'ID' => $uid );
	if ( ! empty( $p['ad'] ) ) {
		$upd['display_name'] = sanitize_text_field( $p['ad'] );
	}
	if ( ! empty( $p['email'] ) && is_email( $p['email'] ) ) {
		$owner = email_exists( $p['email'] );
		if ( $owner && (int) $owner !== $uid ) {
			return new WP_Error( 'rego_email', 'Bu e-posta başka bir kullanıcıda kayıtlı.', array( 'status' => 400 ) );
		}
		$upd['user_email'] = sanitize_email( $p['email'] );
	}
	if ( ! empty( $p['sifre'] ) ) {
		if ( strlen( $p['sifre'] ) < 8 ) {
			return new WP_Error( 'rego_sifre', 'Şifre en az 8 karakter olmalı.', array( 'status' => 400 ) );
		}
		$upd['user_pass'] = $p['sifre'];
	}
	$r = wp_update_user( $upd );
	if ( is_wp_error( $r ) ) {
		return $r;
	}
	if ( isset( $p['tel'] ) ) {
		update_user_meta( $uid, 'rego_tel', sanitize_text_field( $p['tel'] ) );
	}
	if ( ! empty( $p['sifre'] ) ) {
		wp_set_auth_cookie( $uid, true );
	}
	return array( 'me' => rego_user_public( get_user_by( 'id', $uid ) ), 'users' => rego_panel_users() );
}

/** True when the account has no site role beyond the panel roles (so panel managers may change it). */
function rego_panel_only_user( $u ) {
	$roles = array_diff( (array) $u->roles, array( 'rego_yonetici', 'rego_satis', 'rego_saha', 'subscriber' ) );
	return empty( $roles );
}

function rego_api_kullanici( WP_REST_Request $req ) {
	$p     = (array) $req->get_json_params();
	$rol   = in_array( $p['rol'] ?? '', array( 'rego_yonetici', 'rego_satis', 'rego_saha' ), true ) ? $p['rol'] : 'rego_saha';
	$mail  = sanitize_email( $p['email'] ?? '' );
	$ad    = sanitize_text_field( $p['ad'] ?? '' );
	$tel   = sanitize_text_field( $p['tel'] ?? '' );
	$sifre = (string) ( $p['sifre'] ?? '' );
	if ( ! is_email( $mail ) ) {
		return new WP_Error( 'rego_email', 'Geçerli bir e-posta adresi girin.', array( 'status' => 400 ) );
	}
	if ( '' !== $sifre && strlen( $sifre ) < 8 ) {
		return new WP_Error( 'rego_sifre', 'Şifre en az 8 karakter olmalı.', array( 'status' => 400 ) );
	}

	// The address may already belong to a site user (or to an earlier attempt that stopped half way): give it panel access.
	$existing = email_exists( $mail );
	if ( $existing ) {
		$u = get_user_by( 'id', $existing );
		if ( in_array( 'administrator', (array) $u->roles, true ) ) {
			return new WP_Error( 'rego_email', 'Bu e-posta bir site yöneticisine ait; zaten panele tam erişimi var.', array( 'status' => 400 ) );
		}
		if ( ! rego_panel_only_user( $u ) ) {
			return new WP_Error( 'rego_email', 'Bu e-posta sitede başka bir rolle kayıtlı. Rolünü WordPress yönetiminden değiştirin.', array( 'status' => 400 ) );
		}
		$u->set_role( $rol );
		delete_user_meta( $u->ID, 'rego_pasif' );
		$upd = array( 'ID' => $u->ID );
		if ( $ad ) {
			$upd['display_name'] = $ad;
		}
		if ( '' !== $sifre ) {
			$upd['user_pass'] = $sifre;
		}
		wp_update_user( $upd );
		if ( $tel ) {
			update_user_meta( $u->ID, 'rego_tel', $tel );
		}
		return array( 'users' => rego_panel_users(), 'mesaj' => 'Bu e-posta zaten kayıtlıydı; kullanıcıya panel yetkisi verildi.' . ( '' !== $sifre ? ' Belirlediğiniz şifreyle giriş yapabilir.' : '' ) );
	}

	$login = sanitize_user( strstr( $mail, '@', true ), true );
	$base  = $login ?: 'kullanici';
	$i     = 1;
	while ( username_exists( $login ) ) {
		$login = $base . ( ++$i );
	}
	try {
		$uid = wp_insert_user( array(
			'user_login'   => $login,
			'user_email'   => $mail,
			'display_name' => $ad ?: $login,
			'first_name'   => $ad,
			'user_pass'    => '' !== $sifre ? $sifre : wp_generate_password( 20 ),
			'role'         => $rol,
		) );
	} catch ( \Throwable $e ) {
		$uid = email_exists( $mail );
		if ( ! $uid ) {
			return new WP_Error( 'rego_kullanici', 'Kullanıcı oluşturulamadı: ' . $e->getMessage(), array( 'status' => 500 ) );
		}
	}
	if ( is_wp_error( $uid ) ) {
		return $uid;
	}
	update_user_meta( $uid, 'rego_tel', $tel );
	update_user_meta( $uid, 'show_admin_bar_front', 'false' );

	if ( '' !== $sifre ) {
		return array( 'users' => rego_panel_users(), 'mesaj' => 'Kullanıcı eklendi. Belirlediğiniz şifreyi kendisine iletin.' );
	}
	// Invitation e-mail. Some hosts disable PHP mail(), which makes WordPress throw instead of returning false.
	$sent = false;
	try {
		wp_new_user_notification( $uid, null, 'user' );
		$sent = true;
	} catch ( \Throwable $e ) {
		$sent = false;
	}
	return array(
		'users' => rego_panel_users(),
		'mesaj' => $sent ? 'Kullanıcı eklendi, davet e-postası gönderildi.' : 'Kullanıcı eklendi ancak siteniz e-posta gönderemedi. Kullanıcılar listesinden “Şifre ver” ile şifresini belirleyin.',
	);
}

/** Lets a panel manager set a password for a panel user (useful when the site cannot send e-mail). */
function rego_api_kullanici_sifre( WP_REST_Request $req ) {
	$uid = (int) $req['id'];
	$p   = (array) $req->get_json_params();
	$u   = get_user_by( 'id', $uid );
	if ( ! $u || ( $uid !== get_current_user_id() && ! rego_panel_only_user( $u ) ) ) {
		return new WP_Error( 'rego_yetki', 'Bu kullanıcının şifresi panelden değiştirilemez.', array( 'status' => 400 ) );
	}
	$sifre = (string) ( $p['sifre'] ?? '' );
	if ( strlen( $sifre ) < 8 ) {
		return new WP_Error( 'rego_sifre', 'Şifre en az 8 karakter olmalı.', array( 'status' => 400 ) );
	}
	wp_set_password( $sifre, $uid );
	if ( $uid === get_current_user_id() ) {
		wp_set_auth_cookie( $uid, true );
	}
	return array( 'ok' => true );
}

function rego_api_kullanici_rol( WP_REST_Request $req ) {
	$uid = (int) $req['id'];
	$p   = (array) $req->get_json_params();
	$u   = get_user_by( 'id', $uid );
	if ( ! $u || ! rego_panel_only_user( $u ) ) {
		return new WP_Error( 'rego_yetki', 'Site yöneticilerinin rolü panelden değiştirilemez.', array( 'status' => 400 ) );
	}
	if ( $uid === get_current_user_id() ) {
		return new WP_Error( 'rego_yetki', 'Kendi rolünüzü değiştiremezsiniz.', array( 'status' => 400 ) );
	}
	$rol = $p['rol'] ?? '';
	if ( 'pasif' === $rol ) {
		$u->set_role( 'subscriber' );
		update_user_meta( $uid, 'rego_pasif', '1' );
		WP_Session_Tokens::get_instance( $uid )->destroy_all();
	} elseif ( in_array( $rol, array( 'rego_yonetici', 'rego_satis', 'rego_saha' ), true ) ) {
		$u->set_role( $rol );
		delete_user_meta( $uid, 'rego_pasif' );
	}
	return array( 'users' => rego_panel_users() );
}
