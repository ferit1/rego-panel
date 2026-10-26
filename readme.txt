=== Rego Panel ===
Requires at least: 6.0
Requires PHP: 7.4
Stable tag: 1.5.0
License: GPLv2 or later

Rego Technology için müşteri, fiyat teklifi (PDF), proje, tahsilat ve saha randevusu paneli.

== Kurulum ==
1. WordPress yönetiminde Eklentiler > Yeni Ekle > Eklenti Yükle'den rego-panel.zip dosyasını yükleyin ve etkinleştirin.
2. Etkinleştirince "Rego Panel" adında bir sayfa açılır (adres: siteniz/panel, bu adres doluysa siteniz/rego-panel).
3. Bu sayfayı açın; WordPress yönetici hesabınızla giriş yaptığınızda panel açılır.
4. Panelde sağ üstteki adınıza tıklayıp Profilim'den telefonunuzu girin (tekliflerde "Gönderen" bölümünde çıkar).
5. Kullanıcılar ekranından ekip arkadaşlarınızı ekleyin; şifre belirleme e-postası gider.

== Roller ==
* Yönetici: her şey (kullanıcılar, ayarlar, silme dahil).
* Satış: müşteri, teklif + PDF, tahsilat kayıtları. Proje ve sahayı görür.
* Saha ekibi: projeleri ilerletir, saha randevularını yönetir. Fiyat ve tahsilat görmez.
Site yöneticileri (administrator) panelde otomatik olarak tam yetkilidir.

== Notlar ==
* Veriler sitenizin veritabanında wp_rego_* tablolarında tutulur. Eklentiyi devre dışı bırakmak veriyi silmez.
* PDF, eklentiyle gelen dompdf kütüphanesiyle sunucuda üretilir; ek kurulum gerekmez.
  Yazı tipi önbelleği wp-content/uploads/rego-panel-fonts klasörüne yazılır.
* Bir önbellek eklentisi (LiteSpeed, WP Rocket vb.) kullanıyorsanız panel sayfasını önbellek dışında bırakın.
* Yeni kullanıcı davetlerinin gitmesi için sitenizin e-posta gönderebiliyor olması gerekir (gerekirse bir SMTP eklentisi).

== Üçüncü taraf ==
dompdf 3.0.0 (LGPL-2.1), php-font-lib, php-svg-lib, html5-php, PHP-CSS-Parser (MIT/LGPL),
Montserrat ve Merriweather yazı tipleri (SIL Open Font License).
