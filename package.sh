#!/bin/bash

# Chrome Web Store için eklenti paketleme scripti

# Renk kodları
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Ekşi Sözlük AI Analiz - Paketleme Scripti${NC}"
echo "=========================================="

# ZIP dosya adı
ZIP_NAME="eksi-ai-analiz.zip"
TEMP_DIR=".package_temp"

# Eski paketleri temizle
if [ -f "$ZIP_NAME" ]; then
    echo -e "${YELLOW}Eski paket siliniyor...${NC}"
    rm "$ZIP_NAME"
fi

if [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
fi

# Geçici dizin oluştur
mkdir -p "$TEMP_DIR"

echo -e "${GREEN}Dosyalar kopyalanıyor...${NC}"

# Gerekli dosyaları kopyala
cp manifest.json "$TEMP_DIR/"
cp -r icons "$TEMP_DIR/"
cp -r src "$TEMP_DIR/"

# ZIP oluştur
echo -e "${GREEN}ZIP dosyası oluşturuluyor...${NC}"
cd "$TEMP_DIR"
zip -r "../$ZIP_NAME" . -q
cd ..

# Geçici dizini temizle
rm -rf "$TEMP_DIR"

# Dosya boyutunu göster
FILE_SIZE=$(du -h "$ZIP_NAME" | cut -f1)
echo -e "${GREEN}✓ Paket oluşturuldu: ${ZIP_NAME} (${FILE_SIZE})${NC}"

# İçerik kontrolü
echo ""
echo -e "${YELLOW}Paket içeriği:${NC}"
unzip -l "$ZIP_NAME" | head -20

echo ""
echo -e "${GREEN}✓ Paketleme tamamlandı!${NC}"
echo -e "${YELLOW}Şimdi Chrome Web Store Developer Dashboard'a gidip bu ZIP dosyasını yükleyebilirsiniz.${NC}"

