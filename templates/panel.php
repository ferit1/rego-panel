<?php
/** Standalone Rego Panel page: login screen or the app shell. */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
nocache_headers();
$user   = wp_get_current_user();
$logged = $user->exists();
$access = $logged && current_user_can( 'rego_access' );
$ver    = REGO_PANEL_VERSION . '.' . filemtime( REGO_PANEL_DIR . 'assets/panel.js' );
$giris  = isset( $_GET['giris'] ) ? sanitize_key( $_GET['giris'] ) : ''; // phpcs:ignore
$msg    = array(
	'hata'  => 'Kullanıcı adı/e-posta veya şifre hatalı.',
	'pasif' => 'Hesabınız pasif durumda. Yöneticinizle görüşün.',
	'sure'  => 'Oturum süresi doldu, lütfen tekrar deneyin.',
);
?><!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Rego Panel</title>
<link rel="icon" href="<?php echo esc_url( REGO_PANEL_URL . 'assets/icon.png' ); ?>">
<link rel="stylesheet" href="<?php echo esc_url( REGO_PANEL_URL . 'assets/panel.css?v=' . $ver ); ?>">
</head>
<body>
<?php if ( ! $access ) : ?>
	<main class="auth">
		<div class="auth-card">
			<img class="auth-logo" src="<?php echo esc_url( REGO_PANEL_URL . 'assets/logo.png' ); ?>" alt="Rego Technology">
			<?php if ( $logged ) : ?>
				<h1>Erişim yok</h1>
				<p class="sub">Bu hesabın Rego Panel’e erişim yetkisi yok. Yöneticinizden rol atamasını isteyin.</p>
				<a class="btn" href="<?php echo esc_url( wp_logout_url( rego_panel_url() ) ); ?>">Çıkış yap</a>
			<?php else : ?>
				<h1>Panele giriş</h1>
				<p class="sub">Müşteri, proje ve teklif yönetimi</p>
				<?php if ( isset( $msg[ $giris ] ) ) : ?>
					<div class="alert" role="alert"><?php echo esc_html( $msg[ $giris ] ); ?></div>
				<?php endif; ?>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="auth-form">
					<input type="hidden" name="action" value="rego_giris">
					<?php wp_nonce_field( 'rego_giris' ); ?>
					<label class="f" for="log">E-posta veya kullanıcı adı<input id="log" name="log" type="text" autocomplete="username" required autofocus></label>
					<label class="f" for="pwd">Şifre<input id="pwd" name="pwd" type="password" autocomplete="current-password" required></label>
					<label class="chk" for="rememberme"><input id="rememberme" name="rememberme" type="checkbox" value="1" checked> Beni hatırla</label>
					<button class="btn primary block" type="submit">Giriş yap</button>
				</form>
				<a class="auth-link" href="<?php echo esc_url( wp_lostpassword_url( rego_panel_url() ) ); ?>">Şifremi unuttum</a>
			<?php endif; ?>
		</div>
	</main>
<?php else : ?>
	<div id="app" class="app-loading"><div class="loader">Panel yükleniyor…</div></div>
	<script>
	window.REGO = <?php echo wp_json_encode( array(
		'api'   => esc_url_raw( rest_url( 'rego/v1/' ) ),
		'nonce' => wp_create_nonce( 'wp_rest' ),
		'logo'  => REGO_PANEL_URL . 'assets/logo.png',
		'home'  => home_url( '/' ),
	) ); ?>;
	</script>
	<script src="<?php echo esc_url( REGO_PANEL_URL . 'assets/panel.js?v=' . $ver ); ?>"></script>
<?php endif; ?>
</body>
</html>
