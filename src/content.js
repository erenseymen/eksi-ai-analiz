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
        case 'gundem-page':
            initGundemPage();
            break;
        case 'debe-page':
            initDebePage();
            break;
        case 'author-page':
            initAuthorPage();
            break;
        case 'home-page':
        case 'olay-page':
        case 'channel-page':
        case 'statistics-page':
            // Bu sayfalarda buton gösterme
            break;
        default:
            // Desteklenmeyen sayfa tiplerinde buton gösterme
            break;
    }
    
    // Klavye kısayollarını etkinleştir
    setupKeyboardShortcuts();
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

/**
 * Gündem sayfası için UI'ı hazırlar.
 * Sol paneldeki başlıkları toplu analiz etme özelliği ekler.
 */
const initGundemPage = () => {
    const gundemHeading = document.querySelector('nav h2');
    if (!gundemHeading || document.getElementById('eksi-ai-gundem-btn')) return;
    createGundemAnalysisButton(gundemHeading);
};

/**
 * DEBE sayfası için UI'ı hazırlar.
 * Dünün en beğenilen entry'lerini toplu analiz etme özelliği ekler.
 */
const initDebePage = () => {
    const debeHeading = document.querySelector('nav h2');
    if (!debeHeading || document.getElementById('eksi-ai-debe-btn')) return;
    createDebeAnalysisButton(debeHeading);
};

/**
 * Yazar profil sayfası için UI'ı hazırlar.
 * Yazarın son entry'lerini analiz etme özelliği ekler.
 */
const initAuthorPage = () => {
    const authorHeading = document.querySelector('main h1');
    if (!authorHeading || document.getElementById('eksi-ai-author-btn')) return;
    createAuthorAnalysisButton(authorHeading);
};

/**
 * Klavye kısayollarını ayarlar.
 */
const setupKeyboardShortcuts = () => {
    document.addEventListener('keydown', (e) => {
        // Ctrl+Shift+A: Analiz başlat
        if (e.ctrlKey && e.shiftKey && e.key === 'A') {
            e.preventDefault();
            const mainBtn = document.getElementById('eksi-ai-main-btn') || 
                           document.getElementById('eksi-ai-entry-btn') ||
                           document.getElementById('eksi-ai-gundem-btn') ||
                           document.getElementById('eksi-ai-debe-btn') ||
                           document.getElementById('eksi-ai-author-btn');
            if (mainBtn) mainBtn.click();
        }
        
        // Ctrl+Shift+S: Özet çıkar
        if (e.ctrlKey && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            const ozetBtn = document.getElementById('btn-prompt-0');
            if (ozetBtn) ozetBtn.click();
        }
        
        // Ctrl+Shift+B: Blog yazısı oluştur
        if (e.ctrlKey && e.shiftKey && e.key === 'B') {
            e.preventDefault();
            const blogBtn = document.getElementById('btn-prompt-1');
            if (blogBtn) blogBtn.click();
        }
    });
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
    document.addEventListener('DOMContentLoaded', () => {
        setupThemeObserver();
        createFAB();
    });
} else {
    setupThemeObserver();
    createFAB();
}
