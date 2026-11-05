# Rego Panel: devir notu (yeni bir Claude sohbetine başlarken okuyun)

Bu dosya, Rego Panel üzerinde başka bir Claude hesabında ya da yeni bir sohbette kaldığımız yerden devam edebilmek için yazıldı. Yeni sohbete bu dosyayı ekleyin (ya da GitHub bağlantısını verin) ve “Bu projeye devam ediyoruz” deyin.

## Proje nedir

- **Firma:** Rego Technology (Sakarya). 3D tarama, tersine mühendislik, kalite kontrol, CNC, 3D baskı, cihaz satışı ve eğitim işleri yapıyor.
- **Site:** https://www.regotechnology.com (WordPress, Astra + Elementor)
- **Panel adresi:** https://www.regotechnology.com/panel
- **Kod:** https://github.com/ferit1/rego-panel (herkese açık depo, `main` dalı)
- **Panel:** Bir WordPress eklentisi. ofisiniyonet.com benzeri, ürün/stok kısmı olmayan sade bir iş yönetim paneli.
- **Kullanıcılar:** Ferit ÖZEN ve Kübra BOZKURT. “Hazırlayan” listesinde sadece bu ikisi var, “Rego Technology” diye bir hazırlayan yok.
- **e-Fatura:** Ayrı bir sistemde tutuluyor. Panele e-Fatura **eklenmeyecek**.

## Paneldeki bölümler

- **Giriş ve roller:** Yönetici, Satış ve Saha ekibi rolleri var.
- **Müşteriler:** Bir firmaya birden çok kişi eklenebilir. Her kişinin bir görevi olur (Satın alma, Patron, Ar-Ge, Kalite…). Seçim kutularından doğrudan “+ Yeni müşteri” eklenebilir.
- **Fiyat teklifi:** PDF çıktısı, firmanın Canva'daki “Mühendislik Hizmetleri Teklif Formu” ile birebir aynı görünümde. Teklif ekranında şunlar var:
  - Birden çok kişi, görseller (PDF'te ikişer ikişer basılır), hazır kalem kataloğu ve “Diğer” seçeneği.
  - Birimler: Adet, Gün, Saat.
  - Koşul şablonları. Kalite kontrol şablonu da bunların içinde.
  - KDV notu: “Uygulanacak KDV oranı 20'dir.” (yüzde işareti yok).
  - **Kaşe ve imza:** Teklifte “PDF'in altına kaşe ve imza ekle” kutucuğu işaretlenirse kaşe basılır. Kaşe, Fatura Bilgileri ile Sipariş Teyidi kutusunun arasına küçük olarak basılır; diğer yazıları kaydırmaz. Görsel Ayarlar → Kaşe ve imza bölümünden yüklenir ya da döndürülür. Varsayılan görsel `assets/kase.png` (imzalı kaşe).
- **Projeler:** Trello tarzı pano. Aşamalar: Onay bekliyor → Onaylandı → Taramada → Modelleme / Rapor → Teslim edildi. Kartlar sürüklenip bırakılabilir; telefonda basılı tutup sürüklenir.
- **Finans:** Faturalar, faturasız gelirler ve giderler. Kira gibi kalemler her ay tekrarlanabilir.
- **Saha:** Firmaya gidilecek tarama randevuları.
- **Kargo:** Gelen ve giden kargolar; kimden, nerede ve ne zaman teslim alındı.
- **Ana panel takvimi:** Bir günün üzerine gelince kısa önizleme çıkar, tıklayınca ilgili kayda gider.
- **Hatırlatmalar:** Panel içi bildirim zili var. Resmi WhatsApp altyapısı (Meta Cloud API, 0850 hattı) hazır ama henüz kurulmadı; kullanıcı “sonra yaparız” dedi.
- **/sunum sayfası koruması:** Sayfa şifreyle açılıyor. 30 dakika geçince ya da sekme kapanınca şifre yeniden sorulur. Tarayıcı şifreyi kaydetmeyi önermez.
- **Tek tık güncelleme:** Panelde Ayarlar → Güncellemeleri denetle → Şimdi güncelle.

## Teknik yapı

- **PHP:** `rego-panel.php` (sürüm ve DB sürümü burada), `includes/`:
  - `install.php`: tablolar, roller, varsayılan ayarlar ve `migrate_vN` geçişleri
  - `rest.php`: REST API, ad alanı `rego/v1`
  - `helpers.php`: `rego_text`, `rego_markup`, `rego_kdv_notu`, `rego_kase_*`
  - `pdf.php` ve `pdf/template.php`: dompdf 3.0 (`vendor/` içinde), Montserrat ve Merriweather yazı tipleri
  - `updater.php`: GitHub'dan kendi kendini güncelleme
  - `sunum-koruma.php`, `hatirlatma.php`
- **Arayüz:** `assets/panel.js` (tek dosyalık JS uygulaması, hash yönlendirme, `data-bind`) ve `assets/panel.css`. Sayfa şablonu `templates/panel.php`.
- **Önemli kurallar:**
  - WordPress'in `sanitize_text_field` fonksiyonu “%20” gibi dizileri siliyor. Bu yüzden onun yerine `rego_text` / `rego_textarea` kullanılıyor.
  - WhatsApp erişim anahtarı tarayıcıya hiçbir zaman gönderilmez.
  - “Kaydedilmemiş değişiklikler” uyarısı, formun yüklendiği ya da kaydedildiği andaki kopyasıyla karşılaştırılarak gösterilir (`snap()` / `isDirty()`).

## Yeni sürüm yayınlama (güncelleme nasıl gider)

1. Kodu değiştirin. `rego-panel.php` içinde `Version` ve `REGO_PANEL_VERSION` değerini artırın. Veritabanı değişikliği varsa `REGO_PANEL_DB_VERSION` değerini de artırın ve `install.php` içine yeni bir `migrate_vN` ekleyin.
2. Değişikliği commit edip `main` dalına gönderin. Bu commit'in SHA değerini not edin.
3. `update.json` dosyasını güncelleyin:
   ```json
   { "version": "1.8.4",
     "package": "https://github.com/ferit1/rego-panel/archive/<KOD-COMMIT-SHA>.zip",
     "notes": "Ne değişti…", "date": "YYYY-MM-DD" }
   ```
   Bunu commit edip `main` dalına gönderin. Site güncellemeyi bu dosyadan (GitHub API üzerinden) okur.
4. Kullanıcı panelde Ayarlar → Güncellemeleri denetle → Şimdi güncelle der.

Not: Önceki oturumdan tag gönderilemiyordu. Bu yüzden paket bağlantısı tag yerine commit SHA arşivi.

## Yarım kalan ya da sonraya bırakılan işler

- Ana sayfada ve /cihazlar sayfasında görünen “Cihaz Satışı · Demo · Eğitim” yazısı kaldırılacak. Bu yazı ayrı “Rego Site” eklentisinde ve Elementor içinde (widget id'leri c3d7650 ve 21a0d02). Henüz yapılmadı.
- Resmi WhatsApp bildirimi (Meta Cloud API, 0850 hattı) kurulacak. Panel tarafı hazır.
- /sunum sayfası için otomatik güncelleme şimdilik yok; kullanıcı “indir yükle yaparım” dedi.

Son yayınlanan sürüm: **1.8.3** (2026-11-04)
