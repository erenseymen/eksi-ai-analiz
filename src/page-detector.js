/**
 * @fileoverview Ekşi Sözlük AI Analiz - Sayfa Tipi ve Tema Tespiti
 * 
 * Bu dosya sayfa türünü ve tema modunu tespit eder:
 * - URL ve DOM yapısından sayfa tipini belirleme
 * - Dark/Light tema tespiti
 * 
 * Bağımlılıklar: Yok
 */

// =============================================================================
// SAYFA TİPİ TESPİTİ
// =============================================================================

/**
 * URL ve DOM yapısına göre sayfa tipini tespit eder.
 * 
 * Desteklenen sayfa tipleri:
 * - topic-page: Başlık sayfası (/baslik-adi--id)
 * - entry-page: Tek entry sayfası (/entry/id)
 * - home-page: Ana sayfa (/)
 * - gundem-page: Gündem sayfası (/basliklar/gundem)
 * - olay-page: Olay sayfası (/basliklar/olay)
 * - debe-page: DEBE sayfası (/debe)
 * - channel-page: Kanal sayfaları (/basliklar/kanal/*)
 * - author-page: Yazar profil sayfası (/biri/*)
 * - statistics-page: İstatistik sayfaları (/istatistik/*)
 * 
 * @returns {string} Sayfa tipi tanımlayıcısı
 */
const detectPageType = () => {
    const path = window.location.pathname;

    // Başlık sayfası: /baslik-adi--id formatı
    if (/^\/[^\/]+--\d+/.test(path)) {
        return 'topic-page';
    }

    // Ana sayfa
    if (path === '/' || path === '') {
        return 'home-page';
    }

    // Gündem sayfası
    if (path === '/basliklar/gundem') {
        return 'gundem-page';
    }

    // Bugün sayfası
    if (path === '/basliklar/bugun') {
        return 'bugun-page';
    }

    // Çaylaklar bugün sayfası
    if (path === '/basliklar/caylaklar/bugun') {
        return 'caylaklar-bugun-page';
    }

    // Olay sayfası
    if (path === '/basliklar/olay') {
        return 'olay-page';
    }

    // Debe sayfası
    if (path === '/debe') {
        return 'debe-page';
    }

    // Kanal sayfaları
    if (path.startsWith('/basliklar/kanal/')) {
        return 'channel-page';
    }

    // Yazar profil sayfası
    if (path.startsWith('/biri/')) {
        return 'author-page';
    }

    // Entry sayfası
    if (path.startsWith('/entry/')) {
        return 'entry-page';
    }

    // İstatistik sayfaları
    if (path.startsWith('/istatistik/')) {
        return 'statistics-page';
    }

    return 'unknown';
};

// =============================================================================
// TEMA TESPİTİ
// =============================================================================

/**
 * Sayfanın karanlık mod kullanıp kullanmadığını tespit eder.
 * 
 * Body background renginin parlaklığını hesaplar.
 * Parlaklık 128'den düşükse karanlık mod olarak kabul eder.
 * 
 * @returns {boolean} true ise karanlık mod aktif
 */
const detectTheme = () => {
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    const match = bodyBg.match(/\d+/g);
    if (match && match.length >= 3) {
        const [r, g, b] = match.map(Number);
        // Basit parlaklık hesabı: (R + G + B) / 3
        const brightness = (r + g + b) / 3;
        return brightness < 128; // Karanlık mod eşiği
    }
    return false; // Varsayılan olarak açık mod
};
