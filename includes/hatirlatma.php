<?php
/**
 * Reminders: attached to a field visit, payment or project (or standalone), delivered at a set time
 * as in-panel notifications, and over WhatsApp (official Cloud API) once that is configured.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function rego_hat_tables() {
	global $wpdb;
	require_once ABSPATH . 'wp-admin/includes/upgrade.php';
	$c = $wpdb->get_charset_collate();
	$p = $wpdb->prefix . 'rego_';
	dbDelta( "CREATE TABLE {$p}hatirlatma (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		kaynak varchar(20) NOT NULL DEFAULT 'genel',
		kaynak_id bigint(20) unsigned NOT NULL DEFAULT 0,
		kural varchar(10) NOT NULL DEFAULT 'ozel',
		baslik varchar(255) NOT NULL DEFAULT '',
		mesaj text NULL,
		zaman datetime NOT NULL,
		alicilar varchar(255) NOT NULL DEFAULT '',
		durum varchar(20) NOT NULL DEFAULT 'bekliyor',
		gonderim datetime NULL,
		wa_sonuc varchar(255) NOT NULL DEFAULT '',
		created_by bigint(20) unsigned NOT NULL DEFAULT 0,
		created_at datetime NOT NULL,
		PRIMARY KEY  (id),
		KEY zaman (zaman),
		KEY kaynak (kaynak, kaynak_id)
	) $c;" );
	dbDelta( "CREATE TABLE {$p}bildirim (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		user_id bigint(20) unsigned NOT NULL,
		hatirlatma_id bigint(20) unsigned NOT NULL DEFAULT 0,
		baslik varchar(255) NOT NULL DEFAULT '',
		mesaj text NULL,
		link varchar(120) NOT NULL DEFAULT '',
		okundu tinyint(1) NOT NULL DEFAULT 0,
		created_at datetime NOT NULL,
		PRIMARY KEY  (id),
		KEY user_okundu (user_id, okundu)
	) $c;" );
}

/* Every five minutes, deliver reminders that are due. */
add_filter( 'cron_schedules', function ( $s ) {
	$s['rego_5dk'] = array( 'interval' => 5 * MINUTE_IN_SECONDS, 'display' => 'Her 5 dakika (Rego Panel)' );
	return $s;
} );
add_action( 'init', function () {
	if ( ! wp_next_scheduled( 'rego_hatirlatma_cron' ) ) {
		wp_schedule_event( time() + 60, 'rego_5dk', 'rego_hatirlatma_cron' );
	}
} );
add_action( 'rego_hatirlatma_cron', 'rego_hat_isle' );

/* ---------- data helpers ---------- */
function rego_hat_row( $r ) {
	if ( ! $r ) {
		return null;
	}
	$r = (array) $r;
	foreach ( array( 'id', 'kaynak_id', 'created_by' ) as $k ) {
		$r[ $k ] = (int) $r[ $k ];
	}
	$r['alicilar'] = array_values( array_filter( array_map( 'intval', explode( ',', (string) $r['alicilar'] ) ) ) );
	return $r;
}

function rego_hat_get_for( $kaynak, $id ) {
	global $wpdb;
	return rego_hat_row( $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . rego_t( 'hatirlatma' ) . ' WHERE kaynak = %s AND kaynak_id = %d ORDER BY id DESC LIMIT 1', $kaynak, $id ), ARRAY_A ) ); // phpcs:ignore
}

function rego_hat_list() {
	global $wpdb;
	$since = gmdate( 'Y-m-d H:i:s', strtotime( current_time( 'mysql' ) . ' -30 days' ) );
	$rows  = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . rego_t( 'hatirlatma' ) . " WHERE durum = 'bekliyor' OR zaman >= %s ORDER BY zaman ASC LIMIT 500", $since ), ARRAY_A ); // phpcs:ignore
	return array_map( 'rego_hat_row', $rows );
}

/** Date/time the record happens on, as 'Y-m-d H:i'. */
function rego_hat_olay( $kaynak, $item ) {
	if ( 'saha' === $kaynak ) {
		return $item['tarih'] . ' ' . ( $item['saat'] ? $item['saat'] : '09:00' );
	}
	if ( 'hareket' === $kaynak ) {
		return $item['tarih'] . ' 09:00';
	}
	if ( 'proje' === $kaynak ) {
		return $item['teslim'] ? $item['teslim'] . ' 09:00' : '';
	}
	return '';
}

function rego_hat_zaman( $kural, $olay, $ozel = '' ) {
	if ( 'ozel' === $kural ) {
		$t = strtotime( str_replace( 'T', ' ', (string) $ozel ) );
		return $t ? gmdate( 'Y-m-d H:i:00', $t ) : '';
	}
	if ( ! $olay ) {
		return '';
	}
	$t   = strtotime( $olay );
	$day = substr( $olay, 0, 10 );
	switch ( $kural ) {
		case 'gun09':
			return $day . ' 09:00:00';
		case 'saat1':
			return gmdate( 'Y-m-d H:i:00', $t - HOUR_IN_SECONDS );
		case 'gun1':
			return gmdate( 'Y-m-d', strtotime( $day . ' -1 day' ) ) . ' 09:00:00';
		case 'gun3':
			return gmdate( 'Y-m-d', strtotime( $day . ' -3 days' ) ) . ' 09:00:00';
	}
	return '';
}

/** Title, text and panel link for a record's reminder. */
function rego_hat_metin( $kaynak, $item ) {
	$firma = function ( $id ) {
		$m = $id ? rego_api_get( 'musteri', $id ) : null;
		return $m ? $m['firma'] : '';
	};
	if ( 'saha' === $kaynak ) {
		return array(
			'Saha: ' . $item['is_tanimi'],
			implode( ' · ', array_filter( array( rego_date_tr( $item['tarih'] ) . ( $item['saat'] ? ' ' . $item['saat'] : '' ), $firma( $item['musteri_id'] ), $item['konum'], $item['ekip'] ) ) ),
			'saha',
		);
	}
	if ( 'hareket' === $kaynak ) {
		$tutar = rego_num( $item['tutar'] ) . ' ' . $item['para'];
		return array(
			( 'gelir' === $item['tur'] ? 'Beklenen ödeme: ' : 'Ödeme: ' ) . ( $item['aciklama'] ? $item['aciklama'] : $item['kategori'] ),
			$tutar . ' · son gün ' . rego_date_tr( $item['tarih'] ) . ( $item['hesap'] ? ' · ' . $item['hesap'] : '' ),
			'fatura',
		);
	}
	if ( 'proje' === $kaynak ) {
		return array( 'Teslim: ' . $item['ad'], $item['kod'] . ' · ' . $firma( $item['musteri_id'] ) . ' · ' . rego_date_tr( $item['teslim'] ), 'proje' );
	}
	return array( '', '', 'dash' );
}

/** Whether a record still needs reminding (cancel once it is done). */
function rego_hat_acik( $kaynak, $item ) {
	if ( 'saha' === $kaynak ) {
		return ! in_array( $item['durum'], array( 'tamamlandi', 'iptal' ), true );
	}
	if ( 'hareket' === $kaynak ) {
		return 'bekliyor' === $item['durum'];
	}
	if ( 'proje' === $kaynak ) {
		return 'teslim' !== $item['asama'];
	}
	return true;
}

function rego_hat_clean_alicilar( $list ) {
	$ids = array();
	foreach ( (array) $list as $u ) {
		$u = (int) $u;
		if ( $u && user_can( $u, 'rego_access' ) ) {
			$ids[] = $u;
		}
	}
	return implode( ',', array_unique( $ids ) );
}

/**
 * Creates, updates or removes the reminder of a record.
 * $req = array( kural, zaman (for ozel), alicilar ) or null to only refresh an existing one.
 */
function rego_hat_kaydet_kayit( $kaynak, $item, $req = null ) {
	global $wpdb;
	$t   = rego_t( 'hatirlatma' );
	$cur = rego_hat_get_for( $kaynak, $item['id'] );
	if ( null === $req ) {
		if ( ! $cur || 'bekliyor' !== $cur['durum'] ) {
			return $cur;
		}
		$req = array( 'kural' => $cur['kural'], 'zaman' => $cur['zaman'], 'alicilar' => $cur['alicilar'] );
	}
	$kural = in_array( $req['kural'] ?? '', array( 'gun09', 'saat1', 'gun1', 'gun3', 'ozel' ), true ) ? $req['kural'] : 'yok';
	if ( 'yok' === $kural || ! rego_hat_acik( $kaynak, $item ) ) {
		if ( $cur && 'bekliyor' === $cur['durum'] ) {
			if ( 'yok' === $kural ) {
				$wpdb->delete( $t, array( 'id' => $cur['id'] ) );
				return null;
			}
			$wpdb->update( $t, array( 'durum' => 'iptal' ), array( 'id' => $cur['id'] ) );
			return rego_hat_get_for( $kaynak, $item['id'] );
		}
		return $cur;
	}
	$zaman = rego_hat_zaman( $kural, rego_hat_olay( $kaynak, $item ), $req['zaman'] ?? '' );
	if ( ! $zaman ) {
		return $cur;
	}
	list( $baslik, $mesaj ) = rego_hat_metin( $kaynak, $item );
	$alicilar = rego_hat_clean_alicilar( $req['alicilar'] ?? array( get_current_user_id() ) );
	if ( '' === $alicilar ) {
		$alicilar = (string) get_current_user_id();
	}
	$row = array(
		'kaynak' => $kaynak, 'kaynak_id' => (int) $item['id'], 'kural' => $kural, 'baslik' => $baslik, 'mesaj' => $mesaj,
		'zaman' => $zaman, 'alicilar' => $alicilar, 'durum' => 'bekliyor',
	);
	if ( $cur && 'bekliyor' === $cur['durum'] ) {
		$wpdb->update( $t, $row, array( 'id' => $cur['id'] ) );
	} elseif ( $cur && 'gonderildi' === $cur['durum'] && $cur['zaman'] === $zaman ) {
		return $cur; // already delivered for this time
	} else {
		$row['created_by'] = get_current_user_id();
		$row['created_at'] = rego_now();
		$wpdb->insert( $t, $row );
	}
	return rego_hat_get_for( $kaynak, $item['id'] );
}

/* ---------- delivery ---------- */
function rego_hat_isle() {
	global $wpdb;
	$t    = rego_t( 'hatirlatma' );
	$now  = current_time( 'mysql' );
	$rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $t WHERE durum = 'bekliyor' AND zaman <= %s ORDER BY zaman ASC LIMIT 50", $now ), ARRAY_A ); // phpcs:ignore
	foreach ( $rows as $r ) {
		// Claim the row first so two simultaneous runs cannot send it twice.
		$claimed = $wpdb->query( $wpdb->prepare( "UPDATE $t SET durum = 'gonderiliyor' WHERE id = %d AND durum = 'bekliyor'", $r['id'] ) ); // phpcs:ignore
		if ( ! $claimed ) {
			continue;
		}
		$r    = rego_hat_row( $r );
		$link = array( 'saha' => 'saha', 'hareket' => 'fatura', 'proje' => 'proje' )[ $r['kaynak'] ] ?? 'dash';
		$wa   = array();
		foreach ( $r['alicilar'] as $uid ) {
			$wpdb->insert( rego_t( 'bildirim' ), array(
				'user_id' => $uid, 'hatirlatma_id' => $r['id'], 'baslik' => $r['baslik'], 'mesaj' => (string) $r['mesaj'],
				'link' => $link, 'okundu' => 0, 'created_at' => $now,
			) );
			$res = rego_wa_gonder( $uid, $r['baslik'], (string) $r['mesaj'] );
			if ( null !== $res ) {
				$wa[] = $res;
			}
		}
		$wpdb->update( $t, array( 'durum' => 'gonderildi', 'gonderim' => $now, 'wa_sonuc' => substr( implode( ' | ', $wa ), 0, 250 ) ), array( 'id' => $r['id'] ) );
	}
	// Rows stuck in "gonderiliyor" (a run that died) go back to the queue after 10 minutes.
	$wpdb->query( $wpdb->prepare( "UPDATE $t SET durum = 'bekliyor' WHERE durum = 'gonderiliyor' AND zaman <= %s", gmdate( 'Y-m-d H:i:s', strtotime( $now . ' -10 minutes' ) ) ) ); // phpcs:ignore
}

/* ---------- WhatsApp (official Cloud API) ---------- */
function rego_wa_numara( $tel ) {
	$d = preg_replace( '/\D+/', '', (string) $tel );
	if ( '' === $d ) {
		return '';
	}
	if ( 0 === strpos( $d, '00' ) ) {
		$d = substr( $d, 2 );
	}
	if ( 0 === strpos( $d, '0' ) ) {
		$d = '90' . substr( $d, 1 );
	} elseif ( 10 === strlen( $d ) && '5' === $d[0] ) {
		$d = '90' . $d;
	}
	return $d;
}

/** Sends one reminder; returns a short result text, or null when WhatsApp is off. */
function rego_wa_gonder( $uid, $baslik, $mesaj, $force = false ) {
	$s = rego_settings();
	if ( ( empty( $s['wa_aktif'] ) && ! $force ) || empty( $s['wa_phone_id'] ) || empty( $s['wa_token'] ) ) {
		return null;
	}
	$to = rego_wa_numara( get_user_meta( $uid, 'rego_tel', true ) );
	if ( '' === $to ) {
		return 'kullanıcı ' . $uid . ': telefon yok';
	}
	$body = array(
		'messaging_product' => 'whatsapp',
		'to'                => $to,
		'type'              => 'template',
		'template'          => array(
			'name'       => $s['wa_sablon'] ? $s['wa_sablon'] : 'rego_hatirlatma',
			'language'   => array( 'code' => $s['wa_dil'] ? $s['wa_dil'] : 'tr' ),
			'components' => array( array(
				'type'       => 'body',
				'parameters' => array(
					array( 'type' => 'text', 'text' => mb_substr( $baslik, 0, 200 ) ),
					array( 'type' => 'text', 'text' => mb_substr( '' !== $mesaj ? $mesaj : '-', 0, 400 ) ),
				),
			) ),
		),
	);
	$res = wp_remote_post( 'https://graph.facebook.com/' . ( $s['wa_surum'] ? $s['wa_surum'] : 'v24.0' ) . '/' . rawurlencode( $s['wa_phone_id'] ) . '/messages', array(
		'timeout' => 15,
		'headers' => array( 'Authorization' => 'Bearer ' . $s['wa_token'], 'Content-Type' => 'application/json' ),
		'body'    => wp_json_encode( $body ),
	) );
	if ( is_wp_error( $res ) ) {
		return $to . ': ' . $res->get_error_message();
	}
	$code = wp_remote_retrieve_response_code( $res );
	if ( 200 === $code ) {
		return $to . ': gönderildi';
	}
	$j = json_decode( wp_remote_retrieve_body( $res ), true );
	return $to . ': hata ' . $code . ( isset( $j['error']['message'] ) ? ' – ' . $j['error']['message'] : '' );
}

/* ---------- REST ---------- */
add_action( 'rest_api_init', function () {
	$ns   = 'rego/v1';
	$read = function () { return current_user_can( 'rego_access' ); };
	register_rest_route( $ns, '/bildirim', array(
		'methods' => 'GET', 'permission_callback' => $read,
		'callback' => function () {
			rego_hat_isle();
			return rego_bildirim_payload();
		},
	) );
	register_rest_route( $ns, '/bildirim/okundu', array(
		'methods' => 'POST', 'permission_callback' => $read,
		'callback' => function ( WP_REST_Request $req ) {
			global $wpdb;
			$p   = (array) $req->get_json_params();
			$uid = get_current_user_id();
			if ( ! empty( $p['hepsi'] ) ) {
				$wpdb->update( rego_t( 'bildirim' ), array( 'okundu' => 1 ), array( 'user_id' => $uid ) );
			} else {
				foreach ( (array) ( $p['ids'] ?? array() ) as $id ) {
					$wpdb->update( rego_t( 'bildirim' ), array( 'okundu' => 1 ), array( 'id' => (int) $id, 'user_id' => $uid ) );
				}
			}
			return rego_bildirim_payload();
		},
	) );
	// Standalone reminders ("Kazani ile görüşme").
	register_rest_route( $ns, '/hatirlatma', array(
		'methods' => 'POST', 'permission_callback' => $read,
		'callback' => function ( WP_REST_Request $req ) {
			return rego_hat_genel_kaydet( 0, (array) $req->get_json_params() );
		},
	) );
	register_rest_route( $ns, '/hatirlatma/(?P<id>\d+)', array(
		array(
			'methods' => 'PUT,PATCH', 'permission_callback' => $read,
			'callback' => function ( WP_REST_Request $req ) {
				return rego_hat_genel_kaydet( (int) $req['id'], (array) $req->get_json_params() );
			},
		),
		array(
			'methods' => 'DELETE', 'permission_callback' => $read,
			'callback' => function ( WP_REST_Request $req ) {
				global $wpdb;
				$h = rego_hat_row( $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . rego_t( 'hatirlatma' ) . ' WHERE id = %d', (int) $req['id'] ), ARRAY_A ) ); // phpcs:ignore
				if ( ! $h ) {
					return new WP_Error( 'rego_yok', 'Hatırlatma bulunamadı.', array( 'status' => 404 ) );
				}
				if ( (int) $h['created_by'] !== get_current_user_id() && ! current_user_can( 'rego_sil' ) ) {
					return new WP_Error( 'rego_yetki', 'Bu hatırlatmayı yalnızca kuran kişi silebilir.', array( 'status' => 403 ) );
				}
				$wpdb->delete( rego_t( 'hatirlatma' ), array( 'id' => $h['id'] ) );
				return array( 'deleted' => $h['id'] );
			},
		),
	) );
	register_rest_route( $ns, '/whatsapp-test', array(
		'methods' => 'POST', 'permission_callback' => function () { return current_user_can( 'rego_ayarlar' ); },
		'callback' => function () {
			$r = rego_wa_gonder( get_current_user_id(), 'Rego Panel test mesajı', 'WhatsApp hatırlatmaları çalışıyor. ' . wp_date( 'd.m.Y H:i' ), true );
			if ( null === $r ) {
				return new WP_Error( 'rego_wa', 'Önce Telefon numarası kimliği ve erişim anahtarını girip kaydedin.', array( 'status' => 400 ) );
			}
			return array( 'sonuc' => $r );
		},
	) );
} );

function rego_bildirim_payload() {
	global $wpdb;
	$uid   = get_current_user_id();
	$items = $wpdb->get_results( $wpdb->prepare( 'SELECT id, hatirlatma_id, baslik, mesaj, link, okundu, created_at FROM ' . rego_t( 'bildirim' ) . ' WHERE user_id = %d ORDER BY id DESC LIMIT 30', $uid ), ARRAY_A ); // phpcs:ignore
	foreach ( $items as &$i ) {
		$i['id']     = (int) $i['id'];
		$i['okundu'] = (int) $i['okundu'];
	}
	$unread = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . rego_t( 'bildirim' ) . ' WHERE user_id = %d AND okundu = 0', $uid ) ); // phpcs:ignore
	return array( 'items' => $items, 'okunmamis' => $unread, 'hatirlatma' => rego_hat_list(), 'simdi' => current_time( 'mysql' ) );
}

function rego_hat_genel_kaydet( $id, $p ) {
	global $wpdb;
	$t      = rego_t( 'hatirlatma' );
	$baslik = sanitize_text_field( $p['baslik'] ?? '' );
	$zaman  = rego_hat_zaman( 'ozel', '', $p['zaman'] ?? '' );
	if ( '' === $baslik || ! $zaman ) {
		return new WP_Error( 'rego_eksik', 'Başlık ile tarih ve saat gerekli.', array( 'status' => 400 ) );
	}
	$row = array(
		'kaynak' => 'genel', 'kaynak_id' => 0, 'kural' => 'ozel', 'baslik' => $baslik,
		'mesaj' => sanitize_textarea_field( $p['mesaj'] ?? '' ), 'zaman' => $zaman,
		'alicilar' => rego_hat_clean_alicilar( $p['alicilar'] ?? array() ) ?: (string) get_current_user_id(),
		'durum' => 'bekliyor',
	);
	if ( $id ) {
		$h = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $t WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore
		if ( ! $h ) {
			return new WP_Error( 'rego_yok', 'Hatırlatma bulunamadı.', array( 'status' => 404 ) );
		}
		$wpdb->update( $t, $row, array( 'id' => $id ) );
	} else {
		$row['created_by'] = get_current_user_id();
		$row['created_at'] = rego_now();
		$wpdb->insert( $t, $row );
		$id = $wpdb->insert_id;
	}
	return array( 'item' => rego_hat_row( $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $t WHERE id = %d", $id ), ARRAY_A ) ), 'hatirlatma' => rego_hat_list() ); // phpcs:ignore
}
