// Saves options to chrome.storage
const saveOptions = () => {
    const apiKey = document.getElementById('apiKey').value;
    const status = document.getElementById('status');

    if (!apiKey) {
        status.textContent = 'Lütfen bir API Key girin.';
        status.className = 'status error';
        return;
    }

    chrome.storage.sync.set(
        { geminiApiKey: apiKey },
        () => {
            // Update status to let user know options were saved.
            status.textContent = 'Ayarlar kaydedildi.';
            status.className = 'status success';
            setTimeout(() => {
                status.textContent = '';
                status.className = 'status';
            }, 3000);
        }
    );
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
    chrome.storage.sync.get(
        { geminiApiKey: '' },
        (items) => {
            document.getElementById('apiKey').value = items.geminiApiKey;
        }
    );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);
