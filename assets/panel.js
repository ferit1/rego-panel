/* Rego Panel — single-page app on top of the rego/v1 REST API. No build step. */
(function () {
  'use strict';
  var C = window.REGO || {};
  var B = null;           // bootstrap payload: me, caps, users, settings, data
  var st = { view: 'dash', id: null, q: '', tab: {}, para: null, cal: null, forms: {}, dirty: false, menu: null };
  var AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  var AYU = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  var PARA = ['₺', '$', '€', '£'];
  var STAGES = [['onay', 'Onaylandı'], ['tarama', 'Taramada'], ['model', 'Modelleme / Rapor'], ['teslim', 'Teslim edildi']];
  var DURUM = { taslak: ['mute', 'Taslak'], gonderildi: ['warn', 'Yanıt bekliyor'], onaylandi: ['ok', 'Onaylandı'], reddedildi: ['bad', 'Reddedildi'], faturalandi: ['info', 'Faturalandı'] };
  var ROLES = { rego_yonetici: 'Yönetici', rego_satis: 'Satış', rego_saha: 'Saha ekibi', administrator: 'Site yöneticisi', pasif: 'Pasif' };
  var KOS_BASLIK = ['Ödeme Şartları', 'Teslim Süresi', 'Dataların Teslimi', 'Önemli Notlar', 'Garanti', 'Geçerlilik Süresi'];

  /* ---------- utilities ---------- */
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function can(c) { return !!(B && B.caps && B.caps[c]); }
  function lc(s) { return String(s || '').toLocaleLowerCase('tr'); }
  function num(n) {
    n = Number(n) || 0;
    var dec = Math.abs(n - Math.round(n)) > 0.0001 ? 2 : 0;
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
  }
  function money(n, p) { return num(n) + ' ' + (p || '₺'); }
  function parseNum(v) {
    v = String(v == null ? '' : v).trim().replace(/\s/g, '');
    if (v === '') return 0;
    if (v.indexOf(',') > -1) v = v.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, '');
    var n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }
  function dt(s) { return new Date(s + 'T00:00:00'); }
  function fmtD(s) { if (!s) return '—'; var d = dt(s); return d.getDate() + ' ' + AY[d.getMonth()] + ' ' + d.getFullYear(); }
  function addDays(s, n) { var d = dt(s); d.setDate(d.getDate() + n); return iso(d); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function today() { return B.today; }
  function initials(n) { return String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toLocaleUpperCase('tr'); }
  function list(k) { return (B.data && B.data[k]) || []; }
  function byId(k, id) { id = Number(id); return list(k).find(function (x) { return x.id === id; }) || null; }
  function firma(id) { var m = byId('musteri', id); return m ? m.firma : '—'; }
  function user(id) { id = Number(id); return B.users.find(function (u) { return u.id === id; }) || null; }
  function chip(kind, txt) { return '<span class="chip c-' + kind + '">' + esc(txt) + '</span>'; }
  function sumBy(rows) { // rows: [{para, v}] -> {para: total}
    var o = {}; rows.forEach(function (r) { o[r.para] = (o[r.para] || 0) + r.v; }); return o;
  }
  function sumTxt(o, sep) {
    var ks = PARA.filter(function (p) { return o[p]; });
    return ks.length ? ks.map(function (p) { return money(o[p], p); }).join(sep || ' · ') : '—';
  }
  function upsert(k, item) {
    if (!B.data[k]) B.data[k] = [];
    var i = B.data[k].findIndex(function (x) { return x.id === item.id; });
    if (i > -1) B.data[k][i] = item; else B.data[k].unshift(item);
  }
  function drop(k, id) { B.data[k] = list(k).filter(function (x) { return x.id !== id; }); }
  function match(s) { return !st.q || lc(s).indexOf(st.q) > -1; }
  function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, p, v) {
    var ks = p.split('.'), last = ks.pop();
    var t = ks.reduce(function (a, k) { return a[k]; }, o);
    t[last] = v;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function toast(msg, err) {
    $$('.toast').forEach(function (x) { x.remove(); });
    var t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, err ? 4200 : 2400);
  }

  /* WordPress security keys (nonces) expire after 12–24 hours; a tab left open overnight gets a new one silently. */
  var nonceYenileniyor = null;
  function nonceYenile() {
    if (!nonceYenileniyor) {
      nonceYenileniyor = fetch((C.ajax || '/wp-admin/admin-ajax.php') + '?action=rest-nonce', { credentials: 'same-origin', cache: 'no-store' })
        .then(function (r) { return r.text(); })
        .then(function (t) {
          t = String(t || '').trim();
          if (!t || t === '0' || t === '-1' || t.length > 20) return false; // logged out
          C.nonce = t;
          if (B) api('nonces').then(function (n) { B.pdf_nonce = n.pdf_nonce; }).catch(function () {});
          return true;
        })
        .catch(function () { return false; })
        .then(function (ok) { nonceYenileniyor = null; return ok; });
    }
    return nonceYenileniyor;
  }
  function api(path, method, body, tekrar) {
    var opt = { method: method || 'GET', credentials: 'same-origin', cache: 'no-store', headers: { 'X-WP-Nonce': C.nonce } };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch(C.api + path, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        var nonceSorunu = r.status === 401 || (j && j.code === 'rest_cookie_invalid_nonce');
        if (nonceSorunu && !tekrar) {
          return nonceYenile().then(function (ok) {
            if (ok) return api(path, method, body, true);
            st.oturumKapandi = true;
            throw new Error('Oturumunuz kapandı. Sayfayı yenileyip yeniden giriş yapın.');
          });
        }
        if (!r.ok) {
          var m = j && j.message ? String(j.message).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : 'İşlem tamamlanamadı (' + r.status + ').';
          if (j && j.code === 'internal_server_error') m = 'Sunucuda bir hata oluştu. WordPress yöneticisine gelen “Teknik sorun” e-postasında ayrıntı yazar.';
          if (r.status === 401 || (j && j.code === 'rest_cookie_invalid_nonce')) m = 'Oturumunuz sona erdi. Sayfayı yenileyip tekrar giriş yapın.';
          if (r.status === 403 && j && j.code === 'rest_forbidden') m = 'Bu işlem için yetkiniz yok.';
          throw new Error(m);
        }
        return j;
      });
    });
  }
  function fail(e) { toast(e.message || String(e), true); }

  /* ---------- icons ---------- */
  var I = {
    dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="15" width="7" height="6" rx="1.5"/></svg>',
    musteri: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.4 3.6 5.2"/></svg>',
    teklif: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/></svg>',
    proje: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z"/><path d="M3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5"/></svg>',
    fatura: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v.01M17.5 14.5v.01"/></svg>',
    saha: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    kargo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5"/></svg>',
    kullanici: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 4 6v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
    ayarlar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>'
  };
  var NAV = [
    ['dash', 'Ana Panel', 'rego_access'], ['musteri', 'Müşteriler', 'rego_access'], ['teklif', 'Teklifler', 'rego_teklif'],
    ['proje', 'Projeler', 'rego_access'], ['fatura', 'Finans', 'rego_access'], ['saha', 'Saha', 'rego_access'], ['kargo', 'Kargo', 'rego_access'],
    ['kullanici', 'Kullanıcılar', 'rego_kullanici'], ['ayarlar', 'Ayarlar', 'rego_ayarlar']
  ];

  function canFat() { return can('rego_fatura') && can('rego_finans') && !!B.data.fatura; }
  function canKasa() { return can('rego_kasa') && !!B.data.hareket; }
  function navOk(n) { return n[0] === 'fatura' ? (canFat() || canKasa()) : can(n[2]); }

  /* ---------- shell ---------- */
  function shell() {
    var nav = NAV.filter(navOk).map(function (n) {
      return '<button class="nav" data-go="' + n[0] + '" type="button">' + I[n[0]] + '<span>' + n[1] + '</span></button>';
    }).join('');
    document.getElementById('app').className = '';
    document.getElementById('app').innerHTML =
      '<div class="app">' +
      '<nav class="rail" id="rail" aria-label="Ana menü"><div class="side-logo"><img src="' + esc(C.logo) + '" alt="Rego Technology"></div>' + nav + '</nav>' +
      '<div class="drawer-scrim" id="scrim" data-act="close-drawer"></div>' +
      '<div class="main"><header class="top">' +
      '<button class="menu-btn" type="button" data-act="open-drawer" aria-label="Menüyü aç"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>' +
      '<label class="search" for="q"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="q" type="search" placeholder="Müşteri, teklif, proje ara…" autocomplete="off"></label>' +
      '<span class="sp"></span>' +
      '<div class="bellw"><button class="icon-btn bell" type="button" data-act="bell" aria-label="Bildirimler" aria-haspopup="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><span class="badge" id="bell-n" hidden>0</span></button></div>' +
      '<div class="who"><button class="who-btn" type="button" data-act="user-menu" aria-haspopup="true"><span class="avatar">' + esc(initials(displayName(B.me))) + '</span><span class="who-txt"><b>' + esc(displayName(B.me)) + '</b><small>' + esc(ROLES[B.me.rol] || '') + '</small></span></button></div>' +
      '</header><main class="content" id="view" tabindex="-1"></main></div></div>' +
      '<div id="layer"></div>';
  }

  function render() {
    closeMenu();
    var v = VIEWS[st.view] ? st.view : 'dash';
    var html = VIEWS[v]();
    $('#view').innerHTML = html;
    $$('.nav').forEach(function (b) { if (b.dataset.go === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (AFTER[v]) AFTER[v]();
    $$('textarea[data-auto]').forEach(autosize);
  }

  function route() {
    var h = (location.hash || '#dash').slice(1).split('/');
    var v = h[0] || 'dash';
    var allowed = NAV.some(function (n) { return n[0] === v && navOk(n); }) || v === 'ara';
    st.view = allowed ? v : 'dash';
    st.id = h[1] || null;
    if (st.view !== 'teklif' || !st.id) st.forms.E = null;
    st.dirty = false;
    render();
    $('#rail').classList.remove('open'); $('#scrim').classList.remove('open');
    window.scrollTo(0, 0);
  }
  function go(hash) {
    if (location.hash === '#' + hash) route(); else location.hash = hash;
  }

  /* ---------- shared bits ---------- */
  function sahaLi(s) {
    var d = dt(s.tarih);
    var done = s.durum === 'tamamlandi', iptal = s.durum === 'iptal';
    return '<div class="li"><div class="date"><b>' + d.getDate() + '</b><small>' + AY[d.getMonth()] + '</small></div>' +
      '<div style="min-width:0"><div class="t">' + esc(s.is_tanimi) + (done ? ' ' + chip('ok', 'Tamamlandı') : iptal ? ' ' + chip('mute', 'İptal') : '') + '</div>' +
      '<div class="m">' + esc(firma(s.musteri_id)) + (s.konum ? ' · ' + esc(s.konum) : '') + '</div></div>' +
      '<div class="m" style="text-align:right"><span class="mono">' + esc(s.saat || '') + '</span><br>' + esc(s.ekip || '') + '</div>' +
      (can('rego_saha_edit') ? '' : '') + '</div>';
  }
  function stageChip(s) { return { onay: chip('mute', 'Onaylandı'), tarama: chip('info', 'Taramada'), model: chip('warn', 'Modelleme'), teslim: chip('ok', 'Teslim edildi') }[s] || ''; }
  function durumChip(d) { var x = DURUM[d] || DURUM.taslak; return chip(x[0], x[1]); }
  function invState(f) { if (f.odendi) return chip('ok', 'Ödendi'); return f.vade && f.vade < today() ? chip('bad', 'Gecikmiş') : chip('warn', 'Bekliyor'); }
  function teklifTop(t) { return sumTxt(t.toplamlar || {}); }
  function emptyRow(cols, title, hint) { return '<tr><td colspan="' + cols + '" class="empty"><b>' + esc(title) + '</b>' + esc(hint || '') + '</td></tr>'; }
  /* Everything that falls on a date: field visits, payments, project deliveries, invoice due dates. */
  function dayEvents(ds) {
    var ev = [];
    list('saha').forEach(function (s) {
      if (s.tarih !== ds || s.durum === 'iptal') return;
      ev.push({ k: 'saha', t: 'Saha: ' + s.is_tanimi, m: [s.saat, firma(s.musteri_id) !== '—' ? firma(s.musteri_id) : '', s.konum].filter(Boolean).join(' · '), act: can('rego_saha_edit') ? 'saha-edit' : '', id: s.id, go: 'saha', done: s.durum === 'tamamlandi' });
    });
    list('hareket').forEach(function (h) {
      if (h.tarih !== ds) return;
      ev.push({ k: 'odeme', t: (h.tur === 'gelir' ? 'Gelir: ' : 'Ödeme: ') + (h.aciklama || h.kategori), m: money(h.tutar, h.para) + (h.durum === 'odendi' ? (h.tur === 'gelir' ? ' · alındı' : ' · ödendi') : (h.tur === 'gelir' ? ' · bekleniyor' : ' · ödenecek')), act: 'hareket-edit', id: h.id, go: 'fatura', done: h.durum === 'odendi' });
    });
    list('proje').forEach(function (p) {
      if (p.teslim !== ds || p.asama === 'teslim') return;
      ev.push({ k: 'teslim', t: 'Teslim: ' + p.ad, m: p.kod + ' · ' + firma(p.musteri_id), act: can('rego_proje_edit') ? 'proje-edit' : '', id: p.id, go: 'proje' });
    });
    (B.hatirlatma || []).forEach(function (h) {
      if (h.kaynak !== 'genel' || h.durum === 'iptal' || String(h.zaman).slice(0, 10) !== ds) return;
      ev.push({ k: 'hat', t: 'Hatırlatma: ' + h.baslik, m: String(h.zaman).slice(11, 16) + (h.mesaj ? ' · ' + h.mesaj : ''), act: 'hat-edit', id: h.id, go: 'dash', done: h.durum === 'gonderildi' });
    });
    list('kargo').forEach(function (k) {
      var gun = k.durum === 'teslim' ? k.teslim_tarihi : k.tarih;
      if (gun !== ds) return;
      var ne = k.yon === 'gelen' ? (k.durum === 'teslim' ? 'Kargo teslim alındı' : 'Beklenen kargo') : (k.durum === 'bekliyor' ? 'Gönderilecek kargo' : k.durum === 'yolda' ? 'Kargo gönderildi' : 'Kargo teslim edildi');
      ev.push({ k: 'kargo', t: ne + ': ' + kargoKarsi(k), m: [k.icerik, k.kargo_firma, k.takip_no].filter(Boolean).join(' · '), act: 'kargo-edit', id: k.id, go: 'kargo', done: k.durum === 'teslim' });
    });
    list('fatura').forEach(function (f) {
      if (f.vade !== ds || f.odendi) return;
      ev.push({ k: 'fatura', t: 'Fatura vadesi: ' + firma(f.musteri_id), m: money(f.tutar, f.para) + (f.no ? ' · ' + f.no : ''), act: 'fatura-edit', id: f.id, go: 'fatura' });
    });
    return ev;
  }
  var EV_KIND = { saha: 'Saha ziyareti', odeme: 'Ödeme / gelir', teslim: 'Proje teslimi', fatura: 'Fatura vadesi', hat: 'Hatırlatma', kargo: 'Kargo' };
  function calendar(y, m) {
    var first = new Date(y, m, 1), off = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
    var pre = y + '-' + String(m + 1).padStart(2, '0') + '-';
    var c = '', kinds = {};
    for (var i = 0; i < off; i++) c += '<span></span>';
    for (var d = 1; d <= days; d++) {
      var ds = pre + String(d).padStart(2, '0');
      var ev = dayEvents(ds);
      var cls = 'cd' + (ds === today() ? ' today' : '') + (ev.length ? ' mark' : '');
      if (!ev.length) { c += '<span class="' + cls + '">' + d + '</span>'; continue; }
      var dots = {}; ev.forEach(function (e) { dots[e.k] = 1; kinds[e.k] = 1; });
      c += '<button type="button" class="' + cls + '" data-act="cal-day" data-d="' + ds + '" aria-label="' + d + ' ' + AYU[m] + ': ' + ev.length + ' kayıt" aria-haspopup="true">' + d +
        '<i class="dots">' + Object.keys(EV_KIND).filter(function (k) { return dots[k]; }).map(function (k) { return '<i class="dot d-' + k + '"></i>'; }).join('') + '</i></button>';
    }
    var legend = Object.keys(EV_KIND).filter(function (k) { return kinds[k]; }).map(function (k) { return '<span><i class="dot d-' + k + '"></i>' + EV_KIND[k] + '</span>'; }).join('');
    return '<div class="cal">' + ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(function (g) { return '<b>' + g + '</b>'; }).join('') + c + '</div>' +
      (legend ? '<div class="cal-legend">' + legend + '<span class="muted">· Güne gelince ayrıntı görünür</span></div>' : '');
  }
  function calPopHtml(ds) {
    var d = dt(ds);
    return '<div class="calpop-h">' + d.getDate() + ' ' + AYU[d.getMonth()] + ' ' + ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][d.getDay()] + '</div>' +
      dayEvents(ds).map(function (e) {
        var attrs = e.act ? 'data-act="' + e.act + '" data-id="' + e.id + '"' : 'data-go="' + e.go + '"';
        return '<button type="button" class="calpop-i' + (e.done ? ' done' : '') + '" ' + attrs + '><i class="dot d-' + e.k + '"></i><span><b>' + esc(e.t) + '</b><small>' + esc(e.m) + '</small></span></button>';
      }).join('');
  }
  var calTimer = null;
  function showCalPop(cell) {
    clearTimeout(calTimer);
    var wrap = cell.closest('.cal'); if (!wrap) return;
    var pop = $('#calpop', wrap);
    if (pop && pop.dataset.d === cell.dataset.d) return;
    hideCalPop(true);
    pop = document.createElement('div'); pop.id = 'calpop'; pop.className = 'calpop'; pop.dataset.d = cell.dataset.d; pop.setAttribute('role', 'dialog');
    pop.innerHTML = calPopHtml(cell.dataset.d);
    wrap.appendChild(pop);
    var w = pop.offsetWidth, left = cell.offsetLeft + cell.offsetWidth / 2 - w / 2;
    left = Math.max(0, Math.min(left, wrap.clientWidth - w));
    pop.style.left = left + 'px'; pop.style.top = (cell.offsetTop + cell.offsetHeight + 6) + 'px';
    cell.setAttribute('aria-expanded', 'true');
  }
  function hideCalPop(now) {
    clearTimeout(calTimer);
    var go = function () { var p = $('#calpop'); if (p) p.remove(); $$('.cd[aria-expanded]').forEach(function (c) { c.removeAttribute('aria-expanded'); }); };
    if (now) go(); else calTimer = setTimeout(go, 220);
  }
  function newMenu() {
    var items = [['musteri', 'Müşteri', 'rego_musteri_edit'], ['teklif', 'Fiyat teklifi', 'rego_teklif'], ['proje', 'Proje', 'rego_proje_edit'], ['saha', 'Saha ziyareti', 'rego_saha_edit'], ['fatura', 'Fatura kaydı', 'rego_fatura'], ['gelir', 'Gelir (faturasız ödeme)', 'rego_kasa'], ['gider', 'Gider / ödeme (kira vb.)', 'rego_kasa'], ['hatirlatma', 'Hatırlatma', 'rego_access'], ['kargo-gelen', 'Gelen kargo', 'rego_access'], ['kargo-giden', 'Giden kargo', 'rego_access']];
    items = items.filter(function (x) { return can(x[2]); });
    if (!items.length) return '';
    return '<div class="row" style="position:relative"><button class="btn primary" type="button" data-act="new-menu" aria-haspopup="true">+ Yeni kayıt</button></div>';
  }

  /* ---------- views ---------- */
  var VIEWS = {}, AFTER = {};

  VIEWS.dash = function () {
    var h = new Date().getHours();
    var hi = h < 11 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
    var first = B.me.ad && B.me.ad !== B.me.login ? String(B.me.ad).split(' ')[0] : displayName(B.me);
    var aktif = list('proje').filter(function (p) { return p.asama !== 'teslim'; });
    var hafta = addDays(today(), 7);
    var yak = list('saha').filter(function (s) { return s.tarih >= today() && s.durum !== 'iptal' && s.durum !== 'tamamlandi'; });
    var buHafta = yak.filter(function (s) { return s.tarih <= hafta; });
    var bekT = list('teklif').filter(function (t) { return t.durum === 'gonderildi'; });
    var subs = [aktif.length + ' aktif proje', buHafta.length + ' saha ziyareti önümüzdeki 7 günde'];
    if (can('rego_teklif')) subs.push(bekT.length + ' teklif yanıt bekliyor');

    var kpis = '';
    if (can('rego_finans') && B.data.fatura) {
      var ay = today().slice(0, 7);
      var fs = list('fatura');
      var acik = fs.filter(function (f) { return !f.odendi; });
      var gec = acik.filter(function (f) { return f.vade && f.vade < today(); });
      kpis = kpi('Aktif proje', aktif.length, aktif.filter(function (p) { return p.asama === 'tarama'; }).length + ' tanesi taramada') +
        kpi('Yanıt bekleyen teklif', bekT.length, sumTxt(sumBy(flatTop(bekT)))) +
        kpi('Bu ay faturalanan', '<small>' + sumTxt(sumBy(fs.filter(function (f) { return f.tarih.indexOf(ay) === 0; }).map(fv)), '<br>') + '</small>', fs.filter(function (f) { return f.tarih.indexOf(ay) === 0; }).length + ' fatura kaydı') +
        kpi('Bekleyen tahsilat', '<small>' + sumTxt(sumBy(acik.map(fv)), '<br>') + '</small>', gec.length ? '<span style="color:var(--bad);font-weight:700">' + gec.length + ' gecikmiş fatura</span>' : 'Gecikme yok');
    } else {
      var yakin = aktif.filter(function (p) { return p.teslim && p.teslim <= hafta; });
      kpis = kpi('Aktif proje', aktif.length, 'Teslim edilmemiş işler') +
        kpi('Taramada', aktif.filter(function (p) { return p.asama === 'tarama'; }).length, 'Saha veya atölyede') +
        kpi('Bu hafta saha', buHafta.length, yak.length + ' planlı ziyaret toplam') +
        kpi('Teslimi 7 gün içinde', yakin.length, yakin.length ? 'Önceliklendirin' : 'Yakın teslim yok');
    }

    var left;
    if (can('rego_finans') && B.data.fatura) {
      left = '<div class="panel"><div class="panel-h"><div><h2>Tahsil edilen</h2><p>Son 6 ay · faturalı ve faturasız ödemeler</p></div>' + paraSeg() + '</div>' + chart() + '</div>';
    } else {
      var soon = aktif.slice().sort(function (a, b) { return String(a.teslim || '9').localeCompare(String(b.teslim || '9')); }).slice(0, 6);
      left = '<div class="panel"><div class="panel-h"><div><h2>Teslimi yaklaşan projeler</h2><p>Teslim tarihine göre</p></div><button class="btn sm" data-go="proje">Proje panosu</button></div><div class="list">' +
        (soon.map(function (p) { return '<div class="li" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="t">' + esc(p.ad) + '</div><div class="m">' + esc(firma(p.musteri_id)) + ' · ' + esc(p.hizmet) + '</div></div><div class="r">' + stageChip(p.asama) + '<div class="m num">' + fmtD(p.teslim) + '</div></div></div>'; }).join('') || '<p class="empty">Aktif proje yok.</p>') + '</div></div>';
    }
    var right = '<div class="panel"><div class="panel-h"><div><h2>Yaklaşan saha ziyaretleri</h2><p>Türkiye geneli mobil ekip</p></div><button class="btn sm" data-go="saha">Tümü</button></div><div class="list">' +
      (yak.slice(0, 5).map(sahaLi).join('') || '<p class="empty">Planlı ziyaret yok.</p>') + '</div></div>';

    var row2 = '';
    if (can('rego_teklif')) {
      var son = list('teklif').slice(0, 6);
      row2 = '<section class="panel"><div class="panel-h"><div><h2>Son teklifler</h2><p>En son hazırlananlar</p></div><button class="btn sm" data-go="teklif">Tüm teklifler</button></div><div class="tablewrap"><table class="t"><thead><tr><th>No</th><th>Firma</th><th>Tarih</th><th>Durum</th><th class="r">Tutar (KDV hariç)</th></tr></thead><tbody>' +
        (son.map(function (t) { return '<tr class="click" data-go="teklif/' + t.id + '"><td class="mono">' + esc(t.no) + '</td><td class="strong">' + esc(t.firma) + '</td><td class="num">' + fmtD(t.tarih) + '</td><td>' + durumChip(t.durum) + '</td><td class="r num strong">' + esc(teklifTop(t)) + '</td></tr>'; }).join('') || emptyRow(5, 'Henüz teklif yok.', ' “+ Yeni kayıt” ile ilk teklifi hazırlayın.')) +
        '</tbody></table></div></section>';
    }
    if (canKasa()) {
      var odm = '<section class="panel"><div class="panel-h"><div><h2>Yaklaşan ödemeler</h2><p>Önümüzdeki 30 gün ve gecikenler</p></div><button class="btn sm" data-act="fin-kasa">Gelir ve giderler</button></div><div class="list">' +
        (yaklasanOdemeler().slice(0, 6).map(odemeLi).join('') || '<p class="empty"><b>Bekleyen ödeme yok.</b>Kira gibi giderleri “+ Yeni kayıt” ile ekleyin.</p>') + '</div></section>';
      row2 = row2 ? '<div class="grid2">' + row2 + odm + '</div>' : odm;
    }
    var now = new Date();
    var row3 = '<section class="grid2"><div class="panel"><div class="panel-h"><div><h2>Devam eden projeler</h2><p>Teslim tarihine göre</p></div><button class="btn sm" data-go="proje">Proje panosu</button></div><div class="tablewrap"><table class="t"><thead><tr><th>Kod</th><th>Proje</th><th>Aşama</th><th class="r">Teslim</th></tr></thead><tbody>' +
      (aktif.slice().sort(function (a, b) { return String(a.teslim || '9').localeCompare(String(b.teslim || '9')); }).slice(0, 8).map(function (p) { return '<tr><td class="mono">' + esc(p.kod) + '</td><td><div class="strong">' + esc(p.ad) + '</div><div class="small muted">' + esc(firma(p.musteri_id)) + ' · <span class="svc">' + esc(p.hizmet) + '</span></div></td><td>' + stageChip(p.asama) + '</td><td class="r num">' + fmtD(p.teslim) + '</td></tr>'; }).join('') || emptyRow(4, 'Aktif proje yok.')) +
      '</tbody></table></div></div><div class="panel"><div class="panel-h"><div><h2>' + AYU[now.getMonth()] + ' ' + now.getFullYear() + '</h2><p>Saha, ödeme, teslim, kargo ve vade günleri</p></div></div>' + calendar(now.getFullYear(), now.getMonth()) + '</div></section>' +
      '<section class="grid2 even">' + kargoPanel() + hatPanel() + '</section>';

    return '<div class="head"><div><h1>' + hi + ', ' + esc(first) + '.</h1><p class="sub">' + subs.join(' · ') + '</p></div>' + newMenu() + '</div>' +
      '<section class="kpis">' + kpis + '</section><section class="grid2">' + left + right + '</section>' + row2 + row3;
  };
  function kargoPanel() {
    var ks = acikKargolar().slice(0, 6);
    return '<div class="panel"><div class="panel-h"><div><h2>Kargolar</h2><p>Gelecek ve gönderilecek kargolar</p></div><div class="row"><button class="btn sm" type="button" data-act="kargo-new" data-yon="gelen">↓ Gelen</button><button class="btn sm" type="button" data-act="kargo-new" data-yon="giden">↑ Giden</button></div></div><div class="list">' +
      (ks.map(function (k) {
        return '<div class="li" style="grid-template-columns:auto minmax(0,1fr) auto"><span>' + yonChip(k) + '</span><div style="min-width:0"><div class="t">' + esc(kargoKarsi(k)) + '</div><div class="m">' + esc([k.icerik, k.kargo_firma, k.takip_no].filter(Boolean).join(' · ') || '—') + '</div></div>' +
          '<div class="r"><div>' + kargoDurum(k) + '</div><div class="row" style="justify-content:flex-end;margin-top:4px"><span class="small muted num">' + fmtD(k.tarih) + '</span>' + kargoAksiyon(k) + '</div></div></div>';
      }).join('') || '<p class="empty"><b>Açık kargo yok.</b>Gelen ya da giden kargoyu yukarıdaki düğmelerle ekleyin.</p>') +
      '</div>' + (list('kargo').length ? '<div style="margin-top:8px"><button class="btn sm ghost" data-go="kargo">Tüm kargolar →</button></div>' : '') + '</div>';
  }
  function hatPanel() {
    var mine = (B.hatirlatma || []).filter(function (h) { return h.durum === 'bekliyor' && (h.alicilar.indexOf(B.me.id) > -1 || h.created_by === B.me.id); })
      .sort(function (a, b) { return String(a.zaman).localeCompare(String(b.zaman)); }).slice(0, 6);
    var kind = { genel: 'Hatırlatma', saha: 'Saha', hareket: 'Ödeme', proje: 'Teslim' };
    return '<div class="panel"><div class="panel-h"><div><h2>Hatırlatmalarım</h2><p>Sırası gelince zilde ve masaüstünde bildirim olarak çıkar</p></div><button class="btn sm" type="button" data-act="hat-new">+ Hatırlatma</button></div><div class="list">' +
      (mine.map(function (h) {
        return '<button type="button" class="li hat-li" data-act="hat-edit" data-id="' + h.id + '"><span class="date"><b>' + dt(String(h.zaman).slice(0, 10)).getDate() + '</b><small>' + AY[dt(String(h.zaman).slice(0, 10)).getMonth()] + '</small></span>' +
          '<span style="min-width:0"><span class="t">' + esc(h.baslik.replace(/^(Saha|Ödeme|Teslim|Beklenen ödeme): /, '')) + '</span><span class="m">' + esc(kind[h.kaynak] || '') + ' · ' + esc(h.alicilar.map(function (id) { var u = user(id); return u ? displayName(u).split(' ')[0] : ''; }).filter(Boolean).join(', ')) + '</span></span>' +
          '<span class="mono m">' + esc(String(h.zaman).slice(11, 16)) + '</span></button>';
      }).join('') || '<p class="empty"><b>Bekleyen hatırlatma yok.</b>Saha ziyareti, ödeme ya da projeye hatırlatma ekleyebilir veya “+ Hatırlatma” ile tek başına kurabilirsiniz.</p>') + '</div></div>';
  }
  function kpi(l, v, n) { return '<div class="kpi"><span class="lab">' + esc(l) + '</span><span class="val">' + v + '</span><span class="note">' + n + '</span></div>'; }
  function fv(f) { return { para: f.para, v: Number(f.tutar) }; }
  function flatTop(ts) { var r = []; ts.forEach(function (t) { Object.keys(t.toplamlar || {}).forEach(function (p) { r.push({ para: p, v: t.toplamlar[p] }); }); }); return r; }
  function paidPara() {
    var o = {}; list('fatura').forEach(function (f) { if (f.odendi) o[f.para] = (o[f.para] || 0) + 1; });
    list('hareket').forEach(function (h) { if (h.tur === 'gelir' && h.durum === 'odendi') o[h.para] = (o[h.para] || 0) + 1; });
    var ks = PARA.filter(function (p) { return o[p]; });
    return ks.length ? ks : ['₺'];
  }
  function paraSeg() {
    var ks = paidPara();
    if (!st.para || ks.indexOf(st.para) < 0) st.para = ks[0];
    if (ks.length < 2) return '';
    return '<div class="seg" role="group" aria-label="Para birimi">' + ks.map(function (p) { return '<button type="button" data-act="para" data-p="' + esc(p) + '" aria-pressed="' + (p === st.para) + '">' + esc(p) + '</button>'; }).join('') + '</div>';
  }
  function chart() {
    var p = st.para || '₺';
    var now = new Date(), months = [];
    for (var i = 5; i >= 0; i--) { var d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ k: iso(d).slice(0, 7), l: AY[d.getMonth()], v: 0 }); }
    list('fatura').forEach(function (f) {
      if (!f.odendi || f.para !== p) return;
      var k = String(f.odeme_tarihi || f.tarih).slice(0, 7);
      var m = months.find(function (x) { return x.k === k; }); if (m) m.v += Number(f.tutar);
    });
    list('hareket').forEach(function (h) {
      if (h.tur !== 'gelir' || h.durum !== 'odendi' || h.para !== p) return;
      var k = String(h.odeme_tarihi || h.tarih).slice(0, 7);
      var m = months.find(function (x) { return x.k === k; }); if (m) m.v += Number(h.tutar);
    });
    var mx = Math.max.apply(null, months.map(function (m) { return m.v; }));
    if (mx <= 0) return '<p class="empty"><b>Bu dönemde tahsilat yok.</b>Ödendi olarak işaretlenen faturalar burada görünür.</p>';
    var raw = mx / 4, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var nice = [1, 2, 2.5, 5, 10].map(function (f) { return f * mag; }).find(function (v) { return v >= raw; });
    var top = nice * 4;
    var ax = [4, 3, 2, 1, 0].map(function (i) { var v = top / 4 * i; return '<span>' + (v >= 1000 ? num(v / 1000) + 'b' : num(v)) + '</span>'; }).join('');
    return '<div class="bars"><div class="yax">' + ax + '</div><div class="plot">' + months.map(function (m, i) {
      var last = i === months.length - 1;
      return '<div class="bar' + (last ? ' cur' : '') + '" style="height:' + (m.v / top * 100) + '%" title="' + esc(m.l + ': ' + money(m.v, p)) + '">' + (last && m.v ? '<em>' + esc(money(m.v, p)) + '</em>' : '') + '<span>' + m.l + '</span></div>';
    }).join('') + '</div></div>';
  }

  VIEWS.ara = function () {
    var q = st.q;
    var ms = list('musteri').filter(function (m) { return match([m.firma, m.kisi, m.sehir, m.email].join(' ')); }).slice(0, 8);
    var ts = list('teklif').filter(function (t) { return match([t.no, t.firma, t.kisi].join(' ')); }).slice(0, 8);
    var ps = list('proje').filter(function (p) { return match([p.kod, p.ad, firma(p.musteri_id)].join(' ')); }).slice(0, 8);
    function grp(title, rows) { return '<div class="panel"><div class="panel-h"><h2>' + title + '</h2><span class="chip c-mute">' + rows.length + '</span></div><div class="list">' + (rows.join('') || '<p class="muted small">Eşleşme yok.</p>') + '</div></div>'; }
    return '<div class="head"><div><h1>“' + esc(q) + '” için sonuçlar</h1></div></div><section class="grid2 even">' +
      grp('Müşteriler', ms.map(function (m) { return '<div class="li" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="t">' + esc(m.firma) + '</div><div class="m">' + esc([m.kisi, m.sehir].filter(Boolean).join(' · ')) + '</div></div><button class="btn sm" data-act="musteri-edit" data-id="' + m.id + '">Aç</button></div>'; })) +
      (can('rego_teklif') ? grp('Teklifler', ts.map(function (t) { return '<div class="li" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="t">' + esc(t.firma) + ' <span class="mono muted">' + esc(t.no) + '</span></div><div class="m">' + fmtD(t.tarih) + ' · ' + esc(teklifTop(t)) + '</div></div><button class="btn sm" data-go="teklif/' + t.id + '">Aç</button></div>'; })) : '') +
      grp('Projeler', ps.map(function (p) { return '<div class="li" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="t">' + esc(p.ad) + '</div><div class="m">' + esc(p.kod + ' · ' + firma(p.musteri_id)) + '</div></div>' + stageChip(p.asama) + '</div>'; })) +
      '</section>';
  };

  function kisiOzet(mid) {
    var ks = kisilerOf(mid);
    if (!ks.length) return '—';
    return esc(ks[0].ad) + (ks[0].gorev ? ' <span class="small muted">' + esc(ks[0].gorev) + '</span>' : '') + (ks.length > 1 ? ' <span class="chip c-mute">+' + (ks.length - 1) + '</span>' : '');
  }
  VIEWS.musteri = function () {
    var fin = can('rego_finans') && B.data.fatura;
    var rows = list('musteri').filter(function (m) { return match([m.firma, m.sehir, m.email, m.tel, m.sektor].concat(kisilerOf(m.id).map(function (k) { return k.ad + ' ' + k.gorev + ' ' + k.tel; })).join(' ')); });
    var head = '<tr><th>Firma</th><th>İlgili kişi</th><th>Telefon</th><th>E-posta</th><th>Şehir</th><th class="r">Proje</th>' + (can('rego_teklif') ? '<th class="r">Teklif</th>' : '') + (fin ? '<th class="r">Açık bakiye</th>' : '') + '</tr>';
    var body = rows.map(function (m) {
      var pc = list('proje').filter(function (p) { return p.musteri_id === m.id; }).length;
      var tc = list('teklif').filter(function (t) { return t.musteri_id === m.id; }).length;
      var bak = fin ? sumTxt(sumBy(list('fatura').filter(function (f) { return f.musteri_id === m.id && !f.odendi; }).map(fv))) : '';
      return '<tr class="click" data-act="musteri-edit" data-id="' + m.id + '"><td><div class="strong">' + esc(m.firma) + '</div><div class="small muted">' + esc(m.sektor || '') + '</div></td><td>' + kisiOzet(m.id) + '</td><td class="mono">' + esc(m.tel || '—') + '</td><td>' + esc(m.email || '—') + '</td><td>' + esc(m.sehir || '—') + '</td><td class="r num">' + pc + '</td>' +
        (can('rego_teklif') ? '<td class="r num">' + tc + '</td>' : '') + (fin ? '<td class="r num' + (bak !== '—' ? ' strong' : '') + '">' + esc(bak) + '</td>' : '') + '</tr>';
    }).join('');
    var cols = 6 + (can('rego_teklif') ? 1 : 0) + (fin ? 1 : 0);
    return '<div class="head"><div><h1>Müşteriler</h1><p class="sub">' + list('musteri').length + ' firma kayıtlı' + (st.q ? ' · “' + esc(st.q) + '” ile filtreli' : '') + '</p></div>' +
      (can('rego_musteri_edit') ? '<button class="btn primary" type="button" data-act="musteri-new">+ Müşteri ekle</button>' : '') + '</div>' +
      '<section class="panel"><div class="tablewrap"><table class="t"><thead>' + head + '</thead><tbody>' +
      (body || emptyRow(cols, st.q ? 'Aramayla eşleşen müşteri yok.' : 'Henüz müşteri yok.', st.q ? '' : ' Teklif hazırladığınızda firma otomatik eklenir.')) + '</tbody></table></div></section>';
  };

  VIEWS.proje = function () {
    var P = list('proje').filter(function (p) { return match([p.kod, p.ad, p.hizmet, firma(p.musteri_id)].join(' ')); });
    var pct = { onay: 12, tarama: 45, model: 75, teslim: 100 };
    var ed = can('rego_proje_edit');
    return '<div class="head"><div><h1>Projeler</h1><p class="sub">' + (ed ? 'Bir işi sonraki aşamaya taşımak için “İlerlet”e basın.' : 'Projelerin aşamaları') + '</p></div>' +
      (ed ? '<button class="btn primary" type="button" data-act="proje-new">+ Proje aç</button>' : '') + '</div>' +
      '<section class="board">' + STAGES.map(function (s) {
        var items = P.filter(function (p) { return p.asama === s[0]; });
        if (s[0] === 'teslim') items = items.slice(0, 12);
        return '<div class="col"><div class="col-h">' + s[1] + '<span>' + P.filter(function (p) { return p.asama === s[0]; }).length + '</span></div>' +
          (items.map(function (p) {
            var t = p.teklif_id ? byId('teklif', p.teklif_id) : null;
            return '<article class="card"><div class="row" style="justify-content:space-between"><span class="mono muted">' + esc(p.kod) + '</span><span class="svc">' + esc(p.hizmet) + '</span></div>' +
              '<div class="t">' + esc(p.ad) + '</div><div class="m">' + esc(firma(p.musteri_id)) + (p.notlar ? ' · ' + esc(p.notlar) : '') + (t ? ' · <a href="#teklif/' + t.id + '">' + esc(t.no) + '</a>' : '') + '</div>' +
              '<div class="prog"><i style="width:' + pct[p.asama] + '%"></i></div>' +
              '<div class="f"><span class="m num">Teslim ' + fmtD(p.teslim) + '</span><span class="row">' +
              (ed ? '<button class="btn sm ghost" type="button" data-act="proje-edit" data-id="' + p.id + '">Düzenle</button>' : '') +
              (ed && p.asama !== 'teslim' ? '<button class="btn sm" type="button" data-act="proje-adv" data-id="' + p.id + '">İlerlet →</button>' : '') + '</span></div></article>';
          }).join('') || '<p class="m muted small" style="margin:4px 2px">Bu aşamada proje yok.</p>') + '</div>';
      }).join('') + '</section>';
  };

  VIEWS.teklif = function () {
    if (st.id) return editorView();
    var tab = st.tab.teklif || 'tum';
    var all = list('teklif').filter(function (t) { return match([t.no, t.firma, t.kisi].join(' ')); });
    var rows = tab === 'tum' ? all : all.filter(function (t) { return t.durum === tab; });
    var tabs = [['tum', 'Tümü'], ['taslak', 'Taslak'], ['gonderildi', 'Yanıt bekliyor'], ['onaylandi', 'Onaylandı'], ['reddedildi', 'Reddedildi'], ['faturalandi', 'Faturalandı']];
    return '<div class="head"><div><h1>Fiyat teklifleri</h1><p class="sub">Firma ve kalemleri girin; PDF, Rego teklif formu düzeninde hazırlanır.</p></div><button class="btn primary" type="button" data-go="teklif/yeni">+ Yeni teklif</button></div>' +
      '<div class="tabs" role="tablist">' + tabs.map(function (x) { var n = x[0] === 'tum' ? all.length : all.filter(function (t) { return t.durum === x[0]; }).length; return '<button class="tab" role="tab" type="button" data-act="tab" data-k="teklif" data-v="' + x[0] + '" aria-selected="' + (tab === x[0]) + '">' + x[1] + ' (' + n + ')</button>'; }).join('') + '</div>' +
      '<section class="panel"><div class="tablewrap"><table class="t"><thead><tr><th>No</th><th>Firma</th><th>İlgili kişi</th><th>Tarih</th><th>Gönderen</th><th>Durum</th><th class="r">Tutar (KDV hariç)</th><th></th></tr></thead><tbody>' +
      (rows.map(function (t) {
        var u = user(t.gonderen_id);
        return '<tr class="click" data-go="teklif/' + t.id + '"><td class="mono">' + esc(t.no) + '</td><td class="strong">' + esc(t.firma) + '</td><td>' + esc(t.kisi || '—') + '</td><td class="num">' + fmtD(t.tarih) + '</td><td>' + esc(t.gonderen_ad || (u ? displayName(u) : '—')) + '</td><td>' + durumChip(t.durum) + '</td><td class="r num strong">' + esc(teklifTop(t)) + '</td>' +
          '<td class="r"><a class="btn sm" href="' + pdfUrl(t.id) + '" target="_blank" rel="noopener" data-stop="1">PDF</a></td></tr>';
      }).join('') || emptyRow(8, st.q ? 'Aramayla eşleşen teklif yok.' : 'Bu listede teklif yok.', st.q ? '' : ' “+ Yeni teklif” ile başlayın.')) +
      '</tbody></table></div></section>';
  };
  function pdfUrl(id, dl) { return B.pdf_url + '&id=' + id + '&_wpnonce=' + B.pdf_nonce + (dl ? '&indir=1' : ''); }

  /* ----- quote editor ----- */
  function blankTeklif() {
    var sb = (B.settings.sablonlar || [])[0];
    return {
      id: 0, no: '', musteri_id: 0, firma: '', kisiler: [blankKisi()], hitap: '', _hitapManual: false,
      tarih: today(), gonderen_id: B.me.id, durum: 'taslak',
      gonderen_ad: defaultHz().ad, gonderen_email: defaultHz().email, gonderen_tel: defaultHz().tel,
      kalemler: [{ ad: '', miktar: 1, birim: 'Adet', fiyat: 0, para: '€', teslim: '' }],
      kosullar: sb ? clone(sb.kosullar) : [], ek_baslik: sb ? sb.ek_baslik : '', ek_metin: sb ? sb.ek_metin : '', ek_yeni_sayfa: sb ? sb.ek_yeni_sayfa : 0, toplam_goster: 0
    };
  }
  function loadEditor() {
    if (st.forms.E && String(st.forms.E.id || 'yeni') === String(st.id)) return st.forms.E;
    var E;
    if (st.id === 'yeni') E = blankTeklif();
    else {
      var t = byId('teklif', st.id);
      if (!t) return null;
      E = clone(t);
      if (!E.kisiler || !E.kisiler.length) E.kisiler = [blankKisi()];
      E.kisiler.forEach(function (k) { if (!k.hitap) { var m = byId('musteri', t.musteri_id); k.hitap = /Hanım,?$/.test(t.hitap) ? 'Hanım' : ((m && m.hitap) || 'Bey'); } });
      E._hitapManual = !!t.hitap && t.hitap !== autoHitap(E);
    }
    st.forms.E = E;
    return E;
  }
  function hazirlayanlar() { return (B.settings.hazirlayanlar || []); }
  function defaultHz() {
    var hs = hazirlayanlar(), me = B.me;
    return hs.find(function (h) { return (h.email && lc(h.email) === lc(me.email)) || lc(h.ad) === lc(me.ad); }) || hs[0] || { ad: displayName(me), email: me.email, tel: me.tel };
  }
  function displayName(u) { return u && u.ad && u.ad !== u.login ? u.ad : (B.settings.firma_unvan || 'Rego Technology'); }
  function autoHitap(E) {
    var ks = (E.kisiler || []).filter(function (k) { return String(k.ad || '').trim(); });
    if (!ks.length) return '';
    var parts = ks.map(function (k) { return 'Sn. ' + String(k.ad).trim().split(/\s+/)[0] + ' ' + (k.hitap || 'Bey'); });
    return (parts.length > 1 ? parts.slice(0, -1).join(', ') + ' ve ' + parts[parts.length - 1] : parts[0]) + ',';
  }
  function kisilerOf(mid) { return (B.kisi || []).filter(function (k) { return k.musteri_id === mid; }); }
  function kisiSync(r) {
    if (!r || !r.musteri_id || !r.kisi) return;
    B.kisi = (B.kisi || []).filter(function (k) { return k.musteri_id !== r.musteri_id; }).concat(r.kisi);
  }
  function gorevler() { return B.settings.gorevler || ['Satın alma', 'Patron / Genel müdür', 'Ar-Ge', 'Kalite', 'Üretim', 'Diğer']; }
  function blankKisi() { return { ad: '', hitap: 'Bey', gorev: '', email: '', tel: '' }; }
  /* Editable contact rows; `root` is the data-root of the form, `pre` prefixes element ids. */
  function kisiRows(list, pre) {
    return '<div class="kisiler">' + list.map(function (k, i) {
      return '<div class="kisi-row">' +
        '<label class="f" for="' + pre + i + 'a">Ad soyad<input id="' + pre + i + 'a" data-bind="kisiler.' + i + '.ad" value="' + esc(k.ad) + '" placeholder="Mustafa ALTAN"></label>' +
        '<label class="f" for="' + pre + i + 'g">Görevi<select id="' + pre + i + 'g" data-bind="kisiler.' + i + '.gorev"><option value="">Seçin</option>' + gorevler().concat(k.gorev && gorevler().indexOf(k.gorev) < 0 ? [k.gorev] : []).map(function (g) { return '<option' + (g === k.gorev ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('') + '</select></label>' +
        '<label class="f" for="' + pre + i + 'h">Hitap<select id="' + pre + i + 'h" data-bind="kisiler.' + i + '.hitap"><option' + (k.hitap !== 'Hanım' ? ' selected' : '') + '>Bey</option><option' + (k.hitap === 'Hanım' ? ' selected' : '') + '>Hanım</option></select></label>' +
        '<label class="f" for="' + pre + i + 't">Telefon<input id="' + pre + i + 't" type="tel" data-bind="kisiler.' + i + '.tel" value="' + esc(k.tel) + '"></label>' +
        '<label class="f" for="' + pre + i + 'e">E-posta<input id="' + pre + i + 'e" type="email" data-bind="kisiler.' + i + '.email" value="' + esc(k.email) + '"></label>' +
        '<button class="icon-btn x" type="button" data-act="kisi-del" data-i="' + i + '" aria-label="Kişiyi kaldır" title="Kişiyi kaldır">×</button></div>';
    }).join('') + '</div>';
  }

  function editorView() {
    var E = loadEditor();
    if (!E) return '<div class="panel empty"><b>Teklif bulunamadı.</b><a href="#teklif">Tekliflere dön</a></div>';
    var s = B.settings;
    var dl = '<datalist id="dl-firma">' + list('musteri').map(function (m) { return '<option value="' + esc(m.firma) + '">'; }).join('') + '</datalist>' +
      '<datalist id="dl-birim">' + (s.birimler || []).map(function (b) { return '<option value="' + esc(b) + '">'; }).join('') + '</datalist>' +
      '<datalist id="dl-kos">' + KOS_BASLIK.map(function (b) { return '<option value="' + esc(b) + '">'; }).join('') + '</datalist>';
    var isNew = !E.id;
    var kayitli = E.musteri_id ? kisilerOf(E.musteri_id).filter(function (k) { return !E.kisiler.some(function (x) { return lc(x.ad) === lc(k.ad); }); }) : [];
    var musteri = '<section class="panel"><div class="sec-h"><h2>Firma ve ilgili kişiler</h2><span class="hint">Kayıtlı firmayı seçince kişileri gelir. Yeni firma ve kişiler, kaydedince müşterilere eklenir.</span></div>' +
      '<div class="form">' +
      '<div class="full"><div class="firma-satir">' + fld('Firma', '<input id="e-firma" data-bind="firma" list="dl-firma" value="' + esc(E.firma) + '" required autocomplete="off" placeholder="Firma adını yazın ya da listeden seçin">') +
      '<button class="btn" type="button" data-act="e-yeni-mus">+ Yeni müşteri</button></div><div class="hint" id="e-firma-durum">' + firmaDurum(E) + '</div></div></div>' +
      '<div id="e-kisiler">' + kisiRows(E.kisiler, 'ek') + '</div>' +
      '<div class="row" style="margin-top:10px"><button class="btn sm" type="button" data-act="kisi-add">+ Kişi ekle</button>' +
      (kayitli.length ? '<select class="inp" id="e-kayitli" style="width:auto"><option value="">Firmanın kayıtlı kişilerinden ekle…</option>' + kayitli.map(function (k) { return '<option value="' + k.id + '">' + esc(k.ad + (k.gorev ? ' – ' + k.gorev : '')) + '</option>'; }).join('') + '</select>' : '') + '</div>' +
      '<div class="form" style="margin-top:12px">' +
      fld('Hitap satırı (PDF’te)', '<input id="e-hitap" data-bind="hitap" value="' + esc(E.hitap || autoHitap(E)) + '" placeholder="Sn. Mustafa Bey,">', 'full') +
      '</div></section>';

    var items = '<section class="panel"><div class="sec-h"><h2>Ürün ve hizmetler</h2><span class="hint">Fiyatlar KDV hariç. Ürün adında satır atlayabilirsiniz.</span></div>' +
      '<div class="item-h"><span>No</span><span>Ürün veya hizmet</span><span>Miktar</span><span>Birim</span><span>Birim fiyat</span><span>Para</span><span>Teslim süresi</span><span class="r">Toplam</span><span></span></div>' +
      '<div class="items">' + E.kalemler.map(function (k, i) {
        return '<div class="item"><span class="no">' + (i + 1) + '</span>' +
          '<div class="c-urun"><span class="lbl">Ürün veya hizmet</span><textarea class="inp" id="k' + i + '-urun" data-bind="kalemler.' + i + '.ad" data-auto rows="2" aria-label="Ürün veya hizmet ' + (i + 1) + '">' + esc(k.ad) + '</textarea></div>' +
          '<div class="c-m"><span class="lbl">Miktar</span><input class="inp num" id="k' + i + '-m" data-bind="kalemler.' + i + '.miktar" data-num inputmode="decimal" value="' + esc(num(k.miktar)) + '" aria-label="Miktar"></div>' +
          '<div class="c-b"><span class="lbl">Birim</span><input class="inp" id="k' + i + '-b" data-bind="kalemler.' + i + '.birim" list="dl-birim" value="' + esc(k.birim) + '" aria-label="Birim"></div>' +
          '<div class="c-f"><span class="lbl">Birim fiyat</span><input class="inp num" id="k' + i + '-f" data-bind="kalemler.' + i + '.fiyat" data-num inputmode="decimal" value="' + esc(k.fiyat ? num(k.fiyat) : '') + '" placeholder="0" aria-label="Birim fiyat"></div>' +
          '<div class="c-p"><span class="lbl">Para</span><select class="inp" id="k' + i + '-p" data-bind="kalemler.' + i + '.para" aria-label="Para birimi">' + PARA.map(function (p) { return '<option' + (k.para === p ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select></div>' +
          '<div class="c-t"><span class="lbl">Teslim süresi</span><input class="inp" id="k' + i + '-t" data-bind="kalemler.' + i + '.teslim" value="' + esc(k.teslim) + '" placeholder="örn. 15 Gün" aria-label="Teslim süresi"></div>' +
          '<span class="tot" data-tot="' + i + '">' + esc(money((k.miktar || 0) * (k.fiyat || 0), k.para)) + '</span>' +
          '<span class="c-x"><button class="icon-btn x" type="button" data-act="kalem-del" data-i="' + i + '" aria-label="Kalemi sil" title="Kalemi sil">×</button></span></div>';
      }).join('') + '</div>' +
      '<div class="row" style="margin-top:12px;justify-content:space-between"><button class="btn sm" type="button" data-act="kalem-add">+ Kalem ekle</button>' +
      '<label class="check" for="e-tg"><input id="e-tg" type="checkbox" data-bind="toplam_goster"' + (E.toplam_goster ? ' checked' : '') + '> PDF’te tablo altına genel toplamı yaz</label></div></section>';

    E.gorseller = E.gorseller || [];
    var gal = '<section class="panel"><div class="sec-h"><h2>Görseller</h2><span class="hint">PDF’te ürün tablosunun altında ikişer ikişer basılır. JPG, PNG ya da WEBP; büyük görseller küçültülür.</span></div>' +
      '<div class="gal-ed">' + E.gorseller.map(function (g, i) {
        return '<figure class="gal-i"><div class="gal-img"><img src="' + esc(g.url) + '" alt=""></div>' +
          '<input class="inp" id="eg' + i + '" data-bind="gorseller.' + i + '.aciklama" value="' + esc(g.aciklama || '') + '" placeholder="Açıklama (isteğe bağlı)" aria-label="Görsel açıklaması">' +
          '<div class="row" style="justify-content:space-between"><span class="row"><button class="icon-btn" type="button" data-act="gorsel-sol" data-i="' + i + '" aria-label="Sola taşı" title="Sola taşı">←</button><button class="icon-btn" type="button" data-act="gorsel-sag" data-i="' + i + '" aria-label="Sağa taşı" title="Sağa taşı">→</button></span>' +
          '<button class="btn sm ghost danger" type="button" data-act="gorsel-sil" data-i="' + i + '">Kaldır</button></div></figure>';
      }).join('') +
      '<label class="gal-add" for="e-gorsel-yukle"><input id="e-gorsel-yukle" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden><span>+ Görsel yükle</span><small id="gal-durum">Bilgisayardan seçin</small></label>' +
      '</div></section>';

    var kos = '<section class="panel"><div class="sec-h"><h2>Teklif koşulları</h2><div class="row"><select class="inp" id="e-sablon" style="width:auto;max-width:280px" aria-label="Koşul şablonu"><option value="">Şablon seç…</option>' +
      (s.sablonlar || []).map(function (x, i) { return '<option value="' + i + '">' + esc(x.ad) + '</option>'; }).join('') + '</select><button class="btn sm" type="button" data-act="sablon-uygula">Uygula</button></div></div>' +
      kosEditor(E, 'E') + '</section>';

    var ek = '<section class="panel"><div class="sec-h"><h2>Ek açıklama</h2><span class="hint">Koşulların altına ya da yeni sayfaya basılır. Örn. “Amaç: …” veya parça gruplandırma tablosu.</span></div><div class="form">' +
      fld('Başlık (isteğe bağlı)', '<input id="e-ekb" data-bind="ek_baslik" value="' + esc(E.ek_baslik) + '">', 'full') +
      fld('Metin', '<textarea id="e-ekm" data-bind="ek_metin" data-auto rows="3">' + esc(E.ek_metin) + '</textarea>', 'full') +
      '<label class="check full" for="e-ekn"><input id="e-ekn" type="checkbox" data-bind="ek_yeni_sayfa"' + (E.ek_yeni_sayfa ? ' checked' : '') + '> Yeni sayfada başlat (Fatura bilgileri ve Sipariş Teyidi ilk bölümün sonunda kalır)</label></div></section>';

    var side = '<aside class="ed-side"><div class="panel stack">' +
      '<div class="row" style="justify-content:space-between"><h3>' + (isNew ? 'Yeni teklif' : esc(E.no)) + '</h3>' + durumChip(E.durum) + '</div>' +
      fld('Durum', '<select id="e-durum" data-bind="durum">' + Object.keys(DURUM).map(function (d) { return '<option value="' + d + '"' + (E.durum === d ? ' selected' : '') + '>' + DURUM[d][1] + '</option>'; }).join('') + '</select>') +
      fld('Tarih', '<input id="e-tarih" type="date" data-bind="tarih" value="' + esc(E.tarih) + '">') +
      fld('Hazırlayan (PDF’te Gönderen)', '<select id="e-gon" data-act-change="hazirlayan">' + hzOptions(E) + '</select>') +
      '<div class="totals" id="ed-totals">' + totalsHtml(E) + '</div>' +
      '<button class="btn primary block" type="button" data-act="e-save">' + (isNew ? 'Teklifi kaydet' : 'Değişiklikleri kaydet') + '</button>' +
      '<div class="row"><button class="btn" style="flex:1" type="button" data-act="e-pdf">PDF önizle</button><button class="btn" style="flex:1" type="button" data-act="e-pdf" data-dl="1">PDF indir</button></div>' +
      '</div><div class="panel stack">' +
      '<button class="btn" type="button" data-act="e-sablon-kaydet">Koşulları şablon olarak kaydet</button>' +
      (isNew ? '' : '<button class="btn" type="button" data-act="e-kopya">Kopyasını oluştur</button>') +
      (!isNew && E.durum === 'onaylandi' && can('rego_fatura') ? '<button class="btn" type="button" data-act="e-faturala">Fatura kaydı oluştur</button>' : '') +
      (!isNew && (E.durum === 'onaylandi' || E.durum === 'faturalandi') && can('rego_proje_edit') ? '<button class="btn" type="button" data-act="e-proje">Proje aç</button>' : '') +
      (!isNew && can('rego_sil') ? '<button class="btn danger" type="button" data-act="e-sil">Teklifi sil</button>' : '') +
      '<a class="btn ghost" href="#teklif">← Tekliflere dön</a></div></aside>';

    return dl + '<div class="head"><div><h1>' + (isNew ? 'Yeni fiyat teklifi' : esc(E.firma || 'Teklif')) + '</h1><p class="sub">' + (isNew ? 'Firma, kalemler ve koşulları girin; PDF hazır formatta çıkar.' : esc(E.no) + ' · ' + fmtD(E.tarih)) + '</p></div></div>' +
      '<div class="ed" data-root="E"><div class="stack" style="gap:16px">' + musteri + items + gal + kos + ek + '</div>' + side + '</div>';
  }
  function hzOptions(E) {
    var hs = hazirlayanlar().slice();
    if (!E.gonderen_ad) { var u = user(E.gonderen_id); if (u) { E.gonderen_ad = displayName(u); E.gonderen_email = u.email; E.gonderen_tel = u.tel; } }
    if (E.gonderen_ad && !hs.some(function (h) { return h.ad === E.gonderen_ad; })) hs.push({ ad: E.gonderen_ad, email: E.gonderen_email, tel: E.gonderen_tel });
    return hs.map(function (h, i) { return '<option value="' + esc(h.ad) + '"' + (h.ad === E.gonderen_ad ? ' selected' : '') + '>' + esc(h.ad) + '</option>'; }).join('');
  }
  function fld(label, control, cls) {
    var id = (control.match(/id="([^"]+)"/) || [])[1] || '';
    return '<label class="f' + (cls ? ' ' + cls : '') + '"' + (id ? ' for="' + id + '"' : '') + '>' + esc(label) + control + '</label>';
  }
  function kosEditor(F, root) {
    return '<div class="kos">' + (F.kosullar || []).map(function (k, i) {
      return '<div class="ko"><div class="c-b"><input class="inp" id="' + root + 'ko' + i + 'b" data-bind="kosullar.' + i + '.baslik" list="dl-kos" value="' + esc(k.baslik) + '" placeholder="Başlık" aria-label="Koşul başlığı"></div>' +
        '<div class="c-m"><textarea class="inp" id="' + root + 'ko' + i + 'm" data-bind="kosullar.' + i + '.metin" data-auto rows="2" aria-label="Koşul metni">' + esc(k.metin) + '</textarea></div>' +
        '<div class="ctl"><button class="icon-btn" type="button" data-act="kos-up" data-i="' + i + '" aria-label="Yukarı taşı" title="Yukarı taşı">↑</button><button class="icon-btn" type="button" data-act="kos-down" data-i="' + i + '" aria-label="Aşağı taşı" title="Aşağı taşı">↓</button><button class="icon-btn x" type="button" data-act="kos-del" data-i="' + i + '" aria-label="Koşulu sil" title="Koşulu sil">×</button></div></div>';
    }).join('') + '</div>' +
      '<div class="row" style="margin-top:10px;justify-content:space-between"><button class="btn sm" type="button" data-act="kos-add">+ Koşul ekle</button>' +
      '<span class="hint">Madde: <code>- metin</code> · Alt madde: <code>  - metin</code> · Kalın: <code>**metin**</code> · Bağlantı: <code>[buradan](https://…)</code> · Tablo: <code>| A | B |</code></span></div>';
  }
  function totalsHtml(E) {
    var o = {};
    E.kalemler.forEach(function (k) { o[k.para] = (o[k.para] || 0) + (Number(k.miktar) || 0) * (Number(k.fiyat) || 0); });
    var ks = PARA.filter(function (p) { return o[p]; });
    if (!ks.length) return '<div class="muted small">Kalem fiyatı girildiğinde toplam burada görünür.</div>';
    return ks.map(function (p) {
      return '<div><span>Ara toplam</span><b>' + esc(money(o[p], p)) + '</b></div><div class="muted"><span>KDV %20</span><span>' + esc(money(o[p] * 0.2, p)) + '</span></div><div class="g"><span>Genel toplam</span><span>' + esc(money(o[p] * 1.2, p)) + '</span></div>';
    }).join('');
  }
  AFTER.teklif = function () {
    if (!st.id) return;
    var f = $('#e-firma'); if (f && !f.value) f.focus();
  };

  function onEditorInput(el) {
    var E = st.forms.E; if (!E) return;
    var p = el.dataset.bind;
    if (p === 'firma') {
      var m = list('musteri').find(function (x) { return lc(x.firma) === lc(el.value.trim()); });
      var was = E.musteri_id;
      E.musteri_id = m ? m.id : 0;
      if (m && m.id !== was) {
        var bos = !E.kisiler.some(function (k) { return String(k.ad || '').trim(); });
        var ks = kisilerOf(m.id);
        if (bos && ks.length) E.kisiler = [{ ad: ks[0].ad, hitap: ks[0].hitap || 'Bey', gorev: ks[0].gorev, email: ks[0].email, tel: ks[0].tel }];
        if (!E._hitapManual) E.hitap = autoHitap(E);
        rerenderEditorKeepFocus('e-firma');
        return;
      }
    }
    if (p === 'firma') { var fd = $('#e-firma-durum'); if (fd) fd.innerHTML = firmaDurum(E); }
    if (p === 'hitap') E._hitapManual = el.value.trim() !== '' && el.value !== autoHitap(E);
    if (/^kisiler\./.test(p) && !E._hitapManual) { E.hitap = autoHitap(E); var hi = $('#e-hitap'); if (hi) hi.value = E.hitap; }
    if (/^kalemler\./.test(p)) {
      var i = +p.split('.')[1], k = E.kalemler[i];
      var t = $('[data-tot="' + i + '"]'); if (t) t.textContent = money((k.miktar || 0) * (k.fiyat || 0), k.para);
      $('#ed-totals').innerHTML = totalsHtml(E);
    }
  }

  function firmaDurum(E) {
    if (!String(E.firma || '').trim()) return 'Kayıtlı bir firma seçin ya da “+ Yeni müşteri” ile ekleyin.';
    if (E.musteri_id) { var n = kisilerOf(E.musteri_id).length; return '<span style="color:var(--ok);font-weight:700">✓ Kayıtlı müşteri</span>' + (n ? ' · ' + n + ' kayıtlı kişi' : ''); }
    return '<span style="color:var(--accent);font-weight:700">Yeni müşteri</span> · teklif kaydedilince müşterilere eklenecek. Şehir, sektör gibi bilgileri girmek için “+ Yeni müşteri”yi kullanın.';
  }
  function rerenderEditorKeepFocus(id) {
    var el = document.getElementById(id), pos = el && el.selectionStart, y = window.scrollY;
    render(); window.scrollTo(0, y);
    var n = document.getElementById(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} }
  }
  function editorPayload(E) {
    var o = {};
    ['musteri_id', 'firma', 'kisiler', 'hitap', 'tarih', 'gonderen_id', 'gonderen_ad', 'gonderen_email', 'gonderen_tel', 'durum', 'kalemler', 'kosullar', 'gorseller', 'ek_baslik', 'ek_metin', 'ek_yeni_sayfa', 'toplam_goster'].forEach(function (k) { o[k] = E[k]; });
    if (!o.hitap) o.hitap = autoHitap(E);
    return o;
  }
  function saveEditor() {
    var E = st.forms.E;
    if (!E.firma.trim()) { toast('Firma adını girin.', true); $('#e-firma').focus(); return Promise.reject(new Error('skip')); }
    if (!E.kalemler.some(function (k) { return String(k.ad).trim(); })) { toast('En az bir ürün veya hizmet girin.', true); return Promise.reject(new Error('skip')); }
    var path = E.id ? 'teklif/' + E.id : 'teklif';
    return api(path, E.id ? 'PUT' : 'POST', editorPayload(E)).then(function (r) {
      upsert('teklif', r.item);
      if (r.musteri) upsert('musteri', r.musteri);
      kisiSync(r);
      var wasNew = !E.id;
      st.forms.E = clone(r.item); st.forms.E._hitapManual = E._hitapManual;
      if (!st.forms.E.kisiler || !st.forms.E.kisiler.length) st.forms.E.kisiler = [blankKisi()];
      st.dirty = false;
      if (wasNew) { history.replaceState(null, '', '#teklif/' + r.item.id); st.id = String(r.item.id); }
      render();
      return r.item;
    });
  }

  function faturaBody() {
    var tab = st.tab.fatura || 'acik';
    var all = list('fatura').filter(function (f) { return match([f.no, firma(f.musteri_id)].join(' ')); });
    var t = today();
    var groups = {
      acik: all.filter(function (f) { return !f.odendi; }),
      gec: all.filter(function (f) { return !f.odendi && f.vade && f.vade < t; }),
      odendi: all.filter(function (f) { return f.odendi; }),
      tum: all
    };
    var rows = groups[tab].slice().sort(function (a, b) { return tab === 'odendi' ? String(b.odeme_tarihi || b.tarih).localeCompare(String(a.odeme_tarihi || a.tarih)) : String(a.vade || a.tarih).localeCompare(String(b.vade || b.tarih)); });
    var tabs = [['acik', 'Açık'], ['gec', 'Gecikmiş'], ['odendi', 'Ödendi'], ['tum', 'Tümü']];
    var ay = t.slice(0, 7);
    return '' +
      '<div class="tabs" role="tablist">' + tabs.map(function (x) { return '<button class="tab" role="tab" type="button" data-act="tab" data-k="fatura" data-v="' + x[0] + '" aria-selected="' + (tab === x[0]) + '">' + x[1] + ' (' + groups[x[0]].length + ')</button>'; }).join('') + '</div>' +
      '<section class="panel"><div class="tablewrap"><table class="t"><thead><tr><th>Fatura no</th><th>Müşteri</th><th>Teklif</th><th>Düzenleme</th><th>Vade</th><th>Durum</th><th class="r">Tutar (KDV dahil)</th><th></th></tr></thead><tbody>' +
      (rows.map(function (f) {
        var tk = f.teklif_id ? byId('teklif', f.teklif_id) : null;
        return '<tr class="click" data-act="fatura-edit" data-id="' + f.id + '"><td class="mono">' + esc(f.no || '—') + '</td><td class="strong">' + esc(firma(f.musteri_id)) + '</td><td>' + (tk ? '<a href="#teklif/' + tk.id + '" data-stop="1">' + esc(tk.no) + '</a>' : '—') + '</td><td class="num">' + fmtD(f.tarih) + '</td><td class="num">' + fmtD(f.vade) + '</td><td>' + invState(f) + '</td><td class="r num strong">' + esc(money(f.tutar, f.para)) + '</td>' +
          '<td class="r">' + (f.odendi ? '<span class="small muted">' + fmtD(f.odeme_tarihi) + '</span>' : '<button class="btn sm" type="button" data-act="fatura-ode" data-id="' + f.id + '">Tahsil edildi</button>') + '</td></tr>';
      }).join('') || emptyRow(8, 'Bu listede fatura yok.', tab === 'acik' ? ' Onaylanan tekliften “Fatura kaydı oluştur” ile ekleyebilirsiniz.' : '')) +
      '</tbody></table></div></section>';
  }

  function sumAy(rows, key) { var ay = today().slice(0, 7); return rows.filter(function (x) { return String(x[key] || '').indexOf(ay) === 0; }); }
  function hv(h) { return { para: h.para, v: Number(h.tutar) }; }
  function yaklasanOdemeler() {
    var lim = addDays(today(), 30);
    return list('hareket').filter(function (h) { return h.tur === 'gider' && h.durum === 'bekliyor' && h.tarih <= lim; })
      .sort(function (x, y) { return x.tarih.localeCompare(y.tarih); });
  }
  function hareketState(h) {
    if (h.durum === 'odendi') return chip('ok', h.tur === 'gelir' ? 'Alındı' : 'Ödendi');
    if (h.tarih < today()) return chip('bad', 'Gecikmiş');
    var g = Math.round((dt(h.tarih) - dt(today())) / 864e5);
    return chip('warn', g === 0 ? 'Bugün' : g === 1 ? 'Yarın' : g + ' gün sonra');
  }
  function odemeLi(h) {
    var d = dt(h.tarih);
    return '<div class="li"><div class="date"><b>' + d.getDate() + '</b><small>' + AY[d.getMonth()] + '</small></div>' +
      '<div style="min-width:0"><div class="t">' + esc(h.aciklama || h.kategori) + '</div><div class="m">' + esc([h.kategori, h.hesap, h.tekrar === 'aylik' ? 'Her ay' : h.tekrar === 'yillik' ? 'Her yıl' : ''].filter(Boolean).join(' · ')) + '</div></div>' +
      '<div class="r"><div class="strong num">' + esc(money(h.tutar, h.para)) + '</div><div class="row" style="justify-content:flex-end;margin-top:4px">' + hareketState(h) + '<button class="btn sm" type="button" data-act="hareket-ode" data-id="' + h.id + '">Ödendi</button></div></div></div>';
  }

  VIEWS.fatura = function () {
    var fat = canFat(), kasa = canKasa();
    var sec = st.tab.finans || (kasa ? 'kasa' : 'fatura');
    if (!kasa) sec = 'fatura'; if (!fat) sec = 'kasa';
    var t = today();
    var H = list('hareket'), F = list('fatura');
    var gelen = sumBy(sumAy(F.filter(function (f) { return f.odendi; }), 'odeme_tarihi').map(fv).concat(sumAy(H.filter(function (h) { return h.tur === 'gelir' && h.durum === 'odendi'; }), 'odeme_tarihi').map(hv)));
    var giden = sumBy(sumAy(H.filter(function (h) { return h.tur === 'gider' && h.durum === 'odendi'; }), 'odeme_tarihi').map(hv));
    var yak = yaklasanOdemeler(), gecO = yak.filter(function (h) { return h.tarih < t; });
    var acik = F.filter(function (f) { return !f.odendi; });
    var btns = (fat ? '<button class="btn" type="button" data-act="fatura-new">+ Fatura kaydı</button>' : '') +
      (kasa ? '<button class="btn" type="button" data-act="hareket-new" data-tur="gelir">+ Gelir (faturasız)</button><button class="btn primary" type="button" data-act="hareket-new" data-tur="gider">+ Gider / ödeme</button>' : '');
    var sums = '<section class="panel"><div class="sums">' +
      '<div><span class="lab">Bu ay gelen</span><b class="num" style="color:var(--ok)">' + esc(sumTxt(gelen)) + '</b></div>' +
      (kasa ? '<div><span class="lab">Bu ay ödenen</span><b class="num">' + esc(sumTxt(giden)) + '</b></div>' : '') +
      (fat ? '<div><span class="lab">Bekleyen tahsilat</span><b class="num">' + esc(sumTxt(sumBy(acik.map(fv)))) + '</b></div>' : '') +
      (kasa ? '<div><span class="lab">Yaklaşan ödemeler (30 gün)</span><b class="num"' + (gecO.length ? ' style="color:var(--bad)"' : '') + '>' + esc(sumTxt(sumBy(yak.map(hv)))) + '</b>' + (gecO.length ? '<span class="small" style="color:var(--bad)">' + gecO.length + ' gecikmiş ödeme</span>' : '') + '</div>' : '') +
      '</div></section>';
    var sw = fat && kasa ? '<div class="seg" role="tablist" style="width:max-content"><button type="button" role="tab" data-act="tab" data-k="finans" data-v="fatura" aria-pressed="' + (sec === 'fatura') + '">Faturalar</button><button type="button" role="tab" data-act="tab" data-k="finans" data-v="kasa" aria-pressed="' + (sec === 'kasa') + '">Gelir ve giderler</button></div>' : '';
    return '<div class="head"><div><h1>Finans</h1><p class="sub">' + (kasa ? 'Faturalı tahsilatlar, faturasız ödemeler ve kira gibi giderler. ' : '') + 'e-Fatura ayrı sisteminizden kesilir.</p></div><div class="row">' + btns + '</div></div>' +
      sums + sw + (sec === 'kasa' ? kasaBody() : faturaBody());
  };

  function kasaBody() {
    var tab = st.tab.kasa || 'tum';
    var all = list('hareket').filter(function (h) { return match([h.aciklama, h.kategori, h.hesap, firma(h.musteri_id)].join(' ')); });
    var groups = {
      tum: all,
      bekleyen: all.filter(function (h) { return h.durum === 'bekliyor'; }),
      gelir: all.filter(function (h) { return h.tur === 'gelir'; }),
      gider: all.filter(function (h) { return h.tur === 'gider'; })
    };
    var rows = groups[tab].slice().sort(function (x, y) { return tab === 'bekleyen' ? x.tarih.localeCompare(y.tarih) : y.tarih.localeCompare(x.tarih) || y.id - x.id; });
    var tabs = [['tum', 'Tümü'], ['bekleyen', 'Bekleyen'], ['gelir', 'Gelirler'], ['gider', 'Giderler']];
    return '<div class="tabs" role="tablist">' + tabs.map(function (x) { return '<button class="tab" role="tab" type="button" data-act="tab" data-k="kasa" data-v="' + x[0] + '" aria-selected="' + (tab === x[0]) + '">' + x[1] + ' (' + groups[x[0]].length + ')</button>'; }).join('') + '</div>' +
      '<section class="panel"><div class="tablewrap"><table class="t"><thead><tr><th>Tarih</th><th>Açıklama</th><th>Müşteri</th><th>Ödeme şekli</th><th>Durum</th><th class="r">Tutar</th><th></th></tr></thead><tbody>' +
      (rows.map(function (h) {
        var g = h.tur === 'gelir';
        return '<tr class="click" data-act="hareket-edit" data-id="' + h.id + '"><td class="num">' + fmtD(h.tarih) + '</td>' +
          '<td><div class="strong">' + esc(h.aciklama || h.kategori || '—') + '</div><div class="small muted">' + esc([g ? 'Gelir' : 'Gider', h.kategori].filter(Boolean).join(' · ')) + (h.tekrar !== 'yok' ? ' · <span class="svc">' + (h.tekrar === 'aylik' ? 'Her ay' : 'Her yıl') + '</span>' : '') + '</div></td>' +
          '<td>' + esc(h.musteri_id ? firma(h.musteri_id) : '—') + '</td><td>' + esc(h.hesap || '—') + '</td><td>' + hareketState(h) + '</td>' +
          '<td class="r num strong" style="color:' + (g ? 'var(--ok)' : 'var(--fg)') + '">' + (g ? '+' : '−') + ' ' + esc(money(h.tutar, h.para)) + '</td>' +
          '<td class="r">' + (h.durum === 'bekliyor' ? '<button class="btn sm" type="button" data-act="hareket-ode" data-id="' + h.id + '">' + (g ? 'Alındı' : 'Ödendi') + '</button>' : '') + '</td></tr>';
      }).join('') || emptyRow(7, 'Bu listede kayıt yok.', ' Faturasız gelen ödemeleri ve kira gibi giderleri yukarıdaki düğmelerle ekleyin.')) +
      '</tbody></table></div></section>';
  }

  VIEWS.saha = function () {
    var L = list('saha').filter(function (s) { return match([s.is_tanimi, s.konum, s.ekip, firma(s.musteri_id)].join(' ')); });
    var up = L.filter(function (s) { return s.tarih >= today() && s.durum !== 'tamamlandi' && s.durum !== 'iptal'; }).sort(function (a, b) { return (a.tarih + a.saat).localeCompare(b.tarih + b.saat); });
    var past = L.filter(function (s) { return up.indexOf(s) < 0; }).sort(function (a, b) { return (b.tarih + b.saat).localeCompare(a.tarih + a.saat); }).slice(0, 15);
    var ed = can('rego_saha_edit');
    if (!st.cal) { var n = new Date(); st.cal = [n.getFullYear(), n.getMonth()]; }
    function li(s) {
      var d = dt(s.tarih), done = s.durum === 'tamamlandi', iptal = s.durum === 'iptal';
      return '<div class="li sli"><div class="date"><b>' + d.getDate() + '</b><small>' + AY[d.getMonth()] + '</small></div>' +
        '<div style="min-width:0"><div class="t">' + esc(s.is_tanimi) + (done ? ' ' + chip('ok', 'Tamamlandı') : iptal ? ' ' + chip('mute', 'İptal') : '') + '</div>' +
        '<div class="m">' + esc([firma(s.musteri_id) !== '—' ? firma(s.musteri_id) : '', s.konum].filter(Boolean).join(' · ')) + '</div></div>' +
        '<div class="m sli-r"><span class="mono">' + esc(s.saat || '') + '</span><br>' + esc(s.ekip || '') + '</div>' +
        (ed ? '<div class="sli-a">' + (!done && !iptal ? '<button class="btn sm" type="button" data-act="saha-done" data-id="' + s.id + '">Tamamlandı</button>' : '') + '<button class="btn sm ghost" type="button" data-act="saha-edit" data-id="' + s.id + '">Düzenle</button></div>' : '') +
        '</div>';
    }
    return '<div class="head"><div><h1>Saha randevuları</h1><p class="sub">Yerinde tarama ve ölçüm ziyaretleri</p></div>' + (ed ? '<button class="btn primary" type="button" data-act="saha-new">+ Ziyaret planla</button>' : '') + '</div>' +
      '<section class="grid2"><div class="panel"><div class="panel-h"><h2>Yaklaşan</h2><span class="chip c-info">' + up.length + ' ziyaret</span></div><div class="list">' + (up.map(li).join('') || '<p class="empty"><b>Planlı ziyaret yok.</b>' + (ed ? '“+ Ziyaret planla” ile ekleyin.' : '') + '</p>') + '</div>' +
      (past.length ? '<h3 style="margin:18px 0 6px">Geçmiş ve tamamlanan</h3><div class="list">' + past.map(li).join('') + '</div>' : '') + '</div>' +
      '<div class="panel"><div class="panel-h"><h2>' + AYU[st.cal[1]] + ' ' + st.cal[0] + '</h2><div class="row"><button class="icon-btn" type="button" data-act="cal" data-d="-1" aria-label="Önceki ay">‹</button><button class="icon-btn" type="button" data-act="cal" data-d="1" aria-label="Sonraki ay">›</button></div></div>' + calendar(st.cal[0], st.cal[1]) + '</div></section>';
  };

  /* ---------- shipments ---------- */
  var KARGO_DURUM = {
    gelen: [['bekliyor', 'Bekleniyor'], ['yolda', 'Yolda'], ['teslim', 'Teslim alındı']],
    giden: [['bekliyor', 'Hazırlanıyor'], ['yolda', 'Gönderildi'], ['teslim', 'Teslim edildi']]
  };
  function kargoDurum(k) {
    var lab = (KARGO_DURUM[k.yon].find(function (x) { return x[0] === k.durum; }) || [0, ''])[1];
    if (k.durum === 'teslim') return chip('ok', lab);
    if (k.durum === 'yolda') return chip('info', lab);
    var gec = k.tarih && k.tarih < today();
    return chip(gec ? 'bad' : 'warn', lab + (gec ? ' · gecikti' : ''));
  }
  function kargoKarsi(k) { return k.musteri_id ? firma(k.musteri_id) : (k.karsi || '—'); }
  function yonChip(k) { return k.yon === 'gelen' ? '<span class="yon y-gelen" title="Gelen">↓ Gelen</span>' : '<span class="yon y-giden" title="Giden">↑ Giden</span>'; }
  function kargoAksiyon(k) {
    if (k.durum === 'teslim') return '';
    if (k.yon === 'gelen') return '<button class="btn sm" type="button" data-act="kargo-teslim" data-id="' + k.id + '">Teslim alındı</button>';
    if (k.durum === 'bekliyor') return '<button class="btn sm" type="button" data-act="kargo-gonder" data-id="' + k.id + '">Gönderildi</button>';
    return '<button class="btn sm" type="button" data-act="kargo-teslim" data-id="' + k.id + '">Teslim edildi</button>';
  }
  function acikKargolar() {
    return list('kargo').filter(function (k) { return k.durum !== 'teslim'; })
      .sort(function (a, b) { return String(a.tarih || '9').localeCompare(String(b.tarih || '9')); });
  }

  VIEWS.kargo = function () {
    var tab = st.tab.kargo || 'acik';
    var all = list('kargo').filter(function (k) { return match([kargoKarsi(k), k.icerik, k.kargo_firma, k.takip_no, k.teslim_kisi, k.teslim_yeri].join(' ')); });
    var g = {
      acik: all.filter(function (k) { return k.durum !== 'teslim'; }).sort(function (a, b) { return String(a.tarih || '9').localeCompare(String(b.tarih || '9')); }),
      gelen: all.filter(function (k) { return k.yon === 'gelen'; }),
      giden: all.filter(function (k) { return k.yon === 'giden'; }),
      tum: all
    };
    var A = list('kargo');
    var sayac = function (f) { return A.filter(f).length; };
    var tabs = [['acik', 'Açık'], ['gelen', 'Gelen'], ['giden', 'Giden'], ['tum', 'Tümü']];
    return '<div class="head"><div><h1>Kargo</h1><p class="sub">Gelen ve giden kargolar: kimden, nereden, ne zaman teslim alındı ya da gönderildi.</p></div><div class="row">' +
      '<button class="btn" type="button" data-act="kargo-new" data-yon="gelen">↓ Gelen kargo</button><button class="btn primary" type="button" data-act="kargo-new" data-yon="giden">↑ Giden kargo</button></div></div>' +
      '<section class="panel"><div class="sums">' +
      '<div><span class="lab">Gelecek kargo</span><b class="num">' + sayac(function (k) { return k.yon === 'gelen' && k.durum !== 'teslim'; }) + '</b></div>' +
      '<div><span class="lab">Gönderilecek</span><b class="num">' + sayac(function (k) { return k.yon === 'giden' && k.durum === 'bekliyor'; }) + '</b></div>' +
      '<div><span class="lab">Yolda (giden)</span><b class="num">' + sayac(function (k) { return k.yon === 'giden' && k.durum === 'yolda'; }) + '</b></div>' +
      '<div><span class="lab">Bu ay teslim</span><b class="num">' + sayac(function (k) { return k.durum === 'teslim' && String(k.teslim_tarihi || '').slice(0, 7) === today().slice(0, 7); }) + '</b></div>' +
      '</div></section>' +
      '<div class="tabs" role="tablist">' + tabs.map(function (x) { return '<button class="tab" role="tab" type="button" data-act="tab" data-k="kargo" data-v="' + x[0] + '" aria-selected="' + (tab === x[0]) + '">' + x[1] + ' (' + g[x[0]].length + ')</button>'; }).join('') + '</div>' +
      '<section class="panel"><div class="tablewrap"><table class="t"><thead><tr><th>Yön</th><th>Kimden / Kime</th><th>İçerik</th><th>Kargo</th><th>Tarih</th><th>Durum</th><th>Teslim</th><th></th></tr></thead><tbody>' +
      (g[tab].map(function (k) {
        return '<tr class="click" data-act="kargo-edit" data-id="' + k.id + '"><td>' + yonChip(k) + '</td><td class="strong">' + esc(kargoKarsi(k)) + '</td><td>' + esc(k.icerik || '—') + '</td>' +
          '<td>' + esc(k.kargo_firma || '—') + (k.takip_no ? '<div class="mono small muted">' + esc(k.takip_no) + '</div>' : '') + '</td>' +
          '<td class="num">' + fmtD(k.tarih) + '</td><td>' + kargoDurum(k) + '</td>' +
          '<td class="small">' + (k.durum === 'teslim' ? esc([fmtD(k.teslim_tarihi), k.teslim_yeri, k.teslim_kisi].filter(function (x) { return x && x !== '—'; }).join(' · ')) : '<span class="muted">—</span>') + '</td>' +
          '<td class="r">' + kargoAksiyon(k) + '</td></tr>';
      }).join('') || emptyRow(8, tab === 'acik' ? 'Açık kargo yok.' : 'Bu listede kargo yok.', ' Yukarıdaki düğmelerle gelen ya da giden kargo ekleyin.')) +
      '</tbody></table></div></section>';
  };

  function kargoModal(yon, k) {
    var s = B.settings, isNew = !k;
    k = k || { yon: yon, musteri_id: 0, proje_id: 0, karsi: '', icerik: '', kargo_firma: '', takip_no: '', tarih: today(), durum: 'bekliyor', teslim_tarihi: '', teslim_yeri: '', teslim_kisi: '', ucret: '', odeme: '', notlar: '' };
    var gelen = k.yon === 'gelen';
    var karsi = k.musteri_id ? firma(k.musteri_id) : k.karsi;
    modal(isNew ? (gelen ? 'Gelen kargo' : 'Giden kargo') : (gelen ? 'Gelen kargo' : 'Giden kargo') + (k.takip_no ? ' · ' + k.takip_no : ''),
      '<datalist id="dl-mus">' + list('musteri').map(function (m) { return '<option value="' + esc(m.firma) + '">'; }).join('') + '</datalist>' +
      '<datalist id="dl-kfirma">' + (s.kargo_firmalari || []).map(function (f) { return '<option value="' + esc(f) + '">'; }).join('') + '</datalist>' +
      '<datalist id="dl-kyer"><option value="Ofis"><option value="Atölye"><option value="Kargo şubesi"><option value="Müşteriden elden"></datalist>' +
      '<div class="form">' +
      fld(gelen ? 'Kimden' : 'Kime', '<input id="k-karsi" list="dl-mus" value="' + esc(karsi) + '" placeholder="Müşteri ya da tedarikçi adı">') +
      fld(gelen ? 'Ne geliyor' : 'Ne gidiyor', '<input id="k-icerik" value="' + esc(k.icerik) + '" placeholder="Örn. 12 adet döküm parça (tarama için)">') +
      fld('Kargo firması', '<input id="k-firma" list="dl-kfirma" value="' + esc(k.kargo_firma) + '">') +
      fld('Takip numarası', '<input id="k-takip" value="' + esc(k.takip_no) + '" autocomplete="off">') +
      fld(gelen ? 'Beklenen tarih' : 'Gönderim tarihi', '<input id="k-tarih" type="date" value="' + esc(k.tarih || '') + '">') +
      fld('Durum', '<select id="k-durum">' + opt(KARGO_DURUM[k.yon], k.durum) + '</select>') +
      '<div class="full form kteslim"' + (k.durum === 'teslim' ? '' : ' hidden') + ' id="k-teslim-w">' +
      fld(gelen ? 'Teslim alındığı tarih' : 'Teslim edildiği tarih', '<input id="k-ttarih" type="date" value="' + esc(k.teslim_tarihi || today()) + '">') +
      (gelen ? fld('Nerede teslim alındı', '<input id="k-tyer" list="dl-kyer" value="' + esc(k.teslim_yeri) + '" placeholder="Ofis, atölye, kargo şubesi…">') +
        fld('Teslim alan', '<input id="k-tkisi" list="dl-ekip" value="' + esc(k.teslim_kisi || (isNew ? displayName(B.me) : '')) + '">') : fld('Teslim alan (alıcı tarafı)', '<input id="k-tkisi" value="' + esc(k.teslim_kisi) + '">')) +
      '</div>' +
      (gelen ? '' : fld('Kargo ücreti', '<input id="k-ucret" inputmode="decimal" value="' + esc(k.ucret ? num(k.ucret) : '') + '" placeholder="₺">') +
        fld('Ödeme', '<select id="k-odeme">' + opt([['', 'Seçin'], ['gonderici', 'Gönderici ödemeli (biz)'], ['alici', 'Alıcı ödemeli']], k.odeme) + '</select>')) +
      fld('Proje (isteğe bağlı)', '<select id="k-pro">' + opt(list('proje').map(function (p) { return [p.id, p.kod + ' · ' + p.ad]; }), k.proje_id, 'Proje yok') + '</select>') +
      fld('Not', '<textarea id="k-not" data-auto rows="2">' + esc(k.notlar || '') + '</textarea>', 'full') +
      '<datalist id="dl-ekip">' + aktifKullanicilar().map(function (u) { return '<option value="' + esc(displayName(u)) + '">'; }).join('') + '</datalist></div>',
      {
        del: !isNew && can('rego_sil') ? function () { return api('kargo/' + k.id, 'DELETE').then(function () { drop('kargo', k.id); toast('Kargo kaydı silindi'); render(); }); } : null,
        submit: function () {
          if (!val('k-karsi') && !val('k-icerik')) { toast((gelen ? 'Kimden' : 'Kime') + ' ya da içerik girin.', true); return false; }
          var m = list('musteri').find(function (x) { return lc(x.firma) === lc(val('k-karsi')); });
          var teslim = val('k-durum') === 'teslim';
          var body = { yon: k.yon, karsi: val('k-karsi'), musteri_id: m ? m.id : 0, icerik: val('k-icerik'), kargo_firma: val('k-firma'), takip_no: val('k-takip'), tarih: val('k-tarih'), durum: val('k-durum'),
            teslim_tarihi: teslim ? (val('k-ttarih') || today()) : '', teslim_yeri: teslim && gelen ? val('k-tyer') : '', teslim_kisi: teslim ? val('k-tkisi') : '',
            ucret: gelen ? 0 : parseNum(val('k-ucret')), odeme: gelen ? '' : val('k-odeme'), proje_id: +val('k-pro'), notlar: val('k-not') };
          return api(isNew ? 'kargo' : 'kargo/' + k.id, isNew ? 'POST' : 'PUT', body).then(function (r) { upsert('kargo', r.item); toast(isNew ? 'Kargo kaydedildi' : 'Kargo güncellendi'); render(); });
        }
      });
    $('#k-durum').addEventListener('change', function (e) { $('#k-teslim-w').hidden = e.target.value !== 'teslim'; });
  }

  function kargoHizliModal(k, mod) {
    var gelen = k.yon === 'gelen';
    var title = mod === 'gonder' ? 'Gönderildi olarak işaretle' : (gelen ? 'Teslim alındı' : 'Teslim edildi');
    modal(title + ': ' + kargoKarsi(k),
      '<datalist id="dl-kyer"><option value="Ofis"><option value="Atölye"><option value="Kargo şubesi"><option value="Müşteriden elden"></datalist>' +
      '<datalist id="dl-ekip">' + aktifKullanicilar().map(function (u) { return '<option value="' + esc(displayName(u)) + '">'; }).join('') + '</datalist><div class="form">' +
      (mod === 'gonder'
        ? fld('Kargo firması', '<input id="q-firma" list="dl-kfirma" value="' + esc(k.kargo_firma) + '"><datalist id="dl-kfirma">' + (B.settings.kargo_firmalari || []).map(function (f) { return '<option value="' + esc(f) + '">'; }).join('') + '</datalist>') +
          fld('Takip numarası', '<input id="q-takip" value="' + esc(k.takip_no) + '">') + fld('Gönderim tarihi', '<input id="q-tarih" type="date" value="' + today() + '">')
        : fld('Tarih', '<input id="q-tarih" type="date" value="' + today() + '">') +
          (gelen ? fld('Nerede teslim alındı', '<input id="q-yer" list="dl-kyer" value="Ofis">') + fld('Teslim alan', '<input id="q-kisi" list="dl-ekip" value="' + esc(displayName(B.me)) + '">') : fld('Teslim alan (alıcı tarafı)', '<input id="q-kisi">'))) +
      '</div>',
      {
        ok: 'Kaydet',
        submit: function () {
          var body = mod === 'gonder' ? { durum: 'yolda', kargo_firma: val('q-firma'), takip_no: val('q-takip'), tarih: val('q-tarih') || today() }
            : { durum: 'teslim', teslim_tarihi: val('q-tarih') || today(), teslim_yeri: gelen ? val('q-yer') : '', teslim_kisi: val('q-kisi') };
          return api('kargo/' + k.id, 'PUT', body).then(function (r) { upsert('kargo', r.item); toast(title); render(); });
        }
      });
  }

  VIEWS.kullanici = function () {
    var opts = [['rego_yonetici', 'Yönetici'], ['rego_satis', 'Satış'], ['rego_saha', 'Saha ekibi'], ['pasif', 'Pasif (giriş yapamaz)']];
    return '<div class="head"><div><h1>Kullanıcılar</h1><p class="sub">Panel kullanıcıları ve yetkileri</p></div><button class="btn primary" type="button" data-act="kullanici-new">+ Kullanıcı ekle</button></div>' +
      '<section class="panel"><div class="tablewrap"><table class="t"><thead><tr><th>Ad soyad</th><th>E-posta</th><th>Telefon</th><th>Rol</th><th></th></tr></thead><tbody>' +
      B.users.filter(function (u, i, a) { return a.findIndex(function (x) { return x.id === u.id; }) === i; }).map(function (u) {
        var fixed = u.rol === 'administrator' || u.id === B.me.id;
        return '<tr><td class="strong">' + esc(u.ad) + (u.id === B.me.id ? ' <span class="chip c-info">Siz</span>' : '') + '</td><td>' + esc(u.email) + '</td><td class="mono">' + esc(u.tel || '—') + '</td><td>' +
          (fixed ? esc(ROLES[u.rol] || u.rol) : '<select class="inp" style="width:auto" data-act-change="rol" data-id="' + u.id + '" aria-label="' + esc(u.ad) + ' rolü">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (u.rol === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>') + '</td>' +
          '<td class="r"><span class="row" style="justify-content:flex-end;flex-wrap:nowrap">' + (u.rol !== 'administrator' || u.id === B.me.id ? '<button class="btn sm ghost" type="button" data-act="kullanici-duzenle" data-id="' + u.id + '">Düzenle</button>' : '') + (u.rol !== 'administrator' ? '<button class="btn sm" type="button" data-act="sifre-ver" data-id="' + u.id + '">Şifre ver</button>' : '') + '</span></td></tr>';
      }).join('') + '</tbody></table></div></section>' +
      '<section class="grid2 even"><div class="panel"><h2 style="margin-bottom:10px">Roller ne yapabilir?</h2><div class="list">' +
      '<div class="li" style="grid-template-columns:110px minmax(0,1fr)"><b>Yönetici</b><span class="m">Her şey: teklif, tahsilat, proje, saha, kullanıcılar ve ayarlar, kayıt silme.</span></div>' +
      '<div class="li" style="grid-template-columns:110px minmax(0,1fr)"><b>Satış</b><span class="m">Müşteri, teklif (PDF) ve tahsilat kayıtları. Projeleri ve sahayı görür.</span></div>' +
      '<div class="li" style="grid-template-columns:110px minmax(0,1fr)"><b>Saha ekibi</b><span class="m">Projeleri ilerletir, saha randevularını yönetir. Fiyat ve tahsilatı görmez.</span></div>' +
      '</div></div><div class="panel"><h2 style="margin-bottom:10px">Yeni kullanıcı nasıl giriş yapar?</h2><p class="m muted" style="margin:0">Eklerken şifre yazarsanız kişi hemen o şifreyle giriş yapar; boş bırakırsanız şifre belirleme e-postası gider. Siteniz e-posta gönderemiyorsa listeden “Şifre ver”i kullanın. Giriş adresi bu sayfanın adresidir; kullanıcı adı yerine e-posta da yazılabilir.</p></div></section>';
  };

  VIEWS.ayarlar = function () {
    var S = st.forms.S || (st.forms.S = clone(B.settings));
    return '<div class="head"><div><h1>Ayarlar</h1><p class="sub">Teklif formunda görünen firma bilgileri, metinler ve koşul şablonları</p></div><button class="btn primary" type="button" data-act="ayar-save">Ayarları kaydet</button></div>' +
      '<div class="stack" style="gap:16px" data-root="S">' +
      '<section class="panel"><div class="panel-h"><div><h2>Panel sürümü</h2><p id="upd-msg">Yüklü sürüm ' + esc(B.version) + '. Yeni sürümler kendiliğinden kurulur; hemen denetlemek için düğmeyi kullanın.</p></div><div class="row"><button class="btn sm" type="button" data-act="upd-check">Güncellemeleri denetle</button><button class="btn sm primary" type="button" data-act="upd-install" hidden id="upd-btn">Şimdi güncelle</button></div></div></section>' +
      '<section class="panel"><div class="panel-h"><div><h2>WhatsApp bildirimleri (resmi, 0850)</h2><p>Meta WhatsApp Business Platform kurulumu bitince doldurun. O zamana kadar hatırlatmalar yalnızca panelde gelir.</p></div>' + (S.wa_aktif && S.wa_token_var ? '<span class="chip c-ok">Açık</span>' : '<span class="chip c-mute">Kapalı</span>') + '</div><div class="form c3">' +
      fld('Telefon numarası kimliği (Phone number ID)', '<input id="s-waid" data-bind="wa_phone_id" value="' + esc(S.wa_phone_id || '') + '" inputmode="numeric">') +
      fld('Kalıcı erişim anahtarı', '<input id="s-watok" data-bind="wa_token" type="password" autocomplete="off" value="" placeholder="' + (S.wa_token_var ? 'Kayıtlı – değiştirmek için yeni anahtarı yapıştırın' : 'EAAG… ile başlar') + '">') +
      fld('Mesaj şablonu adı', '<input id="s-wasb" data-bind="wa_sablon" value="' + esc(S.wa_sablon || 'rego_hatirlatma') + '">') +
      fld('Şablon dili', '<input id="s-wadil" data-bind="wa_dil" value="' + esc(S.wa_dil || 'tr') + '">') +
      fld('Graph API sürümü', '<input id="s-wasur" data-bind="wa_surum" value="' + esc(S.wa_surum || 'v24.0') + '">') +
      '<label class="check" for="s-waon" style="align-self:end;padding-bottom:10px"><input id="s-waon" type="checkbox" data-bind="wa_aktif"' + (S.wa_aktif ? ' checked' : '') + '> Hatırlatmaları WhatsApp’tan da gönder</label>' +
      '<p class="hint full" style="margin:0">Şablon gövdesinde iki değişken olmalı, örneğin: “Rego Panel hatırlatması: {{1}} – {{2}}”. Mesajlar her kişinin Kullanıcılar ekranındaki telefon numarasına gider.</p>' +
      '<div class="full row"><button class="btn sm" type="button" data-act="wa-test">Bana test mesajı gönder</button><span class="hint" id="wa-sonuc"></span></div>' +
      '</div></section>' +
      '<section class="panel"><h2 style="margin-bottom:14px">Fatura bilgileri (PDF alt kısmı)</h2><div class="form c3">' +
      fld('Firma unvanı', '<input id="s-unvan" data-bind="firma_unvan" value="' + esc(S.firma_unvan) + '">') +
      fld('Vergi no', '<input id="s-vn" data-bind="vergi_no" value="' + esc(S.vergi_no) + '">') +
      fld('Telefon', '<input id="s-tel" data-bind="telefon" value="' + esc(S.telefon) + '">') +
      fld('E-posta', '<input id="s-mail" data-bind="email" value="' + esc(S.email) + '">') +
      fld('Web', '<input id="s-web" data-bind="web" value="' + esc(S.web) + '">') +
      fld('Adres', '<textarea id="s-adres" data-bind="adres" data-auto rows="2">' + esc(S.adres) + '</textarea>') +
      '</div></section>' +
      '<section class="panel"><h2 style="margin-bottom:14px">Teklif formu metinleri</h2><div class="form">' +
      fld('Form başlığı', '<input id="s-baslik" data-bind="teklif_baslik" value="' + esc(S.teklif_baslik) + '">') +
      fld('Teklif no öneki', '<input id="s-onek" data-bind="teklif_onek" value="' + esc(S.teklif_onek) + '">') +
      fld('Giriş metni (hitaptan sonra)', '<textarea id="s-giris" data-bind="giris_metni" data-auto rows="2">' + esc(S.giris_metni) + '</textarea>', 'full') +
      fld('KDV notu (tablo altı)', '<input id="s-kdv" data-bind="kdv_notu" value="' + esc(S.kdv_notu) + '">', 'full') +
      fld('Sipariş teyidi metni', '<textarea id="s-teyit" data-bind="teyit_metni" data-auto rows="2">' + esc(S.teyit_metni) + '</textarea>') +
      fld('Sipariş teyidi alt satırı', '<input id="s-teyit2" data-bind="teyit_alt" value="' + esc(S.teyit_alt) + '">') +
      '</div></section>' +
      '<section class="panel"><div class="panel-h"><div><h2>Teklifi hazırlayanlar</h2><p>Teklif ekranındaki “Hazırlayan” listesi. Seçilen kişinin adı, e-postası ve telefonu PDF’te Gönderen bölümüne yazılır.</p></div><button class="btn sm" type="button" data-act="hz-add">+ Kişi ekle</button></div><div class="stack">' +
      (S.hazirlayanlar || []).map(function (h, i) {
        return '<div class="form c4" style="align-items:end">' +
          fld('Ad soyad', '<input id="hz' + i + 'a" data-bind="hazirlayanlar.' + i + '.ad" value="' + esc(h.ad) + '">') +
          fld('E-posta', '<input id="hz' + i + 'e" type="email" data-bind="hazirlayanlar.' + i + '.email" value="' + esc(h.email) + '">') +
          fld('Telefon', '<input id="hz' + i + 't" data-bind="hazirlayanlar.' + i + '.tel" value="' + esc(h.tel) + '">') +
          '<div><button class="btn sm ghost danger" type="button" data-act="hz-del" data-i="' + i + '">Kaldır</button></div></div>';
      }).join('') + '</div></section>' +
      '<section class="panel"><h2 style="margin-bottom:14px">Listeler</h2><div class="form">' +
      fld('Birimler (virgülle ayırın)', '<input id="s-birim" data-bind="birimler" data-csv value="' + esc((S.birimler || []).join(', ')) + '">') +
      fld('Hizmet türleri (virgülle ayırın)', '<input id="s-hizmet" data-bind="hizmetler" data-csv value="' + esc((S.hizmetler || []).join(', ')) + '">') +
      fld('Kargo firmaları (virgülle ayırın)', '<input id="s-kargo" data-bind="kargo_firmalari" data-csv value="' + esc((S.kargo_firmalari || []).join(', ')) + '">') +
      fld('Kişi görevleri (virgülle ayırın)', '<input id="s-gorev" data-bind="gorevler" data-csv value="' + esc((S.gorevler || []).join(', ')) + '">') +
      fld('Gider kategorileri (virgülle ayırın)', '<input id="s-gider" data-bind="gider_kategorileri" data-csv value="' + esc((S.gider_kategorileri || []).join(', ')) + '">') +
      fld('Gelir kategorileri (virgülle ayırın)', '<input id="s-gelir" data-bind="gelir_kategorileri" data-csv value="' + esc((S.gelir_kategorileri || []).join(', ')) + '">') +
      fld('Ödeme şekilleri (virgülle ayırın)', '<input id="s-hesap" data-bind="hesaplar" data-csv value="' + esc((S.hesaplar || []).join(', ')) + '">') +
      '</div></section>' +
      '<section class="panel"><div class="panel-h"><div><h2>Koşul şablonları</h2><p>Teklif ekranında “Şablon seç” listesinde çıkar.</p></div><button class="btn sm" type="button" data-act="sb-new">+ Şablon ekle</button></div><div class="list">' +
      (S.sablonlar || []).map(function (sb, i) {
        return '<div class="li" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="t">' + esc(sb.ad) + '</div><div class="m">' + esc(sb.kosullar.map(function (k) { return k.baslik; }).filter(Boolean).join(' · ')) + (sb.ek_baslik || sb.ek_metin ? ' · Ek açıklama' : '') + '</div></div><div class="row"><button class="btn sm" type="button" data-act="sb-edit" data-i="' + i + '">Düzenle</button><button class="btn sm ghost danger" type="button" data-act="sb-del" data-i="' + i + '">Sil</button></div></div>';
      }).join('') + '</div></section></div>';
  };

  /* ---------- modals ---------- */
  function modal(title, body, opts) {
    opts = opts || {};
    $('#layer').innerHTML = '<div class="scrim" id="mscrim"><form class="modal' + (opts.wide ? ' wide' : '') + '" id="mform" novalidate aria-label="' + esc(title) + '"' + (opts.root ? ' data-root="' + opts.root + '"' : '') + '><h2>' + esc(title) + '</h2>' + body +
      '<div id="mconfirm"></div><div class="modal-f"><div>' + (opts.del ? '<button type="button" class="btn danger" data-act="m-del">Sil</button>' : '') + '</div><div class="row"><button type="button" class="btn" data-act="m-close">Vazgeç</button><button class="btn primary" type="submit">' + esc(opts.ok || 'Kaydet') + '</button></div></div></form></div>';
    var form = $('#mform');
    form.onsubmit = function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type=submit]'); btn.disabled = true;
      Promise.resolve(opts.submit(form)).then(function (ok) { if (ok !== false) closeModal(); else btn.disabled = false; }).catch(function (err) { btn.disabled = false; fail(err); });
    };
    st.modalDel = opts.del || null;
    hatBind();
    $$('textarea[data-auto]', form).forEach(autosize);
    setTimeout(function () { var f = form.querySelector('input:not([type=hidden]),select,textarea'); if (f) f.focus(); }, 0);
  }
  function closeModal() { $('#layer').innerHTML = ''; st.modalDel = null; }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function opt(listArr, sel, emptyLabel) {
    return (emptyLabel != null ? '<option value="0">' + esc(emptyLabel) + '</option>' : '') + listArr.map(function (x) { return '<option value="' + x[0] + '"' + (String(x[0]) === String(sel) ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('');
  }
  function musteriOpts(sel, empty) {
    return opt(list('musteri').map(function (m) { return [m.id, m.firma]; }), sel, empty) +
      (can('rego_musteri_edit') ? '<option value="yeni">+ Yeni müşteri ekle…</option>' : '');
  }
  /* "+ Yeni müşteri ekle" inside another form: a short inline form under the select. */
  function yeniMusteriAc(sel) {
    var lab = sel.closest('label') || sel;
    var box = document.getElementById(sel.id + '-yeni');
    if (sel.value !== 'yeni') { if (box) box.remove(); return; }
    if (box) return;
    box = document.createElement('div');
    box.id = sel.id + '-yeni'; box.className = 'full yeni-mus';
    box.innerHTML = '<div class="row" style="justify-content:space-between"><h3>Yeni müşteri</h3><span class="hint">Kaydedince müşterilere de eklenir</span></div><div class="form c3">' +
      fld('Firma adı', '<input id="' + sel.id + '-yf" required placeholder="Örn. Kazani Otomotiv">') +
      fld('İlgili kişi (isteğe bağlı)', '<input id="' + sel.id + '-yk">') +
      fld('Görevi', '<select id="' + sel.id + '-yg"><option value="">Seçin</option>' + gorevler().map(function (g) { return '<option>' + esc(g) + '</option>'; }).join('') + '</select>') +
      fld('Telefon', '<input id="' + sel.id + '-yt" type="tel">') +
      fld('Şehir', '<input id="' + sel.id + '-ys">') + '</div>';
    lab.insertAdjacentElement('afterend', box);
    var f = document.getElementById(sel.id + '-yf'); if (f) f.focus();
  }
  /** Resolves the customer id of a select, creating the customer first when "+ Yeni müşteri" is chosen. */
  function musteriId(selId) {
    var v = val(selId);
    if (v !== 'yeni') return Promise.resolve(+v || 0);
    var ad = val(selId + '-yf');
    if (!ad) return Promise.reject(new Error('Yeni müşterinin firma adını girin.'));
    var var_ = list('musteri').find(function (m) { return lc(m.firma) === lc(ad); });
    if (var_) return Promise.resolve(var_.id);
    var k = val(selId + '-yk');
    return api('musteri', 'POST', { firma: ad, sehir: val(selId + '-ys'), kisiler: k ? [{ ad: k, gorev: val(selId + '-yg'), tel: val(selId + '-yt'), hitap: 'Bey' }] : [], tel: k ? '' : val(selId + '-yt') })
      .then(function (r) { kisiSync(r); upsert('musteri', r.item); return r.item.id; });
  }
  function withMus(selId, body, send) {
    return musteriId(selId).then(function (mid) { body.musteri_id = mid; return send(); });
  }

  function musteriModal(m, onSaved) {
    var ed = can('rego_musteri_edit');
    m = m || { firma: '', kisi: '', hitap: 'Bey', email: '', tel: '', sehir: '', sektor: '', notlar: '' };
    var extra = '';
    if (m.id) {
      var ts = list('teklif').filter(function (t) { return t.musteri_id === m.id; }).slice(0, 5);
      var ps = list('proje').filter(function (p) { return p.musteri_id === m.id; }).slice(0, 5);
      extra = '<div class="grid2 even" style="gap:12px">' +
        (can('rego_teklif') ? '<div><h3 style="margin-bottom:6px">Teklifler</h3><div class="list">' + (ts.map(function (t) { return '<div class="li" style="grid-template-columns:minmax(0,1fr) auto;padding:6px 0"><a href="#teklif/' + t.id + '" data-act="m-close">' + esc(t.no) + '</a><span class="small">' + esc(teklifTop(t)) + '</span></div>'; }).join('') || '<span class="small muted">Teklif yok.</span>') + '</div></div>' : '') +
        '<div><h3 style="margin-bottom:6px">Projeler</h3><div class="list">' + (ps.map(function (p) { return '<div class="li" style="grid-template-columns:minmax(0,1fr) auto;padding:6px 0"><span class="small">' + esc(p.ad) + '</span>' + stageChip(p.asama) + '</div>'; }).join('') || '<span class="small muted">Proje yok.</span>') + '</div></div></div>';
    }
    var dis = ed ? '' : ' disabled';
    var mk = m.id ? kisilerOf(m.id) : [];
    st.forms.M = { kisiler: mk.length ? clone(mk) : [blankKisi()] };
    var kisiBlok = ed ? '<div class="full"><h3 style="margin-bottom:8px">İlgili kişiler</h3><div id="m-kisiler">' + kisiRows(st.forms.M.kisiler, 'mk') + '</div><button class="btn sm" type="button" data-act="kisi-add" style="margin-top:8px">+ Kişi ekle</button></div>'
      : '<div class="full"><h3 style="margin-bottom:8px">İlgili kişiler</h3><div class="list">' + (mk.map(function (k) { return '<div class="li" style="grid-template-columns:minmax(0,1fr) auto;padding:6px 0"><span><b>' + esc(k.ad) + '</b> <span class="muted small">' + esc(k.gorev || '') + '</span></span><span class="small mono">' + esc(k.tel || '') + '</span></div>'; }).join('') || '<span class="small muted">Kişi yok.</span>') + '</div></div>';
    modal(m.id ? m.firma : 'Yeni müşteri',
      '<div class="form">' +
      fld('Firma adı', '<input id="m-firma" required value="' + esc(m.firma) + '"' + dis + '>', 'full') +
      kisiBlok +
      fld('Firma e-postası', '<input id="m-email" type="email" value="' + esc(m.email) + '"' + dis + ' placeholder="info@…">') +
      fld('Firma telefonu', '<input id="m-tel" type="tel" value="' + esc(m.tel) + '"' + dis + '>') +
      fld('Şehir', '<input id="m-sehir" value="' + esc(m.sehir) + '"' + dis + '>') +
      fld('Sektör', '<input id="m-sektor" value="' + esc(m.sektor) + '" placeholder="Otomotiv, kalıp, savunma…"' + dis + '>') +
      fld('Notlar', '<textarea id="m-not" data-auto rows="2"' + dis + '>' + esc(m.notlar || '') + '</textarea>', 'full') + '</div>' + extra,
      {
        root: 'M', wide: true,
        ok: ed ? 'Kaydet' : 'Kapat',
        del: m.id && can('rego_sil') ? function () { return api('musteri/' + m.id, 'DELETE').then(function () { drop('musteri', m.id); toast('Müşteri silindi'); render(); }); } : null,
        submit: function () {
          if (!ed) return true;
          if (!val('m-firma')) { toast('Firma adını girin.', true); return false; }
          var ks = st.forms.M.kisiler.filter(function (k) { return String(k.ad || '').trim(); });
          return api(m.id ? 'musteri/' + m.id : 'musteri', m.id ? 'PUT' : 'POST', { firma: val('m-firma'), kisiler: ks, email: val('m-email'), tel: val('m-tel'), sehir: val('m-sehir'), sektor: val('m-sektor'), notlar: val('m-not') })
            .then(function (r) { kisiSync(r); upsert('musteri', r.item); toast(m.id ? 'Müşteri güncellendi' : 'Müşteri eklendi'); if (onSaved) onSaved(r.item); render(); });
        }
      });
  }

  function projeModal(p) {
    var s = B.settings;
    p = p || { ad: '', musteri_id: 0, hizmet: (s.hizmetler || [])[0] || '', asama: 'onay', teslim: addDays(today(), 14), notlar: '', teklif_id: 0 };
    var full = can('rego_finans') || can('rego_ayarlar') || !p.id;
    var dis = full ? '' : ' disabled';
    modal(p.id ? p.kod + ' · ' + p.ad : 'Yeni proje',
      '<div class="form">' +
      fld('Proje adı', '<input id="p-isim" required value="' + esc(p.ad) + '"' + dis + '>', 'full') +
      fld('Müşteri', '<select id="p-mus"' + dis + '>' + musteriOpts(p.musteri_id, 'Müşteri seçin') + '</select>') +
      fld('Hizmet', '<select id="p-svc"' + dis + '>' + opt((s.hizmetler || []).map(function (h) { return [h, h]; }), p.hizmet) + '</select>') +
      fld('Aşama', '<select id="p-asama">' + opt(STAGES, p.asama) + '</select>') +
      fld('Teslim tarihi', '<input id="p-tes" type="date" value="' + esc(p.teslim || '') + '"' + dis + '>') +
      fld('Not', '<textarea id="p-not" data-auto rows="2" placeholder="Hassasiyet, çıktı formatı…">' + esc(p.notlar || '') + '</textarea>', 'full') + hatFields('proje', p.id, 'yok') + '</div>',
      {
        del: p.id && can('rego_sil') ? function () { return api('proje/' + p.id, 'DELETE').then(function () { drop('proje', p.id); toast('Proje silindi'); render(); }); } : null,
        submit: function () {
          if (!val('p-isim')) { toast('Proje adını girin.', true); return false; }
          var body = { ad: val('p-isim'), musteri_id: +val('p-mus'), hizmet: val('p-svc'), asama: val('p-asama'), teslim: val('p-tes'), notlar: val('p-not'), teklif_id: p.teklif_id || 0, hatirlatma: hatVal() };
          return withMus('p-mus', body, function () { return api(p.id ? 'proje/' + p.id : 'proje', p.id ? 'PUT' : 'POST', body).then(function (r) { hatSync(r); upsert('proje', r.item); toast(p.id ? 'Proje güncellendi' : 'Proje açıldı: ' + r.item.kod); if (!p.id && st.view === 'teklif') go('proje'); else render(); }); });
        }
      });
  }

  function sahaModal(s) {
    s = s || { tarih: addDays(today(), 3), saat: '09:00', musteri_id: 0, proje_id: 0, konum: '', is_tanimi: '', ekip: '', durum: 'planli' };
    var projeler = list('proje').filter(function (p) { return p.asama !== 'teslim' || p.id === s.proje_id; });
    modal(s.id ? 'Saha ziyareti' : 'Saha ziyareti planla',
      '<div class="form">' +
      fld('Yapılacak iş', '<input id="s-is" required value="' + esc(s.is_tanimi) + '" placeholder="Kalıp göz taraması">', 'full') +
      fld('Müşteri', '<select id="s-mus">' + musteriOpts(s.musteri_id, 'Müşteri seçin') + '</select>') +
      fld('Proje (isteğe bağlı)', '<select id="s-pro">' + opt(projeler.map(function (p) { return [p.id, p.kod + ' · ' + p.ad]; }), s.proje_id, 'Proje yok') + '</select>') +
      fld('Konum', '<input id="s-konum" value="' + esc(s.konum) + '" placeholder="İl / ilçe">') +
      fld('Ekip', '<input id="s-ekip" value="' + esc(s.ekip) + '" list="dl-ekip" placeholder="Ad, ad"><datalist id="dl-ekip">' + B.users.map(function (u) { return '<option value="' + esc(u.ad) + '">'; }).join('') + '</datalist>') +
      fld('Tarih', '<input id="s-tarih" type="date" required value="' + esc(s.tarih) + '">') +
      fld('Saat', '<input id="s-saat" type="time" value="' + esc(s.saat) + '">') +
      fld('Durum', '<select id="s-durum">' + opt([['planli', 'Planlı'], ['tamamlandi', 'Tamamlandı'], ['iptal', 'İptal']], s.durum) + '</select>') + hatFields('saha', s.id, 'gun09') + '</div>',
      {
        del: s.id && can('rego_sil') ? function () { return api('saha/' + s.id, 'DELETE').then(function () { drop('saha', s.id); toast('Ziyaret silindi'); render(); }); } : null,
        submit: function () {
          if (!val('s-is') || !val('s-tarih')) { toast('İş tanımı ve tarih gerekli.', true); return false; }
          var body = { is_tanimi: val('s-is'), musteri_id: +val('s-mus'), proje_id: +val('s-pro'), konum: val('s-konum'), ekip: val('s-ekip'), tarih: val('s-tarih'), saat: val('s-saat'), durum: val('s-durum'), hatirlatma: hatVal() };
          if (body.hatirlatma && body.hatirlatma.kural !== 'yok' && !body.hatirlatma.alicilar.length) { toast('Hatırlatma için en az bir kişi seçin.', true); return false; }
          return withMus('s-mus', body, function () { return api(s.id ? 'saha/' + s.id : 'saha', s.id ? 'PUT' : 'POST', body).then(function (r) { hatSync(r); upsert('saha', r.item); toast(s.id ? 'Ziyaret güncellendi' : 'Ziyaret planlandı'); render(); }); });
        }
      });
  }

  function faturaModal(f) {
    f = f || { no: '', musteri_id: 0, teklif_id: 0, tarih: today(), vade: addDays(today(), 15), tutar: '', para: '₺', odendi: 0, odeme_tarihi: '', notlar: '' };
    modal(f.id ? 'Fatura kaydı' : 'Yeni fatura kaydı',
      '<div class="form">' +
      fld('Müşteri', '<select id="f-mus" required>' + musteriOpts(f.musteri_id, 'Müşteri seçin') + '</select>') +
      fld('Fatura no (e-Fatura)', '<input id="f-no" value="' + esc(f.no) + '" placeholder="RGF2026000000064">') +
      fld('Tutar (KDV dahil)', '<input id="f-tutar" inputmode="decimal" required value="' + esc(f.tutar !== '' ? num(f.tutar) : '') + '">') +
      fld('Para birimi', '<select id="f-para">' + opt(PARA.map(function (p) { return [p, p]; }), f.para) + '</select>') +
      fld('Düzenleme tarihi', '<input id="f-tarih" type="date" value="' + esc(f.tarih) + '">') +
      fld('Vade', '<input id="f-vade" type="date" value="' + esc(f.vade || '') + '">') +
      '<label class="check" for="f-odendi"><input id="f-odendi" type="checkbox"' + (f.odendi ? ' checked' : '') + '> Ödendi</label>' +
      fld('Ödeme tarihi', '<input id="f-odt" type="date" value="' + esc(f.odeme_tarihi || '') + '">') +
      fld('Not', '<textarea id="f-not" data-auto rows="2">' + esc(f.notlar || '') + '</textarea>', 'full') + '</div>',
      {
        del: f.id && can('rego_sil') ? function () { return api('fatura/' + f.id, 'DELETE').then(function () { drop('fatura', f.id); toast('Fatura kaydı silindi'); render(); }); } : null,
        submit: function () {
          if (!+val('f-mus') && val('f-mus') !== 'yeni') { toast('Müşteri seçin.', true); return false; }
          var od = $('#f-odendi').checked;
          var body = { musteri_id: +val('f-mus'), no: val('f-no'), tutar: parseNum(val('f-tutar')), para: val('f-para'), tarih: val('f-tarih'), vade: val('f-vade'), odendi: od, odeme_tarihi: od ? (val('f-odt') || today()) : '', notlar: val('f-not'), teklif_id: f.teklif_id || 0 };
          return withMus('f-mus', body, function () { return api(f.id ? 'fatura/' + f.id : 'fatura', f.id ? 'PUT' : 'POST', body).then(function (r) { upsert('fatura', r.item); toast(f.id ? 'Fatura kaydı güncellendi' : 'Fatura kaydı eklendi'); render(); }); });
        }
      });
  }

  function hareketModal(tur, h) {
    var s = B.settings;
    var gelir = (h ? h.tur : tur) === 'gelir';
    var isNew = !h;
    h = h || { tur: tur, aciklama: '', kategori: gelir ? 'Hizmet bedeli' : '', tutar: '', para: '₺', tarih: today(), durum: gelir ? 'odendi' : 'odendi', hesap: (s.hesaplar || [])[0] || 'Banka', musteri_id: 0, tekrar: 'yok', notlar: '' };
    var kats = gelir ? (s.gelir_kategorileri || []) : (s.gider_kategorileri || []);
    var durumOpts = gelir ? [['odendi', 'Hesaba geçti'], ['bekliyor', 'Bekleniyor']] : [['odendi', 'Ödendi'], ['bekliyor', 'Ödenecek']];
    modal(isNew ? (gelir ? 'Gelir ekle (faturasız ödeme)' : 'Gider / ödeme ekle') : (gelir ? 'Gelir kaydı' : 'Gider kaydı'),
      '<datalist id="dl-kat">' + kats.map(function (k) { return '<option value="' + esc(k) + '">'; }).join('') + '</datalist><div class="form">' +
      fld('Açıklama', '<input id="h-acik" value="' + esc(h.aciklama) + '" placeholder="' + (gelir ? 'Örn. Altan Mekatronik – yerinde tarama' : 'Örn. Ekim kirası') + '">', 'full') +
      fld('Tutar', '<input id="h-tutar" inputmode="decimal" required value="' + esc(h.tutar !== '' ? num(h.tutar) : '') + '">') +
      fld('Para birimi', '<select id="h-para">' + opt(PARA.map(function (x) { return [x, x]; }), h.para) + '</select>') +
      fld('Kategori', '<input id="h-kat" list="dl-kat" value="' + esc(h.kategori) + '" placeholder="Listeden seçin ya da yazın">') +
      fld(gelir ? 'Tarih' : 'Ödeme tarihi / son gün', '<input id="h-tarih" type="date" required value="' + esc(h.tarih) + '">') +
      fld('Durum', '<select id="h-durum">' + opt(durumOpts, h.durum) + '</select>') +
      fld('Ödeme şekli', '<select id="h-hesap">' + opt((s.hesaplar || []).concat(h.hesap && (s.hesaplar || []).indexOf(h.hesap) < 0 ? [h.hesap] : []).map(function (x) { return [x, x]; }), h.hesap) + '</select>') +
      (gelir ? fld('Müşteri (isteğe bağlı)', '<select id="h-mus">' + musteriOpts(h.musteri_id, 'Müşteri yok') + '</select>') : '') +
      fld('Tekrar', '<select id="h-tekrar">' + opt([['yok', 'Tekrarlamaz'], ['aylik', 'Her ay'], ['yillik', 'Her yıl']], h.tekrar) + '</select>') +
      '<p class="hint full" style="margin:-4px 0 0">Tekrarlayan kayıt ödendi olarak işaretlenince bir sonraki dönemin ödemesi kendiliğinden eklenir.</p>' +
      fld('Not', '<textarea id="h-not" data-auto rows="2">' + esc(h.notlar || '') + '</textarea>', 'full') + hatFields('hareket', h.id, gelir ? 'yok' : 'gun09') +
      '<p class="hint full" style="margin:-6px 0 0">Hatırlatma yalnızca ödeme bekleyen kayıtlarda gönderilir; ödendi işaretlenince iptal olur.</p></div>',
      {
        del: !isNew && can('rego_sil') ? function () { return api('hareket/' + h.id, 'DELETE').then(function () { drop('hareket', h.id); toast('Kayıt silindi'); render(); }); } : null,
        submit: function () {
          var tutar = parseNum(val('h-tutar'));
          if (!(tutar > 0)) { toast('Tutarı girin.', true); return false; }
          if (!val('h-acik') && !val('h-kat')) { toast('Açıklama ya da kategori girin.', true); return false; }
          var body = { hatirlatma: hatVal(), tur: gelir ? 'gelir' : 'gider', aciklama: val('h-acik'), tutar: tutar, para: val('h-para'), kategori: val('h-kat'), tarih: val('h-tarih'), durum: val('h-durum'), hesap: val('h-hesap'), musteri_id: gelir ? +val('h-mus') : 0, tekrar: val('h-tekrar'), notlar: val('h-not') };
          if (body.durum === 'odendi' && h.durum !== 'odendi') body.odeme_tarihi = body.tarih <= today() ? body.tarih : today();
          return withMus('h-mus', body, function () { return api(isNew ? 'hareket' : 'hareket/' + h.id, isNew ? 'POST' : 'PUT', body).then(function (r) {
            hatSync(r); upsert('hareket', r.item); if (r.extra) upsert('hareket', r.extra);
            toast(r.extra ? 'Kaydedildi. Sonraki ödeme ' + fmtD(r.extra.tarih) + ' için eklendi.' : (isNew ? 'Kayıt eklendi' : 'Kayıt güncellendi'));
            if (st.view === 'fatura') st.tab.finans = 'kasa';
            render();
          }); });
        }
      });
    if (isNew && !gelir) {
      // A future date usually means the payment is still to be made.
      var touched = false, ds = $('#h-durum');
      ds.addEventListener('change', function () { touched = true; });
      var sync = function () { if (!touched) ds.value = val('h-tarih') > today() ? 'bekliyor' : 'odendi'; };
      $('#h-tarih').addEventListener('change', sync); $('#h-tarih').addEventListener('input', sync);
    }
  }

  /* ---------- reminders ---------- */
  var HAT_KURAL = {
    saha: [['yok', 'Hatırlatma yok'], ['gun09', 'Aynı gün 09:00'], ['saat1', '1 saat önce'], ['gun1', '1 gün önce 09:00'], ['ozel', 'Tarih ve saat seç']],
    hareket: [['yok', 'Hatırlatma yok'], ['gun09', 'Son gün 09:00'], ['gun1', '1 gün önce 09:00'], ['gun3', '3 gün önce 09:00'], ['ozel', 'Tarih ve saat seç']],
    proje: [['yok', 'Hatırlatma yok'], ['gun09', 'Teslim günü 09:00'], ['gun1', '1 gün önce 09:00'], ['gun3', '3 gün önce 09:00'], ['ozel', 'Tarih ve saat seç']]
  };
  function hatFor(k, id) {
    if (!id) return null;
    var l = (B.hatirlatma || []).filter(function (h) { return h.kaynak === k && h.kaynak_id === id && h.durum !== 'iptal'; });
    return l.length ? l[l.length - 1] : null;
  }
  function fmtDT(s) { if (!s) return ''; var d = new Date(String(s).replace(' ', 'T')); return d.getDate() + ' ' + AY[d.getMonth()] + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function aktifKullanicilar() {
    var seen = {};
    return B.users.filter(function (u) { if (u.rol === 'pasif' || seen[u.id]) return false; seen[u.id] = 1; return true; });
  }
  /* Name shown in people pickers; two accounts with the same name get their e-mail added. */
  function kisiEtiket(u) {
    var ad = displayName(u);
    var ayni = aktifKullanicilar().filter(function (x) { return x.id !== u.id && lc(displayName(x)) === lc(ad); }).length;
    return ayni ? ad + ' (' + u.email + ')' : ad;
  }
  function alicilarHtml(sel) {
    sel = (sel && sel.length) ? sel : [B.me.id];
    return '<div class="alicilar">' + aktifKullanicilar().map(function (u) {
      return '<label class="check" for="hat-u' + u.id + '"><input type="checkbox" id="hat-u' + u.id + '" class="hat-u" value="' + u.id + '"' + (sel.indexOf(u.id) > -1 ? ' checked' : '') + '> ' + esc(kisiEtiket(u)) + (u.id === B.me.id ? ' <span class="muted small">(siz)</span>' : '') + '</label>';
    }).join('') + '</div>';
  }
  function alicilarVal() { return $$('.hat-u').filter(function (c) { return c.checked; }).map(function (c) { return +c.value; }); }
  function hatFields(k, id, defKural) {
    var h = hatFor(k, id);
    var kural = h ? h.kural : (id ? 'yok' : defKural);
    var zaman = h ? String(h.zaman).slice(0, 16).replace(' ', 'T') : addDays(today(), 1) + 'T09:00';
    var durum = h ? (h.durum === 'gonderildi' ? '<span class="chip c-ok">Gönderildi · ' + esc(fmtDT(h.gonderim || h.zaman)) + '</span>' : '<span class="chip c-info">' + esc(fmtDT(h.zaman)) + '</span>') : '';
    return '<div class="full hat"><div class="row" style="justify-content:space-between"><h3>Hatırlatma</h3>' + durum + '</div><div class="form">' +
      fld('Ne zaman', '<select id="hat-kural">' + opt(HAT_KURAL[k], kural) + '</select>') +
      '<label class="f" for="hat-zaman"' + (kural === 'ozel' ? '' : ' hidden') + ' id="hat-zaman-w">Tarih ve saat<input id="hat-zaman" type="datetime-local" value="' + esc(zaman) + '"></label>' +
      '<div class="full"><span class="hint">Kimlere gitsin</span>' + alicilarHtml(h ? h.alicilar : null) + '</div></div></div>';
  }
  function hatBind() {
    var k = $('#hat-kural'); if (!k) return;
    k.addEventListener('change', function () { $('#hat-zaman-w').hidden = k.value !== 'ozel'; });
  }
  function hatVal() {
    var k = $('#hat-kural'); if (!k) return undefined;
    return { kural: k.value, zaman: val('hat-zaman'), alicilar: alicilarVal() };
  }
  function hatSync(r) { if (r && r.hatirlatma) B.hatirlatma = r.hatirlatma; }

  function hatModal(h) {
    var isNew = !h;
    h = h || { baslik: '', mesaj: '', zaman: addDays(today(), 1) + ' 09:00:00', alicilar: [B.me.id] };
    modal(isNew ? 'Hatırlatma ekle' : 'Hatırlatma',
      '<div class="form">' +
      fld('Başlık', '<input id="g-baslik" value="' + esc(h.baslik) + '" placeholder="Örn. Kazani Otomotiv ile görüşme">', 'full') +
      fld('Tarih ve saat', '<input id="g-zaman" type="datetime-local" value="' + esc(String(h.zaman).slice(0, 16).replace(' ', 'T')) + '">') +
      '<div></div>' +
      fld('Not', '<textarea id="g-not" data-auto rows="2" placeholder="Görüşmede konuşulacaklar, adres, telefon…">' + esc(h.mesaj || '') + '</textarea>', 'full') +
      '<div class="full"><span class="hint">Kimlere gitsin</span>' + alicilarHtml(h.alicilar) + '</div>' +
      (h.durum === 'gonderildi' ? '<p class="hint full" style="margin:0">Bu hatırlatma ' + esc(fmtDT(h.gonderim)) + ' tarihinde gönderildi. Tarihi değiştirip kaydederseniz yeniden gönderilir.</p>' : '') + '</div>',
      {
        del: !isNew && (h.created_by === B.me.id || can('rego_sil')) ? function () { return api('hatirlatma/' + h.id, 'DELETE').then(function () { B.hatirlatma = (B.hatirlatma || []).filter(function (x) { return x.id !== h.id; }); toast('Hatırlatma silindi'); render(); }); } : null,
        submit: function () {
          if (!val('g-baslik') || !val('g-zaman')) { toast('Başlık ile tarih ve saat gerekli.', true); return false; }
          if (!alicilarVal().length) { toast('En az bir kişi seçin.', true); return false; }
          return api(isNew ? 'hatirlatma' : 'hatirlatma/' + h.id, isNew ? 'POST' : 'PUT', { baslik: val('g-baslik'), mesaj: val('g-not'), zaman: val('g-zaman'), alicilar: alicilarVal() })
            .then(function (r) { hatSync(r); toast('Hatırlatma ' + fmtDT(r.item.zaman) + ' için kuruldu'); render(); });
        }
      });
  }
  function hatAc(h) {
    if (h.kaynak === 'genel') return hatModal(h);
    if (h.kaynak === 'saha') { var s = byId('saha', h.kaynak_id); if (s && can('rego_saha_edit')) return sahaModal(s); return go('saha'); }
    if (h.kaynak === 'hareket') { var x = byId('hareket', h.kaynak_id); if (x) return hareketModal(null, x); return go('fatura'); }
    if (h.kaynak === 'proje') { var p = byId('proje', h.kaynak_id); if (p && can('rego_proje_edit')) return projeModal(p); return go('proje'); }
  }

  /* ---------- notifications (bell) ---------- */
  function bilApply(p) {
    if (!p) return;
    var prev = B.bildirim || { items: [] };
    var seen = st.bilMax || 0;
    B.bildirim = p; if (p.hatirlatma) B.hatirlatma = p.hatirlatma;
    var n = $('#bell-n'); if (n) { n.textContent = p.okunmamis > 9 ? '9+' : p.okunmamis; n.hidden = !p.okunmamis; }
    var max = p.items.reduce(function (m, i) { return Math.max(m, i.id); }, 0);
    if (st.bilMax != null) {
      p.items.filter(function (i) { return i.id > seen && !i.okundu; }).reverse().forEach(function (i) {
        toast('Hatırlatma: ' + i.baslik);
        try {
          if (window.Notification && Notification.permission === 'granted') {
            var nt = new Notification(i.baslik, { body: i.mesaj || '', icon: C.logo.replace('logo.png', 'icon.png'), tag: 'rego-' + i.id });
            nt.onclick = function () { window.focus(); bilOku([i.id]); go(i.link || 'dash'); nt.close(); };
          }
        } catch (e) {}
      });
    }
    st.bilMax = Math.max(seen, max);
    void prev;
    if (st.menu && st.menu.classList.contains('bellmenu')) st.menu.innerHTML = bellHtml();
  }
  function bilPoll() { api('bildirim').then(bilApply).catch(function () {}); }
  function bilOku(ids, hepsi) { return api('bildirim/okundu', 'POST', hepsi ? { hepsi: 1 } : { ids: ids }).then(bilApply).catch(fail); }
  function ago(s) {
    var ref = B.bildirim && B.bildirim.simdi ? new Date(String(B.bildirim.simdi).replace(' ', 'T')).getTime() : Date.now();
    var d = (ref - new Date(String(s).replace(' ', 'T')).getTime()) / 60000;
    if (d < 1) return 'şimdi'; if (d < 60) return Math.round(d) + ' dk önce'; if (d < 1440) return Math.round(d / 60) + ' saat önce';
    return fmtDT(s);
  }
  function bellHtml() {
    var p = B.bildirim || { items: [], okunmamis: 0 };
    var perm = window.Notification ? Notification.permission : 'unsupported';
    return '<div class="bell-h"><b>Bildirimler</b>' + (p.okunmamis ? '<button type="button" class="btn sm ghost" data-act="bil-hepsi">Tümünü okundu say</button>' : '') + '</div>' +
      '<div class="bell-l">' + (p.items.map(function (i) {
        return '<button type="button" class="bil-i' + (i.okundu ? '' : ' yeni') + '" data-act="bil-ac" data-id="' + i.id + '" data-link="' + esc(i.link) + '"><i class="dot"></i><span><b>' + esc(i.baslik) + '</b><small>' + esc(i.mesaj || '') + '</small><small class="muted">' + esc(ago(i.created_at)) + '</small></span></button>';
      }).join('') || '<p class="empty small" style="padding:18px 8px"><b>Henüz bildirim yok.</b>Kurduğunuz hatırlatmalar zamanı gelince burada görünür.</p>') + '</div>' +
      '<div class="bell-f">' + (perm === 'default' ? '<button type="button" class="btn sm" data-act="bil-izin">Masaüstü bildirimlerini aç</button>' : perm === 'denied' ? '<span class="hint">Masaüstü bildirimleri tarayıcıda engelli.</span>' : '') +
      '<button type="button" class="btn sm primary" data-act="hat-new">+ Hatırlatma</button></div>';
  }

  /* An account without a real name shows the company name everywhere; ask once whose account it is. */
  function adSorModal() {
    var kullanilan = B.users.filter(function (u) { return u.id !== B.me.id; }).map(function (u) { return lc(u.ad); });
    var secenek = hazirlayanlar().filter(function (h) { return kullanilan.indexOf(lc(h.ad)) < 0; });
    modal('Bu hesap kime ait?',
      '<p style="margin:0">Hesabınızda ad soyad yazılı olmadığı için panelde firma adı görünüyor. Adınızı seçin ya da yazın; hatırlatmalarda, kargo teslimlerinde ve kullanıcı listesinde bu ad görünecek.</p>' +
      '<div class="stack">' + secenek.map(function (h, i) { return '<label class="check" for="as' + i + '"><input type="radio" name="as" id="as' + i + '" value="' + esc(h.ad) + '" data-tel="' + esc(h.tel || '') + '"' + (i === 0 ? ' checked' : '') + '> ' + esc(h.ad) + '</label>'; }).join('') +
      '<label class="check" for="as-x"><input type="radio" name="as" id="as-x" value=""' + (secenek.length ? '' : ' checked') + '> Başka bir ad</label>' +
      '<input class="inp" id="as-ad" placeholder="Ad SOYAD"' + (secenek.length ? ' hidden' : '') + '></div>' +
      fld('Telefon (WhatsApp hatırlatmaları için)', '<input id="as-tel" type="tel" value="' + esc(B.me.tel || (secenek[0] && secenek[0].tel) || '') + '">'),
      {
        ok: 'Kaydet',
        submit: function () {
          var r = $('input[name=as]:checked');
          var ad = r && r.value ? r.value : val('as-ad');
          if (!ad) { toast('Adınızı yazın.', true); return false; }
          return api('profil', 'POST', { ad: ad, tel: val('as-tel') }).then(function (res) { B.me = res.me; B.users = res.users; toast('Teşekkürler, ' + ad.split(' ')[0]); shell(); bindShell(); render(); });
        }
      });
    $$('input[name=as]').forEach(function (x) {
      x.addEventListener('change', function () { $('#as-ad').hidden = x.value !== ''; if (x.value && x.dataset.tel && !val('as-tel')) $('#as-tel').value = x.dataset.tel; if (!x.value) $('#as-ad').focus(); });
    });
  }

  function profilModal() {
    var me = B.me;
    modal('Profilim',
      '<div class="form">' +
      fld('Ad soyad', '<input id="u-isim" required value="' + esc(me.ad) + '">', 'full') +
      fld('E-posta', '<input id="u-mail" type="email" value="' + esc(me.email) + '">') +
      fld('Telefon', '<input id="u-tel" type="tel" value="' + esc(me.tel) + '" placeholder="+90 5xx xxx xx xx">') +
      '<p class="hint full" style="margin:-4px 0 0">Ad, e-posta ve telefonunuz tekliflerde “Gönderen” bölümünde görünür.</p>' +
      fld('Yeni şifre', '<input id="u-pass" type="password" autocomplete="new-password" placeholder="Değiştirmek istemiyorsanız boş bırakın">', 'full') + '</div>',
      {
        submit: function () {
          return api('profil', 'POST', { ad: val('u-isim'), email: val('u-mail'), tel: val('u-tel'), sifre: $('#u-pass').value }).then(function (r) {
            B.me = r.me; B.users = r.users; toast('Profil güncellendi'); shell(); bindShell(); render();
          });
        }
      });
  }

  function kullaniciModal() {
    modal('Kullanıcı ekle',
      '<div class="form">' +
      fld('Ad soyad', '<input id="n-isim" required>', 'full') +
      fld('E-posta', '<input id="n-mail" type="email" required>') +
      fld('Telefon', '<input id="n-tel" type="tel">') +
      fld('Rol', '<select id="n-rol">' + opt([['rego_satis', 'Satış'], ['rego_saha', 'Saha ekibi'], ['rego_yonetici', 'Yönetici']], 'rego_satis') + '</select>') +
      fld('Şifre (isteğe bağlı)', '<input id="n-sifre" type="text" autocomplete="new-password" placeholder="En az 8 karakter">') +
      '<p class="hint full" style="margin:0">Şifre yazarsanız kullanıcı hemen o şifreyle giriş yapabilir. Boş bırakırsanız şifresini belirlemesi için e-posta gönderilir.</p></div>',
      {
        ok: 'Kullanıcıyı ekle',
        submit: function () {
          if (!val('n-isim') || !val('n-mail')) { toast('Ad ve e-posta gerekli.', true); return false; }
          if (val('n-sifre') && val('n-sifre').length < 8) { toast('Şifre en az 8 karakter olmalı.', true); return false; }
          return api('kullanici', 'POST', { ad: val('n-isim'), email: val('n-mail'), tel: val('n-tel'), rol: val('n-rol'), sifre: val('n-sifre') }).then(function (r) { B.users = r.users; toast(r.mesaj || 'Kullanıcı eklendi'); render(); });
        }
      });
  }

  function sablonModal(i) {
    var S = st.forms.S;
    var sb = i == null ? { ad: '', kosullar: [{ baslik: 'Ödeme Şartları', metin: '' }, { baslik: 'Teslim Süresi', metin: 'Öngörülen teslim tarihleri teklifimizde belirtilmiştir.' }], ek_baslik: '', ek_metin: '', ek_yeni_sayfa: 0 } : clone(S.sablonlar[i]);
    st.forms.SB = sb;
    function body() {
      return '<datalist id="dl-kos">' + KOS_BASLIK.map(function (b) { return '<option value="' + esc(b) + '">'; }).join('') + '</datalist><div class="form">' +
        fld('Şablon adı', '<input id="sb-isim" data-bind="ad" required value="' + esc(sb.ad) + '">', 'full') + '</div>' +
        '<h3>Koşullar</h3><div id="sb-kos">' + kosEditor(sb, 'SB') + '</div><h3>Ek açıklama</h3><div class="form">' +
        fld('Başlık', '<input id="sb-ekb" data-bind="ek_baslik" value="' + esc(sb.ek_baslik) + '">', 'full') +
        fld('Metin', '<textarea id="sb-ekm" data-bind="ek_metin" data-auto rows="3">' + esc(sb.ek_metin) + '</textarea>', 'full') +
        '<label class="check full" for="sb-ekn"><input id="sb-ekn" type="checkbox" data-bind="ek_yeni_sayfa"' + (sb.ek_yeni_sayfa ? ' checked' : '') + '> Yeni sayfada başlat</label></div>';
    }
    modal(i == null ? 'Yeni koşul şablonu' : 'Şablonu düzenle', body(), {
      wide: true, root: 'SB', ok: 'Şablonu kaydet',
      submit: function () {
        if (!sb.ad.trim()) { toast('Şablon adı gerekli.', true); return false; }
        if (i == null) S.sablonlar.push(sb); else S.sablonlar[i] = sb;
        return saveSettings().then(function () { toast('Şablon kaydedildi'); });
      }
    });
  }
  function saveSettings() {
    return api('ayarlar', 'POST', st.forms.S).then(function (r) { B.settings = r.settings; st.forms.S = clone(r.settings); render(); });
  }

  /* ---------- menus ---------- */
  function openMenu(anchor, html) {
    closeMenu();
    var m = document.createElement('div'); m.className = 'menu'; m.innerHTML = html;
    anchor.parentElement.style.position = 'relative';
    anchor.parentElement.appendChild(m); st.menu = m;
    var f = m.querySelector('button,a'); if (f) f.focus();
  }
  function closeMenu() { if (st.menu) { st.menu.remove(); st.menu = null; } }

  /* ---------- events ---------- */
  function autosize(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 2, 600) + 'px'; }

  function formRoot(el) { var r = el.closest('[data-root]'); return r ? r.dataset.root : null; }

  function onInput(e) {
    var el = e.target;
    if (el.id === 'q') {
      st.q = lc(el.value.trim());
      if (st.q && ['dash', 'kullanici', 'ayarlar'].indexOf(st.view) > -1) { st.view = 'ara'; }
      else if (!st.q && st.view === 'ara') st.view = 'dash';
      if (st.view === 'teklif' && st.id) return;
      var pos = el.selectionStart; render(); var q = $('#q'); q.focus(); try { q.setSelectionRange(pos, pos); } catch (x) {}
      return;
    }
    if (el.matches('textarea[data-auto]')) autosize(el);
    if (!el.dataset.bind) return;
    var root = formRoot(el); var F = root && st.forms[root]; if (!F) return;
    var v;
    if (el.type === 'checkbox') v = el.checked ? 1 : 0;
    else if (el.hasAttribute('data-num')) v = parseNum(el.value);
    else if (el.hasAttribute('data-int')) v = parseInt(el.value, 10) || 0;
    else if (el.hasAttribute('data-csv')) v = el.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    else v = el.value;
    setPath(F, el.dataset.bind, v);
    if (root === 'E') { st.dirty = true; onEditorInput(el); }
    if (root === 'S') st.dirty = true;
  }

  function rerenderKos(root) {
    if (root === 'E') { var y = window.scrollY; render(); window.scrollTo(0, y); return; }
    var box = $('#sb-kos'); if (box) { box.innerHTML = kosEditor(st.forms.SB, 'SB'); $$('textarea[data-auto]', box).forEach(autosize); }
  }

  function onClick(e) {
    var stop = e.target.closest('[data-stop]');
    if (stop) { e.stopPropagation(); return; }
    var g = e.target.closest('[data-go]');
    if (g && !e.target.closest('[data-act]:not(tr)')) { e.preventDefault(); closeMenu(); hideCalPop(true); go(g.dataset.go); return; }
    var a = e.target.closest('[data-act]');
    if (!a) { if (st.menu && !e.target.closest('.menu')) closeMenu(); if (!e.target.closest('#calpop')) hideCalPop(true); return; }
    var act = a.dataset.act, id = +a.dataset.id, i = a.dataset.i != null ? +a.dataset.i : null;
    if (a.closest('#calpop')) hideCalPop(true);
    var root = formRoot(a);
    switch (act) {
      case 'cal-day':
        var cp = $('#calpop');
        if (cp && cp.dataset.d === a.dataset.d && !st.calHover) { hideCalPop(true); break; }
        st.calHover = false; showCalPop(a);
        var only = dayEvents(a.dataset.d);
        if (only.length === 1 && e.detail > 0 && window.matchMedia('(hover: hover)').matches) { var o = only[0]; hideCalPop(true); if (o.act) { var fake = document.createElement('button'); fake.dataset.act = o.act; fake.dataset.id = o.id; document.body.appendChild(fake); fake.click(); fake.remove(); } else go(o.go); }
        break;
      case 'bell':
        if (st.menu && st.menu.classList.contains('bellmenu')) { closeMenu(); break; }
        openMenu(a, bellHtml()); st.menu.classList.add('bellmenu'); bilPoll();
        break;
      case 'bil-ac': var lk = a.dataset.link; closeMenu(); bilOku([id]); go(lk || 'dash'); break;
      case 'bil-hepsi': bilOku(null, true); break;
      case 'bil-izin':
        try { Notification.requestPermission().then(function (p) { toast(p === 'granted' ? 'Masaüstü bildirimleri açıldı' : 'Masaüstü bildirimlerine izin verilmedi', p !== 'granted'); if (st.menu) st.menu.innerHTML = bellHtml(); }); } catch (er) { fail(er); }
        break;
      case 'hat-new': closeMenu(); hatModal(); break;
      case 'kargo-new': kargoModal(a.dataset.yon); break;
      case 'e-yeni-mus':
        var E4 = st.forms.E;
        var var4 = list('musteri').find(function (m) { return lc(m.firma) === lc(E4.firma.trim()); });
        musteriModal(var4 || { firma: E4.firma.trim(), email: '', tel: '', sehir: '', sektor: '', notlar: '' }, function (item) {
          E4.firma = item.firma; E4.musteri_id = item.id;
          var ks = kisilerOf(item.id);
          var bos = !E4.kisiler.some(function (k) { return String(k.ad || '').trim(); });
          if (ks.length && bos) E4.kisiler = ks.map(function (k) { return { ad: k.ad, hitap: k.hitap || 'Bey', gorev: k.gorev, email: k.email, tel: k.tel }; }).slice(0, 1);
          else E4.kisiler.forEach(function (q) { var f = ks.find(function (k) { return lc(k.ad) === lc(q.ad); }); if (f) { q.gorev = f.gorev; q.hitap = f.hitap || q.hitap; q.tel = f.tel; q.email = f.email; } });
          if (!E4._hitapManual) E4.hitap = autoHitap(E4);
          st.dirty = true;
        });
        if (!var4 && E4.kisiler.some(function (k) { return String(k.ad || '').trim(); })) {
          // Carry the contacts already typed into the quote over to the new customer form.
          st.forms.M.kisiler = clone(E4.kisiler.filter(function (k) { return String(k.ad || '').trim(); }));
          $('#m-kisiler').innerHTML = kisiRows(st.forms.M.kisiler, 'mk');
        }
        break;
      case 'kargo-edit': kargoModal(null, byId('kargo', id)); break;
      case 'kargo-teslim': kargoHizliModal(byId('kargo', id), 'teslim'); break;
      case 'kargo-gonder': kargoHizliModal(byId('kargo', id), 'gonder'); break;
      case 'gorsel-sil': st.forms.E.gorseller.splice(i, 1); st.dirty = true; rerenderEditorKeepFocus('e-firma'); break;
      case 'gorsel-sol': case 'gorsel-sag':
        var gs = st.forms.E.gorseller, gj = act === 'gorsel-sol' ? i - 1 : i + 1;
        if (gj >= 0 && gj < gs.length) { var gt = gs[i]; gs[i] = gs[gj]; gs[gj] = gt; st.dirty = true; rerenderEditorKeepFocus('e-firma'); }
        break;
      case 'kisi-add':
        if (root === 'E') { st.forms.E.kisiler.push(blankKisi()); st.dirty = true; rerenderEditorKeepFocus('ek' + (st.forms.E.kisiler.length - 1) + 'a'); }
        else if (root === 'M') { st.forms.M.kisiler.push(blankKisi()); $('#m-kisiler').innerHTML = kisiRows(st.forms.M.kisiler, 'mk'); var nk = $('#mk' + (st.forms.M.kisiler.length - 1) + 'a'); if (nk) nk.focus(); }
        break;
      case 'kisi-del':
        var F = st.forms[root];
        F.kisiler.splice(i, 1); if (!F.kisiler.length) F.kisiler.push(blankKisi());
        if (root === 'E') { st.dirty = true; if (!F._hitapManual) F.hitap = autoHitap(F); rerenderEditorKeepFocus('e-firma'); }
        else $('#m-kisiler').innerHTML = kisiRows(F.kisiler, 'mk');
        break;
      case 'hat-edit': var hh = (B.hatirlatma || []).find(function (x) { return x.id === id; }); if (hh) hatAc(hh); break;
      case 'open-drawer': $('#rail').classList.add('open'); $('#scrim').classList.add('open'); break;
      case 'close-drawer': $('#rail').classList.remove('open'); $('#scrim').classList.remove('open'); break;
      case 'user-menu':
        if (st.menu) { closeMenu(); break; }
        openMenu(a, '<button type="button" data-act="profil">Profilim</button>' + (B.admin ? '<a href="' + esc(B.admin) + '">WordPress yönetimi</a>' : '') + '<a href="' + esc(C.home) + '">Siteye dön</a><hr><a href="' + esc(B.logout) + '">Çıkış yap</a>');
        break;
      case 'new-menu':
        if (st.menu) { closeMenu(); break; }
        openMenu(a, [['musteri', 'Müşteri', 'rego_musteri_edit'], ['teklif', 'Fiyat teklifi', 'rego_teklif'], ['proje', 'Proje', 'rego_proje_edit'], ['saha', 'Saha ziyareti', 'rego_saha_edit'], ['fatura', 'Fatura kaydı', 'rego_fatura'], ['gelir', 'Gelir (faturasız ödeme)', 'rego_kasa'], ['gider', 'Gider / ödeme (kira vb.)', 'rego_kasa'], ['hatirlatma', 'Hatırlatma', 'rego_access'], ['kargo-gelen', 'Gelen kargo', 'rego_access'], ['kargo-giden', 'Giden kargo', 'rego_access']]
          .filter(function (x) { return can(x[2]); }).map(function (x) { return '<button type="button" data-act="new" data-k="' + x[0] + '">' + x[1] + '</button>'; }).join(''));
        break;
      case 'new':
        closeMenu();
        ({ musteri: function () { musteriModal(); }, teklif: function () { go('teklif/yeni'); }, proje: function () { projeModal(); }, saha: function () { sahaModal(); }, fatura: function () { faturaModal(); }, gelir: function () { hareketModal('gelir'); }, gider: function () { hareketModal('gider'); }, hatirlatma: function () { hatModal(); }, 'kargo-gelen': function () { kargoModal('gelen'); }, 'kargo-giden': function () { kargoModal('giden'); } })[a.dataset.k]();
        break;
      case 'profil': closeMenu(); profilModal(); break;
      case 'tab': st.tab[a.dataset.k] = a.dataset.v; render(); break;
      case 'para': st.para = a.dataset.p; render(); break;
      case 'cal': var d = new Date(st.cal[0], st.cal[1] + (+a.dataset.d), 1); st.cal = [d.getFullYear(), d.getMonth()]; render(); break;
      case 'musteri-new': musteriModal(); break;
      case 'musteri-edit': musteriModal(byId('musteri', id)); break;
      case 'proje-new': projeModal(); break;
      case 'proje-edit': projeModal(byId('proje', id)); break;
      case 'proje-adv':
        var p = byId('proje', id); var si = STAGES.findIndex(function (s) { return s[0] === p.asama; });
        var next = STAGES[Math.min(si + 1, 3)];
        api('proje/' + id, 'PUT', { asama: next[0] }).then(function (r) { hatSync(r); upsert('proje', r.item); render(); toast(p.kod + ' → ' + next[1]); }).catch(fail);
        break;
      case 'saha-new': sahaModal(); break;
      case 'saha-edit': sahaModal(byId('saha', id)); break;
      case 'saha-done': api('saha/' + id, 'PUT', { durum: 'tamamlandi' }).then(function (r) { hatSync(r); upsert('saha', r.item); render(); toast('Ziyaret tamamlandı'); }).catch(fail); break;
      case 'fatura-new': faturaModal(); break;
      case 'hareket-new': hareketModal(a.dataset.tur); break;
      case 'hareket-edit': hareketModal(null, byId('hareket', id)); break;
      case 'fin-kasa': st.tab.finans = 'kasa'; go('fatura'); break;
      case 'hareket-ode':
        api('hareket/' + id, 'PUT', { durum: 'odendi', odeme_tarihi: today() }).then(function (r) {
          hatSync(r); upsert('hareket', r.item); if (r.extra) upsert('hareket', r.extra); render();
          toast(r.extra ? 'Ödendi. Sonraki ödeme ' + fmtD(r.extra.tarih) + ' için eklendi.' : 'Ödendi olarak kaydedildi');
        }).catch(fail);
        break;
      case 'fatura-edit': faturaModal(byId('fatura', id)); break;
      case 'fatura-ode': e.stopPropagation(); api('fatura/' + id, 'PUT', { odendi: 1, odeme_tarihi: today() }).then(function (r) { upsert('fatura', r.item); render(); toast('Tahsilat kaydedildi'); }).catch(fail); break;
      case 'kullanici-new': kullaniciModal(); break;
      case 'kullanici-duzenle':
        var ku = user(id);
        modal('Kullanıcıyı düzenle', '<div class="form">' + fld('Ad soyad', '<input id="ku-ad" value="' + esc(ku.ad === ku.login ? '' : ku.ad) + '">', 'full') + fld('Telefon', '<input id="ku-tel" type="tel" value="' + esc(ku.tel || '') + '">') + '<p class="hint" style="margin:0;align-self:end">Giriş e-postası: ' + esc(ku.email) + '</p></div>', {
          submit: function () {
            if (!val('ku-ad')) { toast('Ad soyad gerekli.', true); return false; }
            return api('kullanici/' + ku.id + '/bilgi', 'POST', { ad: val('ku-ad'), tel: val('ku-tel') }).then(function (r) { B.users = r.users; if (ku.id === B.me.id) { B.me = r.me; shell(); bindShell(); } toast('Kullanıcı güncellendi'); render(); });
          }
        });
        break;
      case 'sifre-ver':
        var su = user(id);
        modal('Şifre ver: ' + su.ad, '<div class="form">' + fld('Yeni şifre', '<input id="sv-sifre" type="text" autocomplete="new-password" placeholder="En az 8 karakter">', 'full') + '<p class="hint full" style="margin:0">Giriş için e-posta: ' + esc(su.email) + '. Şifreyi kendisine iletin; Profilim ekranından değiştirebilir.</p></div>', {
          ok: 'Şifreyi kaydet',
          submit: function () {
            if (val('sv-sifre').length < 8) { toast('Şifre en az 8 karakter olmalı.', true); return false; }
            return api('kullanici/' + su.id + '/sifre', 'POST', { sifre: val('sv-sifre') }).then(function () { toast('Şifre kaydedildi'); });
          }
        });
        break;
      case 'm-close': closeModal(); break;
      case 'm-del':
        $('#mconfirm').innerHTML = '<div class="confirm-bar">Bu kayıt kalıcı olarak silinsin mi?<span class="row" style="margin-left:auto"><button type="button" class="btn sm" data-act="m-del-no">Vazgeç</button><button type="button" class="btn sm danger" data-act="m-del-yes">Evet, sil</button></span></div>';
        break;
      case 'm-del-no': $('#mconfirm').innerHTML = ''; break;
      case 'm-del-yes': st.modalDel().then(closeModal).catch(fail); break;

      /* editor */
      case 'kalem-add': st.forms.E.kalemler.push({ ad: '', miktar: 1, birim: 'Adet', fiyat: 0, para: (st.forms.E.kalemler.slice(-1)[0] || {}).para || '€', teslim: '' }); st.dirty = true; rerenderKos('E'); var n = st.forms.E.kalemler.length - 1; var t = document.getElementById('k' + n + '-urun'); if (t) t.focus(); break;
      case 'kalem-del': if (st.forms.E.kalemler.length > 1) { st.forms.E.kalemler.splice(i, 1); st.dirty = true; rerenderKos('E'); } else toast('Teklifte en az bir kalem olmalı.', true); break;
      case 'kos-add': st.forms[root].kosullar.push({ baslik: '', metin: '' }); if (root === 'E') st.dirty = true; rerenderKos(root); break;
      case 'kos-del': st.forms[root].kosullar.splice(i, 1); if (root === 'E') st.dirty = true; rerenderKos(root); break;
      case 'kos-up': case 'kos-down':
        var ks = st.forms[root].kosullar, j = act === 'kos-up' ? i - 1 : i + 1;
        if (j >= 0 && j < ks.length) { var tmp = ks[i]; ks[i] = ks[j]; ks[j] = tmp; if (root === 'E') st.dirty = true; rerenderKos(root); }
        break;
      case 'sablon-uygula':
        var sx = $('#e-sablon').value;
        if (sx === '') { toast('Önce bir şablon seçin.', true); break; }
        var sb = B.settings.sablonlar[+sx], E = st.forms.E;
        E.kosullar = clone(sb.kosullar); E.ek_baslik = sb.ek_baslik; E.ek_metin = sb.ek_metin; E.ek_yeni_sayfa = sb.ek_yeni_sayfa; st.dirty = true;
        rerenderKos('E'); toast('“' + sb.ad + '” koşulları uygulandı');
        break;
      case 'e-save': a.disabled = true; saveEditor().then(function () { toast('Teklif kaydedildi'); }).catch(function (er) { a.disabled = false; if (er.message !== 'skip') fail(er); }); break;
      case 'e-pdf':
        var dl = !!a.dataset.dl;
        var win = dl ? null : window.open('about:blank', '_blank');
        var need = st.dirty || !st.forms.E.id;
        (need ? saveEditor() : Promise.resolve(st.forms.E)).then(function (it) {
          var u = pdfUrl(it.id, dl);
          if (dl) location.href = u; else if (win) win.location = u; else window.open(u, '_blank');
        }).catch(function (er) { if (win) win.close(); if (er.message !== 'skip') fail(er); });
        break;
      case 'e-kopya':
        api('teklif/' + st.forms.E.id + '/kopyala', 'POST', {}).then(function (r) { upsert('teklif', r.item); st.forms.E = null; go('teklif/' + r.item.id); toast('Kopya oluşturuldu: ' + r.item.no); }).catch(fail);
        break;
      case 'e-sil':
        var bar = document.createElement('div');
        bar.className = 'confirm-bar'; bar.innerHTML = 'Teklif kalıcı olarak silinsin mi?<span class="row" style="margin-left:auto"><button type="button" class="btn sm" data-act="e-sil-no">Vazgeç</button><button type="button" class="btn sm danger" data-act="e-sil-yes">Evet, sil</button></span>';
        a.replaceWith(bar);
        break;
      case 'e-sil-no': render(); break;
      case 'e-sil-yes': api('teklif/' + st.forms.E.id, 'DELETE').then(function () { drop('teklif', st.forms.E.id); st.dirty = false; go('teklif'); toast('Teklif silindi'); }).catch(fail); break;
      case 'e-sablon-kaydet':
        modal('Koşulları şablon olarak kaydet', '<div class="form">' + fld('Şablon adı', '<input id="sbn" required placeholder="Örn. Yerinde tarama – otomotiv">', 'full') + '<p class="hint full" style="margin:0">Aynı adda şablon varsa üzerine yazılır.</p></div>', {
          submit: function () {
            var E = st.forms.E;
            if (!val('sbn')) { toast('Şablon adı gerekli.', true); return false; }
            return api('sablon', 'POST', { ad: val('sbn'), kosullar: E.kosullar, ek_baslik: E.ek_baslik, ek_metin: E.ek_metin, ek_yeni_sayfa: E.ek_yeni_sayfa }).then(function (r) { B.settings.sablonlar = r.sablonlar; st.forms.S = null; toast('Şablon kaydedildi'); var y = window.scrollY; render(); window.scrollTo(0, y); });
          }
        });
        break;
      case 'e-faturala':
        var E2 = st.forms.E;
        modal('Fatura kaydı oluştur', '<p class="muted" style="margin:0">Teklif toplamına KDV eklenerek her para birimi için bir fatura kaydı açılır: <b>' + esc(sumTxt(E2.toplamlar || {})) + '</b> + KDV.</p><div class="form">' +
          fld('KDV oranı (%)', '<input id="fk-kdv" inputmode="decimal" value="20">') + fld('Vade', '<input id="fk-vade" type="date" value="' + addDays(today(), 15) + '">') +
          fld('e-Fatura no (isteğe bağlı)', '<input id="fk-no">', 'full') + '</div>', {
            ok: 'Oluştur',
            submit: function () {
              return api('teklif/' + E2.id + '/faturala', 'POST', { kdv: parseNum(val('fk-kdv')), vade: val('fk-vade'), no: val('fk-no') }).then(function (r) {
                r.items.forEach(function (f) { upsert('fatura', f); }); upsert('teklif', r.teklif); st.forms.E = null; toast('Fatura kaydı oluşturuldu'); render();
              });
            }
          });
        break;
      case 'e-proje':
        var E3 = st.forms.E;
        projeModal({ ad: String((E3.kalemler[0] || {}).ad || '').replace(/\s*\n\s*/g, ' '), musteri_id: E3.musteri_id, hizmet: (B.settings.hizmetler || [])[0] || '', asama: 'onay', teslim: addDays(today(), 14), notlar: E3.no, teklif_id: E3.id });
        break;

      /* settings */
      case 'ayar-save': a.disabled = true; saveSettings().then(function () { st.dirty = false; toast('Ayarlar kaydedildi'); }).catch(function (er) { a.disabled = false; fail(er); }); break;
      case 'sb-new': sablonModal(null); break;
      case 'upd-check':
        a.disabled = true; $('#upd-msg').textContent = 'Denetleniyor…';
        api('guncelleme').then(function (r) {
          a.disabled = false;
          if (r.error) { $('#upd-msg').textContent = 'Güncelleme sunucusuna ulaşılamadı: ' + r.error; return; }
          $('#upd-msg').textContent = r.new ? 'Yeni sürüm var: ' + r.latest + ' (yüklü: ' + r.current + ').' + (r.notes ? ' ' + r.notes : '') : 'Panel güncel (' + r.current + ').';
          $('#upd-btn').hidden = !r.new;
        }).catch(function (er) { a.disabled = false; fail(er); });
        break;
      case 'upd-install':
        a.disabled = true; $('#upd-msg').textContent = 'Güncelleniyor, lütfen bekleyin…';
        api('guncelleme', 'POST', {}).then(function (r) {
          $('#upd-msg').textContent = r.message; toast(r.message);
          if (r.updated) setTimeout(function () { location.reload(); }, 1500);
        }).catch(function (er) { a.disabled = false; $('#upd-msg').textContent = er.message; fail(er); });
        break;
      case 'wa-test':
        a.disabled = true; $('#wa-sonuc').textContent = 'Kaydediliyor ve gönderiliyor…';
        saveSettings().then(function () { return api('whatsapp-test', 'POST', {}); }).then(function (r) { toast('Sonuç: ' + r.sonuc); var w = $('#wa-sonuc'); if (w) w.textContent = r.sonuc; })
          .catch(function (er) { fail(er); var w = $('#wa-sonuc'); if (w) w.textContent = er.message; }).then(function () { a.disabled = false; });
        break;
      case 'hz-add': st.forms.S.hazirlayanlar = st.forms.S.hazirlayanlar || []; st.forms.S.hazirlayanlar.push({ ad: '', email: '', tel: '' }); st.dirty = true; render(); var hi = document.getElementById('hz' + (st.forms.S.hazirlayanlar.length - 1) + 'a'); if (hi) hi.focus(); break;
      case 'hz-del': st.forms.S.hazirlayanlar.splice(i, 1); st.dirty = true; render(); break;
      case 'sb-edit': sablonModal(i); break;
      case 'sb-del':
        var nm = st.forms.S.sablonlar[i].ad;
        a.outerHTML = '<span class="confirm-bar">Silinsin mi?<button type="button" class="btn sm danger" data-act="sb-del-yes" data-i="' + i + '">Sil</button></span>';
        void nm;
        break;
      case 'sb-del-yes': st.forms.S.sablonlar.splice(i, 1); saveSettings().then(function () { toast('Şablon silindi'); }).catch(fail); break;
    }
  }

  function onChange(e) {
    var el = e.target;
    if (el.tagName === 'SELECT' && /-mus$/.test(el.id)) { yeniMusteriAc(el); return; }
    if (el.id === 'e-gorsel-yukle' && el.files && el.files.length) {
      var files = Array.prototype.slice.call(el.files), E1 = st.forms.E, done = 0;
      var durum = $('#gal-durum'); if (durum) durum.textContent = 'Yükleniyor… 0/' + files.length;
      files.reduce(function (pr, f) {
        return pr.then(function () {
          var fd = new FormData(); fd.append('dosya', f);
          return fetch(C.api + 'gorsel', { method: 'POST', credentials: 'same-origin', headers: { 'X-WP-Nonce': C.nonce }, body: fd })
            .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.message || 'Görsel yüklenemedi.'); return j; }); })
            .then(function (g) { E1.gorseller.push(g); st.dirty = true; done++; var d = $('#gal-durum'); if (d) d.textContent = 'Yükleniyor… ' + done + '/' + files.length; })
            .catch(function (er) { fail(new Error(f.name + ': ' + er.message)); });
        });
      }, Promise.resolve()).then(function () { if (done) toast(done + ' görsel eklendi; teklifi kaydetmeyi unutmayın'); rerenderEditorKeepFocus('e-firma'); });
      return;
    }
    if (el.id === 'e-kayitli' && el.value) {
      var E0 = st.forms.E, kk = (B.kisi || []).find(function (k) { return k.id === +el.value; });
      if (E0 && kk) {
        var add = { ad: kk.ad, hitap: kk.hitap || 'Bey', gorev: kk.gorev, email: kk.email, tel: kk.tel };
        if (E0.kisiler.length === 1 && !String(E0.kisiler[0].ad || '').trim()) E0.kisiler = [add]; else E0.kisiler.push(add);
        if (!E0._hitapManual) E0.hitap = autoHitap(E0);
        st.dirty = true; rerenderEditorKeepFocus('e-firma');
      }
      return;
    }
    if (el.dataset.actChange === 'hazirlayan') {
      var E = st.forms.E, h = hazirlayanlar().find(function (x) { return x.ad === el.value; });
      if (E && h) { E.gonderen_ad = h.ad; E.gonderen_email = h.email || ''; E.gonderen_tel = h.tel || ''; st.dirty = true; }
      return;
    }
    if (el.dataset.actChange === 'rol') {
      var uid = +el.dataset.id;
      api('kullanici/' + uid, 'PUT', { rol: el.value }).then(function (r) { B.users = r.users; toast('Rol güncellendi'); render(); }).catch(function (er) { fail(er); render(); });
      return;
    }
    if (el.dataset.bind && (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'date')) onInput(e);
    if (el.dataset.bind && el.hasAttribute('data-num')) { var v = parseNum(el.value); el.value = v ? num(v) : ''; }
  }

  function bindShell() {
    var q = $('#q'); if (q) q.value = st.q;
  }

  function boot() {
    api('bootstrap').then(function (b) {
      B = b;
      try { sessionStorage.removeItem('rego_reload'); } catch (x) {}
      shell(); bindShell();
      st.bilMax = null; bilApply(b.bildirim); 
      if (!B.me.ad || B.me.ad === B.me.login) setTimeout(adSorModal, 300);
      setInterval(bilPoll, 60000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) bilPoll(); });
      setInterval(function () { nonceYenile(); }, 6 * 3600 * 1000); // keep keys fresh in long-open tabs
      document.addEventListener('click', onClick);
      document.addEventListener('input', onInput);
      document.addEventListener('change', onChange);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { hideCalPop(true); if ($('#mscrim')) closeModal(); closeMenu(); $('#rail').classList.remove('open'); $('#scrim').classList.remove('open'); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && st.view === 'teklif' && st.id) { e.preventDefault(); saveEditor().then(function () { toast('Teklif kaydedildi'); }).catch(function (er) { if (er.message !== 'skip') fail(er); }); }
      });
      document.addEventListener('mousedown', function (e) { if (e.target.id === 'mscrim') closeModal(); });
      document.addEventListener('mouseover', function (e) {
        if (!window.matchMedia('(hover: hover)').matches) return;
        var cell = e.target.closest('.cd.mark'), pop = e.target.closest('#calpop');
        if (cell) { st.calHover = true; showCalPop(cell); }
        else if (pop) clearTimeout(calTimer);
        else if ($('#calpop')) hideCalPop(false);
      });
      document.addEventListener('focusin', function (e) {
        var cell = e.target.closest && e.target.closest('.cd.mark');
        if (cell && cell.matches(':focus-visible')) showCalPop(cell); // keyboard only; taps are handled by click
      });
      window.addEventListener('hashchange', function () {
        if (st.dirty && !st.leaving) {
          var target = location.hash;
          st.leaving = true; history.back();
          setTimeout(function () {
            st.leaving = false;
            modal('Kaydedilmemiş değişiklikler', '<p style="margin:0">Bu sayfada kaydetmediğiniz değişiklikler var. Kaydetmeden çıkarsanız kaybolur.</p>', {
              ok: 'Kaydetmeden çık', submit: function () { st.dirty = false; location.hash = target; }
            });
          }, 30);
          return;
        }
        if (st.leaving) return;
        route();
      });
      window.addEventListener('beforeunload', function (e) { if (st.dirty) { e.preventDefault(); e.returnValue = ''; } });
      route();
    }).catch(function (e) {
      if (st.oturumKapandi && !sessionStorage.getItem('rego_reload')) { try { sessionStorage.setItem('rego_reload', '1'); } catch (x) {} location.reload(); return; }
      document.getElementById('app').innerHTML = '<div class="auth"><div class="auth-card"><h1>Panel açılamadı</h1><p class="sub">' + esc(e.message) + '</p><a class="btn" href="">Sayfayı yenile</a></div></div>';
    });
  }
  boot();
})();
