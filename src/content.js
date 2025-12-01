// Global state
let allEntries = [];
let topicTitle = "";
let topicId = "";
let shouldStopScraping = false;

const PROMPTS = {
    summary: `Aşağıda "{{TITLE}}" başlığı altındaki Ekşi Sözlük entry'leri JSON formatında verilmiştir. Bu entry'leri analiz ederek kapsamlı bir özet hazırla.

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
Yanıtın sadece özet metni olsun, ek açıklama veya meta bilgi içermesin.

Entry'ler:
{{ENTRIES}}`,
    blog: `Aşağıda "{{TITLE}}" başlığı altındaki Ekşi Sözlük entry'leri JSON formatında verilmiştir. Bu entry'lere dayalı, kapsamlı ve okunabilir bir blog yazısı yaz.

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
- Her alıntıda yazar, tarih ve link bilgilerini mutlaka ekle

Entry'ler:
{{ENTRIES}}`,

};

// Helper to get API Key
const getApiKey = async () => {
    return new Promise((resolve) => {
        chrome.storage.sync.get({ geminiApiKey: '' }, (items) => {
            resolve(items.geminiApiKey);
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
            renderActions(container, shouldStopScraping);
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

const renderActions = (container, wasStopped = false) => {
    const statusMessage = wasStopped
        ? `<div class="eksi-ai-info">İşlem durduruldu. ${allEntries.length} entry toplandı.</div>`
        : `<h3>${allEntries.length} entry toplandı.</h3>`;

    container.innerHTML = `
        ${statusMessage}
        <div class="eksi-ai-actions">
            <button id="btn-download" class="eksi-ai-btn secondary">JSON İndir</button>
            <button id="btn-summary" class="eksi-ai-btn">Özet</button>
            <button id="btn-blog" class="eksi-ai-btn">Blog</button>

            <button id="btn-custom" class="eksi-ai-btn">Özel Prompt</button>
        </div>
        <div id="ai-result" class="eksi-ai-result-area"></div>
        <div id="ai-warning" class="eksi-ai-warning"></div>
    `;

    document.getElementById('btn-download').onclick = downloadJson;
    document.getElementById('btn-summary').onclick = () => runGemini('summary');
    document.getElementById('btn-blog').onclick = () => runGemini('blog');

    document.getElementById('btn-custom').onclick = openCustomPromptModal;
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

const runGemini = async (type, customPrompt = null) => {
    const resultArea = document.getElementById('ai-result');
    const warningArea = document.getElementById('ai-warning');

    resultArea.style.display = 'block';
    resultArea.textContent = "Gemini düşünüyor...";
    warningArea.style.display = 'none';

    const apiKey = await getApiKey();
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

    let promptTemplate = customPrompt || PROMPTS[type];
    const limitedEntries = allEntries;
    const entriesJson = JSON.stringify(limitedEntries);

    const finalPrompt = promptTemplate
        .replace('{{ENTRIES}}', entriesJson)
        .replace('{{TITLE}}', topicTitle);

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
    // Simple prompt for now
    const userPrompt = prompt("Özel promptunuzu girin ({{ENTRIES}} ve {{TITLE}} yer tutucularını kullanabilirsiniz):", "Konu: {{TITLE}}\n\nAşağıdaki JSON formatındaki entry'leri analiz et:\n{{ENTRIES}}");
    if (userPrompt) {
        runGemini('custom', userPrompt);
    }
};

// Run init
init();
