// MODELS is now defined in constants.js

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

