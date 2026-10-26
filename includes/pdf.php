<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'admin_post_rego_teklif_pdf', 'rego_pdf_handler' );
add_action( 'admin_post_nopriv_rego_teklif_pdf', 'rego_pdf_login_required' );

function rego_pdf_login_required() {
	auth_redirect();
}

function rego_pdf_handler() {
	if ( ! current_user_can( 'rego_teklif' ) ) {
		wp_die( 'Bu teklifi görüntüleme yetkiniz yok.', 'Yetki yok', array( 'response' => 403 ) );
	}
	check_admin_referer( 'rego_teklif_pdf' );
	$id = isset( $_GET['id'] ) ? absint( $_GET['id'] ) : 0;
	$t  = rego_api_get( 'teklif', $id );
	if ( ! $t ) {
		wp_die( 'Teklif bulunamadı.', 'Bulunamadı', array( 'response' => 404 ) );
	}
	$pdf  = rego_pdf_render( $t );
	$name = rego_pdf_filename( $t );
	$disp = ! empty( $_GET['indir'] ) ? 'attachment' : 'inline';
	nocache_headers();
	header( 'Content-Type: application/pdf' );
	header( 'Content-Length: ' . strlen( $pdf ) );
	header( "Content-Disposition: $disp; filename=\"" . $name . "\"; filename*=UTF-8''" . rawurlencode( $name ) );
	echo $pdf; // phpcs:ignore
	exit;
}

function rego_pdf_filename( $t ) {
	$tr   = array( 'ç' => 'c', 'Ç' => 'C', 'ğ' => 'g', 'Ğ' => 'G', 'ı' => 'i', 'İ' => 'I', 'ö' => 'o', 'Ö' => 'O', 'ş' => 's', 'Ş' => 'S', 'ü' => 'u', 'Ü' => 'U' );
	$firm = preg_replace( '/[^A-Za-z0-9]+/', '_', strtr( $t['firma'], $tr ) );
	return 'Fiyat_Teklifi_' . trim( $firm, '_' ) . '_' . $t['no'] . '.pdf';
}

/** Builds the quote PDF and returns its bytes. */
function rego_pdf_render( $t ) {
	require_once REGO_PANEL_DIR . 'vendor/autoload.php';

	$up    = wp_upload_dir();
	$cache = trailingslashit( $up['basedir'] ) . 'rego-panel-fonts';
	if ( ! is_dir( $cache ) ) {
		wp_mkdir_p( $cache );
		file_put_contents( $cache . '/index.html', '' ); // phpcs:ignore
	}

	$opt = new \Dompdf\Options();
	$opt->setChroot( array( REGO_PANEL_DIR, trailingslashit( $up['basedir'] ) . 'rego-panel/teklif' ) );
	$opt->setFontDir( $cache );
	$opt->setFontCache( $cache );
	$opt->setTempDir( get_temp_dir() );
	$opt->setIsRemoteEnabled( false );
	$opt->setDefaultFont( 'DejaVu Sans' );
	$opt->setDefaultPaperSize( 'A4' );

	$dompdf = new \Dompdf\Dompdf( $opt );
	$dompdf->setBasePath( REGO_PANEL_DIR );
	$dompdf->loadHtml( rego_pdf_html( $t ), 'UTF-8' );
	$dompdf->setPaper( 'A4', 'portrait' );
	$dompdf->render();
	$dompdf->addInfo( 'Title', 'Fiyat Teklifi ' . $t['no'] );
	$dompdf->addInfo( 'Author', rego_settings()['firma_unvan'] );
	return $dompdf->output();
}

function rego_pdf_html( $t ) {
	$s       = rego_settings();
	$gonderen = $t['gonderen_id'] ? get_user_by( 'id', $t['gonderen_id'] ) : null;
	$g       = $gonderen ? rego_user_public( $gonderen ) : array( 'ad' => '', 'email' => '', 'tel' => '' );
	if ( ! empty( $t['gonderen_ad'] ) ) {
		$g = array( 'ad' => $t['gonderen_ad'], 'email' => $t['gonderen_email'], 'tel' => $t['gonderen_tel'] );
	}
	$hitap   = $t['hitap'];
	if ( '' === trim( $hitap ) && $t['kisi'] ) {
		$first = explode( ' ', trim( $t['kisi'] ) )[0];
		$m     = $t['musteri_id'] ? rego_api_get( 'musteri', $t['musteri_id'] ) : null;
		$hitap = 'Sn. ' . $first . ' ' . ( $m && $m['hitap'] ? $m['hitap'] : 'Bey' ) . ',';
	}
	ob_start();
	include REGO_PANEL_DIR . 'pdf/template.php';
	return ob_get_clean();
}
