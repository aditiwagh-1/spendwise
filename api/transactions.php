<?php
require __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;

switch ($method) {

    case 'GET':
        if ($action === 'summary') {
            getSummary($pdo);
        } else {
            listTransactions($pdo);
        }
        break;

    case 'POST':
        if ($action === 'seed') {
            seedDemoData($pdo);
        } else {
            createTransaction($pdo);
        }
        break;

    case 'PUT':
        updateTransaction($pdo);
        break;

    case 'DELETE':
        deleteTransaction($pdo);
        break;

    default:
        respond(['error' => 'Method not allowed'], 405);
}

// ---------------------------------------------------------------------

function listTransactions($pdo) {
    $type     = $_GET['type'] ?? '';
    $category = $_GET['category'] ?? '';
    $month    = $_GET['month'] ?? ''; // format YYYY-MM
    $search   = $_GET['search'] ?? '';

    $sql = "SELECT * FROM transactions WHERE 1=1";
    $params = [];

    if ($type !== '' && in_array($type, ['income', 'expense'], true)) {
        $sql .= " AND type = :type";
        $params[':type'] = $type;
    }
    if ($category !== '') {
        $sql .= " AND category = :category";
        $params[':category'] = $category;
    }
    if ($month !== '') {
        $sql .= " AND strftime('%Y-%m', date) = :month";
        $params[':month'] = $month;
    }
    if ($search !== '') {
        $sql .= " AND (title LIKE :search OR note LIKE :search)";
        $params[':search'] = '%' . $search . '%';
    }

    $sql .= " ORDER BY date DESC, id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    respond($stmt->fetchAll());
}

function getSummary($pdo) {
    $income  = (float) $pdo->query("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='income'")->fetchColumn();
    $expense = (float) $pdo->query("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='expense'")->fetchColumn();

    $byCategory = $pdo->query(
        "SELECT category, SUM(amount) as total FROM transactions WHERE type='expense' GROUP BY category ORDER BY total DESC"
    )->fetchAll();

    $byMonth = $pdo->query(
        "SELECT strftime('%Y-%m', date) as month,
                SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
         FROM transactions GROUP BY month ORDER BY month ASC"
    )->fetchAll();

    respond([
        'income'      => $income,
        'expense'     => $expense,
        'balance'     => $income - $expense,
        'byCategory'  => $byCategory,
        'byMonth'     => $byMonth,
    ]);
}

function createTransaction($pdo) {
    $data = body();
    $errors = validate($data);
    if ($errors) respond(['errors' => $errors], 422);

    $stmt = $pdo->prepare(
        "INSERT INTO transactions (title, amount, type, category, date, note)
         VALUES (:title, :amount, :type, :category, :date, :note)"
    );
    $stmt->execute([
        ':title'    => $data['title'],
        ':amount'   => $data['amount'],
        ':type'     => $data['type'],
        ':category' => $data['category'],
        ':date'     => $data['date'],
        ':note'     => $data['note'] ?? '',
    ]);

    $id = $pdo->lastInsertId();
    $row = $pdo->prepare("SELECT * FROM transactions WHERE id = ?");
    $row->execute([$id]);
    respond($row->fetch(), 201);
}

function updateTransaction($pdo) {
    $id = $_GET['id'] ?? null;
    if (!$id) respond(['error' => 'Missing id'], 400);

    $data = body();
    $errors = validate($data);
    if ($errors) respond(['errors' => $errors], 422);

    $stmt = $pdo->prepare(
        "UPDATE transactions SET title=:title, amount=:amount, type=:type,
         category=:category, date=:date, note=:note WHERE id=:id"
    );
    $stmt->execute([
        ':title'    => $data['title'],
        ':amount'   => $data['amount'],
        ':type'     => $data['type'],
        ':category' => $data['category'],
        ':date'     => $data['date'],
        ':note'     => $data['note'] ?? '',
        ':id'       => $id,
    ]);

    if ($stmt->rowCount() === 0) respond(['error' => 'Transaction not found'], 404);

    $row = $pdo->prepare("SELECT * FROM transactions WHERE id = ?");
    $row->execute([$id]);
    respond($row->fetch());
}

function deleteTransaction($pdo) {
    $id = $_GET['id'] ?? null;
    if (!$id) respond(['error' => 'Missing id'], 400);

    $stmt = $pdo->prepare("DELETE FROM transactions WHERE id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) respond(['error' => 'Transaction not found'], 404);
    respond(['success' => true, 'id' => $id]);
}

function validate($data) {
    $errors = [];
    if (empty($data['title']) || strlen(trim($data['title'])) < 2) {
        $errors['title'] = 'Title must be at least 2 characters';
    }
    if (!isset($data['amount']) || !is_numeric($data['amount']) || $data['amount'] <= 0) {
        $errors['amount'] = 'Amount must be a positive number';
    }
    if (empty($data['type']) || !in_array($data['type'], ['income', 'expense'], true)) {
        $errors['type'] = 'Type must be income or expense';
    }
    if (empty($data['category'])) {
        $errors['category'] = 'Category is required';
    }
    if (empty($data['date'])) {
        $errors['date'] = 'Date is required';
    }
    return $errors;
}

function seedDemoData($pdo) {
    $pdo->exec("DELETE FROM transactions");
    $demo = [
        ['Monthly Salary', 45000, 'income', 'Salary', date('Y-m-01'), 'September pay'],
        ['Freelance Website', 8000, 'income', 'Freelance', date('Y-m-05'), ''],
        ['Groceries', 2400, 'expense', 'Food', date('Y-m-03'), 'Weekly shopping'],
        ['Electricity Bill', 1500, 'expense', 'Bills', date('Y-m-07'), ''],
        ['Bus Pass', 600, 'expense', 'Transport', date('Y-m-02'), ''],
        ['Movie Night', 800, 'expense', 'Entertainment', date('Y-m-10'), ''],
        ['Udemy Course', 499, 'expense', 'Education', date('Y-m-12'), 'PHP course'],
        ['Pharmacy', 350, 'expense', 'Health', date('Y-m-14'), ''],
        ['New Shoes', 2200, 'expense', 'Shopping', date('Y-m-15'), ''],
    ];
    $stmt = $pdo->prepare(
        "INSERT INTO transactions (title, amount, type, category, date, note) VALUES (?,?,?,?,?,?)"
    );
    foreach ($demo as $row) $stmt->execute($row);
    respond(['success' => true, 'inserted' => count($demo)]);
}
