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
    // Extract topic URL from h1 link
    const topicLink = h1Element.querySelector('a');
    if (!topicLink || !topicLink.href) {
        console.error('Topic link not found');
        return;
    }

    // Use the full URL including query parameters (if any)
    const topicUrl = topicLink.href;
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

// Scrape entries from a specific URL
const scrapeEntriesFromUrl = async (url) => {
    allEntries = [];
    
    // Parse URL to preserve query parameters
    const urlObj = new URL(url);
    const baseUrl = urlObj.origin + urlObj.pathname;
    const existingParams = new URLSearchParams(urlObj.search);
    
    // Remove 'p' parameter if it exists (we'll add it in the loop)
    existingParams.delete('p');
    
    // Fetch the topic page
    const response = await fetch(url);
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

    const statusSpan = document.querySelector('.eksi-ai-loading');

    for (let i = 1; i <= totalPages; i++) {
        // Check if user requested to stop
        if (shouldStopScraping) {
            if (statusSpan) statusSpan.textContent = `İşlem durduruldu. ${allEntries.length} entry toplandı.`;
            break;
        }

        if (statusSpan) statusSpan.textContent = `Sayfa ${i}/${totalPages} taranıyor...`;

        // Build URL with preserved query parameters + page number
        const params = new URLSearchParams(existingParams);
        params.set('p', i.toString());
        const pageUrl = `${baseUrl}?${params.toString()}`;
        
        const pageResponse = await fetch(pageUrl);
        const pageText = await pageResponse.text();
        const pageDoc = parser.parseFromString(pageText, 'text/html');

        const entryItems = pageDoc.querySelectorAll('#entry-item-list > li');
        entryItems.forEach(item => {
            const content = item.querySelector('.content')?.innerText.trim();
            const author = item.querySelector('.entry-author')?.innerText.trim();
            const date = item.querySelector('.entry-date')?.innerText.trim();
            const id = item.getAttribute('data-id');

            if (content) {
                allEntries.push({
                    id,
                    author,
                    date,
                    content
                });
            }
        });

        // Be nice to the server
        await new Promise(r => setTimeout(r, 500));
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


// Initialize single entry page
const initEntryPage = () => {
    // On entry pages, we can find the topic link and add a button
    // Look for topic link in breadcrumbs or entry metadata
    const topicLink = document.querySelector('a[href*="--"]');
    if (topicLink) {
        // Find the nearest heading
        let heading = topicLink.closest('h1, h2, h3');
        if (!heading) {
            // Look for h1 in the page
            heading = document.querySelector('h1');
        }
        if (heading) {
            // Extract topic ID
            const urlMatch = topicLink.href.match(/--(\d+)/);
            const topicId = urlMatch ? urlMatch[1] : 'entry-topic';
            createAnalysisButton(heading, topicId);
        }
    }
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
    const btn = document.getElementById('eksi-ai-main-btn');
    btn.disabled = true;
    btn.textContent = "Durduruluyor...";
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

    // Parse current URL to preserve query parameters (like ?day=2025-12-04)
    const currentUrlObj = new URL(window.location.href);
    const baseUrl = currentUrlObj.origin + currentUrlObj.pathname;
    const existingParams = new URLSearchParams(currentUrlObj.search);
    
    // Remove 'p' parameter if it exists (we'll add it in the loop)
    existingParams.delete('p');

    const statusSpan = document.querySelector('.eksi-ai-loading');

    for (let i = 1; i <= totalPages; i++) {
        // Check if user requested to stop
        if (shouldStopScraping) {
            if (statusSpan) statusSpan.textContent = `İşlem durduruldu. ${allEntries.length} entry toplandı.`;
            break;
        }

        if (statusSpan) statusSpan.textContent = `Sayfa ${i}/${totalPages} taranıyor...`;

        // Build URL with preserved query parameters + page number
        const params = new URLSearchParams(existingParams);
        params.set('p', i.toString());
        const url = `${baseUrl}?${params.toString()}`;
        
        const response = await fetch(url);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        const entryItems = doc.querySelectorAll('#entry-item-list > li');
        entryItems.forEach(item => {
            const content = item.querySelector('.content')?.innerText.trim();
            const author = item.querySelector('.entry-author')?.innerText.trim();
            const date = item.querySelector('.entry-date')?.innerText.trim();
            const id = item.getAttribute('data-id');

            if (content) {
                allEntries.push({
                    id,
                    author,
                    date,
                    content
                });
            }
        });

        // Be nice to the server
        await new Promise(r => setTimeout(r, 500));
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

const downloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allEntries, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${topicTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};

const runGemini = async (userPrompt) => {
    const resultArea = document.getElementById('ai-result');
    const warningArea = document.getElementById('ai-warning');

    resultArea.style.display = 'block';
    resultArea.textContent = "Gemini düşünüyor...";
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
        const response = await callGeminiApi(apiKey, modelId, finalPrompt);
        resultArea.textContent = response;
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
        }
        
        resultArea.textContent = "Hata: " + errorMessage;
    }
};

const callGeminiApi = async (apiKey, modelId, prompt) => {
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
                })
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
                lastError = errorData.error?.message || 'API request failed';
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

// Run init
init();
