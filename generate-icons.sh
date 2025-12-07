#!/bin/bash

# Icon generation script for eksi-ai-analiz
# Generates different icon sizes from the source icon
# Requires: ImageMagick (install with: sudo apt install imagemagick)

SOURCE_ICON="icons/icon.png"
OUTPUT_DIR="icons"

# Icon sizes to generate (add or remove sizes as needed)
SIZES=(16 32 48 64 128)

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is not installed."
    echo "Install it with: sudo apt install imagemagick"
    exit 1
fi

# Check if source icon exists
if [ ! -f "$SOURCE_ICON" ]; then
    echo "Error: Source icon not found at $SOURCE_ICON"
    exit 1
fi

echo "Generating icons from $SOURCE_ICON..."

for size in "${SIZES[@]}"; do
    output_file="$OUTPUT_DIR/icon${size}.png"
    echo "  Creating ${size}x${size} -> $output_file"
    convert "$SOURCE_ICON" -resize "${size}x${size}" "$output_file"
done

echo ""
echo "Done! Generated icons:"
ls -la "$OUTPUT_DIR"/icon*.png

