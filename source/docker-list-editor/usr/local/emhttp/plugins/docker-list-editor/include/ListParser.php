<?php
/**
 * Docker List Editor - List Parser
 * 
 * Server-side parsing utilities for converting between list format
 * and array/XML template format. Useful for import/export features.
 * 
 * @author Florian Victor (retrozenith)
 * @version 2025.12.14
 * 
 * Supported Formats:
 * - Environment Variables: NAME=VALUE
 * - Port Mappings: HOST:CONTAINER/PROTOCOL
 * - Volume Mappings: /host/path:/container/path:MODE
 */

class ListParser
{

    /**
     * Parse environment variables from text
     * 
     * @param string $text Text with one variable per line
     * @return array Array of ['name' => ..., 'value' => ...]
     * 
     * Format: NAME=VALUE
     * Lines starting with # are comments
     */
    public static function parseEnvList($text)
    {
        $vars = [];
        $lines = explode("\n", trim($text));

        foreach ($lines as $line) {
            $line = trim($line);

            // Skip empty lines and comments
            if (empty($line) || strpos($line, '#') === 0) {
                continue;
            }

            $eqPos = strpos($line, '=');
            if ($eqPos === false || $eqPos === 0) {
                continue; // Invalid line
            }

            $vars[] = [
                'name' => trim(substr($line, 0, $eqPos)),
                'value' => substr($line, $eqPos + 1) // Don't trim value - preserve spaces
            ];
        }

        return $vars;
    }

    /**
     * Parse port mappings from text
     * 
     * @param string $text Text with one mapping per line
     * @return array Array of ['host' => ..., 'container' => ..., 'protocol' => ...]
     * 
     * Format: HOST:CONTAINER/PROTOCOL
     * Protocol is optional, defaults to 'tcp'
     */
    public static function parsePortList($text)
    {
        $ports = [];
        $lines = explode("\n", trim($text));

        foreach ($lines as $line) {
            $line = trim($line);

            // Skip empty lines and comments
            if (empty($line) || strpos($line, '#') === 0) {
                continue;
            }

            // Parse format: 8080:80/tcp or 8080:80
            if (preg_match('/^(\d+):(\d+)\/?(\w+)?$/', $line, $matches)) {
                $ports[] = [
                    'host' => $matches[1],
                    'container' => $matches[2],
                    'protocol' => $matches[3] ?? 'tcp'
                ];
            }
        }

        return $ports;
    }

    /**
     * Parse volume mappings from text
     * 
     * @param string $text Text with one mapping per line
     * @return array Array of ['host' => ..., 'container' => ..., 'mode' => ...]
     * 
     * Format: /host/path:/container/path:MODE
     * Mode is optional, defaults to 'rw'
     * Supported modes: rw, ro, z, Z
     */
    public static function parseVolumeList($text)
    {
        $volumes = [];
        $lines = explode("\n", trim($text));

        $validModes = ['rw', 'ro', 'z', 'Z'];

        foreach ($lines as $line) {
            $line = trim($line);

            // Skip empty lines and comments
            if (empty($line) || strpos($line, '#') === 0) {
                continue;
            }

            // Find colons - need to handle paths that might have colons
            $lastColon = strrpos($line, ':');
            $secondLastColon = ($lastColon !== false) ? strrpos(substr($line, 0, $lastColon), ':') : false;

            if ($secondLastColon !== false) {
                // Check if last part is a valid mode
                $modeCandidate = substr($line, $lastColon + 1);

                if (in_array($modeCandidate, $validModes)) {
                    $volumes[] = [
                        'host' => substr($line, 0, $secondLastColon),
                        'container' => substr($line, $secondLastColon + 1, $lastColon - $secondLastColon - 1),
                        'mode' => $modeCandidate
                    ];
                } else {
                    // No mode, treat as host:container
                    $volumes[] = [
                        'host' => substr($line, 0, $lastColon),
                        'container' => substr($line, $lastColon + 1),
                        'mode' => 'rw'
                    ];
                }
            } elseif ($lastColon !== false && $lastColon > 0) {
                $volumes[] = [
                    'host' => substr($line, 0, $lastColon),
                    'container' => substr($line, $lastColon + 1),
                    'mode' => 'rw'
                ];
            }
        }

        return $volumes;
    }

    /**
     * Convert environment variables array to list format
     * 
     * @param array $vars Array of ['name' => ..., 'value' => ...]
     * @return string Text with one variable per line
     */
    public static function toEnvList($vars)
    {
        $lines = [];
        foreach ($vars as $v) {
            if (!empty($v['name'])) {
                $lines[] = $v['name'] . '=' . ($v['value'] ?? '');
            }
        }
        return implode("\n", $lines);
    }

    /**
     * Convert port mappings array to list format
     * 
     * @param array $ports Array of ['host' => ..., 'container' => ..., 'protocol' => ...]
     * @return string Text with one mapping per line
     */
    public static function toPortList($ports)
    {
        $lines = [];
        foreach ($ports as $p) {
            if (!empty($p['container'])) {
                $protocol = $p['protocol'] ?? 'tcp';
                $lines[] = ($p['host'] ?? '') . ':' . $p['container'] . '/' . $protocol;
            }
        }
        return implode("\n", $lines);
    }

    /**
     * Convert volume mappings array to list format
     * 
     * @param array $volumes Array of ['host' => ..., 'container' => ..., 'mode' => ...]
     * @return string Text with one mapping per line
     */
    public static function toVolumeList($volumes)
    {
        $lines = [];
        foreach ($volumes as $v) {
            if (!empty($v['container'])) {
                $mode = $v['mode'] ?? 'rw';
                $lines[] = ($v['host'] ?? '') . ':' . $v['container'] . ':' . $mode;
            }
        }
        return implode("\n", $lines);
    }

    /**
     * Validate environment variable format
     * 
     * @param string $text Text to validate
     * @return array ['valid' => bool, 'errors' => [...], 'count' => int]
     */
    public static function validateEnvList($text)
    {
        $lines = explode("\n", trim($text));
        $errors = [];
        $count = 0;

        foreach ($lines as $num => $line) {
            $line = trim($line);
            $lineNum = $num + 1;

            if (empty($line) || strpos($line, '#') === 0) {
                continue;
            }

            if (strpos($line, '=') === false) {
                $errors[] = "Line {$lineNum}: Missing '=' separator";
            } elseif (strpos($line, '=') === 0) {
                $errors[] = "Line {$lineNum}: Variable name cannot be empty";
            } else {
                $count++;
            }
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
            'count' => $count
        ];
    }

    /**
     * Validate port mapping format
     * 
     * @param string $text Text to validate
     * @return array ['valid' => bool, 'errors' => [...], 'count' => int]
     */
    public static function validatePortList($text)
    {
        $lines = explode("\n", trim($text));
        $errors = [];
        $count = 0;

        foreach ($lines as $num => $line) {
            $line = trim($line);
            $lineNum = $num + 1;

            if (empty($line) || strpos($line, '#') === 0) {
                continue;
            }

            if (!preg_match('/^(\d+):(\d+)\/?(\w+)?$/', $line, $matches)) {
                $errors[] = "Line {$lineNum}: Invalid format (expected HOST:CONTAINER/PROTOCOL)";
            } else {
                $host = (int) $matches[1];
                $container = (int) $matches[2];

                if ($host < 1 || $host > 65535) {
                    $errors[] = "Line {$lineNum}: Host port must be 1-65535";
                }
                if ($container < 1 || $container > 65535) {
                    $errors[] = "Line {$lineNum}: Container port must be 1-65535";
                }
                if (!empty($matches[3]) && !in_array($matches[3], ['tcp', 'udp', 'sctp'])) {
                    $errors[] = "Line {$lineNum}: Invalid protocol (use tcp, udp, or sctp)";
                }

                if (empty($errors) || end($errors) && strpos(end($errors), "Line {$lineNum}") === false) {
                    $count++;
                }
            }
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
            'count' => $count
        ];
    }

    /**
     * Validate volume mapping format
     * 
     * @param string $text Text to validate
     * @return array ['valid' => bool, 'errors' => [...], 'count' => int]
     */
    public static function validateVolumeList($text)
    {
        $lines = explode("\n", trim($text));
        $errors = [];
        $count = 0;
        $validModes = ['rw', 'ro', 'z', 'Z'];

        foreach ($lines as $num => $line) {
            $line = trim($line);
            $lineNum = $num + 1;

            if (empty($line) || strpos($line, '#') === 0) {
                continue;
            }

            $colonCount = substr_count($line, ':');

            if ($colonCount < 1) {
                $errors[] = "Line {$lineNum}: Missing ':' separator between host and container path";
            } else {
                $parts = self::parseVolumeList($line);
                if (empty($parts)) {
                    $errors[] = "Line {$lineNum}: Invalid volume format";
                } else {
                    $count++;
                }
            }
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
            'count' => $count
        ];
    }
}

// If called directly via AJAX, handle the request
if (basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
    header('Content-Type: application/json');

    $action = $_POST['action'] ?? $_GET['action'] ?? '';
    $type = $_POST['type'] ?? $_GET['type'] ?? '';
    $data = $_POST['data'] ?? $_GET['data'] ?? '';

    $result = ['success' => false, 'error' => 'Unknown action'];

    switch ($action) {
        case 'parse':
            switch ($type) {
                case 'env':
                    $result = ['success' => true, 'data' => ListParser::parseEnvList($data)];
                    break;
                case 'port':
                    $result = ['success' => true, 'data' => ListParser::parsePortList($data)];
                    break;
                case 'volume':
                    $result = ['success' => true, 'data' => ListParser::parseVolumeList($data)];
                    break;
            }
            break;

        case 'validate':
            switch ($type) {
                case 'env':
                    $result = ['success' => true, 'data' => ListParser::validateEnvList($data)];
                    break;
                case 'port':
                    $result = ['success' => true, 'data' => ListParser::validatePortList($data)];
                    break;
                case 'volume':
                    $result = ['success' => true, 'data' => ListParser::validateVolumeList($data)];
                    break;
            }
            break;
    }

    echo json_encode($result);
    exit;
}
