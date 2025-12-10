/**
 * @fileoverview Ekşi Sözlük AI Analiz - Ana İçerik Script'i
 * 
 * Bu dosya Ekşi Sözlük sayfalarına enjekte edilen ana script'tir.
 * Sayfa tipini tespit ederek uygun başlatma fonksiyonlarını çağırır.
 * 
 * Bağımlılıklar (yükleme sırasına göre):
 * - prompts.js (SYSTEM_PROMPT, DEFAULT_PROMPTS)
 * - constants.js (MODELS, escapeHtml, checkModelAvailability)
 * - utils.js (cache, token, filename utilities)
 * - analysis-history.js (saveToHistory, getHistory)
 * - settings.js (getSettings)
 * - page-detector.js (detectPageType, detectTheme)
 * - scraper.js (scraping functions)
 * - api.js (Gemini API functions)
 * - markdown.js (parseMarkdown)
 * - ui.js (all UI components and handlers)
 */

// =============================================================================
// SAYFA İNİTİALİZASYONU
// =============================================================================

/**
 * Eklentiyi başlatır ve sayfa tipine göre uygun işlemleri yapar.
 */
const init = () => {
    const pageType = detectPageType();

    switch (pageType) {
        case 'topic-page':
            initTopicPage();
            break;
        case 'entry-page':
            initEntryPage();
            break;
        case 'home-page':
        case 'gundem-page':
        case 'olay-page':
        case 'debe-page':
        case 'author-page':
        case 'channel-page':
        case 'statistics-page':
            // Bu sayfalarda buton gösterme
            break;
        default:
            // Desteklenmeyen sayfa tiplerinde buton gösterme
            break;
    }
};

/**
 * Tek başlık sayfası için UI'ı hazırlar.
 */
const initTopicPage = () => {
    let topicHeader = document.getElementById('topic');
    let topicTitleH1 = topicHeader ? topicHeader.querySelector('h1') : document.querySelector('h1');

    if (topicTitleH1 && (!topicHeader || !topicHeader.contains(topicTitleH1))) {
        topicHeader = topicTitleH1.parentElement;
    }

    if (topicTitleH1 && !document.getElementById('eksi-ai-main-btn')) {
        createAnalysisButton(topicTitleH1, null, true);
    }
};

/**
 * Tek entry sayfası için UI'ı hazırlar.
 */
const initEntryPage = () => {
    const heading = document.querySelector('#topic h1') || document.querySelector('h1');
    if (!heading) return;
    createSingleEntryButton(heading);
};

// =============================================================================
// TEMA GÖZLEMCİSİ
// =============================================================================

/**
 * Tema değişikliklerini izler ve UI elementlerini günceller.
 * Sayfa yüklendikten sonra tema değişirse tüm eklenti UI'ları otomatik güncellenir.
 */
const setupThemeObserver = () => {
    // Tüm eklenti container'larını bul ve tema sınıfını güncelle
    const updateAllContainersTheme = () => {
        const isDark = detectTheme();
        document.querySelectorAll('.eksi-ai-container, .eksi-ai-modal-overlay').forEach(el => {
            if (isDark) {
                el.classList.add('eksi-ai-dark');
            } else {
                el.classList.remove('eksi-ai-dark');
            }
        });
    };

    // İlk güncelleme
    updateAllContainersTheme();

    // Body'nin stil değişikliklerini izle
    const observer = new MutationObserver(() => {
        updateAllContainersTheme();
    });

    // Body'nin style ve class değişikliklerini izle
    if (document.body) {
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['style', 'class'],
            subtree: false
        });
    }

    // Sayfa yüklendiğinde tekrar kontrol et
    window.addEventListener('load', updateAllContainersTheme);
    
    // Media query değişikliklerini de izle (sistem teması değişirse)
    if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', updateAllContainersTheme);
    }
};

// =============================================================================
// BAŞLATMA
// =============================================================================

// Sayfa yüklendiğinde eklentiyi başlat
init();

// Tema gözlemcisini başlat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupThemeObserver);
} else {
    setupThemeObserver();
}
