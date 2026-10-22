<?php
/**
 * Quote PDF layout, modelled on Rego's "Mühendislik Hizmetleri Teklif Formu".
 * Variables: $t (quote), $s (settings), $g (sender), $hitap.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
$f   = REGO_PANEL_DIR . 'pdf/fonts/';
$dash = function ( $v ) { return '' !== trim( (string) $v ) ? esc_html( $v ) : '-'; };
$year = gmdate( 'Y', strtotime( $t['tarih'] ) );

$footer = function () use ( $s, $year ) {
	?>
	<table class="foot"><tr>
		<td class="fb">
			<div class="fbh"><?php echo esc_html( $s['firma_unvan'] ); ?> / Fatura Bilgileri</div>
			<div class="fbl"><b>V.N:</b><?php echo esc_html( $s['vergi_no'] ); ?></div>
			<div class="fbl"><b>T:</b> <?php echo esc_html( $s['telefon'] ); ?></div>
			<div class="fbl"><b>E:</b> <?php echo esc_html( $s['email'] ); ?></div>
			<div class="fbl"><b>w:</b> <?php echo esc_html( $s['web'] ); ?></div>
			<div class="fbl"><b>A:</b> <?php echo nl2br( esc_html( $s['adres'] ) ); ?></div>
		</td>
		<td class="tyw">
			<div class="ty">
				<div class="tyh">Sipariş Teyidi</div>
				<div class="tyd">Tarih: ..../...../<?php echo esc_html( $year ); ?></div>
				<div class="tyt"><?php echo esc_html( $s['teyit_metni'] ); ?><br><?php echo esc_html( $s['teyit_alt'] ); ?></div>
			</div>
		</td>
	</tr></table>
	<?php
};
$ek = function () use ( $t ) {
	if ( '' === trim( $t['ek_metin'] ) && '' === trim( $t['ek_baslik'] ) ) {
		return;
	}
	echo '<div class="ek' . ( $t['ek_yeni_sayfa'] ? ' np' : '' ) . '">';
	if ( $t['ek_baslik'] ) {
		echo '<div class="ekh">' . esc_html( $t['ek_baslik'] ) . '</div>';
	}
	echo '<div class="md">' . rego_markup( $t['ek_metin'] ) . '</div></div>'; // phpcs:ignore
};
?><!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8">
<style>
@font-face{font-family:'Mont';font-weight:normal;src:url('<?php echo esc_attr( $f ); ?>Montserrat-Medium.ttf') format('truetype')}
@font-face{font-family:'Mont';font-weight:bold;src:url('<?php echo esc_attr( $f ); ?>Montserrat-Bold.ttf') format('truetype')}
@font-face{font-family:'Merri';font-weight:normal;src:url('<?php echo esc_attr( $f ); ?>Merriweather-Regular.ttf') format('truetype')}
@font-face{font-family:'Merri';font-weight:bold;src:url('<?php echo esc_attr( $f ); ?>Merriweather-Bold.ttf') format('truetype')}
@page{margin:128pt 34pt 52pt 34pt}
body{font-family:'Merri','DejaVu Sans',serif;font-size:7.6pt;line-height:1.45;color:#111}
.bg{position:fixed;top:-128pt;left:-34pt;width:595.3pt;height:841.9pt;z-index:-1}
.logo{position:fixed;top:-96pt;left:13pt;width:132pt}
.title{position:fixed;top:-36pt;left:0;right:0;text-align:center;font-family:'Mont';font-weight:bold;font-size:10.5pt}
.info{width:100%;border-collapse:collapse;margin-top:10pt;font-family:'Mont';font-size:6.6pt;color:#555}
.info td{vertical-align:top;width:50%;padding:0}
.info .r{padding-left:62pt}
.info b{color:#555}
.info .ln{border-bottom:1pt solid #3d72e6;width:150pt;margin-top:2pt}
.hi{margin-top:12pt;font-size:7pt}
.hi b{display:block}
table.k{width:100%;border-collapse:collapse;margin-top:7pt;border:1.4pt solid #111;font-family:'Mont'}
table.k th{background:#d9d9d9;font-weight:bold;font-size:8pt;line-height:1.35;border:1.1pt solid #111;padding:9pt 3pt;text-align:center}
table.k td{border:1.1pt solid #111;padding:13pt 4pt;text-align:center;vertical-align:middle;font-size:6.7pt;line-height:1.4}
table.k tr{page-break-inside:avoid}
.kdv{font-size:5.9pt;margin-top:2pt}
.tot{text-align:right;font-family:'Mont';font-weight:bold;font-size:8pt;margin-top:4pt}
.kh{font-family:'Mont';font-weight:bold;font-size:10pt;margin:12pt 0 6pt 28pt;padding-bottom:3pt;border-bottom:1pt solid #3d72e6;width:105pt;padding-left:8pt;margin-left:20pt}
.ko{margin-left:17pt}
.kr{position:relative;padding-left:91pt;margin-bottom:3pt}
.kr .b{position:absolute;left:0;top:0;width:86pt;font-weight:bold}
.md p{margin:0 0 3pt 0}
.md ul{margin:0 0 1pt 0;padding-left:13pt}
.md ul.l1{list-style-type:disc}
.md ul.l2{list-style-type:circle;margin:0}
.md a{color:#1a4fb5;text-decoration:underline}
.md table.mt{width:100%;border-collapse:collapse;margin:6pt 0;font-size:7pt}
.md table.mt th,.md table.mt td{border:.8pt solid #333;padding:4pt;text-align:left;vertical-align:top}
.md table.mt th{background:#eee}
.ek{margin-top:16pt;margin-left:17pt;margin-right:8pt}
.ek.np{page-break-before:always;margin-top:0}
.ekh{font-weight:bold;text-align:center;font-size:9pt;margin-bottom:8pt}
table.foot{width:100%;border-collapse:collapse;margin-top:26pt;page-break-inside:avoid}
table.foot td{vertical-align:bottom;padding:0}
.fb{padding-left:2pt !important;font-family:'Mont'}
.fbh{color:#1a4fb5;font-weight:bold;font-size:10.5pt;margin-bottom:8pt}
.fbl{font-size:6.6pt;color:#555;line-height:1.55}
.fbl b{color:#555}
.tyw{width:215pt}
.ty{border:3pt solid #e2e2e2;border-radius:7pt;padding:14pt 18pt 6pt 18pt}
.tyh{font-weight:bold;font-size:7.6pt;text-align:center;padding-right:40pt}
.tyd{font-size:7.6pt;text-align:center;margin-top:5pt;padding-right:40pt}
.tyt{margin-top:42pt;font-size:5.9pt;line-height:1.45}
</style></head><body>
<img class="bg" src="<?php echo esc_attr( REGO_PANEL_DIR . 'pdf/page-bg.png' ); ?>">
<img class="logo" src="<?php echo esc_attr( REGO_PANEL_DIR . 'assets/logo.png' ); ?>">
<div class="title"><?php echo esc_html( $s['teklif_baslik'] ); ?></div>

<table class="info"><tr>
	<td>
		<div><b>Firma:</b> <?php echo esc_html( $t['firma'] ); ?></div>
		<div><b>İlgili Kişi:</b> <?php echo $dash( $t['kisi'] ); // phpcs:ignore ?></div>
		<div><b>E-Mail:</b> <?php echo $dash( $t['kisi_email'] ); // phpcs:ignore ?></div>
		<div><b>Tel:</b> <?php echo $dash( $t['kisi_tel'] ); // phpcs:ignore ?></div>
		<div class="ln"></div>
	</td>
	<td class="r">
		<div><b>Tarih:</b> <?php echo esc_html( rego_date_tr( $t['tarih'] ) ); ?></div>
		<div><b>Gönderen:</b> <?php echo $dash( $g['ad'] ); // phpcs:ignore ?></div>
		<div><b>E-Mail:</b> <?php echo $dash( $g['email'] ); // phpcs:ignore ?></div>
		<div><b>Tel:</b> <?php echo $dash( $g['tel'] ); // phpcs:ignore ?></div>
		<div class="ln"></div>
	</td>
</tr></table>

<div class="hi"><?php if ( $hitap ) : ?><b><?php echo esc_html( $hitap ); ?></b><?php endif; ?><?php echo esc_html( $s['giris_metni'] ); ?></div>

<table class="k">
	<thead><tr>
		<th style="width:10%">Sıra No</th><th style="width:21%">Ürün veya Hizmet</th><th style="width:11.5%">Miktar</th>
		<th style="width:10.5%">Birim</th><th style="width:14%">Birim Adet Fiyatı</th><th style="width:12%">Toplam Fiyat</th>
		<th style="width:10.5%">Para Birimi</th><th style="width:10.5%">Teslim Süresi</th>
	</tr></thead>
	<tbody>
	<?php foreach ( $t['kalemler'] as $i => $k ) : ?>
		<tr>
			<td><?php echo (int) $i + 1; ?></td>
			<td><?php echo nl2br( esc_html( $k['ad'] ) ); ?></td>
			<td><?php echo esc_html( rego_num( $k['miktar'] ) ); ?></td>
			<td><?php echo esc_html( $k['birim'] ); ?></td>
			<td><?php echo esc_html( rego_num( $k['fiyat'] ) ); ?></td>
			<td><?php echo esc_html( rego_num( $k['miktar'] * $k['fiyat'] ) ); ?></td>
			<td><?php echo esc_html( $k['para'] ); ?></td>
			<td><?php echo esc_html( $k['teslim'] ); ?></td>
		</tr>
	<?php endforeach; ?>
	</tbody>
</table>
<div class="kdv"><?php echo esc_html( $s['kdv_notu'] ); ?></div>
<?php if ( $t['toplam_goster'] && $t['toplamlar'] ) : ?>
	<div class="tot">Toplam (KDV hariç):
		<?php echo esc_html( implode( '  +  ', array_map( function ( $p, $v ) { return rego_num( $v ) . ' ' . $p; }, array_keys( $t['toplamlar'] ), $t['toplamlar'] ) ) ); ?>
	</div>
<?php endif; ?>

<?php if ( $t['kosullar'] ) : ?>
	<div class="kh">Teklif Koşulları</div>
	<div class="ko">
	<?php foreach ( $t['kosullar'] as $k ) : ?>
		<div class="kr"><div class="b"><?php echo esc_html( $k['baslik'] ); ?></div><div class="md"><?php echo rego_markup( $k['metin'] ); // phpcs:ignore ?></div></div>
	<?php endforeach; ?>
	</div>
<?php endif; ?>

<?php
if ( $t['ek_yeni_sayfa'] ) {
	$footer();
	$ek();
} else {
	$ek();
	$footer();
}
?>
</body></html>
