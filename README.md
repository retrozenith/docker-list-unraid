# Docker List Editor

A companion plugin for Unraid's built-in Docker Manager (`dynamix.docker.manager`) that adds text-based list editing for Docker container configurations.

## Features

- **List Mode Toggle**: Switch between the standard form UI and a text editor
- **Environment Variables**: Edit as `NAME=VALUE` format (one per line)
- **Port Mappings**: Edit as `HOST:CONTAINER/PROTOCOL` format
- **Volume Mappings**: Edit as `/host:/container:MODE` format
- **Real-time Validation**: Instant feedback on syntax errors
- **Clipboard Support**: Copy/paste entire configurations
- **Theme Support**: Works with all Unraid themes (Black, White, Azure, Gray)

## Screenshots

*Toggle button appears next to each section in Advanced View:*

```
[Environment Variables] [+ Add Variable] [📋 List Mode]
```

*List mode provides a clean textarea for bulk editing:*

```
PUID=1000
PGID=1000
TZ=America/New_York
# Database settings
DB_HOST=localhost
DB_USER=admin
```

## Installation

### From Community Applications (Recommended)
Search for "Docker List Editor" in Community Applications and click Install.

### Manual Installation
1. Navigate to Plugins > Install Plugin
2. Enter the plugin URL:
   ```
   https://github.com/retrozenith/docker-list-editor/raw/main/docker-list-editor.plg
   ```
3. Click Install

## Usage

1. Navigate to **Docker** tab in Unraid
2. Click **Add Container** or edit an existing container
3. Enable **Advanced View** (toggle in upper right)
4. Look for **List Mode** buttons next to:
   - Environment Variables section
   - Port Mappings section  
   - Volume Mappings section
5. Click **List Mode** to switch to textarea editing
6. Edit your configuration using the simple text format
7. Click **List Mode** again to switch back to form view

## Format Reference

### Environment Variables
```
# Format: NAME=VALUE
# Comments start with #

PUID=1000
PGID=1000
TZ=America/New_York
MY_SECRET_KEY=abc123
```

### Port Mappings
```
# Format: HOST_PORT:CONTAINER_PORT/PROTOCOL
# Protocol is optional, defaults to tcp

8080:80/tcp
443:443/tcp
53:53/udp
8443:443
```

### Volume Mappings
```
# Format: /host/path:/container/path:MODE
# Mode is optional, defaults to rw (read-write)

/mnt/user/appdata/myapp:/config:rw
/mnt/user/media:/media:ro
/mnt/cache/downloads:/downloads
```

## Requirements

- Unraid 6.12.0 or later
- Docker enabled (Settings > Docker)

## Building from Source

This plugin is part of the Unraid Plugin SDK examples. To build:

```bash
cd docker-list-editor
./build.sh docker-list-editor.plg main $(date +%Y.%m.%d)
```

This creates a `.txz` package in the `archive/` directory.

## File Structure

```
docker-list-editor/
├── docker-list-editor.plg          # Installation script
├── README.md                       # This file
├── build.sh                        # Build script (optional)
└── source/
    └── docker-list-editor/
        └── usr/local/emhttp/plugins/docker-list-editor/
            ├── DockerListEditor.page    # UI injection page
            ├── include/
            │   └── ListParser.php       # Server-side parser
            ├── javascript/
            │   └── listEditor.js        # Main JavaScript
            └── styles/
                └── listEditor.css       # Styling
```

## Troubleshooting

### Toggle buttons don't appear
- Ensure you're in **Advanced View** mode
- Check browser console for JavaScript errors
- Verify the plugin is installed: `ls /usr/local/emhttp/plugins/docker-list-editor/`

### Changes not saving
- Make sure to toggle back to Form Mode before clicking Apply
- Or simply leave the textarea open - the form syncs automatically on submit

### Clipboard buttons not working
- Your browser may block clipboard access
- Use `Ctrl+C` / `Ctrl+V` as a fallback

## License

This plugin is released under the GNU General Public License v2.

## Credits

- Created as part of the [Unraid Plugin SDK](https://github.com/retrozenith/unraid_plugin_sdk_unofficial)
- Companion to the built-in [dynamix.docker.manager](https://github.com/limetech/dynamix) plugin
