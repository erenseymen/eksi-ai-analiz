/**
 * @fileoverview Ekşi Sözlük AI Analiz - Ana İçerik Script'i
 * 
 * Bu dosya Ekşi Sözlük sayfalarına enjekte edilen ana script'tir.
 * Temel işlevler:
 * - Entry'leri sayfadan toplama (scraping)
 * - Gemini API ile analiz yapma
 * - Sonuçları Markdown formatında gösterme
 * - Kullanıcı etkileşimlerini yönetme
 * 
 * Desteklenen sayfa türleri:
 * - Başlık sayfaları (/baslik-adi--id)
 * - Tek entry sayfaları (/entry/id)
 * 
 * Bağımlılıklar:
 * - constants.js (SYSTEM_PROMPT, DEFAULT_PROMPTS, escapeHtml)
 * - styles.css (UI stilleri)
 */

// =============================================================================
// GLOBAL DURUM DEĞİŞKENLERİ
// =============================================================================

/** @type {Array<Object>} Toplanan tüm entry'lerin listesi */
let allEntries = [];

/** @type {string} Mevcut başlığın adı */
let topicTitle = "";

/** @type {string} Mevcut başlığın ID'si */
let topicId = "";

/** @type {boolean} Entry toplama işleminin durdurulup durdurulmayacağını belirten bayrak */
let shouldStopScraping = false;

/** @type {Map<string, Object>} Gemini yanıtları için önbellek (anahtar: prompt, değer: yanıt) */
let responseCache = new Map();

/** @type {string|null} Son kullanılan özel prompt (önbellek için) */
let lastCustomPrompt = null;

// =============================================================================
// AYARLAR
// =============================================================================

/**
 * Chrome storage'dan kullanıcı ayarlarını alır.
 * 
 * @returns {Promise<{geminiApiKey: string, selectedModel: string, prompts: Array}>}
 *          Kullanıcı ayarları objesi
 */
const getSettings = async () => {
    return new Promise((resolve) => {
        chrome.storage.sync.get({
            geminiApiKey: '',
            selectedModel: 'gemini-2.5-flash',
            prompts: DEFAULT_PROMPTS
        }, (items) => {
            // Boş veya tanımsız prompt listesi için varsayılan değerleri kullan
            if (!items.prompts || items.prompts.length === 0) {
                items.prompts = DEFAULT_PROMPTS;
            }
            resolve(items);
        });
    });
};

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
// UI BİLEŞENLERİ OLUŞTURMA
// =============================================================================

/**
 * Analiz butonu ve sonuç konteynerini oluşturur.
 * 
 * Verilen h1 elementinin yanına "Entry'leri Analiz Et" butonu ekler.
 * Buton tıklandığında entry toplama ve analiz işlemi başlar.
 * 
 * @param {HTMLElement} h1Element - Butonun ekleneceği başlık elementi
 * @param {string|null} [topicId=null] - Başlık ID'si (benzersiz buton ID'si için)
 * @param {boolean} [useCurrentPage=false] - true ise mevcut sayfadan entry toplar,
 *                                           false ise başlık linkinden toplar
 */
const createAnalysisButton = (h1Element, topicId = null, useCurrentPage = false) => {
    if (!h1Element) {
        console.error('h1Element is required');
        return;
    }

    // Check if button already exists for this topic
    const existingBtnId = topicId ? `eksi-ai-main-btn-${topicId}` : 'eksi-ai-main-btn';
    if (document.getElementById(existingBtnId)) {
        return; // Button already exists
    }

    const btn = document.createElement('button');
    btn.id = existingBtnId;
    btn.className = 'eksi-ai-btn';
    btn.textContent = "Entry'leri Analiz Et";
    
    // Use current page analysis for topic pages, otherwise use topic-specific analysis
    if (useCurrentPage) {
        btn.onclick = startAnalysis;
    } else {
        btn.onclick = () => startAnalysisForTopic(h1Element, topicId);
    }

    // Find the parent container (usually a heading wrapper or topic section)
    let parentContainer = h1Element.parentElement;
    
    // Try to find a more appropriate container
    while (parentContainer && parentContainer !== document.body) {
        // Look for common container patterns
        if (parentContainer.id === 'topic' || 
            parentContainer.classList.contains('topic') ||
            parentContainer.tagName === 'MAIN' ||
            parentContainer.querySelector('ul[ref*="entry"]') ||
            parentContainer.querySelector('#entry-item-list')) {
            break;
        }
        parentContainer = parentContainer.parentElement;
    }

    // Insert button after h1
    if (h1Element.nextSibling) {
        h1Element.parentNode.insertBefore(btn, h1Element.nextSibling);
    } else {
        h1Element.parentNode.appendChild(btn);
    }

    // Create container for results/actions
    const container = document.createElement('div');
    container.id = topicId ? `eksi-ai-container-${topicId}` : 'eksi-ai-container';
    container.className = 'eksi-ai-container';
    container.style.display = 'none';

    // Apply theme
    if (detectTheme()) {
        container.classList.add('eksi-ai-dark');
    }

    // Konteyneri butonun hemen altına ekle
    btn.parentNode.insertBefore(container, btn.nextSibling);
};

// =============================================================================
// ANALİZ İŞLEMLERİ
// =============================================================================

/**
 * Belirli bir başlık için analiz başlatır.
 * 
 * Entry sayfalarında kullanılır. H1 elementinden başlık URL'sini çıkarır,
 * tüm entry'leri toplar ve analiz seçeneklerini gösterir.
 * 
 * @param {HTMLElement} h1Element - Başlık elementi (URL bilgisi içerir)
 * @param {string} topicId - Başlık ID'si (UI elementleri için)
 */
const startAnalysisForTopic = async (h1Element, topicId) => {
    // Check if there's a focusto href on the heading (set by initEntryPage for /entry/ID URLs)
    // This takes priority over the regular topic link
    let topicUrl = h1Element.getAttribute('data-focusto-href');
    
    if (!topicUrl) {
        // Check for stored topic URL (set by initEntryPage)
        topicUrl = h1Element.getAttribute('data-topic-href');
    }
    
    if (!topicUrl) {
        // Extract topic URL from h1 link
        const topicLink = h1Element.querySelector('a');
        if (!topicLink || !topicLink.href) {
            console.error('Topic link not found');
            return;
        }
        topicUrl = topicLink.href;
    }
    const btnId = topicId ? `eksi-ai-main-btn-${topicId}` : 'eksi-ai-main-btn';
    const containerId = topicId ? `eksi-ai-container-${topicId}` : 'eksi-ai-container';
    
    const btn = document.getElementById(btnId);
    const container = document.getElementById(containerId);

    if (!btn || !container) {
        console.error('Button or container not found');
        return;
    }

    // Reset stop flag and clear response cache for new analysis
    shouldStopScraping = false;
    responseCache.clear();
    lastCustomPrompt = null;

    // Change button to "Stop" button
    btn.textContent = "Durdur";
    btn.onclick = stopScraping;
    btn.disabled = false;

    container.style.display = 'block';
    container.innerHTML = '<span class="eksi-ai-loading">Entry\'ler toplanıyor... Lütfen bekleyin.</span>';

    try {
        // Navigate to topic page and scrape entries
        await scrapeEntriesFromUrl(topicUrl);

        // Render actions if we have entries (even if stopped early)
        if (allEntries.length > 0) {
            await renderActions(container, shouldStopScraping);
        } else {
            container.innerHTML = '<div class="eksi-ai-warning">Hiç entry toplanamadı.</div>';
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="eksi-ai-warning">Hata oluştu: ${escapeHtml(err.message)}</div>`;
    } finally {
        // Restore original button
        btn.disabled = false;
        btn.textContent = "Entry'leri Analiz Et";
        btn.onclick = () => startAnalysisForTopic(h1Element, topicId);
    }
};

// =============================================================================
// ENTRY REFERANS İŞLEME
// =============================================================================

/**
 * Entry içeriğinden referans verilen entry ID'lerini çıkarır.
 * 
 * Ekşi Sözlük'te entry'ler arası referans formatı: (bkz: #entry_id)
 * Bu fonksiyon bu formatı arar ve ID'leri listeler.
 * 
 * @param {string} content - Entry içeriği
 * @returns {string[]} Bulunan entry ID'leri listesi
 * 
 * @example
 * extractReferencedEntryIds('Bu konuda (bkz: #12345) entry\'sine bakın')
 * // Döndürür: ['12345']
 */
const extractReferencedEntryIds = (content) => {
    if (!content) return [];
    
    const regex = /\(bkz:\s*#(\d+)\)/gi;
    const matches = [];
    let match;
    
    while ((match = regex.exec(content)) !== null) {
        matches.push(match[1]); // Extract just the entry ID
    }
    
    return matches;
};

/**
 * Belirtilen ID'ye sahip entry'yi API'den alır.
 * 
 * eksisozluk.com/entry/{id} sayfasını fetch eder ve entry verilerini
 * DOM'dan parse eder. Referans entry'leri yüklemek için kullanılır.
 * 
 * @param {string} entryId - Alınacak entry'nin ID'si
 * @returns {Promise<Object|null>} Entry objesi veya hata durumunda null
 *          Entry objesi: {id, author, date, content}
 */
const fetchEntryById = async (entryId) => {
    try {
        const url = `https://eksisozluk.com/entry/${entryId}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            console.warn(`Failed to fetch entry ${entryId}: ${response.status}`);
            return null;
        }
        
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        
        // Find the entry item
        const entryItem = doc.querySelector(`li[data-id="${entryId}"]`) || 
                          doc.querySelector('#entry-item-list > li');
        
        if (!entryItem) {
            console.warn(`Entry element not found for ${entryId}`);
            return null;
        }
        
        const contentElement = entryItem.querySelector('.content');
        const content = extractContentWithFullUrls(contentElement);
        const author = entryItem.querySelector('.entry-author')?.innerText.trim();
        const date = entryItem.querySelector('.entry-date')?.innerText.trim();
        
        if (!content) {
            return null;
        }
        
        return {
            id: entryId,
            author,
            date,
            content
        };
    } catch (err) {
        console.error(`Error fetching entry ${entryId}:`, err);
        return null;
    }
};

/**
 * Tüm referans entry'leri toplu olarak alır ve ana listeye ekler.
 * 
 * allEntries içindeki her entry'nin referenced_entry_ids alanını kontrol eder,
 * eksik entry'leri API'den alır ve referenced_entries alanına tam veriyi ekler.
 * 
 * @param {HTMLElement|null} [statusSpan=null] - İlerleme durumunu gösterecek element
 */
const fetchAllReferencedEntries = async (statusSpan = null) => {
    // Collect all unique referenced entry IDs
    const existingIds = new Set(allEntries.map(e => e.id));
    const referencedIds = new Set();
    
    allEntries.forEach(entry => {
        if (entry.referenced_entry_ids) {
            entry.referenced_entry_ids.forEach(id => {
                if (!existingIds.has(id)) {
                    referencedIds.add(id);
                }
            });
        }
    });
    
    if (referencedIds.size === 0) {
        return;
    }
    
    const idsToFetch = Array.from(referencedIds);
    const fetchedEntries = new Map();
    
    // Fetch each referenced entry
    for (let i = 0; i < idsToFetch.length; i++) {
        if (shouldStopScraping) {
            break;
        }
        
        const entryId = idsToFetch[i];
        if (statusSpan) {
            statusSpan.textContent = `Referans entry'ler alınıyor... (${i + 1}/${idsToFetch.length})`;
        }
        
        const entry = await fetchEntryById(entryId);
        if (entry) {
            fetchedEntries.set(entryId, entry);
        }
        
        // Rate limiting
        if (i < idsToFetch.length - 1) {
            await new Promise(r => setTimeout(r, 300));
        }
    }
    
    // Also include entries from allEntries that are referenced
    allEntries.forEach(entry => {
        if (!fetchedEntries.has(entry.id)) {
            fetchedEntries.set(entry.id, {
                id: entry.id,
                author: entry.author,
                date: entry.date,
                content: entry.content
            });
        }
    });
    
    // Update allEntries with full referenced entry objects
    allEntries.forEach(entry => {
        if (entry.referenced_entry_ids && entry.referenced_entry_ids.length > 0) {
            entry.referenced_entries = entry.referenced_entry_ids
                .map(id => fetchedEntries.get(id) || { id, error: 'Entry bulunamadı' })
                .filter(e => e !== null);
            
            // Remove the temporary IDs field
            delete entry.referenced_entry_ids;
        }
    });
};

// =============================================================================
// İÇERİK ÇIKARMA YARDIMCILARI
// =============================================================================

/**
 * DOM elementinden entry içeriğini çıkarır, kısaltılmış URL'leri tam URL ile değiştirir.
 * 
 * Ekşi Sözlük uzun URL'leri "..." ile kısaltır. Bu fonksiyon href değerini
 * kullanarak tam URL'yi geri yükler. Ayrıca gizli referansları (bkz) açığa çıkarır.
 * Satır sonlarını (<br> etiketlerini) korur.
 * 
 * @param {HTMLElement} contentElement - Entry içeriğini barındıran DOM elementi
 * @returns {string} Temizlenmiş ve URL'leri düzeltilmiş metin içeriği
 */
const extractContentWithFullUrls = (contentElement) => {
    if (!contentElement) return '';
    
    // Clone the element to avoid modifying the DOM
    const clone = contentElement.cloneNode(true);
    
    // Find all links and replace their text with actual href if the text appears to be a truncated URL
    const links = clone.querySelectorAll('a');
    links.forEach(link => {
        const href = link.getAttribute('href');
        const text = link.innerText.trim();
        const title = link.getAttribute('title');
        
        // Check if this looks like a URL link (text starts with http or contains ...)
        // and if the href is a full URL (starts with http)
        if (href && href.startsWith('http')) {
            // If text contains ellipsis (…) or looks like a truncated URL, replace with full href
            if (text.includes('…') || text.includes('...') || 
                (text.startsWith('http') && text !== href)) {
                // Add space before and after the URL for better readability
                link.innerText = ' ' + href + ' ';
            }
        }
        
        // Handle hidden references in title attribute (like "* " links with "(bkz: swh)" titles)
        // These are typically inside <sup class="ab"> elements
        if (title && text === '*') {
            // Replace the asterisk with the asterisk + title content
            // title is typically "(bkz: term)" format
            link.innerText = '* ' + title;
        }
    });
    
    // Replace <br> tags with newline characters to preserve line breaks
    // This must be done before getting innerText, as innerText collapses <br> into spaces
    clone.querySelectorAll('br').forEach(br => {
        br.replaceWith('\n');
    });
    
    return clone.innerText.trim();
};

/**
 * DOM belgesinden entry'leri çıkarır.
 * 
 * Entry listesini DOM'dan parse eder. İsteğe bağlı olarak focusto parametresiyle
 * belirli bir entry'den itibaren filtreleme yapabilir.
 * 
 * @param {Document} doc - Parse edilecek HTML belgesi
 * @param {string|null} [focustoEntryId=null] - Bu ID'den itibaren entry'leri al
 * @returns {{entries: Array, foundFocusEntry: boolean}} Entry listesi ve focusto bulundu mu
 */
const extractEntriesFromDoc = (doc, focustoEntryId = null) => {
    const entries = [];
    let foundFocusEntry = !focustoEntryId; // If no focusto, include all entries
    
    const entryItems = doc.querySelectorAll('#entry-item-list > li');
    entryItems.forEach(item => {
        const id = item.getAttribute('data-id');
        
        // If we have a focusto entry ID, skip entries until we find it
        if (focustoEntryId && !foundFocusEntry) {
            if (id === focustoEntryId) {
                foundFocusEntry = true;
            } else {
                return; // Skip this entry
            }
        }
        
        const contentElement = item.querySelector('.content');
        const content = extractContentWithFullUrls(contentElement);
        const author = item.querySelector('.entry-author')?.innerText.trim();
        const date = item.querySelector('.entry-date')?.innerText.trim();

        if (content) {
            const entry = {
                id,
                author,
                date,
                content
            };
            
            // Extract referenced entry IDs from content (will be populated with full entries later)
            const referencedEntryIds = extractReferencedEntryIds(content);
            if (referencedEntryIds.length > 0) {
                entry.referenced_entry_ids = referencedEntryIds;
            }
            
            entries.push(entry);
        }
    });
    
    return { entries, foundFocusEntry };
};

// =============================================================================
// ENTRY TOPLAMA (SCRAPING)
// =============================================================================

/**
 * Belirtilen URL'den entry'leri toplar.
 * 
 * Başlık sayfasına gider, sayfa sayısını tespit eder ve tüm sayfaları
 * sırayla tarayarak entry'leri toplar. Rate limiting uygular.
 * 
 * Özellikler:
 * - Çok sayfalı başlıkları destekler
 * - focusto parametresini işler (belirli entry'den başlama)
 * - Query parametrelerini korur (?day=, ?a= vb.)
 * - Referans entry'leri otomatik yükler
 * 
 * @param {string} url - Başlık URL'si
 */
const scrapeEntriesFromUrl = async (url) => {
    allEntries = [];
    
    // Parse URL to preserve query parameters
    const urlObj = new URL(url);
    const baseUrl = urlObj.origin + urlObj.pathname;
    const existingParams = new URLSearchParams(urlObj.search);
    
    // Check for focusto parameter
    const focustoEntryId = existingParams.get('focusto');
    
    // Get current page number from URL (if exists)
    const currentPageParam = existingParams.get('p');
    let startPage = currentPageParam ? parseInt(currentPageParam) : 1;
    
    // Remove 'p' parameter if it exists (we'll add it in the loop)
    existingParams.delete('p');
    
    // Build URL for first page fetch with preserved query parameters (without p)
    // Keep focusto parameter as the server uses it to determine which page to show
    const firstPageParams = new URLSearchParams(existingParams);
    const firstPageUrl = firstPageParams.toString() 
        ? `${baseUrl}?${firstPageParams.toString()}`
        : baseUrl;
    
    // Fetch the topic page (first page or focusto page)
    const response = await fetch(firstPageUrl);
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    
    // Extract topic title
    topicTitle = doc.querySelector('h1')?.innerText || doc.querySelector('#topic h1')?.innerText || "Basliksiz";
    
    // Extract topic ID from URL
    const urlMatch = url.match(/--(\d+)/);
    topicId = urlMatch ? urlMatch[1] : '';

    // Determine total pages
    const pager = doc.querySelector('.pager');
    let totalPages = 1;
    if (pager) {
        const lastPageLink = pager.getAttribute('data-pagecount');
        totalPages = parseInt(lastPageLink) || 1;
    }
    
    // If we have focusto, the server redirects to the page containing that entry
    // We need to detect which page we're on
    if (focustoEntryId) {
        const currentPageFromPager = pager?.getAttribute('data-currentpage');
        if (currentPageFromPager) {
            startPage = parseInt(currentPageFromPager) || 1;
        }
    }

    const statusSpan = document.querySelector('.eksi-ai-loading');
    
    // Remove focusto from params for subsequent page fetches (we only need it for the first page)
    existingParams.delete('focusto');

    // If we're starting from a specific page (not page 1), fetch that page
    if (startPage > 1 && !focustoEntryId) {
        // Build URL for the starting page
        const startPageParams = new URLSearchParams(existingParams);
        startPageParams.set('p', startPage.toString());
        const startPageUrl = `${baseUrl}?${startPageParams.toString()}`;
        
        if (statusSpan) statusSpan.textContent = `Sayfa ${startPage}/${totalPages} taranıyor...`;
        
        const startPageResponse = await fetch(startPageUrl);
        const startPageText = await startPageResponse.text();
        const startPageDoc = parser.parseFromString(startPageText, 'text/html');

        const { entries } = extractEntriesFromDoc(startPageDoc);
        allEntries.push(...entries);
    } else {
        // Process first page entries from fetched document (with focusto filtering if applicable)
        const { entries, foundFocusEntry } = extractEntriesFromDoc(doc, focustoEntryId);
        allEntries.push(...entries);
        
        // If focusto entry was not found on this page, something went wrong
        if (focustoEntryId && !foundFocusEntry) {
            console.warn(`focusto entry ${focustoEntryId} not found on page ${startPage}`);
        }
    }

    // Process remaining pages (starting from startPage + 1)
    for (let i = startPage + 1; i <= totalPages; i++) {
        // Check if user requested to stop
        if (shouldStopScraping) {
            if (statusSpan) statusSpan.textContent = `İşlem durduruldu. ${allEntries.length} entry toplandı.`;
            break;
        }

        if (statusSpan) statusSpan.textContent = `Sayfa ${i}/${totalPages} taranıyor...`;

        // Build URL with preserved query parameters + page number (no focusto needed for subsequent pages)
        const params = new URLSearchParams(existingParams);
        params.set('p', i.toString());
        const pageUrl = `${baseUrl}?${params.toString()}`;
        
        const pageResponse = await fetch(pageUrl);
        const pageText = await pageResponse.text();
        const pageDoc = parser.parseFromString(pageText, 'text/html');

        const { entries } = extractEntriesFromDoc(pageDoc);
        allEntries.push(...entries);

        // Be nice to the server
        // Sunucuya yük bindirmemek için bekleme (rate limiting)
        await new Promise(r => setTimeout(r, 500));
    }
    
    // Referans entry'lerin içeriklerini al
    if (!shouldStopScraping) {
        await fetchAllReferencedEntries(statusSpan);
    }
};

// =============================================================================
// SAYFA İNİTİALİZASYONU
// =============================================================================

/**
 * Eklentiyi başlatır ve sayfa tipine göre uygun işlemleri yapar.
 * 
 * Sayfa türünü tespit eder ve uygun init fonksiyonunu çağırır.
 * Ana sayfa, gündem gibi liste sayfalarında buton göstermez.
 */
const init = () => {
    const pageType = detectPageType();
    
    switch (pageType) {
        case 'topic-page':
            // Single topic page - existing logic
            initTopicPage();
            break;
        case 'entry-page':
            // Single entry page - could link to topic page
            initEntryPage();
            break;
        case 'home-page':
        case 'gundem-page':
        case 'debe-page':
        case 'author-page':
        case 'channel-page':
        case 'statistics-page':
            // Don't show buttons on these pages
            break;
        default:
            // Fallback to topic page logic
            initTopicPage();
    }
};

/**
 * Tek başlık sayfası için UI'ı hazırlar.
 * 
 * Başlık elementini bulur ve analiz butonunu ekler.
 * Mevcut sayfa üzerinden entry toplama modunu kullanır.
 */
const initTopicPage = () => {
    let topicHeader = document.getElementById('topic');
    let topicTitleH1 = topicHeader ? topicHeader.querySelector('h1') : document.querySelector('h1');

    // If we found h1 but not topicHeader (or topicHeader didn't contain h1), update topicHeader
    if (topicTitleH1 && (!topicHeader || !topicHeader.contains(topicTitleH1))) {
        topicHeader = topicTitleH1.parentElement;
    }

    if (topicTitleH1 && !document.getElementById('eksi-ai-main-btn')) {
        // For topic pages, use current page analysis (useCurrentPage = true)
        createAnalysisButton(topicTitleH1, null, true);
    }
};

/**
 * Tek entry sayfasından entry verisini çıkarır.
 * 
 * /entry/ID formatındaki sayfalarda DOM'dan entry bilgilerini parse eder.
 * Birden fazla strateji dener çünkü DOM yapısı değişkenlik gösterebilir.
 */
const scrapeSingleEntryFromCurrentPage = () => {
    allEntries = [];
    
    // Extract entry ID from current URL (/entry/ENTRY_ID)
    const entryIdMatch = window.location.pathname.match(/\/entry\/(\d+)/);
    if (!entryIdMatch) {
        console.error('Entry ID not found in URL');
        return;
    }
    
    const entryId = entryIdMatch[1];
    
    // Try multiple strategies to find the entry in the DOM
    let entryItem = null;
    let contentElement = null;
    
    // Strategy 1: Find by data-id attribute
    entryItem = document.querySelector(`li[data-id="${entryId}"]`);
    
    // Strategy 2: Find via entry-item-list
    if (!entryItem) {
        const entryList = document.querySelector('#entry-item-list');
        if (entryList) {
            entryItem = entryList.querySelector(`li[data-id="${entryId}"]`) || 
                       entryList.querySelector('li:first-child');
        }
    }
    
    // Strategy 3: Find by entry URL link (date link typically contains entry URL)
    if (!entryItem) {
        const entryLink = document.querySelector(`a[href="/entry/${entryId}"]`);
        if (entryLink) {
            entryItem = entryLink.closest('li');
        }
    }
    
    // Strategy 4: Find any list item in the main content area that might be the entry
    if (!entryItem) {
        const main = document.querySelector('main');
        if (main) {
            // Look for list items that contain the entry ID in links
            const allLis = main.querySelectorAll('li');
            for (const li of allLis) {
                const links = li.querySelectorAll('a');
                for (const link of links) {
                    if (link.href.includes(`/entry/${entryId}`)) {
                        entryItem = li;
                        break;
                    }
                }
                if (entryItem) break;
            }
        }
    }
    
    if (!entryItem) {
        console.error('Entry element not found on page');
        return;
    }
    
    // Extract entry data
    const id = entryItem.getAttribute('data-id') || entryId;
    
    // Try to find content element - multiple possible structures
    contentElement = entryItem.querySelector('.content');
    if (!contentElement) {
        // Try finding content directly in the list item
        // On entry pages, content might be directly in the li without .content class
        // We'll clone the item and remove metadata elements
        const clone = entryItem.cloneNode(true);
        
        // Remove common metadata elements
        clone.querySelectorAll('.entry-author, .entry-date, .entry-footer, .entry-meta, .entry-actions').forEach(el => el.remove());
        
        // Remove author links
        clone.querySelectorAll('a[href^="/biri/"]').forEach(el => {
            // Keep the text if it's not just the author name
            if (el.textContent.trim() === el.href.split('/').pop()) {
                el.remove();
            }
        });
        
        // Remove date links (they point to the entry itself)
        clone.querySelectorAll(`a[href="/entry/${entryId}"]`).forEach(el => el.remove());
        
        contentElement = clone;
    }
    
    const content = extractContentWithFullUrls(contentElement);
    
    // Extract author - try multiple selectors
    let author = entryItem.querySelector('.entry-author')?.innerText.trim() || '';
    if (!author) {
        const authorLink = entryItem.querySelector('a[href^="/biri/"]');
        if (authorLink) {
            author = authorLink.innerText.trim();
        }
    }
    
    // Extract date - try multiple selectors
    let date = entryItem.querySelector('.entry-date')?.innerText.trim() || '';
    if (!date) {
        const dateLink = entryItem.querySelector(`a[href="/entry/${entryId}"]`);
        if (dateLink) {
            date = dateLink.innerText.trim();
        }
    }
    
    // Extract topic title
    topicTitle = document.querySelector('h1')?.innerText || 
                 document.querySelector('#topic h1')?.innerText || 
                 "Basliksiz";
    
    // Extract topic ID if available
    const topicLink = document.querySelector('h1 a[href*="--"]') || 
                     document.querySelector('a[href*="--"]');
    if (topicLink) {
        const urlMatch = topicLink.href.match(/--(\d+)/);
        topicId = urlMatch ? urlMatch[1] : '';
    }
    
    if (content && content.trim()) {
        const entry = {
            id,
            author,
            date,
            content
        };
        
        // Extract referenced entry IDs from content
        const referencedEntryIds = extractReferencedEntryIds(content);
        if (referencedEntryIds.length > 0) {
            entry.referenced_entry_ids = referencedEntryIds;
        }
        
        allEntries.push(entry);
    } else {
        console.error('Entry content could not be extracted');
    }
};

/**
 * Tek entry için analiz başlatır.
 * 
 * Entry sayfalarında "Bu Entry'yi Analiz Et" butonu için handler.
 * Mevcut entry'yi DOM'dan alır, referanslarını yükler ve analiz seçeneklerini gösterir.
 */
const startSingleEntryAnalysis = async () => {
    const btn = document.getElementById('eksi-ai-entry-btn');
    const container = document.getElementById('eksi-ai-entry-container');

    if (!btn || !container) {
        console.error('Button or container not found');
        return;
    }

    // Reset stop flag and clear response cache for new analysis
    shouldStopScraping = false;
    responseCache.clear();
    lastCustomPrompt = null;

    // Change button to "Stop" button
    btn.textContent = "Durdur";
    btn.onclick = stopScraping;
    btn.disabled = false;

    container.style.display = 'block';
    container.innerHTML = '<span class="eksi-ai-loading">Entry toplanıyor... Lütfen bekleyin.</span>';

    try {
        // Scrape single entry from current page
        scrapeSingleEntryFromCurrentPage();
        
        // Fetch referenced entries if any
        if (!shouldStopScraping && allEntries.length > 0) {
            const statusSpan = container.querySelector('.eksi-ai-loading');
            await fetchAllReferencedEntries(statusSpan);
        }

        // Render actions if we have entries
        if (allEntries.length > 0) {
            await renderActions(container, shouldStopScraping);
        } else {
            container.innerHTML = '<div class="eksi-ai-warning">Entry toplanamadı.</div>';
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="eksi-ai-warning">Hata oluştu: ${escapeHtml(err.message)}</div>`;
    } finally {
        // Restore original button
        btn.disabled = false;
        btn.textContent = "Bu Entry'yi Analiz Et";
        btn.onclick = startSingleEntryAnalysis;
    }
};

/**
 * Tek entry analizi için buton oluşturur.
 * 
 * Entry sayfalarında kullanılır. "Bu Entry'yi Analiz Et" butonunu
 * başlık elementinin altına ekler.
 * 
 * @param {HTMLElement} heading - Butonun ekleneceği başlık elementi
 */
const createSingleEntryButton = (heading) => {
    if (!heading) {
        console.error('Heading is required');
        return;
    }

    // Check if button already exists
    if (document.getElementById('eksi-ai-entry-btn')) {
        return; // Button already exists
    }

    const btn = document.createElement('button');
    btn.id = 'eksi-ai-entry-btn';
    btn.className = 'eksi-ai-btn';
    btn.textContent = "Bu Entry'yi Analiz Et";
    btn.onclick = startSingleEntryAnalysis;

    // Insert button after h1
    if (heading.nextSibling) {
        heading.parentNode.insertBefore(btn, heading.nextSibling);
    } else {
        heading.parentNode.appendChild(btn);
    }

    // Create container for results/actions
    const container = document.createElement('div');
    container.id = 'eksi-ai-entry-container';
    container.className = 'eksi-ai-container';
    container.style.display = 'none';

    // Apply theme
    if (detectTheme()) {
        container.classList.add('eksi-ai-dark');
    }

    // Konteyneri butonun altına ekle
    btn.parentNode.insertBefore(container, btn.nextSibling);
};

/**
 * Tek entry sayfası için UI'ı hazırlar.
 * 
 * Entry sayfalarında sadece tek entry analizi butonu gösterir.
 * Tam başlık analizi için ayrı bir buton eklenmez.
 */
const initEntryPage = () => {
    // On entry pages, we need to find the topic link and the heading
    // The DOM structure on entry pages: h1 contains the topic title link
    
    // First, find the h1 element (topic title)
    const heading = document.querySelector('#topic h1') || document.querySelector('h1');
    if (!heading) {
        console.error('Entry page: heading not found');
        return;
    }
    
    // Create button for single entry analysis
    createSingleEntryButton(heading);
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
    // Check for dark mode based on body background color or specific classes
    // Ekşi Sözlük dark mode usually has a dark background color
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    // Simple check: if background is dark (brightness < 128), it's dark mode
    const rgb = bodyBg.match(/\d+/g);
    if (rgb) {
        const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
        return brightness < 128;
    }
    return false;
};

/**
 * Ana analiz işlemini başlatır.
 * 
 * Başlık sayfalarında "Entry'leri Analiz Et" butonu için handler.
 * Mevcut sayfadaki tüm entry'leri toplar ve analiz seçeneklerini gösterir.
 */
const startAnalysis = async () => {
    const btn = document.getElementById('eksi-ai-main-btn');
    const container = document.getElementById('eksi-ai-container');

    if (!btn || !container) {
        console.error('Button or container not found');
        return;
    }

    // Reset stop flag and clear response cache for new analysis
    shouldStopScraping = false;
    responseCache.clear();
    lastCustomPrompt = null;

    // Change button to "Stop" button
    btn.textContent = "Durdur";
    btn.onclick = stopScraping;
    btn.disabled = false;

    container.style.display = 'block';
    container.innerHTML = '<span class="eksi-ai-loading">Entry\'ler toplanıyor... Lütfen bekleyin.</span>';

    try {
        await scrapeEntries();

        // Render actions if we have entries (even if stopped early)
        if (allEntries.length > 0) {
            await renderActions(container, shouldStopScraping);
        } else {
            container.innerHTML = '<div class="eksi-ai-warning">Hiç entry toplanamadı.</div>';
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="eksi-ai-warning">Hata oluştu: ${escapeHtml(err.message)}</div>`;
    } finally {
        // Restore original button
        btn.disabled = false;
        btn.textContent = "Entry'leri Analiz Et";
        btn.onclick = startAnalysis;
    }
};

/**
 * Entry toplama işlemini durdurur.
 * 
 * "Durdur" butonuna basıldığında çağrılır. shouldStopScraping bayrağını
 * true yaparak döngülerin durmasını sağlar.
 */
const stopScraping = () => {
    shouldStopScraping = true;
    // Try to find either button (main or entry page button)
    const btn = document.getElementById('eksi-ai-main-btn') || document.getElementById('eksi-ai-entry-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Durduruluyor...";
    }
};

/**
 * Mevcut sayfadan entry'leri toplar.
 * 
 * startAnalysis tarafından çağrılır. Mevcut başlık sayfasındaki tüm
 * entry'leri toplar, çok sayfalı başlıkları destekler.
 * 
 * Özellikler:
 * - Mevcut sayfa numarasından başlar
 * - Query parametrelerini korur
 * - Kullanıcı durdurabilir
 */
const scrapeEntries = async () => {
    allEntries = [];
    topicTitle = document.querySelector('h1')?.innerText || document.querySelector('#topic h1')?.innerText || "Basliksiz";

    // Determine total pages
    const pager = document.querySelector('.pager');
    let totalPages = 1;
    if (pager) {
        const lastPageLink = pager.getAttribute('data-pagecount');
        totalPages = parseInt(lastPageLink) || 1;
    }

    // Parse current URL to preserve query parameters (like ?day=2025-12-04, ?a=tracked&snapshot=180043127)
    const currentUrlObj = new URL(window.location.href);
    const baseUrl = currentUrlObj.origin + currentUrlObj.pathname;
    const existingParams = new URLSearchParams(currentUrlObj.search);
    
    // Check for focusto parameter
    const focustoEntryId = existingParams.get('focusto');
    
    // Get current page number from URL (if exists)
    const currentPageParam = existingParams.get('p');
    let startPage = currentPageParam ? parseInt(currentPageParam) : 1;
    
    // If we have focusto, the server shows the page containing that entry
    // We need to detect which page we're on from the pager
    if (focustoEntryId) {
        const currentPageFromPager = pager?.getAttribute('data-currentpage');
        if (currentPageFromPager) {
            startPage = parseInt(currentPageFromPager) || 1;
        }
    }
    
    // Remove 'p' parameter if it exists (we'll add it in the loop)
    existingParams.delete('p');
    // Remove focusto from params for subsequent page fetches
    existingParams.delete('focusto');

    const statusSpan = document.querySelector('.eksi-ai-loading');

    // Process current page entries from DOM (only if we're on page 1 without focusto, or the focusto page)
    // If we're on a later page without focusto, we'll fetch it in the loop
    if (startPage === 1 || focustoEntryId) {
        // Process entries from current DOM (with focusto filtering if applicable)
        const { entries, foundFocusEntry } = extractEntriesFromDoc(document, focustoEntryId);
        allEntries.push(...entries);
        
        // If focusto entry was not found on this page, something went wrong
        if (focustoEntryId && !foundFocusEntry) {
            console.warn(`focusto entry ${focustoEntryId} not found on current page`);
        }
    } else {
        // We're starting from a later page (without focusto), fetch it first
        const startPageParams = new URLSearchParams(existingParams);
        startPageParams.set('p', startPage.toString());
        const startPageUrl = `${baseUrl}?${startPageParams.toString()}`;
        
        if (statusSpan) statusSpan.textContent = `Sayfa ${startPage}/${totalPages} taranıyor...`;
        
        const startPageResponse = await fetch(startPageUrl);
        const startPageText = await startPageResponse.text();
        const parser = new DOMParser();
        const startPageDoc = parser.parseFromString(startPageText, 'text/html');

        const { entries } = extractEntriesFromDoc(startPageDoc);
        allEntries.push(...entries);
    }

    // Process remaining pages (starting from startPage + 1)
    for (let i = startPage + 1; i <= totalPages; i++) {
        // Check if user requested to stop
        if (shouldStopScraping) {
            if (statusSpan) statusSpan.textContent = `İşlem durduruldu. ${allEntries.length} entry toplandı.`;
            break;
        }

        if (statusSpan) statusSpan.textContent = `Sayfa ${i}/${totalPages} taranıyor...`;

        // Build URL with preserved query parameters + page number (no focusto needed for subsequent pages)
        const params = new URLSearchParams(existingParams);
        params.set('p', i.toString());
        const url = `${baseUrl}?${params.toString()}`;
        
        const response = await fetch(url);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        const { entries } = extractEntriesFromDoc(doc);
        allEntries.push(...entries);

        // Be nice to the server
        // Rate limiting - sunucuya nazik davran
        await new Promise(r => setTimeout(r, 500));
    }
    
    // Referans entry'lerin içeriklerini al
    if (!shouldStopScraping) {
        await fetchAllReferencedEntries(statusSpan);
    }
};

// =============================================================================
// UI RENDER FONKSİYONLARI
// =============================================================================

/**
 * Analiz aksiyon butonlarını render eder.
 * 
 * Entry toplama tamamlandığında çağrılır. Kullanıcının ayarladığı
 * prompt butonlarını ve JSON indirme butonunu gösterir.
 * 
 * @param {HTMLElement} container - Butonların ekleneceği konteyner
 * @param {boolean} [wasStopped=false] - İşlem kullanıcı tarafından durduruldu mu
 */
const renderActions = async (container, wasStopped = false) => {
    const settings = await getSettings();

    const statusMessage = wasStopped
        ? `<div class="eksi-ai-info">İşlem durduruldu. ${allEntries.length} entry toplandı.</div>`
        : `<h3>${allEntries.length} entry toplandı.</h3>`;

    let buttonsHtml = `
        <button id="btn-download" class="eksi-ai-btn secondary">JSON İndir</button>
    `;

    // Add dynamic buttons from settings with "ve" buttons
    settings.prompts.forEach((item, index) => {
        buttonsHtml += `
            <div class="eksi-ai-button-group">
                <button id="btn-prompt-${index}" class="eksi-ai-btn" data-index="${index}">${item.name}</button>
                <button id="btn-prompt-ve-${index}" class="eksi-ai-btn-ve" data-index="${index}" title="Prompt'u düzenle">ve</button>
            </div>
        `;
    });

    buttonsHtml += `<button id="btn-custom-manual" class="eksi-ai-btn">Özel Prompt</button>`;

    container.innerHTML = `
        ${statusMessage}
        <div class="eksi-ai-actions">
            ${buttonsHtml}
        </div>
        <div id="ai-result" class="eksi-ai-result-area"></div>
        <div id="ai-warning" class="eksi-ai-warning"></div>
    `;

    document.getElementById('btn-download').onclick = downloadJson;

    // Add listeners for dynamic buttons
    settings.prompts.forEach((item, index) => {
        const btn = document.getElementById(`btn-prompt-${index}`);
        
        // Ana butona basıldığında, eğer "ve" butonundan gelen cached result varsa onu göster
        btn.onclick = () => {
            // "ve" butonundan gelen cached result'ı kontrol et
            // Cache key'i, ana prompt + "ve" butonundan gelen özel prompt kombinasyonu olabilir
            // Ancak daha basit bir yaklaşım: ana butonun data attribute'unda saklanan "ve" prompt'unu kontrol et
            const vePrompt = btn.getAttribute('data-ve-prompt');
            if (vePrompt && responseCache.has(vePrompt)) {
                // "ve" butonundan gelen cached result'ı göster
                runGemini(vePrompt, true, btn);
            } else {
                // Normal prompt'u çalıştır
                runGemini(item.prompt, false, btn);
            }
        };
        
        // Add listener for "ve" button
        const veBtn = document.getElementById(`btn-prompt-ve-${index}`);
        veBtn.onclick = () => openCustomPromptModal(null, item.prompt, btn);
    });

    document.getElementById('btn-custom-manual').onclick = () => {
        const customBtn = document.getElementById('btn-custom-manual');
        
        // If button is already selected (showing cached result), open modal for new prompt
        if (customBtn.classList.contains('eksi-ai-btn-selected')) {
            openCustomPromptModal(customBtn);
            return;
        }
        
        // If there's a cached custom prompt response, show it
        if (lastCustomPrompt && responseCache.has(lastCustomPrompt)) {
            runGemini(lastCustomPrompt, true, customBtn);
            return;
        }
        
        // Otherwise, open modal for new prompt
        openCustomPromptModal(customBtn);
    };
};

// =============================================================================
// DOSYA İŞLEMLERİ
// =============================================================================

/**
 * Dosya adını geçerli karakterlerle temizler.
 * 
 * Windows ve diğer işletim sistemlerinde geçersiz olan karakterleri
 * alt çizgi ile değiştirir.
 * 
 * @param {string} name - Temizlenecek dosya adı
 * @returns {string} Güvenli dosya adı
 */
const sanitizeFilename = (name) => {
    return name
        .replace(/[\\/:*?"<>|]/g, '_')  // Windows'ta geçersiz karakterleri değiştir
        .replace(/_+/g, '_')            // Ardışık alt çizgileri teke indir
        .replace(/^\s+|\s+$/g, '')      // Baş ve sondaki boşlukları temizle
        .replace(/^_+|_+$/g, '');       // Baş ve sondaki alt çizgileri temizle
};

/**
 * Toplanan entry'leri JSON dosyası olarak indirir.
 * 
 * allEntries dizisini formatlı JSON'a çevirir ve başlık adıyla
 * dosya olarak indirilmesini sağlar.
 */
const downloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allEntries, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    const filename = sanitizeFilename(topicTitle) || 'entries';
    downloadAnchorNode.setAttribute("download", `${filename}.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};

// =============================================================================
// GEMİNİ API ENTEGRASYONu
// =============================================================================

/**
 * Gemini API'ye prompt gönderir ve sonucu gösterir.
 * 
 * Entry'leri ve kullanıcı promptunu birleştirerek Gemini API'ye gönderir.
 * Sonuçları önbelleğe alır, Markdown olarak render eder.
 * 
 * Özellikler:
 * - Yanıt önbellekleme (aynı prompt tekrar sorulduğunda API çağrısı yapmaz)
 * - İptal edilebilir istekler
 * - Hata yönetimi (quota, model hatası vb.)
 * 
 * @param {string} userPrompt - Kullanıcının promptu
 * @param {boolean} [showPromptHeader=false] - Özel prompt başlığı gösterilsin mi
 * @param {HTMLElement|null} [clickedButton=null] - Tıklanan buton (seçili görünüm için)
 * @param {HTMLElement|null} [mainButton=null] - "ve" butonundan geldiğinde ilgili ana buton (ok işareti için)
 */
const runGemini = async (userPrompt, showPromptHeader = false, clickedButton = null, mainButton = null) => {
    // Find container from clickedButton if available, otherwise use getElementById as fallback
    let container = null;
    if (clickedButton) {
        container = clickedButton.closest('#eksi-ai-container, #eksi-ai-entry-container');
    }
    
    // Find result and warning areas within the container, or fallback to getElementById
    const resultArea = container 
        ? container.querySelector('#ai-result') 
        : document.getElementById('ai-result');
    const warningArea = container 
        ? container.querySelector('#ai-warning') 
        : document.getElementById('ai-warning');
    
    // Mark clicked button as selected (remove from others first)
    if (clickedButton) {
        // Find actions container within the same container as the button
        const actionsContainer = container 
            ? container.querySelector('.eksi-ai-actions')
            : clickedButton.closest('.eksi-ai-actions');
        if (actionsContainer) {
            actionsContainer.querySelectorAll('.eksi-ai-btn').forEach(btn => {
                btn.classList.remove('eksi-ai-btn-selected');
            });
        }
        clickedButton.classList.add('eksi-ai-btn-selected');
    }

    // Early return if result area not found
    if (!resultArea || !warningArea) {
        console.error('Result area or warning area not found');
        return;
    }

    resultArea.style.display = 'block';
    warningArea.style.display = 'none';
    
    // Check if we have a cached response for this prompt
    const cacheKey = userPrompt;
    if (responseCache.has(cacheKey)) {
        const cachedData = responseCache.get(cacheKey);
        
        // Build result HTML from cache
        let resultHTML = '';
        
        // Show custom prompt header if requested
        if (showPromptHeader && userPrompt) {
            resultHTML += `<div class="eksi-ai-custom-prompt-header">
                <span class="eksi-ai-custom-prompt-label">Özel Prompt:</span>
                <span class="eksi-ai-custom-prompt-text">${escapeHtml(userPrompt).replace(/\n/g, '<br>')}</span>
            </div>`;
        }
        
        // Show model note if available
        if (cachedData.modelId) {
            resultHTML += `<div class="eksi-ai-model-note">📝 ${cachedData.modelId}</div>`;
        }
        
        resultHTML += parseMarkdown(cachedData.response);
        resultArea.innerHTML = resultHTML;
        resultArea.classList.add('eksi-ai-markdown');
        
        // Add action buttons for the result
        addResultActionButtons(resultArea, cachedData.response, userPrompt, showPromptHeader, clickedButton);
        
        // Mark button as cached
        if (clickedButton) {
            clickedButton.classList.add('eksi-ai-btn-cached');
        }
        return;
    }
    
    // Create AbortController for cancellation
    const abortController = new AbortController();
    
    // Create loading message with stop button
    const loadingContainer = document.createElement('div');
    loadingContainer.style.display = 'flex';
    loadingContainer.style.alignItems = 'center';
    loadingContainer.style.gap = '10px';
    
    const loadingText = document.createElement('span');
    loadingText.textContent = "Gemini düşünüyor...";
    
    const stopButton = document.createElement('button');
    stopButton.textContent = "Durdur";
    stopButton.className = 'eksi-ai-btn';
    stopButton.style.padding = '5px 12px';
    stopButton.style.fontSize = '12px';
    stopButton.style.margin = '0';
    stopButton.onclick = () => {
        abortController.abort();
        loadingText.textContent = "İstek iptal ediliyor...";
        stopButton.disabled = true;
    };
    
    loadingContainer.appendChild(loadingText);
    loadingContainer.appendChild(stopButton);
    resultArea.innerHTML = '';
    resultArea.appendChild(loadingContainer);

    const settings = await getSettings();
    const apiKey = settings.geminiApiKey;
    const modelId = settings.selectedModel || 'gemini-2.5-flash';

    if (!apiKey) {
        resultArea.style.display = 'none';
        warningArea.style.display = 'block';
        warningArea.innerHTML = 'Gemini API Key bulunamadı. Lütfen <a href="#" id="open-settings">Ayarlar</a> sayfasından ekleyin.';
        document.getElementById('open-settings').onclick = (e) => {
            e.preventDefault();
            window.open(chrome.runtime.getURL('src/options.html'), '_blank');
        };
        return;
    }

    const limitedEntries = allEntries;
    const entriesJson = JSON.stringify(limitedEntries);

    // Automatically wrap user prompt with title and entries
    const finalPrompt = `Başlık: "${topicTitle}"

Aşağıda Ekşi Sözlük entry'leri JSON formatında verilmiştir:
${entriesJson}

${userPrompt}`;

    try {
        const response = await callGeminiApi(apiKey, modelId, finalPrompt, abortController.signal);
        
        // Cache the successful response with model info
        responseCache.set(cacheKey, { response, modelId, timestamp: Date.now() });
        
        // Mark button as cached
        if (clickedButton) {
            clickedButton.classList.add('eksi-ai-btn-cached');
        }
        
        // Eğer "ve" butonundan geldiyse, ana butonun cached işaretini ekle
        if (mainButton) {
            mainButton.classList.add('eksi-ai-btn-cached');
        }
        
        // Check if button is still selected (user might have clicked another button while waiting)
        // If not selected, don't overwrite the current result - user can click this button again to see cached result
        if (clickedButton && !clickedButton.classList.contains('eksi-ai-btn-selected')) {
            return;
        }
        
        // Build result HTML
        let resultHTML = '';
        
        // Show custom prompt header if requested
        if (showPromptHeader && userPrompt) {
            resultHTML += `<div class="eksi-ai-custom-prompt-header">
                <span class="eksi-ai-custom-prompt-label">Özel Prompt:</span>
                <span class="eksi-ai-custom-prompt-text">${escapeHtml(userPrompt).replace(/\n/g, '<br>')}</span>
            </div>`;
        }
        
        // Show model note
        resultHTML += `<div class="eksi-ai-model-note">📝 ${modelId}</div>`;
        
        resultHTML += parseMarkdown(response);
        resultArea.innerHTML = resultHTML;
        resultArea.classList.add('eksi-ai-markdown');
        
        // Add action buttons for the result
        addResultActionButtons(resultArea, response, userPrompt, showPromptHeader, clickedButton);
    } catch (err) {
        let errorMessage = err.message;
        
        // Provide helpful error message for model not found
        if (errorMessage.includes('not found') || errorMessage.includes('not supported')) {
            errorMessage = `Model "${modelId}" bulunamadı veya desteklenmiyor.\n\n` +
                          `Lütfen Ayarlar sayfasından mevcut bir model seçin:\n` +
                          `- gemini-3-pro-preview\n` +
                          `- gemini-2.5-pro (Önerilen)\n` +
                          `- gemini-2.5-flash\n` +
                          `- gemini-2.5-flash-lite\n\n` +
                          `Hata detayı: ${err.message}`;
            resultArea.textContent = "Hata: " + errorMessage;
        } else if (errorMessage.includes('quota') || errorMessage.includes('Quota exceeded')) {
            showQuotaErrorWithRetry(resultArea, errorMessage, userPrompt, showPromptHeader, clickedButton, modelId);
        } else {
            // Check if error is due to abort
            if (err.name === 'AbortError' || errorMessage.includes('aborted')) {
                resultArea.textContent = "İstek iptal edildi.";
            } else {
                resultArea.textContent = "Hata: " + errorMessage;
            }
        }
    }
};

/**
 * Gemini API'ye HTTP isteği yapar.
 * 
 * Önce v1 (stable) API'yi dener, başarısız olursa v1beta'ya düşer.
 * Bu sayede yeni modeller için geriye uyumluluk sağlanır.
 * 
 * @param {string} apiKey - Gemini API anahtarı
 * @param {string} modelId - Kullanılacak model ID'si
 * @param {string} prompt - Gönderilecek tam prompt
 * @param {AbortSignal} signal - İstek iptal sinyali
 * @returns {Promise<string>} Model yanıtı
 * @throws {Error} API hatası durumunda
 */
const callGeminiApi = async (apiKey, modelId, prompt, signal) => {
    const startTime = performance.now();
    
    // Try v1 first (stable), fallback to v1beta if needed
    const attempts = [
        { version: 'v1', model: modelId },
        { version: 'v1beta', model: modelId }
    ];

    let lastError = null;
    
    for (const attempt of attempts) {
        const url = `https://generativelanguage.googleapis.com/${attempt.version}/models/${attempt.model}:generateContent?key=${apiKey}`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{
                            text: SYSTEM_PROMPT
                        }]
                    },
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                }),
                signal: signal
            });

            if (response.ok) {
                const data = await response.json();
                const endTime = performance.now();
                const responseTime = endTime - startTime;
                
                console.log(`Gemini API Response Time: ${responseTime.toFixed(2)}ms (${attempt.version}/${attempt.model})`);
                window.geminiResponseTime = responseTime;
                
                return data.candidates[0].content.parts[0].text;
            } else {
                const errorData = await response.json();
                // Get full error message including details
                const errorMsg = errorData.error?.message || 'API request failed';
                // Include error details if available
                const fullError = errorData.error?.details 
                    ? `${errorMsg}\n\n${JSON.stringify(errorData.error.details, null, 2)}`
                    : errorMsg;
                lastError = fullError;
                // Continue to next attempt
            }
        } catch (err) {
            lastError = err.message;
            // Continue to next attempt
        }
    }
    
    // If all attempts failed, throw the last error with helpful message
    throw new Error(lastError || 'Model bulunamadı. Lütfen model adını ve API versiyonunu kontrol edin.');
};

/**
 * Mevcut modelden bir alt seviye modeli bulur.
 * 
 * @param {string} currentModelId - Mevcut model ID'si
 * @returns {Object|null} Alt seviye model objesi veya bulunamazsa null
 */
const getLowerModel = (currentModelId) => {
    const currentIndex = MODELS.findIndex(m => m.id === currentModelId);
    if (currentIndex === -1 || currentIndex >= MODELS.length - 1) {
        return null; // Model bulunamadı veya zaten en düşük model
    }
    // Bir sonraki modeli döndür (daha düşük seviye)
    return MODELS[currentIndex + 1];
};

/**
 * Kota aşım hatasını modal pencere ile gösterir.
 * 
 * Gemini API rate limit aşıldığında kullanıcıya modal pencere açarak
 * daha düşük bir modelle tekrar deneme seçeneği sunar.
 * 
 * @param {HTMLElement} resultArea - Hata mesajının gösterileceği element
 * @param {string} errorMessage - API'den gelen hata mesajı
 * @param {string} userPrompt - Tekrar denemek için kullanılacak prompt
 * @param {boolean} showPromptHeader - Özel prompt başlığı gösterilsin mi
 * @param {HTMLElement|null} clickedButton - Seçili buton referansı
 * @param {string|null} currentModelId - Mevcut model ID'si (opsiyonel, verilmezse settings'den alınır)
 */
const showQuotaErrorWithRetry = async (resultArea, errorMessage, userPrompt, showPromptHeader, clickedButton, currentModelId = null) => {
    const settings = await getSettings();
    const modelId = currentModelId || settings.selectedModel || 'gemini-2.5-flash';
    let lowerModel = getLowerModel(modelId);
    
    // Özel durum: gemini-2.5-flash-lite kullanılıyorsa ve alt model yoksa,
    // gemini-2.5-flash ile denemeyi öner
    if (!lowerModel && modelId === 'gemini-2.5-flash-lite') {
        lowerModel = MODELS.find(m => m.id === 'gemini-2.5-flash');
    }
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'eksi-ai-quota-modal-overlay';
    overlay.className = 'eksi-ai-modal-overlay';
    
    // Apply theme to overlay/modal
    if (detectTheme()) {
        overlay.classList.add('eksi-ai-dark');
    }
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'eksi-ai-modal-content';
    
    let modalContent = `
        <h3 class="eksi-ai-modal-title">API Kota Limiti Aşıldı</h3>
        <div class="eksi-ai-quota-modal-message">
            <p>Mevcut model (<strong>${modelId}</strong>) için API kota limiti aşıldı.</p>
    `;
    
    if (lowerModel) {
        modalContent += `
            <p>Bir düşük model (<strong>${lowerModel.id}</strong>) ile deneyeyim mi?</p>
        `;
    } else {
        modalContent += `
            <p>Zaten en düşük model kullanılıyor. Lütfen daha sonra tekrar deneyin.</p>
        `;
    }
    
    modalContent += `
        </div>
        <div class="eksi-ai-modal-actions">
    `;
    
    if (lowerModel) {
        modalContent += `
            <button id="eksi-ai-quota-modal-cancel" 
                    class="eksi-ai-modal-btn eksi-ai-modal-cancel-btn">
                vazgeç
            </button>
            <button id="eksi-ai-quota-modal-retry" 
                    class="eksi-ai-modal-btn eksi-ai-modal-submit-btn">
                ${lowerModel.name.replace(/^[^\s]+\s*/, '')} ile dene
            </button>
        `;
    } else {
        modalContent += `
            <button id="eksi-ai-quota-modal-cancel" 
                    class="eksi-ai-modal-btn eksi-ai-modal-cancel-btn"
                    style="margin-left: auto;">
                tamam
            </button>
        `;
    }
    
    modalContent += `
        </div>
    `;
    
    modal.innerHTML = modalContent;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const cancelBtn = document.getElementById('eksi-ai-quota-modal-cancel');
    const retryBtn = document.getElementById('eksi-ai-quota-modal-retry');
    
    // Close modal function
    const closeModal = () => {
        overlay.remove();
        // Show error message in result area
        resultArea.style.display = 'block';
        resultArea.innerHTML = '<div class="eksi-ai-warning">API kota limiti aşıldı. Lütfen daha sonra tekrar deneyin.</div>';
    };
    
    // Cancel button
    cancelBtn.onclick = closeModal;
    
    // Close on overlay click (but not on modal click)
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    };
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Retry button - only if lower model is available
    if (retryBtn && lowerModel) {
        retryBtn.onclick = async () => {
            closeModal();
            
            // Clear the cache for this prompt
            responseCache.delete(userPrompt);
            
            // Create AbortController for cancellation
            const abortController = new AbortController();
            
            // Create loading message with stop button
            const loadingContainer = document.createElement('div');
            loadingContainer.style.display = 'flex';
            loadingContainer.style.alignItems = 'center';
            loadingContainer.style.gap = '10px';
            
            const loadingText = document.createElement('span');
            loadingText.textContent = "Gemini düşünüyor...";
            
            const stopButton = document.createElement('button');
            stopButton.textContent = "Durdur";
            stopButton.className = 'eksi-ai-btn';
            stopButton.style.padding = '5px 12px';
            stopButton.style.fontSize = '12px';
            stopButton.style.margin = '0';
            stopButton.onclick = () => {
                abortController.abort();
                loadingText.textContent = "İstek iptal ediliyor...";
                stopButton.disabled = true;
            };
            
            loadingContainer.appendChild(loadingText);
            loadingContainer.appendChild(stopButton);
            resultArea.style.display = 'block';
            resultArea.innerHTML = '';
            resultArea.appendChild(loadingContainer);
            
            // Call Gemini with the lower model
            try {
                const apiKey = settings.geminiApiKey;
                const limitedEntries = allEntries;
                const entriesJson = JSON.stringify(limitedEntries);
                
                const finalPrompt = `Başlık: "${topicTitle}"

Aşağıda Ekşi Sözlük entry'leri JSON formatında verilmiştir:
${entriesJson}

${userPrompt}`;
                
                const response = await callGeminiApi(apiKey, lowerModel.id, finalPrompt, abortController.signal);
                
                // Cache the successful response with model info
                responseCache.set(userPrompt, { response, modelId: lowerModel.id, timestamp: Date.now() });
                
                // Build result HTML
                let resultHTML = '';
                
                if (showPromptHeader && userPrompt) {
                    resultHTML += `<div class="eksi-ai-custom-prompt-header">
                        <span class="eksi-ai-custom-prompt-label">Özel Prompt:</span>
                        <span class="eksi-ai-custom-prompt-text">${escapeHtml(userPrompt).replace(/\n/g, '<br>')}</span>
                    </div>`;
                }
                
                // Add a note about the model used
                resultHTML += `<div class="eksi-ai-model-note">📝 ${lowerModel.id}</div>`;
                
                resultHTML += parseMarkdown(response);
                resultArea.innerHTML = resultHTML;
                resultArea.classList.add('eksi-ai-markdown');
                
                // Add action buttons for the result
                addResultActionButtons(resultArea, response, userPrompt, showPromptHeader, clickedButton);
                
            } catch (retryErr) {
                let retryErrorMessage = retryErr.message;
                
                // Check if error is due to abort
                if (retryErr.name === 'AbortError' || retryErrorMessage.includes('aborted')) {
                    resultArea.innerHTML = '<div class="eksi-ai-warning">İstek iptal edildi.</div>';
                } else if (retryErrorMessage.includes('quota') || retryErrorMessage.includes('Quota exceeded')) {
                    // If retry also fails with quota error, handle it recursively
                    // This allows the retry mechanism to work as if it's the first time
                    await showQuotaErrorWithRetry(resultArea, retryErrorMessage, userPrompt, showPromptHeader, clickedButton, lowerModel.id);
                } else {
                    // If retry fails with a different error, show the error
                    resultArea.innerHTML = `<div class="eksi-ai-warning">Hata: ${escapeHtml(retryErrorMessage)}</div>`;
                }
            }
        };
    }
};

// =============================================================================
// ÖZEL PROMPT MODALI
// =============================================================================

/**
 * Özel prompt giriş modalını açar.
 * 
 * Kullanıcının kendi promptunu yazabileceği bir modal pencere gösterir.
 * Ctrl+Enter ile gönderme, Escape ile kapatma destekler.
 * 
 * @param {HTMLElement|null} [customButton=null] - Modal kapandığında seçili görünecek buton
 * @param {string|null} [prefillPrompt=null] - Textarea'yı önceden dolduracak prompt metni
 * @param {HTMLElement|null} [mainButton=null] - "ve" butonundan geldiğinde ilgili ana buton referansı
 */
const openCustomPromptModal = (customButton = null, prefillPrompt = null, mainButton = null) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'eksi-ai-modal-overlay';
    overlay.className = 'eksi-ai-modal-overlay';

    // Apply theme to overlay/modal if needed (though overlay handles it via CSS vars usually, 
    // but we might need the class on the overlay to cascade)
    if (detectTheme()) {
        overlay.classList.add('eksi-ai-dark');
    }

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'eksi-ai-modal-content';

    modal.innerHTML = `
        <h3 class="eksi-ai-modal-title">Ne yapmamı istersin?</h3>
        <textarea id="eksi-ai-custom-prompt" 
                  class="eksi-ai-textarea"
                  placeholder="Örnek: Bu konudaki mizahi entry'leri listele"></textarea>
        <div class="eksi-ai-modal-actions">
            <button id="eksi-ai-modal-cancel" 
                    class="eksi-ai-modal-btn eksi-ai-modal-cancel-btn">
                vazgeç
            </button>
            <button id="eksi-ai-modal-submit" 
                    class="eksi-ai-modal-btn eksi-ai-modal-submit-btn">
                gönder
            </button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Focus on textarea
    const textarea = document.getElementById('eksi-ai-custom-prompt');
    const cancelBtn = document.getElementById('eksi-ai-modal-cancel');
    const submitBtn = document.getElementById('eksi-ai-modal-submit');

    // Pre-fill with provided prompt, or last custom prompt if exists
    if (prefillPrompt) {
        textarea.value = prefillPrompt;
        // "ve" butonundan geldiğinde, prompt'un satır sayısına göre textarea yüksekliğini ayarla
        const lineCount = prefillPrompt.split('\n').length;
        // Her satır için yaklaşık 22px + padding (12px üst + 12px alt = 24px) + border (2px)
        // Birkaç satır daha fazla yükseklik için +3 satır ekliyoruz
        const minHeight = 120; // Minimum yükseklik
        const maxHeight = 500; // Maksimum yükseklik
        const calculatedHeight = Math.max(minHeight, Math.min(maxHeight, (lineCount + 3) * 22 + 26));
        textarea.style.height = `${calculatedHeight}px`;
        textarea.style.minHeight = `${minHeight}px`; // Minimum yükseklik korunmalı
        textarea.style.maxHeight = `${maxHeight}px`; // Maksimum yükseklik korunmalı
    } else if (lastCustomPrompt) {
        textarea.value = lastCustomPrompt;
    }

    setTimeout(() => {
        textarea.focus();
        // Move cursor to end of text
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
    }, 100);

    // Close modal function
    const closeModal = () => {
        overlay.remove();
    };

    // Cancel button
    cancelBtn.onclick = closeModal;

    // Close on overlay click (but not on modal click)
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    };

    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Submit button
    submitBtn.onclick = () => {
        const userPrompt = textarea.value.trim();
        if (userPrompt) {
            // Eğer "ve" butonundan geldiyse, ana buton referansını da geçir
            if (mainButton) {
                // Ana butonun data attribute'una "ve" prompt'unu kaydet
                mainButton.setAttribute('data-ve-prompt', userPrompt);
                // "ve" butonundan gelen prompt'ları lastCustomPrompt'a kaydetme
                runGemini(userPrompt, true, customButton, mainButton); // mainButton = ok işareti için
            } else {
                // Sadece "Özel Prompt" butonundan gelen prompt'ları kaydet
                lastCustomPrompt = userPrompt; // Store the custom prompt for caching
                runGemini(userPrompt, true, customButton); // true = show custom prompt header, customButton = mark as selected
            }
            closeModal();
        } else {
            textarea.style.borderColor = '#d9534f';
            textarea.focus();
        }
    };

    // Submit on Ctrl+Enter or Cmd+Enter
    textarea.onkeydown = (e) => {
        // Reset border color on typing
        if (textarea.style.borderColor === 'rgb(217, 83, 79)') {
            textarea.style.borderColor = ''; // Let CSS handle it
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            submitBtn.click();
        }
    };
};

// =============================================================================
// MARKDOWN İŞLEME
// =============================================================================

/**
 * Bir string'in geçerli JSON olup olmadığını kontrol eder.
 * 
 * @param {string} str - Kontrol edilecek string
 * @returns {boolean} Geçerli JSON ise true
 */
const isValidJson = (str) => {
    try {
        const parsed = JSON.parse(str);
        // Must be object or array to be considered "real" JSON
        return typeof parsed === 'object' && parsed !== null;
    } catch {
        return false;
    }
};

/**
 * JSON string'i syntax highlighting ile formatlar.
 * 
 * JSON anahtarlarını, string değerlerini, sayıları ve boolean'ları
 * farklı renklerde gösterir.
 * 
 * @param {string} jsonStr - Formatlanacak JSON string'i
 * @returns {string} HTML formatında syntax highlighted JSON
 */
const formatJsonWithHighlight = (jsonStr) => {
    try {
        const parsed = JSON.parse(jsonStr);
        const formatted = JSON.stringify(parsed, null, 2);
        
        // Apply syntax highlighting
        let highlighted = escapeHtml(formatted);
        
        // Highlight keys (property names)
        highlighted = highlighted.replace(/"((?:[^"\\]|\\.)+)":/g, '<span class="eksi-ai-json-key">"$1"</span>:');
        
        // Highlight string values (after colon)
        highlighted = highlighted.replace(/: "((?:[^"\\]|\\.)*)"/g, ': <span class="eksi-ai-json-string">"$1"</span>');
        
        // Highlight numbers
        highlighted = highlighted.replace(/: (-?\d+\.?\d*)/g, ': <span class="eksi-ai-json-number">$1</span>');
        
        // Highlight booleans and null
        highlighted = highlighted.replace(/: (true|false|null)/g, ': <span class="eksi-ai-json-boolean">$1</span>');
        
        return highlighted;
    } catch {
        return escapeHtml(jsonStr);
    }
};

/**
 * Markdown metni HTML'e dönüştürür.
 * 
 * Desteklenen formatlar:
 * - Başlıklar (# - ######)
 * - Kalın (**), italik (*), üstü çizili (~~)
 * - Kod blokları (``` ve `)
 * - Listeler (sıralı ve sırasız)
 * - Tablolar
 * - Alıntılar (>)
 * - Linkler [text](url)
 * - Otomatik URL tespiti
 * - JSON syntax highlighting
 * 
 * @param {string} text - Dönüştürülecek Markdown metni
 * @returns {string} HTML çıktısı
 */
const parseMarkdown = (text) => {
    if (!text) return '';
    
    // Check if the entire response is JSON (no markdown, just raw JSON)
    const trimmedText = text.trim();
    if ((trimmedText.startsWith('{') || trimmedText.startsWith('[')) && isValidJson(trimmedText)) {
        const formattedJson = formatJsonWithHighlight(trimmedText);
        return `<pre class="eksi-ai-code-block eksi-ai-json-block"><code class="language-json">${formattedJson}</code></pre>`;
    }
    
    // First, escape HTML
    let html = escapeHtml(text);
    
    // Store code blocks temporarily to prevent processing inside them
    const codeBlocks = [];
    const inlineCodes = [];
    
    // Handle fenced code blocks (```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const index = codeBlocks.length;
        const trimmedCode = code.trim();
        
        // Check if this is a JSON code block and format it nicely
        if ((lang === 'json' || lang === '') && isValidJson(trimmedCode)) {
            const formattedJson = formatJsonWithHighlight(trimmedCode);
            codeBlocks.push(`<pre class="eksi-ai-code-block eksi-ai-json-block"><code class="language-json">${formattedJson}</code></pre>`);
        } else {
            codeBlocks.push(`<pre class="eksi-ai-code-block"><code class="language-${lang || 'text'}">${trimmedCode}</code></pre>`);
        }
        return `%%CODEBLOCK${index}%%`;
    });
    
    // Handle inline code (`)
    // Also parse markdown links inside inline code
    html = html.replace(/`([^`]+)`/g, (match, code) => {
        const index = inlineCodes.length;
        // Parse markdown links inside inline code
        let processedCode = code.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        inlineCodes.push(`<code class="eksi-ai-inline-code">${processedCode}</code>`);
        return `%%INLINECODE${index}%%`;
    });
    
    // Handle headers (must be at start of line)
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
    
    // Handle blockquotes (can be multiline)
    html = html.replace(/^&gt;\s*(.*)$/gm, '<blockquote>$1</blockquote>');
    // Merge consecutive blockquotes
    html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');
    
    // Handle horizontal rules
    html = html.replace(/^(?:---|\*\*\*|___)$/gm, '<hr>');
    
    // Handle bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    
    // Handle strikethrough
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    
    // Handle links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Auto-link plain URLs (not already inside an anchor tag)
    // Match URLs that are not preceded by href=" or >
    html = html.replace(/(?<!href="|>)(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Handle unordered lists
    const processUnorderedList = (text) => {
        const lines = text.split('\n');
        let result = [];
        let listStack = []; // Stores indentation levels
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const listMatch = line.match(/^(\s*)[\-\*]\s+(.+)$/);
            
            if (listMatch) {
                const indent = listMatch[1].length;
                const content = listMatch[2];
                
                if (listStack.length === 0) {
                    result.push('<ul>');
                    listStack.push(indent);
                } else {
                    const currentIndent = listStack[listStack.length - 1];
                    
                    if (indent > currentIndent) {
                        result.push('<ul>');
                        listStack.push(indent);
                    } else if (indent < currentIndent) {
                        while (listStack.length > 0 && indent < listStack[listStack.length - 1]) {
                            result.push('</ul>');
                            listStack.pop();
                        }
                        
                        // If indent level is still not matching (e.g. weird indentation), start new or append
                        if (listStack.length === 0) {
                            result.push('<ul>');
                            listStack.push(indent);
                        }
                    }
                }
                result.push(`<li>${content}</li>`);
            } else {
                while (listStack.length > 0) {
                    result.push('</ul>');
                    listStack.pop();
                }
                result.push(line);
            }
        }
        
        while (listStack.length > 0) {
            result.push('</ul>');
            listStack.pop();
        }
        
        return result.join('\n');
    };
    
    // Handle ordered lists
    const processOrderedList = (text) => {
        const lines = text.split('\n');
        let result = [];
        let listStack = []; // Stores indentation levels
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const listMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
            
            if (listMatch) {
                const indent = listMatch[1].length;
                const content = listMatch[2];
                
                if (listStack.length === 0) {
                    result.push('<ol>');
                    listStack.push(indent);
                } else {
                    const currentIndent = listStack[listStack.length - 1];
                    
                    if (indent > currentIndent) {
                        result.push('<ol>');
                        listStack.push(indent);
                    } else if (indent < currentIndent) {
                        while (listStack.length > 0 && indent < listStack[listStack.length - 1]) {
                            result.push('</ol>');
                            listStack.pop();
                        }
                        
                        if (listStack.length === 0) {
                            result.push('<ol>');
                            listStack.push(indent);
                        }
                    }
                }
                result.push(`<li>${content}</li>`);
            } else {
                while (listStack.length > 0) {
                    result.push('</ol>');
                    listStack.pop();
                }
                result.push(line);
            }
        }
        
        while (listStack.length > 0) {
            result.push('</ol>');
            listStack.pop();
        }
        
        return result.join('\n');
    };
    
    // Handle tables
    const processTables = (text) => {
        const lines = text.split('\n');
        let result = [];
        let inTable = false;
        let tableRows = [];
        
        const isTableSeparator = (line) => {
            // Check if line contains only |- : and spaces, and at least one | or -
            // Also allow spaces at start/end
            const trimmed = line.trim();
            if (!trimmed) return false;
            // Must contain | or -
            // Must generally look like |---|---| or ---|---
            return /^\|?[\s\-:|]+\|?$/.test(trimmed) && trimmed.includes('-');
        };

        const splitTableLine = (line) => {
            let content = line.trim();
            if (content.startsWith('|')) content = content.substring(1);
            if (content.endsWith('|')) content = content.substring(0, content.length - 1);
            
            // Handle escaped pipes if any (though usually code blocks catch them)
            // We'll just split by | for now as code blocks are already extracted
            return content.split('|');
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            if (inTable) {
                if (trimmed.includes('|')) {
                    tableRows.push(trimmed);
                } else {
                    // End of table
                    result.push(renderTable(tableRows));
                    inTable = false;
                    tableRows = [];
                    result.push(line);
                }
            } else {
                // Check for start of table
                // A table starts with a header row, followed by a separator row
                if (trimmed.includes('|') && i + 1 < lines.length) {
                    const nextLine = lines[i + 1];
                    if (isTableSeparator(nextLine)) {
                        inTable = true;
                        tableRows.push(trimmed);
                        // The next iteration will catch the separator as part of tableRows
                        continue;
                    }
                }
                result.push(line);
            }
        }
        
        if (inTable) {
            result.push(renderTable(tableRows));
        }
        
        return result.join('\n');
    };

    const renderTable = (rows) => {
        if (rows.length < 2) return rows.join('\n');
        
        const header = rows[0];
        // rows[1] is separator, we skip it for rendering content but could use it for alignment
        const body = rows.slice(2);
        
        let html = '<div class="eksi-ai-table-wrapper"><table class="eksi-ai-markdown-table"><thead><tr>';
        
        // Process header
        const splitTableLine = (line) => {
            let content = line.trim();
            if (content.startsWith('|')) content = content.substring(1);
            if (content.endsWith('|')) content = content.substring(0, content.length - 1);
            return content.split('|');
        };

        const headerCells = splitTableLine(header);
        headerCells.forEach(cell => {
            html += `<th>${cell.trim()}</th>`;
        });
        html += '</tr></thead><tbody>';
        
        // Process body
        body.forEach(row => {
            html += '<tr>';
            const cells = splitTableLine(row);
            cells.forEach(cell => {
                html += `<td>${cell.trim()}</td>`;
            });
            html += '</tr>';
        });
        
        html += '</tbody></table></div>';
        return html;
    };

    html = processTables(html);
    html = processUnorderedList(html);
    html = processOrderedList(html);
    
    // Handle paragraphs (double newlines)
    html = html.replace(/\n\n+/g, '</p><p>');
    
    // Handle single line breaks in non-list context
    html = html.replace(/(?<!<\/li>|<\/ul>|<\/ol>|<\/blockquote>|<\/h[1-6]>|<hr>|<\/p>|<p>|<\/div>|<\/table>|<\/thead>|<\/tbody>|<\/tr>|<\/td>|<\/th>)\n(?!<li>|<ul>|<ol>|<blockquote>|<h[1-6]>|<hr>|<\/p>|<p>|<div class="eksi-ai-table-wrapper">|<table>|<thead>|<tbody>|<tr>|<td>|<th>)/g, '<br>\n');
    
    // Wrap in paragraph if not already wrapped
    if (!html.startsWith('<')) {
        html = '<p>' + html + '</p>';
    } else if (!html.startsWith('<p>') && !html.startsWith('<h') && !html.startsWith('<ul>') && !html.startsWith('<ol>') && !html.startsWith('<blockquote>') && !html.startsWith('<hr>') && !html.startsWith('<div class="eksi-ai-table-wrapper">') && !html.startsWith('%%CODEBLOCK')) {
        html = '<p>' + html + '</p>';
    }
    
    // Restore code blocks
    codeBlocks.forEach((block, index) => {
        html = html.replace(`%%CODEBLOCK${index}%%`, block);
    });
    
    // Restore inline codes
    inlineCodes.forEach((code, index) => {
        html = html.replace(`%%INLINECODE${index}%%`, code);
    });
    
    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>(<h[1-6]>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ol>)/g, '$1');
    html = html.replace(/(<\/ol>)<\/p>/g, '$1');
    html = html.replace(/<p>(<blockquote>)/g, '$1');
    html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
    html = html.replace(/<p>(<hr>)/g, '$1');
    html = html.replace(/(<hr>)<\/p>/g, '$1');
    html = html.replace(/<p>(<pre)/g, '$1');
    html = html.replace(/(<\/pre>)<\/p>/g, '$1');
    html = html.replace(/<p>(<div class="eksi-ai-table-wrapper">)/g, '$1');
    html = html.replace(/(<\/div>)<\/p>/g, '$1');
    
    return html;
};

// =============================================================================
// SONUÇ AKSİYON BUTONLARI
// =============================================================================

/**
 * Sonuç alanına kopyala, indir ve tekrar sor butonları ekler.
 * 
 * Analiz sonucu gösterildikten sonra kullanıcının sonucu
 * kopyalaması, Markdown dosyası olarak indirmesi veya
 * aynı promptu tekrar sorması için butonlar ekler.
 * 
 * @param {HTMLElement} resultArea - Butonların ekleneceği sonuç alanı
 * @param {string} markdownContent - Kopyalanacak/indirilecek ham Markdown içeriği
 * @param {string} userPrompt - Tekrar sormak için kullanılacak prompt
 * @param {boolean} showPromptHeader - Özel prompt başlığı gösterilsin mi
 * @param {HTMLElement|null} clickedButton - Seçili buton referansı
 */
const addResultActionButtons = (resultArea, markdownContent, userPrompt, showPromptHeader, clickedButton) => {
    // Create action buttons container
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'eksi-ai-result-actions';
    
    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'eksi-ai-result-action-btn';
    copyBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Kopyala</span>
    `;
    copyBtn.onclick = () => copyToClipboard(markdownContent, copyBtn);
    
    // Download MD button with custom icon
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'eksi-ai-result-action-btn';
    downloadBtn.innerHTML = `
        <svg width="20" height="16" viewBox="0 0 28 22" fill="none" class="eksi-ai-md-icon">
            <rect x="0.5" y="0.5" width="27" height="21" rx="2.5" stroke="currentColor" fill="none"/>
            <path d="M4 16V6h2.5l2.5 4 2.5-4H14v10h-2.5v-5.5L9 14.5l-2.5-4V16H4z" fill="currentColor"/>
            <path d="M16 16V6h4.5a3.5 3.5 0 0 1 0 7H18.5V16H16zm2.5-5.5h1.5a1 1 0 1 0 0-2h-1.5v2z" fill="currentColor"/>
            <path d="M21 13l3 3m0-3l-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>Markdown İndir</span>
    `;
    downloadBtn.onclick = () => downloadMarkdown(markdownContent);
    
    // Retry button (Ask Again)
    const retryBtn = document.createElement('button');
    retryBtn.className = 'eksi-ai-result-action-btn';
    retryBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        <span>Tekrar Sor</span>
    `;
    retryBtn.onclick = () => {
        // Clear the cache for this prompt
        responseCache.delete(userPrompt);
        // Remove cached indicator from the button
        if (clickedButton) {
            clickedButton.classList.remove('eksi-ai-btn-cached');
        }
        // Re-run the prompt
        runGemini(userPrompt, showPromptHeader, clickedButton);
    };
    
    actionsContainer.appendChild(copyBtn);
    actionsContainer.appendChild(downloadBtn);
    actionsContainer.appendChild(retryBtn);
    
    // Insert at the top of result area
    resultArea.insertBefore(actionsContainer, resultArea.firstChild);
};

/**
 * Metni panoya kopyalar ve butona görsel geri bildirim verir.
 * 
 * Başarılı kopyalamada buton geçici olarak "Kopyalandı!" gösterir,
 * hata durumunda "Hata!" gösterir.
 * 
 * @param {string} text - Kopyalanacak metin
 * @param {HTMLElement} button - Geri bildirim verilecek buton
 */
const copyToClipboard = async (text, button) => {
    try {
        await navigator.clipboard.writeText(text);
        const originalHTML = button.innerHTML;
        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Kopyalandı!</span>
        `;
        button.classList.add('success');
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('success');
        }, 2000);
    } catch (err) {
        console.error('Kopyalama hatası:', err);
        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <span>Hata!</span>
        `;
    }
};

/**
 * İçeriği Markdown dosyası (.md) olarak indirir.
 * 
 * Başlık adını dosya adı olarak kullanır (özel karakterler temizlenerek).
 * 
 * @param {string} content - İndirilecek Markdown içeriği
 */
const downloadMarkdown = (content) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', url);
    const filename = sanitizeFilename(topicTitle) || 'analiz';
    downloadAnchorNode.setAttribute('download', `${filename}.md`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    URL.revokeObjectURL(url);
};

// =============================================================================
// BAŞLATMA
// =============================================================================

// Sayfa yüklendiğinde eklentiyi başlat
init();
