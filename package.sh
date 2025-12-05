#!/bin/bash

# Chrome Web Store ve Firefox Add-ons için eklenti paketleme scripti

# Renk kodları
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${GREEN}Ekşi Sözlük AI Analiz - Paketleme Scripti${NC}"
echo "=========================================="

# Kullanım bilgisi
show_usage() {
    echo -e "${CYAN}Kullanım:${NC}"
    echo "  ./package.sh          # Hem Chrome hem Firefox paketler"
    echo "  ./package.sh chrome   # Sadece Chrome paketi"
    echo "  ./package.sh firefox  # Sadece Firefox paketi"
    echo ""
}

# Versiyonu manifest.json'dan oku
VERSION=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)
if [ -z "$VERSION" ]; then
    echo -e "${RED}Hata: manifest.json'dan versiyon okunamadı!${NC}"
    exit 1
fi

echo -e "${GREEN}Versiyon: ${VERSION}${NC}"
echo ""

# Chrome paketi oluştur
package_chrome() {
    local ZIP_NAME="eksi-ai-analiz-v${VERSION}-chrome.zip"
    local TEMP_DIR=".package_temp_chrome"

    echo -e "${CYAN}Chrome paketi hazırlanıyor...${NC}"

    # Eski paketleri temizle
    if [ -f "$ZIP_NAME" ]; then
        rm "$ZIP_NAME"
    fi

    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi

    # Geçici dizin oluştur
    mkdir -p "$TEMP_DIR"

    # Gerekli dosyaları kopyala
    cp manifest.json "$TEMP_DIR/"
    cp -r icons "$TEMP_DIR/"
    cp -r src "$TEMP_DIR/"

    # ZIP oluştur
    cd "$TEMP_DIR"
    zip -r "../$ZIP_NAME" . -q
    cd ..

    # Geçici dizini temizle
    rm -rf "$TEMP_DIR"

    # Dosya boyutunu göster
    FILE_SIZE=$(du -h "$ZIP_NAME" | cut -f1)
    echo -e "${GREEN}✓ Chrome paketi: ${ZIP_NAME} (${FILE_SIZE})${NC}"
}

# Firefox paketi oluştur
package_firefox() {
    local ZIP_NAME="eksi-ai-analiz-v${VERSION}-firefox.zip"
    local TEMP_DIR=".package_temp_firefox"

    echo -e "${CYAN}Firefox paketi hazırlanıyor...${NC}"

    # Firefox manifest kontrolü
    if [ ! -f "manifest.firefox.json" ]; then
        echo -e "${RED}Hata: manifest.firefox.json bulunamadı!${NC}"
        exit 1
    fi

    # Eski paketleri temizle
    if [ -f "$ZIP_NAME" ]; then
        rm "$ZIP_NAME"
    fi

    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi

    # Geçici dizin oluştur
    mkdir -p "$TEMP_DIR"

    # Gerekli dosyaları kopyala (Firefox manifest'i ana manifest olarak)
    cp manifest.firefox.json "$TEMP_DIR/manifest.json"
    cp -r icons "$TEMP_DIR/"
    cp -r src "$TEMP_DIR/"

    # ZIP oluştur
    cd "$TEMP_DIR"
    zip -r "../$ZIP_NAME" . -q
    cd ..

    # Geçici dizini temizle
    rm -rf "$TEMP_DIR"

    # Dosya boyutunu göster
    FILE_SIZE=$(du -h "$ZIP_NAME" | cut -f1)
    echo -e "${GREEN}✓ Firefox paketi: ${ZIP_NAME} (${FILE_SIZE})${NC}"
}

# Parametre kontrolü
case "$1" in
    chrome)
        package_chrome
        echo ""
        echo -e "${GREEN}✓ Chrome paketleme tamamlandı!${NC}"
        echo -e "${YELLOW}Chrome Web Store Developer Dashboard'a gidip bu ZIP dosyasını yükleyebilirsiniz.${NC}"
        ;;
    firefox)
        package_firefox
        echo ""
        echo -e "${GREEN}✓ Firefox paketleme tamamlandı!${NC}"
        echo -e "${YELLOW}Firefox Add-on Developer Hub'a gidip bu ZIP dosyasını yükleyebilirsiniz.${NC}"
        echo -e "${YELLOW}https://addons.mozilla.org/developers/${NC}"
        ;;
    ""|all)
        package_chrome
        echo ""
        package_firefox
        echo ""
        echo -e "${GREEN}✓ Tüm paketleme tamamlandı!${NC}"
        echo ""
        echo -e "${YELLOW}Yükleme linkleri:${NC}"
        echo -e "  Chrome: https://chrome.google.com/webstore/devconsole"
        echo -e "  Firefox: https://addons.mozilla.org/developers/"
        ;;
    -h|--help)
        show_usage
        ;;
    *)
        echo -e "${RED}Geçersiz parametre: $1${NC}"
        show_usage
        exit 1
        ;;
esac

echo ""
