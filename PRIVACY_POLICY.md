# Gizlilik Politikası

**Son Güncelleme:** 2025-12-05

## Genel Bakış

Ekşi Sözlük AI Analiz eklentisi, kullanıcıların Ekşi Sözlük başlıklarını yapay zeka ile analiz etmesine olanak sağlar. Bu gizlilik politikası, eklentinin veri toplama, kullanma ve saklama uygulamalarını açıklar.

## Toplanan Veriler

### 1. API Anahtarları
- **Ne toplanır:** Kullanıcıların kendi Google Gemini API anahtarları
- **Nasıl saklanır:** Veriler yalnızca tarayıcınızın yerel depolama alanında (`chrome.storage.sync`) saklanır
- **Kullanım:** API anahtarları yalnızca Google Gemini API'sine istek göndermek için kullanılır
- **Paylaşım:** API anahtarları hiçbir zaman üçüncü taraflarla paylaşılmaz veya sunucularımıza gönderilmez

### 2. Ekşi Sözlük İçeriği
- **Ne toplanır:** Kullanıcının ziyaret ettiği Ekşi Sözlük başlıklarındaki entry'ler
- **Nasıl toplanır:** Veriler yalnızca kullanıcı "Entry'leri Analiz Et" butonuna tıkladığında toplanır
- **Kullanım:** Toplanan entry'ler Google Gemini API'sine gönderilerek analiz edilir
- **Saklama:** Entry'ler yalnızca analiz süresi boyunca geçici olarak bellekte tutulur, kalıcı olarak saklanmaz

### 3. Kullanıcı Ayarları
- **Ne toplanır:** Seçilen AI modeli, özel prompt'lar ve diğer kullanıcı tercihleri
- **Nasıl saklanır:** Veriler tarayıcınızın yerel depolama alanında saklanır
- **Kullanım:** Ayarlar yalnızca eklentinin işlevselliğini sağlamak için kullanılır

## Veri Paylaşımı

### Google Gemini API
- Entry'ler ve kullanıcı prompt'ları analiz için Google Gemini API'sine gönderilir
- Bu veri aktarımı Google'ın gizlilik politikasına tabidir
- API anahtarları kullanıcının kendi Google hesabına aittir

### Üçüncü Taraf Paylaşımı
- Eklenti, toplanan verileri reklam şirketleri, analitik servisler veya diğer üçüncü taraflarla paylaşmaz
- Veriler hiçbir sunucuya gönderilmez (yalnızca Google Gemini API'sine)

## Veri Güvenliği

- Tüm veriler tarayıcınızın yerel depolama alanında saklanır
- API anahtarları şifrelenmiş bir şekilde Chrome'un senkronizasyon servisi üzerinden saklanabilir (kullanıcı Chrome senkronizasyonunu etkinleştirmişse)
- Eklenti, verileri toplamak veya saklamak için herhangi bir sunucu kullanmaz

## Kullanıcı Hakları

- **Veri Erişimi:** Tüm verileriniz tarayıcınızın yerel depolama alanında saklanır ve Chrome'un geliştirici araçları ile görüntülenebilir
- **Veri Silme:** Eklentiyi kaldırdığınızda tüm veriler otomatik olarak silinir
- **Veri Düzenleme:** Ayarlar sayfasından API anahtarınızı ve diğer tercihlerinizi düzenleyebilir veya silebilirsiniz

## İletişim

Bu gizlilik politikası hakkında sorularınız için lütfen GitHub repository'sinde issue açın.

## Ek Bilgiler

- **Eklenti Adı:** Ekşi Sözlük AI Analiz
- **Geliştirici:** [GitHub Repository](https://github.com/erenseymen/eksi-ai-analiz)
- **Veri İşleme Yeri:** Yerel (kullanıcının tarayıcısı)

