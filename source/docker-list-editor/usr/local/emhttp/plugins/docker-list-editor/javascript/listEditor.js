/**
 * Docker List Editor - UI Injection Script
 * Companion plugin for dynamix.docker.manager
 * 
 * Adds list-based editing for:
 * - Environment Variables (NAME=VALUE format)
 * - Port Mappings (HOST:CONTAINER/PROTOCOL format)
 * - Volume Mappings (/host:/container:MODE format)
 * 
 * @author Florian Victor (retrozenith)
 * @version 2025.12.14
 */

(function ($) {
    'use strict';

    // Configuration
    const CONFIG = {
        initDelay: 500,        // Delay before initialization (ms)
        animationSpeed: 200,   // Slide animation speed (ms)
        debugMode: false       // Set to true for console logging
    };

    // Section definitions
    const SECTIONS = {
        env: {
            title: 'Variables',
            tableId: '#envRows',
            fields: {
                name: 'input[name="VariableName[]"]',
                value: 'input[name="VariableValue[]"]'
            },
            templateFields: {
                name: '#VariableName1',
                value: '#VariableValue1'
            },
            addFunction: 'addEnv',
            placeholder: 'PUID=1000\nPGID=1000\nTZ=America/New_York\nMY_SECRET=value123',
            hint: 'Format: NAME=VALUE (one per line). Lines starting with # are ignored.',
            parseRegex: null  // Special handling for env vars
        },
        port: {
            title: 'Ports',
            tableId: '#portRows',
            fields: {
                host: 'input[name="hostPort[]"]',
                container: 'input[name="containerPort[]"]',
                protocol: 'select[name="portProtocol[]"]'
            },
            templateFields: {
                host: '#hostPort1',
                container: '#containerPort1',
                protocol: '#portProtocol1'
            },
            addFunction: 'addPort',
            placeholder: '8080:80/tcp\n443:443/tcp\n53:53/udp',
            hint: 'Format: HOST_PORT:CONTAINER_PORT/PROTOCOL (one per line). Protocol defaults to tcp.',
            parseRegex: /^(\d+):(\d+)\/?(\w+)?$/
        },
        path: {
            title: 'Paths',
            tableId: '#pathRows',
            fields: {
                host: 'input[name="hostPath[]"]',
                container: 'input[name="containerPath[]"]',
                mode: 'select[name="hostWritable[]"]'
            },
            templateFields: {
                host: '#hostPath1',
                container: '#containerPath1',
                mode: '#hostWritable1'
            },
            addFunction: 'addPath',
            placeholder: '/mnt/user/appdata/myapp:/config:rw\n/mnt/user/media:/media:ro',
            hint: 'Format: /host/path:/container/path:MODE (rw or ro, one per line). Mode defaults to rw.',
            parseRegex: null  // Special handling for paths
        }
    };

    // State tracking
    let initialized = false;
    let activeEditors = {};

    /**
     * Debug logging helper
     */
    function log(...args) {
        if (CONFIG.debugMode) {
            console.log('[DockerListEditor]', ...args);
        }
    }

    /**
     * Initialize the list editor on page load
     */
    function init() {
        if (initialized) return;

        // Verify we're on the right page
        if (!$('#formTemplate').length) {
            log('Not on container edit page, skipping initialization.');
            return;
        }

        log('Initializing...');

        // Initialize each section
        Object.keys(SECTIONS).forEach(type => {
            initSection(type, SECTIONS[type]);
        });

        initialized = true;
        log('Initialization complete.');
    }

    /**
     * Initialize a single section with toggle button and textarea
     */
    function initSection(type, config) {
        const $table = $(config.tableId);
        if (!$table.length) {
            log(`Table ${config.tableId} not found, skipping ${type}.`);
            return;
        }

        // Find the section container
        const $container = $table.closest('table');
        if (!$container.length) {
            log(`Container for ${type} not found.`);
            return;
        }

        // Find header row with the section title
        let $headerCell = null;
        $container.find('td, th').each(function () {
            const text = $(this).text().trim();
            if (text.includes(config.title) || text.match(new RegExp(config.title, 'i'))) {
                $headerCell = $(this);
                return false; // Break loop
            }
        });

        // Create toggle button
        const $toggleBtn = $(`
            <span class="list-editor-toggle" data-type="${type}" title="Toggle between form and list editing mode">
                <i class="fa fa-list-ul"></i> List Mode
            </span>
        `);

        // Create textarea container
        const $textarea = $(`
            <div class="list-editor-container" id="listEditor_${type}" style="display:none;">
                <div class="list-editor-header">
                    <span class="list-editor-title">
                        <i class="fa fa-edit"></i> Editing ${config.title} as List
                    </span>
                    <span class="list-editor-actions">
                        <button type="button" class="list-editor-btn" onclick="DockerListEditor.copyToClipboard('${type}')" title="Copy to clipboard">
                            <i class="fa fa-copy"></i>
                        </button>
                        <button type="button" class="list-editor-btn" onclick="DockerListEditor.pasteFromClipboard('${type}')" title="Paste from clipboard">
                            <i class="fa fa-paste"></i>
                        </button>
                    </span>
                </div>
                <textarea 
                    class="list-editor-textarea" 
                    id="listTextarea_${type}" 
                    placeholder="${config.placeholder}"
                    spellcheck="false"
                ></textarea>
                <div class="list-editor-hint">
                    <i class="fa fa-info-circle"></i> ${config.hint}
                </div>
                <div class="list-editor-validation" id="listValidation_${type}"></div>
            </div>
        `);

        // Insert textarea after the form table
        $table.after($textarea);

        // Insert toggle button
        if ($headerCell && $headerCell.length) {
            $headerCell.append(' ').append($toggleBtn);
        } else {
            // Fallback: insert before table
            $table.before($toggleBtn);
        }

        // Bind toggle click handler
        $toggleBtn.on('click', function (e) {
            e.preventDefault();
            toggleMode(type);
        });

        // Bind real-time validation
        $(`#listTextarea_${type}`).on('input', function () {
            validateInput(type, $(this).val());
        });

        activeEditors[type] = {
            button: $toggleBtn,
            container: $textarea,
            textarea: $(`#listTextarea_${type}`),
            isListMode: false
        };

        log(`Initialized section: ${type}`);
    }

    /**
     * Toggle between form mode and list mode
     */
    function toggleMode(type) {
        const editor = activeEditors[type];
        const config = SECTIONS[type];
        const $table = $(config.tableId);

        if (!editor) return;

        if (editor.isListMode) {
            // Switching from list to form mode
            const listData = parseList(type, editor.textarea.val());

            if (listData.errors.length > 0) {
                // Show confirmation dialog if there are errors
                if (!confirm('Some lines could not be parsed and will be ignored.\n\nContinue anyway?')) {
                    return;
                }
            }

            populateForm(type, listData.items);

            editor.container.slideUp(CONFIG.animationSpeed);
            $table.slideDown(CONFIG.animationSpeed);
            editor.button.removeClass('active').find('i').removeClass('fa-th-list').addClass('fa-list-ul');
            editor.isListMode = false;

            log(`${type}: Switched to form mode`);
        } else {
            // Switching from form to list mode
            const formData = extractFormData(type);
            editor.textarea.val(formatAsList(type, formData));

            $table.slideUp(CONFIG.animationSpeed);
            editor.container.slideDown(CONFIG.animationSpeed);
            editor.button.addClass('active').find('i').removeClass('fa-list-ul').addClass('fa-th-list');
            editor.isListMode = true;

            // Focus textarea
            setTimeout(() => editor.textarea.focus(), CONFIG.animationSpeed);

            log(`${type}: Switched to list mode`);
        }
    }

    /**
     * Extract current form data into an array
     */
    function extractFormData(type) {
        const config = SECTIONS[type];
        const data = [];
        const $rows = $(config.tableId + ' tbody tr');

        $rows.each(function () {
            const $row = $(this);
            // Skip if row is hidden or is a template row
            if ($row.is(':hidden') && !$row.is(':first-child')) return;

            let item = {};
            let hasData = false;

            switch (type) {
                case 'env':
                    item.name = $row.find(config.fields.name).val() || '';
                    item.value = $row.find(config.fields.value).val() || '';
                    hasData = item.name.length > 0;
                    break;
                case 'port':
                    item.host = $row.find(config.fields.host).val() || '';
                    item.container = $row.find(config.fields.container).val() || '';
                    item.protocol = $row.find(config.fields.protocol).val() || 'tcp';
                    hasData = item.container.length > 0;
                    break;
                case 'path':
                    item.host = $row.find(config.fields.host).val() || '';
                    item.container = $row.find(config.fields.container).val() || '';
                    item.mode = $row.find(config.fields.mode).val() || 'rw';
                    hasData = item.container.length > 0;
                    break;
            }

            if (hasData) {
                data.push(item);
            }
        });

        return data;
    }

    /**
     * Format array data as list text
     */
    function formatAsList(type, data) {
        return data.map(item => {
            switch (type) {
                case 'env':
                    return `${item.name}=${item.value}`;
                case 'port':
                    return `${item.host}:${item.container}/${item.protocol}`;
                case 'path':
                    return `${item.host}:${item.container}:${item.mode}`;
            }
        }).join('\n');
    }

    /**
     * Parse list text into array with validation
     */
    function parseList(type, text) {
        const lines = text.split('\n');
        const items = [];
        const errors = [];

        lines.forEach((line, index) => {
            line = line.trim();

            // Skip empty lines and comments
            if (!line || line.startsWith('#')) return;

            let item = null;
            let lineNum = index + 1;

            switch (type) {
                case 'env':
                    const eqIdx = line.indexOf('=');
                    if (eqIdx > 0) {
                        item = {
                            name: line.substring(0, eqIdx).trim(),
                            value: line.substring(eqIdx + 1)
                        };
                    } else {
                        errors.push(`Line ${lineNum}: Missing '=' in environment variable`);
                    }
                    break;

                case 'port':
                    const portMatch = line.match(/^(\d+):(\d+)\/?(\w+)?$/);
                    if (portMatch) {
                        item = {
                            host: portMatch[1],
                            container: portMatch[2],
                            protocol: portMatch[3] || 'tcp'
                        };
                    } else {
                        errors.push(`Line ${lineNum}: Invalid port format (expected HOST:CONTAINER/PROTOCOL)`);
                    }
                    break;

                case 'path':
                    // Handle paths which may contain colons (Windows-style won't appear here but just in case)
                    const lastColon = line.lastIndexOf(':');
                    const secondLastColon = line.lastIndexOf(':', lastColon - 1);

                    if (secondLastColon > 0) {
                        const modeCandidate = line.substring(lastColon + 1);
                        if (['rw', 'ro', 'z', 'Z'].includes(modeCandidate)) {
                            item = {
                                host: line.substring(0, secondLastColon),
                                container: line.substring(secondLastColon + 1, lastColon),
                                mode: modeCandidate
                            };
                        } else {
                            // No mode specified, treat last part as container path
                            item = {
                                host: line.substring(0, lastColon),
                                container: line.substring(lastColon + 1),
                                mode: 'rw'
                            };
                        }
                    } else if (lastColon > 0) {
                        item = {
                            host: line.substring(0, lastColon),
                            container: line.substring(lastColon + 1),
                            mode: 'rw'
                        };
                    } else {
                        errors.push(`Line ${lineNum}: Invalid path format (expected /host:/container:mode)`);
                    }
                    break;
            }

            if (item) {
                items.push(item);
            }
        });

        return { items, errors };
    }

    /**
     * Validate input in real-time and show feedback
     */
    function validateInput(type, text) {
        const result = parseList(type, text);
        const $validation = $(`#listValidation_${type}`);

        if (result.errors.length > 0) {
            $validation
                .html('<i class="fa fa-exclamation-triangle"></i> ' + result.errors.join('<br>'))
                .addClass('has-errors')
                .show();
        } else {
            const count = result.items.length;
            $validation
                .html(`<i class="fa fa-check-circle"></i> ${count} valid ${count === 1 ? 'entry' : 'entries'}`)
                .removeClass('has-errors')
                .show();
        }
    }

    /**
     * Populate form fields from parsed data
     */
    function populateForm(type, data) {
        const config = SECTIONS[type];
        const $table = $(config.tableId);

        // Clear existing rows (except first/template row)
        $table.find('tbody tr:not(:first)').remove();

        // Reset template row fields
        Object.keys(config.templateFields).forEach(key => {
            $(config.templateFields[key]).val('');
        });

        // Add each item
        data.forEach((item, index) => {
            switch (type) {
                case 'env':
                    $(config.templateFields.name).val(item.name);
                    $(config.templateFields.value).val(item.value);
                    break;
                case 'port':
                    $(config.templateFields.host).val(item.host);
                    $(config.templateFields.container).val(item.container);
                    $(config.templateFields.protocol).val(item.protocol);
                    break;
                case 'path':
                    $(config.templateFields.host).val(item.host);
                    $(config.templateFields.container).val(item.container);
                    $(config.templateFields.mode).val(item.mode);
                    break;
            }

            // Call the native add function if there are more items
            if (index < data.length - 1) {
                if (typeof window[config.addFunction] === 'function') {
                    window[config.addFunction]();
                }
            }
        });

        log(`${type}: Populated form with ${data.length} items`);
    }

    /**
     * Copy textarea content to clipboard
     */
    function copyToClipboard(type) {
        const editor = activeEditors[type];
        if (!editor) return;

        const text = editor.textarea.val();
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard!');
        }).catch(err => {
            // Fallback for older browsers
            editor.textarea.select();
            document.execCommand('copy');
            showToast('Copied to clipboard!');
        });
    }

    /**
     * Paste from clipboard into textarea
     */
    function pasteFromClipboard(type) {
        const editor = activeEditors[type];
        if (!editor) return;

        navigator.clipboard.readText().then(text => {
            editor.textarea.val(text);
            validateInput(type, text);
            showToast('Pasted from clipboard!');
        }).catch(err => {
            showToast('Unable to access clipboard. Use Ctrl+V instead.', 'error');
        });
    }

    /**
     * Show a temporary toast notification
     */
    function showToast(message, type = 'success') {
        const $toast = $(`
            <div class="list-editor-toast ${type}">
                <i class="fa ${type === 'success' ? 'fa-check' : 'fa-exclamation-circle'}"></i>
                ${message}
            </div>
        `);

        $('body').append($toast);

        setTimeout(() => {
            $toast.addClass('visible');
        }, 10);

        setTimeout(() => {
            $toast.removeClass('visible');
            setTimeout(() => $toast.remove(), 300);
        }, 2000);
    }

    // Expose public API
    window.DockerListEditor = {
        init: init,
        toggleMode: toggleMode,
        copyToClipboard: copyToClipboard,
        pasteFromClipboard: pasteFromClipboard,
        getActiveEditors: () => activeEditors,
        setDebugMode: (enabled) => { CONFIG.debugMode = enabled; }
    };

    // Initialize when DOM is ready
    $(document).ready(function () {
        setTimeout(init, CONFIG.initDelay);
    });

})(jQuery);
