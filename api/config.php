<?php
/**
 * config.php
 * Database connection + shared headers for the SpendWise API.
 *
 * NOTE ON DEPLOYMENT (read this before going to production):
 * Vercel's PHP runtime is a serverless function. Its filesystem is
 * READ-ONLY except for /tmp, and /tmp is wiped between cold starts.
 * That means the SQLite file below is perfect for local development
 * and for demoing this project, but on Vercel it will reset itself
 * every time the function goes cold (rows you added can disappear).
 *
 * For a real deployment, swap the PDO connection string below for a
 * hosted database such as:
 *   - Turso (libSQL, SQLite-compatible, has a PHP-friendly HTTP API)
 *   - PlanetScale / Railway / Supabase (MySQL or Postgres, change the DSN)
 * Everything else in this project (routes, frontend, JSON shape)
 * stays exactly the same — only this connection block changes.
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Use /tmp on serverless (Vercel), a local file when running with `php -S` locally.
$isServerless = getenv('VERCEL') !== false;
$dbPath = $isServerless ? '/tmp/spendwise.db' : __DIR__ . '/spendwise.db';

try {
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    $pdo->exec("CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income','expense')),
        category TEXT NOT NULL,
        date TEXT NOT NULL,
        note TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )");
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed', 'details' => $e->getMessage()]);
    exit();
}

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit();
}

function body() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
