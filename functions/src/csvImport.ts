import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { recordAuditLog } from './auditLog';
// 依存パッケージを遅延ロード（関数実行時にのみロード）
let iconv: any;
let csvParse: any;

function loadDeps() {
  if (!iconv) iconv = require('iconv-lite');
  if (!csvParse) csvParse = require('csv-parse/sync').parse;
}

const PRODUCT_IDS = ['visit', 'web', 'replace', 'meo'];

export const parseHourlyKpiCsv = functions.https.onCall(async (data, context) => {
  loadDeps();  // ← この行を追加
  // 1. 権限チェック：manager以上
  if (!context.auth || !['executive','manager'].includes(context.auth.token.role)) {
    throw new functions.https.HttpsError('permission-denied', 'Only manager+ can import CSV.');
  }

  const { fileBuffer, fileName } = data;  // fileBufferはBase64

  // 2. ファイル名から商材IDと日付を抽出
  // 例: "時間別_visit_20260518_20260518.csv"
  const match = fileName.match(/時間別_([a-z]+)_(\d{4})(\d{2})(\d{2})_(\d{4})(\d{2})(\d{2})\.csv/);
  if (!match) {
    throw new functions.https.HttpsError('invalid-argument',
      'Invalid filename. Expected: 時間別_{productId}_YYYYMMDD_YYYYMMDD.csv');
  }
  const [, productId, sy, sm, sd, ey, em, ed] = match;
  if (!PRODUCT_IDS.includes(productId)) {
    throw new functions.https.HttpsError('invalid-argument',
      `Invalid productId in filename: ${productId}`);
  }
  const targetDate = `${sy}-${sm}-${sd}`;
  if (targetDate !== `${ey}-${em}-${ed}`) {
    throw new functions.https.HttpsError('invalid-argument',
      'Multi-day CSV is not supported. Start and end date must match.');
  }

  // 3. productMasters の存在確認
  const productDoc = await admin.firestore()
    .collection('productMasters').doc(productId).get();
  if (!productDoc.exists) {
    throw new functions.https.HttpsError('not-found',
      `Product not found: ${productId}`);
  }

  // 4. CP932 → UTF-8 デコード
  const buffer = Buffer.from(fileBuffer, 'base64');
  const text = iconv.decode(buffer, 'cp932');

  // 5. CSVパース
  const records = csvParse(text, { skip_empty_lines: true });

  // 6. バリデーション
  if (records.length < 4) {
    throw new functions.https.HttpsError('invalid-argument', 'Not enough rows.');
  }
  if (records[0].length !== 85) {
    throw new functions.https.HttpsError('invalid-argument',
      `Invalid column count: ${records[0].length} (expected 85)`);
  }

  // 7. 時間帯定義（14時間帯）
  const HOUR_LABELS = [
    'early',  // 0:00〜8:59
    9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    'late',   // 21:00〜23:59
  ];
  const KPI_KEYS = ['total','actual','recall','owner','prospect','appoint'];

  // 8. メンバー名→userIdの名寄せ準備
  const usersSnap = await admin.firestore().collection('users').get();
  const normalize = (n: string) => (n || '').replace(/[\s　]/g, '');
  const usersByName = new Map(usersSnap.docs.map(d => [normalize(d.data().name), { id: d.id, ...d.data() }]));

  // 9. データ行をパース（3行目〜最終行の1つ前）
  const dataRows = records.slice(2, -1);
  const summaryRow = records[records.length - 1]; // 「合計」行

  const parsedMembers: any[] = [];
  for (const row of dataRows) {
    const name = row[0]?.trim();
    if (!name || name === '合計') continue;

    const normalizedName = normalize(name);
    const userData = usersByName.get(normalizedName) as any;
    const userId = userData?.id || null;

    // 14時間帯×6項目をパース
    const hourlyData: any[] = [];
    let col = 1;
    for (const hour of HOUR_LABELS) {
      const d: any = { hour };
      for (const key of KPI_KEYS) {
        d[key] = parseInt(row[col], 10) || 0;
        col++;
      }
      hourlyData.push(d);
    }

    // 日次合計
    const totals: any = {};
    for (const key of KPI_KEYS) {
      totals[key] = hourlyData.reduce((s, h) => s + (h[key] || 0), 0);
    }

    parsedMembers.push({
      name, userId, hourlyData, totals,
      matched: userId !== null,
      warnings: userId === null ? ['名前がusersに見つかりません'] : [],
    });
  }

  // 10. 全社合計（CSVの「合計」行）をパース
  const summaryHourly: any[] = [];
  let sCol = 1;
  for (const hour of HOUR_LABELS) {
    const d: any = { hour };
    for (const key of KPI_KEYS) {
      d[key] = parseInt(summaryRow[sCol], 10) || 0;
      sCol++;
    }
    summaryHourly.push(d);
  }
  const summaryTotals: any = {};
  for (const key of KPI_KEYS) {
    summaryTotals[key] = summaryHourly.reduce((s, h) => s + (h[key] || 0), 0);
  }

  return {
    productId,
    targetDate,
    fileName,
    totalMembers: parsedMembers.length,
    matchedCount: parsedMembers.filter(m => m.matched).length,
    unmatchedCount: parsedMembers.filter(m => !m.matched).length,
    members: parsedMembers,
    summary: { hourlyData: summaryHourly, totals: summaryTotals },
  };
});

export const commitCsvImport = functions.https.onCall(async (data, context) => {
  if (!context.auth || !['executive','manager'].includes(context.auth.token.role)) {
    throw new functions.https.HttpsError('permission-denied', 'Only manager+ can commit.');
  }

  const { productId, targetDate, fileName, members, summary, overwrite } = data;
  const db = admin.firestore();
  const batch = db.batch();

  // 1. 取込ログを記録
  const logRef = db.collection('csvImportLogs').doc();
  batch.set(logRef, {
    fileName, productId, targetDate,
    importedBy: context.auth.uid,
    importedAt: admin.firestore.FieldValue.serverTimestamp(),
    totalMembers: members.length,
    successCount: 0, // 後でupdate
    status: 'in_progress',
  });

  // 2. メンバー別dailyKpiを一括書込
  let successCount = 0;
  for (const member of members) {
    if (!member.userId) continue;
    const docId = `${member.userId}_${productId}_${targetDate}`;
    const docRef = db.collection('dailyKpi').doc(docId);
    const existing = await docRef.get();
    if (existing.exists && !overwrite) continue;

    batch.set(docRef, {
      userId: member.userId,
      date: targetDate,
      productId,
      productVersion: 1,
      source: 'csv_import',
      csvFileName: fileName,
      importLogId: logRef.id,
      importedBy: context.auth.uid,
      importedAt: admin.firestore.FieldValue.serverTimestamp(),
      hourlyData: member.hourlyData,
      totals: member.totals,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    successCount++;
  }

  // 3. dailyKpiSummary（商材別の全社合計）を保存
  const summaryId = `${productId}_${targetDate}`;
  const summaryRef = db.collection('dailyKpiSummary').doc(summaryId);
  batch.set(summaryRef, {
    summaryId, productId, date: targetDate,
    hourlyData: summary.hourlyData,
    totals: summary.totals,
    memberCount: successCount,
    importLogId: logRef.id,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 4. ログを完了に更新
  batch.update(logRef, { successCount, status: 'completed' });

  await batch.commit();

  await recordAuditLog({
    action: 'csvImport',
    executorUid: context.auth.uid,
    target: { 
      type: 'csv', 
      id: logRef.id, 
      name: fileName 
    },
    metadata: {
      productId,
      targetDate,
      recordCount: successCount
    }
  });

  return { success: true, successCount, logId: logRef.id };
});
