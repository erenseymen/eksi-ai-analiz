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

// Known Google Gemini API limits (free tier)
const GEMINI_LIMITS = {
    dailyTokens: 300000, // 300k tokens per day
    requestsPerMinute: 60
};

// Get today's usage statistics
const getTodayUsage = () => {
    return new Promise((resolve) => {
        const today = new Date().toISOString().split('T')[0];
        const usageKey = `geminiUsage_${today}`;
        
        chrome.storage.local.get([usageKey], (result) => {
            const usage = result[usageKey] || {
                promptTokens: 0,
                candidatesTokens: 0,
                totalTokens: 0,
                requestCount: 0
            };
            resolve(usage);
        });
    });
};

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

const loadTokenUsageBar = async () => {
    const tokenBarDiv = document.getElementById('tokenUsageBar');
    if (!tokenBarDiv) return;

    try {
        const usage = await getTodayUsage();
        const limits = GEMINI_LIMITS;
        const usagePercent = limits.dailyTokens > 0 
            ? Math.min((usage.totalTokens / limits.dailyTokens) * 100, 100)
            : 0;
        
        // Determine color based on usage
        let usageColor = '#81c14b'; // green
        if (usagePercent > 80) usageColor = '#d9534f'; // red
        else if (usagePercent > 60) usageColor = '#f0ad4e'; // orange
        
        const formatNumber = (num) => new Intl.NumberFormat('tr-TR').format(num);
        
        tokenBarDiv.innerHTML = `
            <div class="token-bar-label">Bugünkü Token Kullanımı: ${formatNumber(usage.totalTokens)} / ${formatNumber(limits.dailyTokens)}</div>
            <div class="token-bar-container">
                <div class="token-bar-fill" style="background: ${usageColor}; width: ${usagePercent}%;"></div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading token usage:', error);
        tokenBarDiv.innerHTML = '';
    }
};

const restoreOptions = async () => {
    chrome.storage.sync.get(
        {
            selectedModel: 'gemini-2.5-flash'
        },
        async (items) => {
            populateModelSelect(items.selectedModel);
            await loadTokenUsageBar();
        }
    );
};

// Open full settings page
document.getElementById('settingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
});

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', () => {
    saveOptions();
    // Refresh token usage bar after saving
    loadTokenUsageBar();
});

// Listen for storage changes to update token usage bar in real-time
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
        // Check if any token usage key changed
        const today = new Date().toISOString().split('T')[0];
        const usageKey = `geminiUsage_${today}`;
        if (changes[usageKey]) {
            loadTokenUsageBar();
        }
    }
});

