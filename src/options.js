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

// Saves options to chrome.storage
const saveOptions = () => {
    const apiKey = document.getElementById('apiKey').value;
    const modelSelect = document.getElementById('modelSelect');
    const selectedModel = modelSelect.value;
    const status = document.getElementById('status');

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
            }, 3000);

            // Re-render to ensure state consistency (optional but good)
            renderPrompts();
        }
    );
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
    chrome.storage.sync.get(
        {
            geminiApiKey: '',
            selectedModel: 'gemini-2.5-flash',
            prompts: DEFAULT_PROMPTS
        },
        (items) => {
            document.getElementById('apiKey').value = items.geminiApiKey;
            prompts = items.prompts;

            populateModelSelect(items.selectedModel);
            renderPrompts();
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
            const capacity = Math.floor(model.contextWindow / TOKENS_PER_ENTRY);
            // Round to nearest thousand for simpler display
            const roundedCapacity = Math.round(capacity / 1000) * 1000;
            const formattedCapacity = new Intl.NumberFormat('tr-TR').format(roundedCapacity);

            infoDiv.innerHTML = `
                <strong>${model.name}</strong><br>
                ${model.description}<br>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ccc;">
                    <small><strong>Maliyet:</strong> ${model.cost}</small><br>
                    <small><strong>Yanıt Süresi:</strong> ${model.responseTime}</small><br>
                    <small><strong>Bağlam Penceresi:</strong> ${new Intl.NumberFormat('tr-TR').format(model.contextWindow)} token</small><br>
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

const renderPrompts = () => {
    const list = document.getElementById('promptsList');
    list.innerHTML = '';

    prompts.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'prompt-item';

        div.innerHTML = `
            <label>Buton Adı</label>
            <input type="text" class="prompt-name" value="${item.name}" placeholder="Buton Adı">
            
            <label>Prompt</label>
            <textarea class="prompt-text" rows="4" placeholder="Prompt içeriği...">${item.prompt}</textarea>
            
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

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);
document.getElementById('addBtn').addEventListener('click', addPrompt);
document.getElementById('resetBtn').addEventListener('click', resetPrompts);
document.getElementById('apiKey').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        saveOptions();
    }
});
