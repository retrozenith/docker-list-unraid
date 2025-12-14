#!/bin/bash
#
# Docker List Editor - Build Script
# Creates a .txz package for Unraid plugin installation
#
# Usage: ./build.sh [version]
# Example: ./build.sh 2024.12.14
#

set -e

# Detect macOS and use GNU tools
if [ "$(uname)" == "Darwin" ]; then
    PREFIX="g"
    echo "Detected macOS, using GNU tools (gsed, gtar)"
else
    PREFIX=""
fi

# Configuration
PLUGIN_NAME="docker-list-editor"
VERSION="${1:-$(date +%Y.%m.%d)}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="${SCRIPT_DIR}/source/${PLUGIN_NAME}"
ARCHIVE_DIR="${SCRIPT_DIR}/archive"
PLUGIN_FILE="${SCRIPT_DIR}/${PLUGIN_NAME}.plg"

echo "============================================"
echo "Building ${PLUGIN_NAME} v${VERSION}"
echo "============================================"

# Validate source directory
if [ ! -d "${SOURCE_DIR}" ]; then
    echo "ERROR: Source directory not found: ${SOURCE_DIR}"
    exit 1
fi

# Create archive directory
mkdir -p "${ARCHIVE_DIR}"

# Package filename
PACKAGE_FILE="${ARCHIVE_DIR}/${PLUGIN_NAME}-${VERSION}.txz"

echo "Source: ${SOURCE_DIR}"
echo "Output: ${PACKAGE_FILE}"
echo ""

# Enter source directory
pushd "${SOURCE_DIR}" > /dev/null

# Normalize line endings (if dos2unix is available)
if command -v dos2unix &> /dev/null; then
    echo "Normalizing line endings..."
    find usr -type f \( -name "*.php" -o -name "*.js" -o -name "*.css" -o -name "*.page" \) -exec dos2unix {} \; 2>/dev/null
fi

# Set permissions
echo "Setting file permissions..."
find usr -type f -exec chmod 644 {} \;
find usr -type d -exec chmod 755 {} \;

# Make any scripts executable
find usr -type f -name "*.sh" -exec chmod 755 {} \; 2>/dev/null || true

# Create the archive
echo "Creating archive..."
"${PREFIX}tar" -cJf "${PACKAGE_FILE}" --owner=0 --group=0 usr/

popd > /dev/null

# Verify archive was created
if [ ! -f "${PACKAGE_FILE}" ]; then
    echo "ERROR: Failed to create archive"
    exit 1
fi

# Calculate MD5 hash
HASH=$(md5sum "${PACKAGE_FILE}" | cut -f 1 -d " ")
echo ""
echo "Package created: ${PACKAGE_FILE}"
echo "MD5: ${HASH}"
echo "Size: $(du -h "${PACKAGE_FILE}" | cut -f1)"

# Update .plg file with new version and hash
if [ -f "${PLUGIN_FILE}" ]; then
    echo ""
    echo "Updating ${PLUGIN_FILE}..."
    
    # Update version
    "${PREFIX}sed" -i.bak 's/<!ENTITY version.*>/<!ENTITY version   "'"${VERSION}"'">/' "${PLUGIN_FILE}"
    
    # Update MD5 hash
    "${PREFIX}sed" -i.bak 's/<!ENTITY md5.*>/<!ENTITY md5       "'"${HASH}"'">/' "${PLUGIN_FILE}"
    
    # Clean up backup files
    rm -f "${PLUGIN_FILE}.bak"
    
    echo "Updated version to: ${VERSION}"
    echo "Updated MD5 to: ${HASH}"
fi

echo ""
echo "============================================"
echo "Build complete!"
echo "============================================"
echo ""
echo "To install on Unraid:"
echo "1. Copy ${PACKAGE_FILE} to your Unraid server"
echo "2. Install via Plugins > Install Plugin with the .plg file"
echo ""
echo "For development testing:"
echo "1. Extract to /usr/local/emhttp/plugins/${PLUGIN_NAME}/"
echo "2. Refresh the Docker page in Unraid WebUI"
