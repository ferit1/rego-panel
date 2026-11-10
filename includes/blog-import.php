<?php
/**
 * One-time import of prepared blog posts (blog-import/posts.json) as drafts,
 * with their images, category, tags, internal links and SEO fields.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function rego_blog_paketi() {
	$f = REGO_PANEL_DIR . 'blog-import/posts.json';
	if ( ! file_exists( $f ) ) {
		return array();
	}
	$d = json_decode( file_get_contents( $f ), true );
	return is_array( $d ) ? $d : array();
}

function rego_blog_mevcut( $slug ) {
	$q = get_posts( array( 'name' => $slug, 'post_type' => 'post', 'post_status' => array( 'publish', 'draft', 'pending', 'future', 'private' ), 'numberposts' => 1 ) );
	return $q ? $q[0] : null;
}

function rego_blog_durum() {
	$out = array();
	foreach ( rego_blog_paketi() as $p ) {
		$m     = rego_blog_mevcut( $p['slug'] );
		$out[] = array(
			'baslik' => $p['title'],
			'slug'   => $p['slug'],
			'id'     => $m ? $m->ID : 0,
			'durum'  => $m ? $m->post_status : '',
			'duzen'  => $m ? admin_url( 'post.php?post=' . $m->ID . '&action=edit' ) : '',
		);
	}
	return $out;
}

function rego_blog_link( $id ) {
	$p = get_post( $id );
	if ( 'publish' === $p->post_status ) {
		return get_permalink( $p );
	}
	require_once ABSPATH . 'wp-admin/includes/post.php';
	list( $tpl, $name ) = get_sample_permalink( $p );
	return str_replace( array( '%postname%', '%pagename%' ), $name, $tpl );
}

function rego_blog_gorsel( $key ) {
	$ex = get_posts( array( 'post_type' => 'attachment', 'meta_key' => '_rego_blog_img', 'meta_value' => $key, 'numberposts' => 1, 'post_status' => 'inherit' ) );
	if ( $ex ) {
		return $ex[0]->ID;
	}
	$src = REGO_PANEL_DIR . 'blog-import/img/' . $key . '.jpg';
	if ( ! file_exists( $src ) ) {
		return 0;
	}
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';
	$tmp = wp_tempnam( $key . '.jpg' );
	copy( $src, $tmp );
	$id = media_handle_sideload( array( 'name' => $key . '.jpg', 'tmp_name' => $tmp ), 0 );
	if ( is_wp_error( $id ) ) {
		@unlink( $tmp );
		return 0;
	}
	update_post_meta( $id, '_rego_blog_img', $key );
	return $id;
}

function rego_blog_ice_aktar() {
	if ( ! current_user_can( 'edit_posts' ) || ! current_user_can( 'upload_files' ) ) {
		return new WP_Error( 'rego_blog', 'Bu işlem için WordPress yönetici yetkisi gerekiyor.', array( 'status' => 403 ) );
	}
	$paket = rego_blog_paketi();
	if ( ! $paket ) {
		return new WP_Error( 'rego_blog', 'İçe aktarılacak yazı bulunamadı.', array( 'status' => 404 ) );
	}
	$cat = term_exists( 'Dijital Diş Hekimliği', 'category' );
	if ( ! $cat ) {
		$cat = wp_insert_term( 'Dijital Diş Hekimliği', 'category', array( 'slug' => 'dijital-dis-hekimligi' ) );
	}
	$cat_id = is_array( $cat ) ? (int) $cat['term_id'] : 0;

	// 1) Create missing drafts (content filled in step 2, once every post has a link).
	$ids = array();
	$yeni = 0;
	foreach ( $paket as $p ) {
		$m = rego_blog_mevcut( $p['slug'] );
		if ( $m ) {
			$ids[ $p['slug'] ] = array( $m->ID, false );
			continue;
		}
		$id = wp_insert_post( array(
			'post_title'   => $p['title'],
			'post_name'    => $p['slug'],
			'post_status'  => 'draft',
			'post_type'    => 'post',
			'post_excerpt' => $p['meta'],
			'post_content' => '',
			'post_category' => $cat_id ? array( $cat_id ) : array(),
		), true );
		if ( is_wp_error( $id ) ) {
			return $id;
		}
		$ids[ $p['slug'] ] = array( $id, true );
		$yeni++;
	}
	// 2) Fill new drafts: images, links, tags, SEO fields.
	foreach ( $paket as $p ) {
		list( $id, $is_new ) = $ids[ $p['slug'] ];
		if ( ! $is_new ) {
			continue;
		}
		$c = $p['content'];
		$ilk = 0;
		if ( preg_match_all( '/\{\{IMGID:([a-z0-9-]+)\}\}/', $c, $mm ) ) {
			foreach ( array_unique( $mm[1] ) as $k ) {
				$aid = rego_blog_gorsel( $k );
				if ( ! $aid ) {
					continue;
				}
				$ilk = $ilk ? $ilk : $aid;
				$url = wp_get_attachment_image_url( $aid, 'large' );
				$alt = '';
				if ( preg_match( '/IMGURL:' . preg_quote( $k, '/' ) . '\}\}" alt="([^"]*)"/', $c, $am ) ) {
					$alt = html_entity_decode( $am[1] );
					update_post_meta( $aid, '_wp_attachment_image_alt', $alt );
				}
				$c = str_replace( array( '{{IMGID:' . $k . '}}', '{{IMGURL:' . $k . '}}' ), array( $aid, $url ), $c );
				wp_update_post( array( 'ID' => $aid, 'post_parent' => $id, 'post_title' => $alt ? $alt : $k ) );
			}
		}
		$c = preg_replace_callback( '/\{\{LINK:([a-z0-9-]+)\}\}/', function ( $m ) use ( $ids ) {
			return isset( $ids[ $m[1] ] ) ? esc_url( rego_blog_link( $ids[ $m[1] ][0] ) ) : '#';
		}, $c );
		// Cover image: one not already shown in the text, so it does not appear twice.
		$kapak = array(
			'geomagic-dis-hekimligi-tez-analiz-hizmeti' => 'implant-scan-body-renk-haritasi',
			'implant-olcusu-lineer-ve-acisal-sapma-hesaplama' => 'all-on-4-splintli-tarama-sapma',
			'dijital-konvansiyonel-olcu-karsilastirma-trueness-precision' => 'all-on-4-splintsiz-tarama-sapma',
			'all-on-4-dijital-olcu-dogrulugu-splintli-splintsiz' => 'dijital-olcu-referans-karsilastirma',
			'cad-cam-kron-marjinal-internal-uyum-olcumu' => 'implant-model-tarama-basligi',
			'3d-yazici-tam-protez-kaidesi-uyumu-renk-haritasi' => 'ana-kaide-renk-haritasi',
			'geomagic-sapma-degerleri-neden-yuksek-cikar' => 'implant-model-tarama-basligi',
			'asinma-hacim-kaybi-olcumu-geomagic-design-x-control-x' => 'dijital-olcu-referans-karsilastirma',
			'tez-icin-geomagic-deneme-surumu-egitim-destek' => 'ana-kaide-renk-haritasi',
		);
		$ilk = isset( $kapak[ $p['slug'] ] ) ? rego_blog_gorsel( $kapak[ $p['slug'] ] ) : $ilk;
		wp_update_post( array( 'ID' => $id, 'post_content' => wp_slash( $c ) ) );
		if ( $ilk ) {
			set_post_thumbnail( $id, $ilk );
		}
		wp_set_post_tags( $id, $p['tags'], false );
		// Yoast SEO and Rank Math fields (whichever is installed reads its own).
		update_post_meta( $id, '_yoast_wpseo_title', $p['seo_title'] );
		update_post_meta( $id, '_yoast_wpseo_metadesc', $p['meta'] );
		update_post_meta( $id, '_yoast_wpseo_focuskw', $p['focus'] );
		update_post_meta( $id, 'rank_math_title', $p['seo_title'] );
		update_post_meta( $id, 'rank_math_description', $p['meta'] );
		update_post_meta( $id, 'rank_math_focus_keyword', $p['focus'] );
	}
	return array( 'yeni' => $yeni, 'yazilar' => rego_blog_durum(), 'liste' => admin_url( 'edit.php?post_status=draft&post_type=post' ) );
}

add_action( 'rest_api_init', function () {
	register_rest_route( 'rego/v1', '/blog', array(
		array( 'methods' => 'GET', 'callback' => function () { return array( 'yazilar' => rego_blog_durum(), 'yetki' => current_user_can( 'edit_posts' ) && current_user_can( 'upload_files' ) ); }, 'permission_callback' => function () { return current_user_can( 'rego_ayarlar' ); } ),
		array( 'methods' => 'POST', 'callback' => 'rego_blog_ice_aktar', 'permission_callback' => function () { return current_user_can( 'rego_ayarlar' ); } ),
	) );
} );

/** Replaces the first version's light contact box (unreadable on dark themes) in imported posts. */
function rego_blog_cta_duzelt() {
	$yeni = @file_get_contents( REGO_PANEL_DIR . 'blog-import/cta.html' );
	if ( ! $yeni ) {
		return 0;
	}
	$n = 0;
	foreach ( rego_blog_paketi() as $p ) {
		$m = rego_blog_mevcut( $p['slug'] );
		if ( ! $m || false === strpos( $m->post_content, 'background-color:#eef3fb' ) ) {
			continue;
		}
		$c = preg_replace( '/<!-- wp:group \{[^\n]*#eef3fb[^\n]*-->.*?<!-- \/wp:group -->/s', $yeni, $m->post_content, 1 );
		if ( $c && $c !== $m->post_content ) {
			wp_update_post( array( 'ID' => $m->ID, 'post_content' => wp_slash( $c ) ) );
			$n++;
		}
	}
	return $n;
}

/** Swaps the blog images for the re-cropped 16:9 versions and points the posts at the new sizes. */
function rego_blog_gorsel_yenile() {
	require_once ABSPATH . 'wp-admin/includes/image.php';
	$atts = get_posts( array( 'post_type' => 'attachment', 'post_status' => 'inherit', 'meta_key' => '_rego_blog_img', 'numberposts' => 50 ) );
	$yeni = array();
	foreach ( $atts as $a ) {
		$k   = get_post_meta( $a->ID, '_rego_blog_img', true );
		$src = REGO_PANEL_DIR . 'blog-import/img/' . $k . '.jpg';
		$dst = get_attached_file( $a->ID );
		if ( ! $k || ! file_exists( $src ) || ! $dst ) {
			continue;
		}
		$eski = wp_get_attachment_metadata( $a->ID );
		if ( ! empty( $eski['sizes'] ) ) {
			foreach ( $eski['sizes'] as $sz ) {
				wp_delete_file( path_join( dirname( $dst ), $sz['file'] ) );
			}
		}
		if ( ! copy( $src, $dst ) ) {
			continue;
		}
		wp_update_attachment_metadata( $a->ID, wp_generate_attachment_metadata( $a->ID, $dst ) );
		$yeni[ $a->ID ] = wp_get_attachment_image_url( $a->ID, 'large' );
	}
	if ( ! $yeni ) {
		return 0;
	}
	$n = 0;
	foreach ( rego_blog_paketi() as $p ) {
		$m = rego_blog_mevcut( $p['slug'] );
		if ( ! $m ) {
			continue;
		}
		$c = preg_replace_callback( '/<img src="[^"]*"([^>]*class="wp-image-(\d+)")/', function ( $mm ) use ( $yeni ) {
			return isset( $yeni[ (int) $mm[2] ] ) ? '<img src="' . esc_url( $yeni[ (int) $mm[2] ] ) . '"' . $mm[1] : $mm[0];
		}, $m->post_content );
		if ( $c !== $m->post_content ) {
			wp_update_post( array( 'ID' => $m->ID, 'post_content' => wp_slash( $c ) ) );
			$n++;
		}
	}
	return $n;
}
