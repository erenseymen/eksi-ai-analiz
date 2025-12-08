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
            initTopicPage();
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
// BAŞLATMA
// =============================================================================

// Sayfa yüklendiğinde eklentiyi başlat
init();
