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
            prompts: DEFAULT_PROMPTS
        }, (items) => {
            resolve(items);
        });
    });
};

// Initialization
const init = () => {
    let topicHeader = document.getElementById('topic');
    let topicTitleH1 = topicHeader ? topicHeader.querySelector('h1') : document.querySelector('h1');

    // If we found h1 but not topicHeader (or topicHeader didn't contain h1), update topicHeader
    if (topicTitleH1 && (!topicHeader || !topicHeader.contains(topicTitleH1))) {
        topicHeader = topicTitleH1.parentElement;
    }

    if (topicHeader && !document.getElementById('eksi-ai-main-btn')) {
        const btn = document.createElement('button');
        btn.id = 'eksi-ai-main-btn';
        btn.className = 'eksi-ai-btn';
        btn.textContent = "Entry'leri Analiz Et";
        btn.onclick = startAnalysis;

        if (topicTitleH1) {
            // Insert after the h1 title
            topicTitleH1.parentNode.insertBefore(btn, topicTitleH1.nextSibling);
        } else {
            // Fallback: Insert at the top of topicHeader
            topicHeader.insertBefore(btn, topicHeader.firstChild);
        }

        // Container for results/actions
        const container = document.createElement('div');
        container.id = 'eksi-ai-container';
        container.className = 'eksi-ai-container';
        container.style.display = 'none';

        // Insert container after the button
        if (topicTitleH1) {
            topicTitleH1.parentNode.insertBefore(container, btn.nextSibling);
        } else {
            topicHeader.appendChild(container);
        }
    }
};

const startAnalysis = async () => {
    const btn = document.getElementById('eksi-ai-main-btn');
    const container = document.getElementById('eksi-ai-container');

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

    const currentUrl = window.location.href.split('?')[0]; // Base URL

    const statusSpan = document.querySelector('.eksi-ai-loading');

    for (let i = 1; i <= totalPages; i++) {
        // Check if user requested to stop
        if (shouldStopScraping) {
            if (statusSpan) statusSpan.textContent = `İşlem durduruldu. ${allEntries.length} entry toplandı.`;
            break;
        }

        if (statusSpan) statusSpan.textContent = `Sayfa ${i}/${totalPages} taranıyor...`;

        const url = `${currentUrl}?p=${i}`;
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
        const response = await callGeminiApi(apiKey, finalPrompt);
        resultArea.textContent = response;
    } catch (err) {
        resultArea.textContent = "Hata: " + err.message;
    }
};

const callGeminiApi = async (apiKey, prompt) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
};

const openCustomPromptModal = () => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'eksi-ai-modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: #fff;
        padding: 25px;
        border-radius: 6px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        width: 90%;
    `;

    modal.innerHTML = `
        <h3 style="margin: 0 0 20px 0; color: #333; font-size: 18px; font-weight: 600;">Ne yapmamı istersin?</h3>
        <textarea id="eksi-ai-custom-prompt" 
                  style="width: 100%; 
                         height: 120px; 
                         padding: 12px; 
                         border: 1px solid #ccc; 
                         border-radius: 4px; 
                         font-family: inherit;
                         font-size: 14px;
                         box-sizing: border-box;
                         resize: vertical;
                         background: #fff;
                         color: #333;"
                  placeholder="Örnek: Bu konudaki mizahi entry'leri listele"></textarea>
        <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
            <button id="eksi-ai-modal-cancel" 
                    class="eksi-ai-modal-btn eksi-ai-modal-cancel-btn"
                    style="padding: 10px 20px; 
                           border: 1px solid #ccc; 
                           background: #f5f5f5; 
                           color: #333;
                           border-radius: 4px; 
                           cursor: pointer;
                           font-size: 14px;
                           font-weight: 500;">
                vazgeç
            </button>
            <button id="eksi-ai-modal-submit" 
                    class="eksi-ai-modal-btn eksi-ai-modal-submit-btn"
                    style="padding: 10px 20px; 
                           border: none; 
                           background: #81c14b; 
                           color: #fff; 
                           border-radius: 4px; 
                           cursor: pointer;
                           font-size: 14px;
                           font-weight: 500;">
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

    // Add hover effects
    cancelBtn.onmouseenter = () => {
        cancelBtn.style.background = '#e8e8e8';
    };
    cancelBtn.onmouseleave = () => {
        cancelBtn.style.background = '#f5f5f5';
    };

    submitBtn.onmouseenter = () => {
        submitBtn.style.background = '#6da53e';
    };
    submitBtn.onmouseleave = () => {
        submitBtn.style.background = '#81c14b';
    };

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
            textarea.style.borderColor = '#ccc';
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            submitBtn.click();
        }
    };
};

// Run init
init();
