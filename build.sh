#!/bin/bash
#
# Docker List Editor - Build Script
# Creates a .txz package for Unraid plugin installation
#
# Usage: ./build.sh [version]
# Examples: 
#   ./build.sh              # Auto-generates version like 2025.12.14
#   ./build.sh 2025.12.14a  # Specific version with suffix
#   ./build.sh bump         # Auto-increment suffix (a->b->c...)
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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="${SCRIPT_DIR}/source/${PLUGIN_NAME}"
ARCHIVE_DIR="${SCRIPT_DIR}/archive"
PLUGIN_FILE="${SCRIPT_DIR}/${PLUGIN_NAME}.plg"

# Version handling
get_current_version() {
    if [ -f "${PLUGIN_FILE}" ]; then
        "${PREFIX}sed" -n 's/.*<!ENTITY version[[:space:]]*"\([^"]*\)">.*/\1/p' "${PLUGIN_FILE}"
    else
        echo ""
    fi
}

increment_suffix() {
    local version="$1"
    local base_date=$(echo "$version" | grep -oE '^[0-9]{4}\.[0-9]{2}\.[0-9]{2}')
    local suffix=$(echo "$version" | grep -oE '[a-z]$' || echo "")
    local today=$(date +%Y.%m.%d)
    
    if [ "$base_date" != "$today" ]; then
        # New day, start fresh
        echo "${today}"
    elif [ -z "$suffix" ]; then
        # Same day, no suffix yet, add 'a'
        echo "${base_date}a"
    else
        # Increment suffix (a->b, b->c, etc.)
        local next_suffix=$(echo "$suffix" | tr 'a-y' 'b-z')
        if [ "$next_suffix" == "$suffix" ]; then
            # Already at 'z', wrap to 'za' (unlikely but handled)
            echo "${base_date}za"
        else
            echo "${base_date}${next_suffix}"
        fi
    fi
}

# Determine version
if [ "$1" == "bump" ]; then
    CURRENT_VERSION=$(get_current_version)
    VERSION=$(increment_suffix "$CURRENT_VERSION")
    echo "Bumping version: $CURRENT_VERSION -> $VERSION"
elif [ -n "$1" ]; then
    VERSION="$1"
else
    VERSION=$(date +%Y.%m.%d)
fi

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
    "${PREFIX}sed" -i.bak 's/<!ENTITY version[[:space:]]*"[^"]*">/<!ENTITY version   "'"${VERSION}"'">/' "${PLUGIN_FILE}"
    
    # Update MD5 hash
    "${PREFIX}sed" -i.bak 's/<!ENTITY md5[[:space:]]*"[^"]*">/<!ENTITY md5       "'"${HASH}"'">/' "${PLUGIN_FILE}"
    
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
echo "1. Push changes to GitHub"
echo "2. Install via: https://github.com/retrozenith/docker-list-unraid/raw/refs/heads/master/${PLUGIN_NAME}.plg"
echo ""
echo "Quick rebuild (increment suffix):"
echo "  ./build.sh bump"
