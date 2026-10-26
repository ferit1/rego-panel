<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Capability set per panel role. */
function rego_panel_role_caps() {
	$all = array(
		'rego_access', 'rego_finans', 'rego_musteri_edit', 'rego_teklif', 'rego_fatura',
		'rego_proje_edit', 'rego_saha_edit', 'rego_ayarlar', 'rego_kullanici', 'rego_sil', 'rego_kasa',
	);
	return array(
		'rego_yonetici' => array( 'label' => 'Rego Yönetici', 'caps' => $all ),
		'rego_satis'    => array( 'label' => 'Rego Satış', 'caps' => array( 'rego_access', 'rego_finans', 'rego_musteri_edit', 'rego_teklif', 'rego_fatura' ) ),
		'rego_saha'     => array( 'label' => 'Rego Saha Ekibi', 'caps' => array( 'rego_access', 'rego_proje_edit', 'rego_saha_edit' ) ),
	);
}

function rego_panel_install_roles() {
	$defs = rego_panel_role_caps();
	foreach ( $defs as $role => $def ) {
		remove_role( $role );
		$caps = array( 'read' => true );
		foreach ( $def['caps'] as $c ) {
			$caps[ $c ] = true;
		}
		add_role( $role, $def['label'], $caps );
	}
	// Site administrators get full access to the panel.
	$admin = get_role( 'administrator' );
	if ( $admin ) {
		foreach ( $defs['rego_yonetici']['caps'] as $c ) {
			$admin->add_cap( $c );
		}
	}
}

function rego_panel_install_tables() {
	global $wpdb;
	require_once ABSPATH . 'wp-admin/includes/upgrade.php';
	$c = $wpdb->get_charset_collate();
	$p = $wpdb->prefix . 'rego_';

	dbDelta( "CREATE TABLE {$p}musteri (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		firma varchar(190) NOT NULL,
		kisi varchar(190) NOT NULL DEFAULT '',
		hitap varchar(20) NOT NULL DEFAULT 'Bey',
		email varchar(190) NOT NULL DEFAULT '',
		tel varchar(60) NOT NULL DEFAULT '',
		sehir varchar(120) NOT NULL DEFAULT '',
		sektor varchar(120) NOT NULL DEFAULT '',
		notlar text NULL,
		created_at datetime NOT NULL,
		created_by bigint(20) unsigned NOT NULL DEFAULT 0,
		PRIMARY KEY  (id),
		KEY firma (firma)
	) $c;" );

	dbDelta( "CREATE TABLE {$p}kisi (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		musteri_id bigint(20) unsigned NOT NULL,
		ad varchar(190) NOT NULL DEFAULT '',
		hitap varchar(20) NOT NULL DEFAULT 'Bey',
		gorev varchar(60) NOT NULL DEFAULT '',
		email varchar(190) NOT NULL DEFAULT '',
		tel varchar(60) NOT NULL DEFAULT '',
		sira int(11) NOT NULL DEFAULT 0,
		created_at datetime NOT NULL,
		PRIMARY KEY  (id),
		KEY musteri_id (musteri_id)
	) $c;" );

	dbDelta( "CREATE TABLE {$p}kargo (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		yon varchar(10) NOT NULL DEFAULT 'gelen',
		musteri_id bigint(20) unsigned NOT NULL DEFAULT 0,
		proje_id bigint(20) unsigned NOT NULL DEFAULT 0,
		karsi varchar(190) NOT NULL DEFAULT '',
		icerik varchar(255) NOT NULL DEFAULT '',
		kargo_firma varchar(60) NOT NULL DEFAULT '',
		takip_no varchar(80) NOT NULL DEFAULT '',
		tarih date NULL,
		durum varchar(20) NOT NULL DEFAULT 'bekliyor',
		teslim_tarihi date NULL,
		teslim_yeri varchar(120) NOT NULL DEFAULT '',
		teslim_kisi varchar(120) NOT NULL DEFAULT '',
		ucret decimal(14,2) NOT NULL DEFAULT 0,
		odeme varchar(20) NOT NULL DEFAULT '',
		notlar text NULL,
		created_at datetime NOT NULL,
		created_by bigint(20) unsigned NOT NULL DEFAULT 0,
		PRIMARY KEY  (id),
		KEY durum (durum)
	) $c;" );

	dbDelta( "CREATE TABLE {$p}proje (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		kod varchar(40) NOT NULL,
		musteri_id bigint(20) unsigned NOT NULL DEFAULT 0,
		teklif_id bigint(20) unsigned NOT NULL DEFAULT 0,
		ad varchar(255) NOT NULL,
		hizmet varchar(60) NOT NULL DEFAULT '',
		asama varchar(20) NOT NULL DEFAULT 'onay',
		teslim date NULL,
		notlar text NULL,
		created_at datetime NOT NULL,
		PRIMARY KEY  (id),
		KEY musteri_id (musteri_id)
	) $c;" );

	dbDelta( "CREATE TABLE {$p}teklif (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		no varchar(40) NOT NULL,
		musteri_id bigint(20) unsigned NOT NULL DEFAULT 0,
		firma varchar(190) NOT NULL DEFAULT '',
		kisi varchar(190) NOT NULL DEFAULT '',
		kisi_email varchar(190) NOT NULL DEFAULT '',
		kisi_tel varchar(60) NOT NULL DEFAULT '',
		hitap varchar(255) NOT NULL DEFAULT '',
		tarih date NOT NULL,
		gonderen_id bigint(20) unsigned NOT NULL DEFAULT 0,
		gonderen_ad varchar(190) NOT NULL DEFAULT '',
		gonderen_email varchar(190) NOT NULL DEFAULT '',
		gonderen_tel varchar(60) NOT NULL DEFAULT '',
		durum varchar(20) NOT NULL DEFAULT 'taslak',
		kalemler longtext NULL,
		kosullar longtext NULL,
		ek_baslik varchar(255) NOT NULL DEFAULT '',
		ek_metin longtext NULL,
		kisiler longtext NULL,
		gorseller longtext NULL,
		ek_yeni_sayfa tinyint(1) NOT NULL DEFAULT 0,
		toplam_goster tinyint(1) NOT NULL DEFAULT 0,
		created_at datetime NOT NULL,
		updated_at datetime NOT NULL,
		PRIMARY KEY  (id),
		UNIQUE KEY no (no),
		KEY musteri_id (musteri_id)
	) $c;" );

	dbDelta( "CREATE TABLE {$p}fatura (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		no varchar(60) NOT NULL DEFAULT '',
		musteri_id bigint(20) unsigned NOT NULL DEFAULT 0,
		teklif_id bigint(20) unsigned NOT NULL DEFAULT 0,
		tarih date NOT NULL,
		vade date NULL,
		tutar decimal(14,2) NOT NULL DEFAULT 0,
		para varchar(8) NOT NULL DEFAULT '₺',
		odendi tinyint(1) NOT NULL DEFAULT 0,
		odeme_tarihi date NULL,
		notlar text NULL,
		created_at datetime NOT NULL,
		PRIMARY KEY  (id),
		KEY musteri_id (musteri_id)
	) $c;" );

	dbDelta( "CREATE TABLE {$p}hareket (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		tur varchar(10) NOT NULL DEFAULT 'gider',
		tarih date NOT NULL,
		tutar decimal(14,2) NOT NULL DEFAULT 0,
		para varchar(8) NOT NULL DEFAULT '₺',
		kategori varchar(120) NOT NULL DEFAULT '',
		aciklama varchar(255) NOT NULL DEFAULT '',
		musteri_id bigint(20) unsigned NOT NULL DEFAULT 0,
		hesap varchar(60) NOT NULL DEFAULT '',
		durum varchar(20) NOT NULL DEFAULT 'odendi',
		odeme_tarihi date NULL,
		tekrar varchar(10) NOT NULL DEFAULT 'yok',
		sonraki_id bigint(20) unsigned NOT NULL DEFAULT 0,
		notlar text NULL,
		created_at datetime NOT NULL,
		created_by bigint(20) unsigned NOT NULL DEFAULT 0,
		PRIMARY KEY  (id),
		KEY tarih (tarih)
	) $c;" );

	dbDelta( "CREATE TABLE {$p}saha (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		tarih date NOT NULL,
		saat varchar(5) NOT NULL DEFAULT '',
		musteri_id bigint(20) unsigned NOT NULL DEFAULT 0,
		proje_id bigint(20) unsigned NOT NULL DEFAULT 0,
		konum varchar(190) NOT NULL DEFAULT '',
		is_tanimi varchar(255) NOT NULL DEFAULT '',
		ekip varchar(255) NOT NULL DEFAULT '',
		durum varchar(20) NOT NULL DEFAULT 'planli',
		created_at datetime NOT NULL,
		PRIMARY KEY  (id),
		KEY tarih (tarih)
	) $c;" );
}

/** Default company info, quote texts and term templates (from Rego's own quote forms). */
function rego_panel_default_settings() {
	$sertifika = 'https://www.regotechnology.com';
	return array(
		'firma_unvan'    => 'Rego Technology',
		'vergi_no'       => '67117188908',
		'telefon'        => '0850 242 4263',
		'email'          => 'info@regotechnology.com',
		'web'            => 'www.regotechnology.com',
		'adres'          => "Tabakhane mah. Mehmet Akif Ersoy Cad. No:53/A 54200,\nErenler/Sakarya",
		'teklif_baslik'  => 'Mühendislik Hizmetleri Teklif Formu',
		'teklif_onek'    => 'RT',
		'giris_metni'    => 'Teklif isteğiniz için teşekkür ederiz. Talep, istek ve bilgi almak isterseniz bizimle iletişime geçebilirsiniz. Değerli siparişlerinizi bekler, iyi çalışmalar dileriz.',
		'kdv_notu'       => "*Birim fiyatlarına KDV dahil değildir. Uygulanacak KDV oranı %20'dir.",
		'teyit_metni'    => 'Teklif formu dahilinde verilen ürün, fiyat ve adetleri onayladığımızı, Teklif Koşullarının tarafımızca okunduğunu ve kabul edildiğini beyan ederiz.',
		'teyit_alt'      => 'Yetkili kişi imzası varsa kaşe',
		'wa_aktif'       => 0,
		'wa_phone_id'    => '',
		'wa_token'       => '',
		'wa_sablon'      => 'rego_hatirlatma',
		'wa_dil'         => 'tr',
		'wa_surum'       => 'v24.0',
		'hazirlayanlar'  => array(
			array( 'ad' => 'Ferit ÖZEN', 'email' => 'ferit@regotechnology.com', 'tel' => '+90 542 430 5866' ),
			array( 'ad' => 'Kübra BOZKURT', 'email' => '', 'tel' => '' ),
		),
		'gider_kategorileri' => array( 'Kira', 'Maaş', 'SGK / Vergi', 'Elektrik, su, doğalgaz', 'İnternet ve telefon', 'Yakıt ve yol', 'Malzeme', 'Yazılım ve lisans', 'Bakım ve onarım', 'Diğer' ),
		'gelir_kategorileri' => array( 'Hizmet bedeli', 'Cihaz satışı', 'Eğitim', 'Diğer' ),
		'hesaplar'       => array( 'Banka', 'Nakit', 'Kredi kartı' ),
		'gorevler'       => array( 'Satın alma', 'Patron / Genel müdür', 'Ar-Ge', 'Kalite', 'Üretim', 'Teknik / Mühendislik', 'Diğer' ),
		'kargo_firmalari' => array( 'Yurtiçi Kargo', 'Aras Kargo', 'MNG Kargo', 'PTT Kargo', 'Sürat Kargo', 'DHL', 'UPS', 'Kurye', 'Elden' ),
		'birimler'       => array( 'Adet', 'Gün', 'Saat', 'Parça', 'Set', 'Lisans', 'Ay' ),
		'hizmetler'      => array( '3D Tarama', 'Tersine Mühendislik', 'Kalite Kontrol', 'CNC İşleme', 'Cihaz / Yazılım Satışı', 'Eğitim' ),
		'sablonlar'      => array(
			array(
				'ad'       => 'Tarama ve tersine mühendislik hizmeti',
				'kosullar' => array(
					array( 'baslik' => 'Ödeme Şartları', 'metin' => 'Sipariş olması durumunda ödeme sipariş tesliminden sonra, belirtilen hesaplara peşin olarak yapılacaktır.' ),
					array( 'baslik' => 'Teslim Süresi', 'metin' => 'Öngörülen teslim tarihleri teklifimizde belirtilmiştir.' ),
					array( 'baslik' => 'Dataların Teslimi', 'metin' => 'Gönderilecek dataların 3D tasarımları STEP, IGES veya PARASOLID olarak gönderilir.' ),
					array( 'baslik' => 'Önemli Notlar', 'metin' => "Verilen teklif fiyatları; parçaların yerinde taranması ve tasarım hizmetini kapsamaktadır.\nYerinde tarama için sadece elektrik bağlantısı (220V) istenilmektedir.\nLazer tarama cihazımızın hassasiyeti 0.02mm’dir.\nCihazımıza ait sertifikasyonlara [buradan]($sertifika) ulaşabilirsiniz." ),
				),
				'ek_baslik' => '', 'ek_metin' => '', 'ek_yeni_sayfa' => 0,
			),
			array(
				'ad'       => 'Cihaz, yazılım satışı ve eğitim',
				'kosullar' => array(
					array( 'baslik' => 'Ödeme Şartları', 'metin' => 'Sipariş olması durumunda ödeme sipariş ile, belirtilen hesaplara peşin olarak yapılacaktır.' ),
					array( 'baslik' => 'Teslim Süresi', 'metin' => 'Öngörülen teslim tarihleri teklifimizde belirtilmiştir.' ),
					array( 'baslik' => 'Önemli Notlar', 'metin' => "- Bu teklif kapsamında müşteriye aşağıdaki hizmetler eksiksiz olarak sağlanacaktır:\n- 3D Tarayıcı Teslimatı ve Kurulumu\n  - Belirlenen 3D tarama cihazının teslimatı yapılacaktır.\n  - Cihazın bilgisayar bağlantıları ve gerekli kurulum işlemleri gerçekleştirilecektir.\n  - Tarama için gerekli aksesuarlar ve temel kullanım bilgileri aktarılacaktır.\n- 3D Tarama Eğitimi\n  - Tarayıcının çalışma prensipleri anlatılacaktır.\n  - Doğru tarama teknikleri uygulamalı olarak gösterilecektir.\n  - Marker kullanımı, tarama açılarının belirlenmesi ve veri toplama süreçleri öğretilecektir.\n  - Tarama sırasında karşılaşılabilecek hatalar ve çözüm yöntemleri aktarılacaktır.\n- Yazılım Kurulumu ve Konfigürasyonu\n  - Tarama yazılımının kurulumu gerçekleştirilecektir.\n  - Lisans aktivasyon işlemleri yapılacaktır.\n  - Yazılım ayarları kullanım senaryolarına uygun şekilde yapılandırılacaktır.\n- Parça Tarama Uygulamaları\n  - Örnek parçalar üzerinde uygulamalı tarama çalışmaları yapılacaktır.\n  - Büyük ve karmaşık yüzeylerin nasıl taranacağı gösterilecektir.\n  - Tarama verilerinin düzenlenmesi ve temizlenmesi öğretilecektir.\n- Tersine Mühendislik Eğitimi\n  - Tarama verilerinden CAD model oluşturma süreçleri anlatılacaktır.\n  - Nokta bulutu ve mesh verilerinin işlenmesi gösterilecektir.\n  - Yüzey modelleme ve katı model oluşturma yöntemleri öğretilecektir.\n  - Örnek parçaların yeniden modellenmesi uygulamalı olarak gerçekleştirilecektir.\n- Uygulamalı Proje Çalışması\n  - Firmanın seçtiği örnek bir parçanın tarama ve tasarım süreci baştan sona birlikte gerçekleştirilecektir.\n  - 2D ve 3D çizimler yapılacaktır.\n- Teknik Destek\n  - Eğitim sonrasında belirlenen süre (1 ay) boyunca uzaktan teknik destek sağlanacaktır.\n  - Yazılım ve cihaz kullanımı ile ilgili temel sorulara destek verilecektir." ),
				),
				'ek_baslik' => '',
				'ek_metin'  => 'Amaç: Firmanın 3D tarama, veri işleme ve tersine mühendislik süreçlerini kendi bünyesinde bağımsız olarak yürütebilmesi ve tasarımlarını dijital ortama aktararak sahip oldukları data ile üretim süreçlerinde kullanabilmesidir.',
				'ek_yeni_sayfa' => 0,
			),
			array(
				'ad'       => 'Çok parçalı proje (ek parça ve gruplandırma)',
				'kosullar' => array(
					array( 'baslik' => 'Ödeme Şartları', 'metin' => 'Sipariş olması durumunda ödeme sipariş tesliminden sonra, belirtilen hesaplara peşin olarak yapılacaktır.' ),
					array( 'baslik' => 'Teslim Süresi', 'metin' => 'Öngörülen teslim tarihleri teklifimizde belirtilmiştir.' ),
					array( 'baslik' => 'Dataların Teslimi', 'metin' => 'Gönderilecek dataların 3D tasarımları STEP uzantı olarak gönderilir. Ayrıca talep edilmesi durumunda IGES, PARASOLID olarak da gönderilebilir. Teknik resimler PDF formatta teslim edilir.' ),
					array( 'baslik' => 'Önemli Notlar', 'metin' => "Verilen teklif fiyatları; parçaların taranması, tasarlanması ve teknik resmi oluşturma hizmetini kapsamaktadır.\nLazer tarama cihazımızın hassasiyeti 0.02mm’dir.\nCihazımıza ait sertifikasyonlara [buradan]($sertifika) ulaşabilirsiniz.\nEk parça durumu: Proje kapsamına sonradan parça eklenmesi halinde:\n  - Her ek parça için birim fiyat: [250] € + KDV (aynı fiyat geçerli)\n  - Ek parçalar için süre: her [5] parça için [2] iş günü ilave edilir (veya: ek parça adedine göre takvim güncellenir)\n  - Ek parçalar, ana teslimat takvimini etkilemeyecek şekilde ayrı bir teslim planıyla ya da ana işler bittikten sonra teslim edilebilir." ),
				),
				'ek_baslik' => 'Parça Gruplandırma ve Fiyatlandırma Ölçütleri',
				'ek_metin'  => "Parçalar, işin teknik özelliklerine göre üç gruba ayrılmıştır. Bu ayrım, her parçanın fiyatının ve teslim süresinin şeffaf ve tutarlı şekilde belirlenmesini sağlar. Gruplandırma ölçütleri (işlem sayısı, tolerans, malzeme ve fikstür ihtiyacı) önceden tanımlandığı için, sonradan ek parça geldiğinde ya da iş kapsamı değiştiğinde aynı ölçütlerle yeniden değerlendirme yapılabilir.\n\nParçaları işin özelliğine göre üç gruba ayırıyoruz:\n- Grup 1: Tek işlemle tamamlanan, standart malzemeden yapılan ve geniş toleranslı parçalar.\n- Grup 2: Birden fazla işlem gerektiren veya daha hassas ölçü istenen parçalar.\n- Grup 3: Özel fikstür veya kalıp gerektiren, dar toleranslı ya da zor malzemeden üretilen parçalar.\n\n**Grup 1 (Basit)**\n- Tipik işlemler: düz kesim, temel delik açma, kılavuz çekme, basit taşlama\n- Tolerans aralığı: örneğin ±0,2 mm ve üzeri\n- Malzeme: standart çelik, alüminyum, plastik gibi kolay işlenebilen malzemeler\n- Fikstür: standart bağlama aparatı yeterli, özel fikstür gerekmez\n\n**Grup 2 (Orta)**\n- Tipik işlemler: birden fazla yüzeyin işlenmesi, kademeli delikler, frezeleme ve tornalama kombinasyonu\n- Tolerans aralığı: örneğin ±0,05 ila ±0,2 mm arası\n- Malzeme: genellikle standart malzeme, ancak bazı durumlarda daha sert alaşımlar\n- Fikstür: standart fikstür kullanılabilir, gerekirse basit bir bağlama aparatı üretilir\n\n**Grup 3 (Karmaşık)**\n- Tipik işlemler: çok aşamalı üretim, özel yüzey geometrileri, dar açılı ya da derin cepler\n- Tolerans aralığı: örneğin ±0,05 mm ve altı\n- Malzeme: paslanmaz çelik, titanyum gibi zor işlenen malzemeler veya ısıl işlem gerektiren parçalar\n- Fikstür: özel fikstür veya kalıp üretimi gerekir, bu süreye ve maliyete ayrıca yansır\n\n| Grup | Tanım | Tolerans | Birim fiyat aralığı (€) | Termin süresi (iş günü) |\n| Grup 1: Basit | Tek işlem, standart malzeme, standart bağlama | ±0,2 mm ve üzeri | [100] – [200] | [2] – [3] |\n| Grup 2: Orta | Birden fazla işlem, kademeli ölçüler, basit aparat | ±0,05 – ±0,2 mm | [200] – [350] | [2] – [5] |\n| Grup 3: Karmaşık | Çok aşamalı, özel fikstür/kalıp, zor malzeme | ±0,05 mm ve altı | [350] – [500] | [2] – [7] |",
				'ek_yeni_sayfa' => 1,
			),
		),
	);
}

function rego_panel_create_page() {
	$id = (int) get_option( 'rego_panel_page_id' );
	if ( $id && get_post_status( $id ) ) {
		return;
	}
	$existing = get_page_by_path( 'panel' );
	$slug     = $existing ? 'rego-panel' : 'panel';
	$id       = wp_insert_post( array(
		'post_title'   => 'Rego Panel',
		'post_name'    => $slug,
		'post_content' => '[rego_panel]',
		'post_status'  => 'publish',
		'post_type'    => 'page',
	) );
	if ( $id && ! is_wp_error( $id ) ) {
		update_option( 'rego_panel_page_id', $id );
	}
}

function rego_panel_activate() {
	rego_panel_install_tables();
	if ( function_exists( 'rego_hat_tables' ) ) {
		rego_hat_tables();
	}
	rego_panel_install_roles();
	if ( ! get_option( 'rego_panel_settings' ) ) {
		add_option( 'rego_panel_settings', rego_panel_default_settings(), '', false );
	}
	rego_panel_create_page();
	rego_panel_migrate_v5();
	update_option( 'rego_panel_db_version', REGO_PANEL_DB_VERSION );
}

function rego_panel_deactivate() {
	// Data and roles are kept; nothing to clean up on deactivation.
}

function rego_panel_maybe_upgrade() {
	if ( get_option( 'rego_panel_db_version' ) !== REGO_PANEL_DB_VERSION ) {
		rego_panel_activate();
	}
}

/** v5: one contact row per existing customer contact; company itself is no longer a quote sender. */
function rego_panel_migrate_v5() {
	global $wpdb;
	$k = $wpdb->prefix . 'rego_kisi';
	$m = $wpdb->prefix . 'rego_musteri';
	$rows = $wpdb->get_results( "SELECT id, kisi, hitap, email, tel FROM $m WHERE kisi <> ''", ARRAY_A ); // phpcs:ignore
	foreach ( (array) $rows as $r ) {
		$has = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $k WHERE musteri_id = %d", $r['id'] ) ); // phpcs:ignore
		if ( ! $has ) {
			$wpdb->insert( $k, array( 'musteri_id' => $r['id'], 'ad' => $r['kisi'], 'hitap' => $r['hitap'] ? $r['hitap'] : 'Bey', 'email' => $r['email'], 'tel' => $r['tel'], 'created_at' => current_time( 'mysql' ) ) );
		}
	}
	$s = get_option( 'rego_panel_settings' );
	if ( is_array( $s ) && ! empty( $s['hazirlayanlar'] ) ) {
		$s['hazirlayanlar'] = array_values( array_filter( $s['hazirlayanlar'], function ( $h ) {
			return 'rego technology' !== mb_strtolower( trim( $h['ad'] ?? '' ) );
		} ) );
		update_option( 'rego_panel_settings', $s, false );
	}
}
