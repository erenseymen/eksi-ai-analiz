const MODELS = [
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash (Önerilen)',
        description: 'Hız ve verimlilik için en iyi seçenek. Çoğu görev için ideal.',
        cost: 'Ücretsiz (Rate limit dahilinde)',
        contextWindow: 1048576,
        responseTime: '~20 saniye'
    },
    {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Güçlü muhakeme yeteneği ve geniş bağlam penceresi. Karmaşık görevler ve derinlemesine analiz için en güçlü model.',
        cost: 'Orta/Yüksek maliyet',
        contextWindow: 1048576,
        responseTime: '~30 saniye'
    },
    {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash-Lite',
        description: 'Maksimum hız, basit görevler için.',
        cost: 'En düşük maliyet',
        contextWindow: 1048576,
        responseTime: '~10 saniye'
    }
];

const AVG_CHAR_PER_ENTRY = 328;
const CHARS_PER_TOKEN = 4; // Approximate
const TOKENS_PER_ENTRY = Math.ceil(AVG_CHAR_PER_ENTRY / CHARS_PER_TOKEN) + 20; // +20 for metadata overhead

const populateModelSelect = (savedModelId) => {
    const select = document.getElementById('modelSelect');
    const infoDiv = document.getElementById('modelInfo');

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

    // Function to update info display
    const updateInfo = () => {
        const selectedId = select.value;
        const model = MODELS.find(m => m.id === selectedId);
        if (model) {
            const capacity = Math.floor(model.contextWindow / TOKENS_PER_ENTRY);
            // Round to nearest thousand for simpler display
            const roundedCapacity = Math.round(capacity / 1000) * 1000;
            const formattedCapacity = new Intl.NumberFormat('tr-TR').format(roundedCapacity);

            infoDiv.innerHTML = `
                <strong>${model.name}</strong>
                ${model.description}
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ccc;">
                    <small><strong>Maliyet:</strong> ${model.cost}</small>
                    <small><strong>Yanıt Süresi:</strong> ${model.responseTime}</small>
                    <small><strong>Bağlam Penceresi:</strong> ${new Intl.NumberFormat('tr-TR').format(model.contextWindow)} token</small>
                    <small><strong>Tahmini Kapasite:</strong> ~${formattedCapacity} entry</small>
                </div>
            `;
        }
    };

    // Initial update
    updateInfo();

    // Listener for changes
    select.addEventListener('change', updateInfo);
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
            selectedModel: 'gemini-2.5-flash'
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

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);

