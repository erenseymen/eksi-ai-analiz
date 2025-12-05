const MODELS = [
    {
        id: 'gemini-3-pro-preview',
        name: '💎 Gemini 3 Pro Preview (Ücretli)',
        description: 'En yeni nesil model. Üstün performans, gelişmiş muhakeme ve çoklu modalite desteği.',
        cost: '💰 Ücretli (Free tier\'da kullanılamaz)',
        contextWindow: 1048576,
        responseTime: '~30-40 saniye',
        isFree: false
    },
    {
        id: 'gemini-2.5-pro',
        name: '⭐ Gemini 2.5 Pro (Önerilen)',
        description: 'Güçlü muhakeme yeteneği ve geniş bağlam penceresi. Karmaşık görevler ve derinlemesine analiz için güçlü model.',
        cost: '✅ Ücretsiz (Rate limit dahilinde)',
        contextWindow: 1048576,
        responseTime: '~30 saniye',
        isFree: true
    },
    {
        id: 'gemini-2.5-flash',
        name: '⚡ Gemini 2.5 Flash',
        description: 'Hız ve verimlilik için en iyi seçenek. Çoğu görev için ideal.',
        cost: '✅ Ücretsiz (Rate limit dahilinde)',
        contextWindow: 1048576,
        responseTime: '~20 saniye',
        isFree: true
    },
    {
        id: 'gemini-2.5-flash-lite',
        name: '⚡ Gemini 2.5 Flash-Lite',
        description: 'Maksimum hız, basit görevler için.',
        cost: '✅ Ücretsiz (En düşük maliyet)',
        contextWindow: 1048576,
        responseTime: '~10 saniye',
        isFree: true
    }
];

const populateModelSelect = (savedModelId) => {
    const select = document.getElementById('modelSelect');

    select.innerHTML = '';

    MODELS.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        if (model.id === savedModelId) {
            option.selected = true;
        }
        select.appendChild(option);
    });
};

const saveOptions = () => {
    const modelSelect = document.getElementById('modelSelect');
    const selectedModel = modelSelect.value;
    const status = document.getElementById('status');

    chrome.storage.sync.get(['geminiApiKey', 'prompts'], (items) => {
        const settings = {
            geminiApiKey: items.geminiApiKey || '',
            selectedModel: selectedModel,
            prompts: items.prompts || []
        };

        chrome.storage.sync.set(settings, () => {
            status.textContent = 'Model kaydedildi.';
            status.className = 'status success';
            setTimeout(() => {
                status.textContent = '';
                status.className = 'status';
            }, 2000);
        });
    });
};

const restoreOptions = () => {
    chrome.storage.sync.get(
        {
            selectedModel: 'gemini-2.5-pro'
        },
        (items) => {
            populateModelSelect(items.selectedModel);
        }
    );
};

// Open full settings page
document.getElementById('settingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
});

document.addEventListener('DOMContentLoaded', () => {
    restoreOptions();
    // Auto-save when model selection changes
    document.getElementById('modelSelect').addEventListener('change', saveOptions);
});

