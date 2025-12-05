// Global state
let allEntries = [];
let topicTitle = "";
let topicId = "";
let shouldStopScraping = false;

const DEFAULT_PROMPTS = [
    {
        name: "Özet",
        prompt: `Bu entry'leri analiz ederek kapsamlı bir özet hazırla.

## Görev:
- Ana konuları ve tartışma başlıklarını belirle
- Farklı görüşler ve fikir ayrılıklarını dengeli bir şekilde sun
- Mizahi, ironik veya dikkat çekici entry'leri vurgula
- Özgün ve derinlemesine görüşleri öne çıkar
- Entry'lerin kronolojik veya tematik akışını göz önünde bulundur

## Format ve Dil:
- Markdown formatında yaz (başlıklar, listeler, vurgular kullan)
- Bilgi verici, tarafsız ve profesyonel bir dil kullan
- Akıcı ve okunabilir bir metin oluştur
- Gereksiz spekülasyon veya çıkarımdan kaçın
- Entry'lerden kısa ve anlamlı alıntılar ekle (tırnak işareti ile)

## Link Formatı:
- Entry'lere referans verirken Markdown link formatı kullan: [link metni](https://eksisozluk.com/entry/{entry_id})
- JSON'daki entry_id değerini kullanarak link oluştur
- Link metni entry'nin anahtar kelimesini veya bağlama uygun bir ifadeyi içersin

## Çıktı:
- Yanıtın sadece özet metni olsun, ek açıklama veya meta bilgi içermesin.`
    },
    {
        name: "Blog",
        prompt: `Bu entry'lere dayalı, kapsamlı ve okunabilir bir blog yazısı yaz.

## Görev
Entry'lerdeki farklı görüşleri, deneyimleri, mizahı ve eleştirileri sentezleyerek, konuyu derinlemesine ele alan bir blog yazısı oluştur.

## Yazı Üslubu ve Stil
- Akıcı, samimi ve erişilebilir bir dil kullan
- Analitik ve düşündürücü ol, ancak akademik bir üsluptan kaçın
- Farklı perspektifleri dengeli bir şekilde sun
- Gerektiğinde örnekler, anekdotlar ve ilginç detaylar ekle
- Spekülasyondan kaçın, yalnızca entry'lerdeki bilgileri kullan

## İçerik Yapısı
1. Giriş: Konuyu kısa bir özetle tanıt ve entry'lerden çıkan ana temaları belirt
2. Gelişme: Farklı bakış açılarını, görüşleri ve deneyimleri kategorize ederek sun
3. Sonuç: Genel gözlemler ve öne çıkan noktaları özetle

## Alıntı Formatı
Her alıntı şu formatta olsun:
> [Entry içeriği]
> 
> — **{yazar}** · [{tarih}](https://eksisozluk.com/entry/{entry_id})

Notlar:
- Yukarıdaki satırı aynen bu Markdown yapısıyla üret (tarih tıklanabilir link olsun).

## Çıktı Formatı
- Yanıt YALNIZCA blog yazısı olsun (Markdown formatında)
- Başlık, alt başlıklar ve paragrafları uygun şekilde formatla
- Entry'lerden bol bol alıntı yap, farklı görüşleri yansıt
- Her alıntıda yazar, tarih ve link bilgilerini mutlaka ekle`
    }
];

// Helper to get Settings
const getSettings = async () => {
    return new Promise((resolve) => {
        chrome.storage.sync.get({
            geminiApiKey: '',
            selectedModel: 'gemini-2.5-flash',
            prompts: DEFAULT_PROMPTS
        }, (items) => {
            // Eğer prompts boş veya tanımsızsa, varsayılan değerleri kullan
            if (!items.prompts || items.prompts.length === 0) {
                items.prompts = DEFAULT_PROMPTS;
            }
            resolve(items);
        });
    });
};

// Detect page type based on URL and DOM structure
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

// Create analysis button and container for a specific topic
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

    // Insert container after the button
    btn.parentNode.insertBefore(container, btn.nextSibling);
};

// Start analysis for a specific topic (used in entry pages)
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

    // Reset stop flag
    shouldStopScraping = false;

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
        container.innerHTML = `<div class="eksi-ai-warning">Hata oluştu: ${err.message}</div>`;
    } finally {
        // Restore original button
        btn.disabled = false;
        btn.textContent = "Entry'leri Analiz Et";
        btn.onclick = () => startAnalysisForTopic(h1Element, topicId);
    }
};

// Helper function to extract referenced entry IDs from content
// Format: (bkz: #entry_id) - direct reference to another entry
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

// Fetch a single entry by its ID from eksisozluk.com/entry/{id}
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

// Fetch all referenced entries and populate them in allEntries
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

// Helper function to extract content from an element, replacing truncated link text with actual href
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
    
    return clone.innerText.trim();
};

// Helper function to extract entries from a document, optionally filtering from a focusto entry
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

// Scrape entries from a specific URL
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
        await new Promise(r => setTimeout(r, 500));
    }
    
    // Fetch referenced entries content
    if (!shouldStopScraping) {
        await fetchAllReferencedEntries(statusSpan);
    }
};

// Initialization
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

// Initialize single topic page
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


// Scrape single entry from current entry page
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

// Start analysis for single entry on entry page
const startSingleEntryAnalysis = async () => {
    const btn = document.getElementById('eksi-ai-entry-btn');
    const container = document.getElementById('eksi-ai-entry-container');

    if (!btn || !container) {
        console.error('Button or container not found');
        return;
    }

    // Reset stop flag
    shouldStopScraping = false;

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
        container.innerHTML = `<div class="eksi-ai-warning">Hata oluştu: ${err.message}</div>`;
    } finally {
        // Restore original button
        btn.disabled = false;
        btn.textContent = "Bu Entry'yi Analiz Et";
        btn.onclick = startSingleEntryAnalysis;
    }
};

// Create button for single entry analysis on entry pages
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

    // Insert container after the button
    btn.parentNode.insertBefore(container, btn.nextSibling);
};

// Initialize single entry page
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

const startAnalysis = async () => {
    const btn = document.getElementById('eksi-ai-main-btn');
    const container = document.getElementById('eksi-ai-container');

    if (!btn || !container) {
        console.error('Button or container not found');
        return;
    }

    // Reset stop flag
    shouldStopScraping = false;

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
        container.innerHTML = `<div class="eksi-ai-warning">Hata oluştu: ${err.message}</div>`;
    } finally {
        // Restore original button
        btn.disabled = false;
        btn.textContent = "Entry'leri Analiz Et";
        btn.onclick = startAnalysis;
    }
};

const stopScraping = () => {
    shouldStopScraping = true;
    // Try to find either button (main or entry page button)
    const btn = document.getElementById('eksi-ai-main-btn') || document.getElementById('eksi-ai-entry-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Durduruluyor...";
    }
};

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
        await new Promise(r => setTimeout(r, 500));
    }
    
    // Fetch referenced entries content
    if (!shouldStopScraping) {
        await fetchAllReferencedEntries(statusSpan);
    }
};

const renderActions = async (container, wasStopped = false) => {
    const settings = await getSettings();

    const statusMessage = wasStopped
        ? `<div class="eksi-ai-info">İşlem durduruldu. ${allEntries.length} entry toplandı.</div>`
        : `<h3>${allEntries.length} entry toplandı.</h3>`;

    let buttonsHtml = `
        <button id="btn-download" class="eksi-ai-btn secondary">JSON İndir</button>
    `;

    // Add dynamic buttons from settings
    settings.prompts.forEach((item, index) => {
        buttonsHtml += `<button id="btn-prompt-${index}" class="eksi-ai-btn" data-index="${index}">${item.name}</button>`;
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
        document.getElementById(`btn-prompt-${index}`).onclick = () => runGemini(item.prompt);
    });

    document.getElementById('btn-custom-manual').onclick = openCustomPromptModal;
};

const sanitizeFilename = (name) => {
    return name
        .replace(/[\\/:*?"<>|]/g, '_')  // Windows'ta geçersiz karakterleri değiştir
        .replace(/_+/g, '_')            // Ardışık alt çizgileri teke indir
        .replace(/^\s+|\s+$/g, '')      // Baş ve sondaki boşlukları temizle
        .replace(/^_+|_+$/g, '');       // Baş ve sondaki alt çizgileri temizle
};

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

const runGemini = async (userPrompt) => {
    const resultArea = document.getElementById('ai-result');
    const warningArea = document.getElementById('ai-warning');

    resultArea.style.display = 'block';
    
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
    warningArea.style.display = 'none';

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
        resultArea.innerHTML = parseMarkdown(response);
        resultArea.classList.add('eksi-ai-markdown');
        
        // Add action buttons for the result
        addResultActionButtons(resultArea, response);
    } catch (err) {
        let errorMessage = err.message;
        
        // Provide helpful error message for model not found
        if (errorMessage.includes('not found') || errorMessage.includes('not supported')) {
            errorMessage = `Model "${modelId}" bulunamadı veya desteklenmiyor.\n\n` +
                          `Lütfen Ayarlar sayfasından mevcut bir model seçin:\n` +
                          `- gemini-2.5-flash (Önerilen)\n` +
                          `- gemini-2.5-pro\n` +
                          `- gemini-2.5-flash-lite\n\n` +
                          `Hata detayı: ${err.message}`;
            resultArea.textContent = "Hata: " + errorMessage;
        } else if (errorMessage.includes('quota') || errorMessage.includes('Quota exceeded')) {
            // Parse retry time from error message (can be in different formats)
            // Look for patterns like "Please retry in 56.404982995s" or "retry in Xs"
            const retryMatch = errorMessage.match(/retry in ([\d.]+)\s*s/i) || 
                              errorMessage.match(/retry.*?([\d.]+)\s*second/i) ||
                              errorMessage.match(/([\d.]+)\s*s\s*$/m);
            if (retryMatch) {
                const retrySeconds = parseFloat(retryMatch[1]);
                if (!isNaN(retrySeconds) && retrySeconds > 0) {
                    showQuotaErrorWithCountdown(resultArea, errorMessage, retrySeconds);
                } else {
                    resultArea.textContent = "Hata: " + errorMessage;
                }
            } else {
                resultArea.textContent = "Hata: " + errorMessage;
            }
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

// Show quota error with countdown timer
const showQuotaErrorWithCountdown = (resultArea, errorMessage, retrySeconds) => {
    resultArea.style.display = 'block';
    
    // Create countdown container
    const countdownContainer = document.createElement('div');
    countdownContainer.className = 'eksi-ai-quota-error';
    
    const errorText = document.createElement('div');
    errorText.className = 'eksi-ai-quota-error-text';
    errorText.textContent = errorMessage.split('\n')[0]; // First line of error
    
    const countdownText = document.createElement('div');
    countdownText.className = 'eksi-ai-quota-countdown';
    
    countdownContainer.appendChild(errorText);
    countdownContainer.appendChild(countdownText);
    
    resultArea.innerHTML = '';
    resultArea.appendChild(countdownContainer);
    
    // Start countdown
    let remainingSeconds = Math.ceil(retrySeconds);
    const updateCountdown = () => {
        if (remainingSeconds > 0) {
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            const timeString = minutes > 0 
                ? `${minutes}:${seconds.toString().padStart(2, '0')}`
                : `${seconds} saniye`;
            countdownText.textContent = `Lütfen ${timeString} sonra tekrar deneyin...`;
            remainingSeconds--;
            setTimeout(updateCountdown, 1000);
        } else {
            countdownText.textContent = 'Tekrar deneyebilirsiniz!';
            countdownText.style.color = 'var(--eksi-ai-btn-bg)';
        }
    };
    
    updateCountdown();
};

const openCustomPromptModal = () => {
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

    setTimeout(() => textarea.focus(), 100);

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
            runGemini(userPrompt);
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

// Simple Markdown Parser
const parseMarkdown = (text) => {
    if (!text) return '';
    
    // Escape HTML to prevent XSS
    const escapeHtml = (str) => {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };
    
    // First, escape HTML
    let html = escapeHtml(text);
    
    // Store code blocks temporarily to prevent processing inside them
    const codeBlocks = [];
    const inlineCodes = [];
    
    // Handle fenced code blocks (```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const index = codeBlocks.length;
        codeBlocks.push(`<pre class="eksi-ai-code-block"><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`);
        return `%%CODEBLOCK_${index}%%`;
    });
    
    // Handle inline code (`)
    html = html.replace(/`([^`]+)`/g, (match, code) => {
        const index = inlineCodes.length;
        inlineCodes.push(`<code class="eksi-ai-inline-code">${code}</code>`);
        return `%%INLINECODE_${index}%%`;
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
    
    // Handle unordered lists
    const processUnorderedList = (text) => {
        const lines = text.split('\n');
        let result = [];
        let inList = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const listMatch = line.match(/^[\-\*]\s+(.+)$/);
            
            if (listMatch) {
                if (!inList) {
                    result.push('<ul>');
                    inList = true;
                }
                result.push(`<li>${listMatch[1]}</li>`);
            } else {
                if (inList) {
                    result.push('</ul>');
                    inList = false;
                }
                result.push(line);
            }
        }
        
        if (inList) {
            result.push('</ul>');
        }
        
        return result.join('\n');
    };
    
    // Handle ordered lists
    const processOrderedList = (text) => {
        const lines = text.split('\n');
        let result = [];
        let inList = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const listMatch = line.match(/^\d+\.\s+(.+)$/);
            
            if (listMatch) {
                if (!inList) {
                    result.push('<ol>');
                    inList = true;
                }
                result.push(`<li>${listMatch[1]}</li>`);
            } else {
                if (inList) {
                    result.push('</ol>');
                    inList = false;
                }
                result.push(line);
            }
        }
        
        if (inList) {
            result.push('</ol>');
        }
        
        return result.join('\n');
    };
    
    html = processUnorderedList(html);
    html = processOrderedList(html);
    
    // Handle paragraphs (double newlines)
    html = html.replace(/\n\n+/g, '</p><p>');
    
    // Handle single line breaks in non-list context
    html = html.replace(/(?<!<\/li>|<\/ul>|<\/ol>|<\/blockquote>|<\/h[1-6]>|<hr>|<\/p>|<p>)\n(?!<li>|<ul>|<ol>|<blockquote>|<h[1-6]>|<hr>|<\/p>|<p>)/g, '<br>\n');
    
    // Wrap in paragraph if not already wrapped
    if (!html.startsWith('<')) {
        html = '<p>' + html + '</p>';
    } else if (!html.startsWith('<p>') && !html.startsWith('<h') && !html.startsWith('<ul>') && !html.startsWith('<ol>') && !html.startsWith('<blockquote>') && !html.startsWith('<hr>') && !html.startsWith('%%CODEBLOCK_')) {
        html = '<p>' + html + '</p>';
    }
    
    // Restore code blocks
    codeBlocks.forEach((block, index) => {
        html = html.replace(`%%CODEBLOCK_${index}%%`, block);
    });
    
    // Restore inline codes
    inlineCodes.forEach((code, index) => {
        html = html.replace(`%%INLINECODE_${index}%%`, code);
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
    
    return html;
};

// Add action buttons (copy, download) to result area
const addResultActionButtons = (resultArea, markdownContent) => {
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
    
    actionsContainer.appendChild(copyBtn);
    actionsContainer.appendChild(downloadBtn);
    
    // Insert at the top of result area
    resultArea.insertBefore(actionsContainer, resultArea.firstChild);
};

// Copy markdown content to clipboard
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

// Download markdown content as .md file
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

// Run init
init();
