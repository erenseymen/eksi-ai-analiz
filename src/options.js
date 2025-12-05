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

// DEFAULT_PROMPTS is now defined in constants.js

// Helper function to escape HTML (prevents XSS)
const escapeHtml = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

let prompts = [];

// Helper to update prompts array from DOM
const updatePromptsFromDOM = () => {
    const promptItems = document.querySelectorAll('.prompt-item');
    const newPrompts = [];
    promptItems.forEach(item => {
        const name = item.querySelector('.prompt-name').value;
        const prompt = item.querySelector('.prompt-text').value;
        if (name && prompt) {
            newPrompts.push({ name, prompt });
        }
    });
    prompts = newPrompts;
};

// Validate API Key by making a test request to Gemini API
const validateApiKey = async (apiKey, updateInputStyle = true) => {
    const apiKeyInput = document.getElementById('apiKey');
    
    if (!apiKey || apiKey.trim() === '') {
        if (updateInputStyle) {
            apiKeyInput.classList.remove('valid', 'invalid');
        }
        return { valid: false, error: 'API Key boş olamaz.' };
    }

    try {
        const modelsUrl = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
        const response = await fetch(modelsUrl);
        
        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error?.message || 'API Key geçersiz';
            if (updateInputStyle) {
                apiKeyInput.classList.remove('valid');
                apiKeyInput.classList.add('invalid');
            }
            return { valid: false, error: errorMessage };
        }

        if (updateInputStyle) {
            apiKeyInput.classList.remove('invalid');
            apiKeyInput.classList.add('valid');
        }
        return { valid: true };
    } catch (error) {
        if (updateInputStyle) {
            apiKeyInput.classList.remove('valid');
            apiKeyInput.classList.add('invalid');
        }
        return { valid: false, error: 'API Key doğrulanırken bir hata oluştu: ' + error.message };
    }
};

// Saves options to chrome.storage
const saveOptions = async () => {
    const apiKey = document.getElementById('apiKey').value;
    const modelSelect = document.getElementById('modelSelect');
    const selectedModel = modelSelect.value;
    const status = document.getElementById('status');

    // Validate API Key before saving
    status.textContent = 'API Key doğrulanıyor...';
    status.className = 'status';
    status.style.display = 'block';

    const validation = await validateApiKey(apiKey, true);
    
    if (!validation.valid) {
        status.textContent = `Hata: ${validation.error}`;
        status.className = 'status error';
        setTimeout(() => {
            status.textContent = '';
            status.className = 'status';
            status.style.display = 'none';
        }, 5000);
        return;
    }

    updatePromptsFromDOM();

    const settings = {
        geminiApiKey: apiKey,
        selectedModel: selectedModel,
        prompts: prompts
    };

    chrome.storage.sync.set(
        settings,
        () => {
            // Update status to let user know options were saved.
            status.textContent = 'Ayarlar kaydedildi.';
            status.className = 'status success';
            setTimeout(() => {
                status.textContent = '';
                status.className = 'status';
                status.style.display = 'none';
            }, 3000);

            // Re-render to ensure state consistency (optional but good)
            renderPrompts();
        }
    );
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = async () => {
    chrome.storage.sync.get(
        {
            geminiApiKey: '',
            selectedModel: 'gemini-2.5-pro',
            prompts: DEFAULT_PROMPTS
        },
        async (items) => {
            document.getElementById('apiKey').value = items.geminiApiKey;
            
            // Eğer prompts boş veya tanımsızsa, varsayılan değerleri kullan
            prompts = (items.prompts && items.prompts.length > 0) ? items.prompts : DEFAULT_PROMPTS;

            populateModelSelect(items.selectedModel);
            renderPrompts();
            
            // Validate existing API Key if present
            if (items.geminiApiKey) {
                await validateApiKey(items.geminiApiKey, true);
            }
        }
    );
};

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
            infoDiv.innerHTML = `
                <strong>${model.name}</strong><br>
                ${model.description}<br>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ccc;">
                    <small><strong>Maliyet:</strong> ${model.cost}</small><br>
                    <small><strong>Yanıt Süresi:</strong> ${model.responseTime}</small><br>
                    <small><strong>Bağlam Penceresi:</strong> ${new Intl.NumberFormat('tr-TR').format(model.contextWindow)} token (yaklaşık 10.000 entry)</small>
                </div>
            `;
        }
    };

    // Initial update
    updateInfo();

    // Listener for changes
    select.addEventListener('change', updateInfo);
};

const renderPrompts = () => {
    const list = document.getElementById('promptsList');
    list.innerHTML = '';

    prompts.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'prompt-item';

        div.innerHTML = `
            <label>Buton Adı</label>
            <input type="text" class="prompt-name" value="${escapeHtml(item.name)}" placeholder="Buton Adı">
            
            <label>Prompt</label>
            <textarea class="prompt-text" rows="4" placeholder="Prompt içeriği...">${escapeHtml(item.prompt)}</textarea>
            
            <div style="margin-top: 10px;">
                <button class="save-item-btn" style="margin-right: 5px;">Kaydet</button>
                <button class="delete-btn">Sil</button>
            </div>
        `;

        div.querySelector('.save-item-btn').onclick = saveOptions;
        div.querySelector('.delete-btn').onclick = () => removePrompt(index);
        list.appendChild(div);
    });
};

const addPrompt = () => {
    updatePromptsFromDOM(); // Capture current state before adding
    prompts.push({ name: "Yeni Buton", prompt: "" });
    renderPrompts();
};

const removePrompt = (index) => {
    if (confirm('Bu butonu silmek istediğinize emin misiniz?')) {
        updatePromptsFromDOM(); // Capture current state before deleting
        prompts.splice(index, 1);

        // Save immediately
        const apiKey = document.getElementById('apiKey').value;
        const settings = {
            geminiApiKey: apiKey,
            prompts: prompts
        };

        chrome.storage.sync.set(settings, () => {
            renderPrompts();

            // Show status
            const status = document.getElementById('status');
            status.textContent = 'Buton silindi ve ayarlar kaydedildi.';
            status.className = 'status success';
            setTimeout(() => {
                status.textContent = '';
                status.className = 'status';
            }, 3000);
        });
    }
};

const resetPrompts = () => {
    if (confirm('Tüm butonları varsayılan değerlere sıfırlamak istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
        prompts = JSON.parse(JSON.stringify(DEFAULT_PROMPTS)); // Deep copy

        // Save immediately
        const apiKey = document.getElementById('apiKey').value;
        const settings = {
            geminiApiKey: apiKey,
            prompts: prompts
        };

        chrome.storage.sync.set(settings, () => {
            renderPrompts();

            // Show status
            const status = document.getElementById('status');
            status.textContent = 'Butonlar varsayılan değerlere sıfırlandı ve ayarlar kaydedildi.';
            status.className = 'status success';
            setTimeout(() => {
                status.textContent = '';
                status.className = 'status';
            }, 3000);
        });
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    restoreOptions();
});

document.getElementById('saveBtn').addEventListener('click', () => {
    saveOptions();
});
document.getElementById('addBtn').addEventListener('click', addPrompt);
document.getElementById('resetBtn').addEventListener('click', resetPrompts);
document.getElementById('apiKey').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        saveOptions();
    }
});

// Validate API Key when user leaves the input field
document.getElementById('apiKey').addEventListener('blur', async (e) => {
    const apiKey = e.target.value.trim();
    if (apiKey) {
        await validateApiKey(apiKey, true);
    } else {
        // Remove validation classes if input is empty
        e.target.classList.remove('valid', 'invalid');
    }
});
