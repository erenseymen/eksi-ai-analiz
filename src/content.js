// Global state
let allEntries = [];
let topicTitle = "";
let topicId = "";

// Prompts (Hardcoded for now, or we can fetch them if we bundle them accessible via web_accessible_resources, 
// but hardcoding is easier for a simple extension structure without complex build steps)
const PROMPTS = {
    summary: `Aşağıdaki JSON formatındaki ekşi sözlük entry'lerini incele. Bu başlık altında konuşulanları, genel havayı, öne çıkan noktaları ve tartışmaları kapsayan detaylı ve akıcı bir özet çıkar. Ekşi sözlük jargonuna hakim bir dil kullan ancak çok laubali olma. Objektif olmaya çalış.

Entry'ler:
{{ENTRIES}}`,
    blog: `Aşağıdaki JSON formatındaki ekşi sözlük entry'lerini kaynak alarak, bu konu hakkında ilgi çekici, okunabilirliği yüksek ve SEO uyumlu bir blog yazısı hazırla. Yazıda başlıklar, maddeler ve akıcı bir anlatım kullan. Ekşi sözlük yazarlarının deneyimlerinden ve yorumlarından alıntılar (anonim olarak) yapabilirsin. Yazının tonu bilgilendirici ve samimi olsun.

Entry'ler:
{{ENTRIES}}`,
    opinions: `Aşağıdaki JSON formatındaki ekşi sözlük entry'lerini analiz et. Bu başlık altındaki temel görüşleri/argümanları gruplandır. Her bir görüşün ne olduğunu açıkla ve yazarların tahmini olarak yüzde kaçının bu görüşü desteklediğini belirt.

Çıktı formatı şöyle olsun:
- **Görüş 1:** [Görüşün Açıklaması] (%XX)
- **Görüş 2:** [Görüşün Açıklaması] (%XX)
...

Ayrıca en sonunda genel bir değerlendirme yap.

Entry'ler:
{{ENTRIES}}`
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
    const topicHeader = document.getElementById('topic');
    if (topicHeader && !document.getElementById('eksi-ai-main-btn')) {
        const btn = document.createElement('button');
        btn.id = 'eksi-ai-main-btn';
        btn.className = 'eksi-ai-btn';
        btn.textContent = "Entry'leri Analiz Et";
        btn.onclick = startAnalysis;

        // Insert after the title
        topicHeader.appendChild(btn);

        // Container for results/actions
        const container = document.createElement('div');
        container.id = 'eksi-ai-container';
        container.className = 'eksi-ai-container';
        container.style.display = 'none';
        topicHeader.parentNode.insertBefore(container, topicHeader.nextSibling);
    }
};

const startAnalysis = async () => {
    const btn = document.getElementById('eksi-ai-main-btn');
    const container = document.getElementById('eksi-ai-container');

    btn.disabled = true;
    btn.textContent = "Analiz Ediliyor...";
    container.style.display = 'block';
    container.innerHTML = '<span class="eksi-ai-loading">Entry\'ler toplanıyor... Lütfen bekleyin.</span>';

    try {
        await scrapeEntries();
        renderActions(container);
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="eksi-ai-warning">Hata oluştu: ${err.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = "Entry'leri Analiz Et";
    }
};

const scrapeEntries = async () => {
    allEntries = [];
    topicTitle = document.querySelector('#topic h1')?.innerText || "Basliksiz";

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

const renderActions = (container) => {
    container.innerHTML = `
        <h3>${allEntries.length} entry toplandı.</h3>
        <div class="eksi-ai-actions">
            <button id="btn-download" class="eksi-ai-btn secondary">JSON İndir</button>
            <button id="btn-summary" class="eksi-ai-btn">Özet</button>
            <button id="btn-blog" class="eksi-ai-btn">Blog</button>
            <button id="btn-opinions" class="eksi-ai-btn">Görüşler</button>
            <button id="btn-custom" class="eksi-ai-btn">Özel Prompt</button>
        </div>
        <div id="ai-result" class="eksi-ai-result-area"></div>
        <div id="ai-warning" class="eksi-ai-warning"></div>
    `;

    document.getElementById('btn-download').onclick = downloadJson;
    document.getElementById('btn-summary').onclick = () => runGemini('summary');
    document.getElementById('btn-blog').onclick = () => runGemini('blog');
    document.getElementById('btn-opinions').onclick = () => runGemini('opinions');
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
            chrome.runtime.openOptionsPage();
        };
        return;
    }

    let promptTemplate = customPrompt || PROMPTS[type];
    // Sending all entries. Gemini 1.5 Flash has a 1M token context window, which should be sufficient for most topics.
    const limitedEntries = allEntries;
    const entriesJson = JSON.stringify(limitedEntries);

    const finalPrompt = promptTemplate.replace('{{ENTRIES}}', entriesJson);

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
    const userPrompt = prompt("Özel promptunuzu girin ({{ENTRIES}} yer tutucusu entry'lerin geleceği yerdir):", "Aşağıdaki entry'leri analiz et:\n{{ENTRIES}}");
    if (userPrompt) {
        runGemini('custom', userPrompt);
    }
};

// Run init
init();
