import { collection, query, where, getDocs, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../firebase';
import Encoding from 'encoding-japanese';

const HOUR_LABELS = ['early', 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 'late'];
const KPI_KEYS = ['total', 'actual', 'recall', 'owner', 'prospect', 'appoint'];

function downloadCsv(content, fileName) {
  const unicodeList = [];
  for (let i = 0; i < content.length; i += 1) {
    unicodeList.push(content.charCodeAt(i));
  }
  const sjisCodeList = Encoding.convert(unicodeList, {
    to: 'SJIS',
    from: 'UNICODE'
  });
  const u8a = new Uint8Array(sjisCodeList);
  const blob = new Blob([u8a], { type: 'text/csv' });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function getHourLabel(hour) {
  if (hour === 'early') return '早朝';
  if (hour === 'late') return '夜間';
  return `${hour}時`;
}

function generateHourlyCsv(records, usersMap) {
  const header = ['日付', '名前', ...HOUR_LABELS.flatMap(h => KPI_KEYS.map(k => `${getHourLabel(h)}_${k}`))];
  const rows = [header];
  
  for (const r of records) {
    const row = [r.date, usersMap[r.userId] || '不明'];
    if (r.hourlyData) {
      for (const h of HOUR_LABELS) {
        const hourData = r.hourlyData.find(d => String(d.hour) === String(h)) || {};
        for (const k of KPI_KEYS) {
          row.push(hourData[k] || 0);
        }
      }
    } else {
      for (let i = 0; i < HOUR_LABELS.length * KPI_KEYS.length; i++) row.push(0);
    }
    rows.push(row);
  }
  return rows.map(r => r.join(',')).join('\r\n');
}

function generateDailyCsv(records, usersMap) {
  const header = ['日付', '名前', ...KPI_KEYS];
  const rows = [header];
  
  for (const r of records) {
    const row = [r.date, usersMap[r.userId] || '不明'];
    for (const k of KPI_KEYS) {
      row.push(r.totals?.[k] || 0);
    }
    rows.push(row);
  }
  return rows.map(r => r.join(',')).join('\r\n');
}

function generateMonthlyCsv(records, usersMap) {
  const header = ['月', '名前', ...KPI_KEYS];
  const rows = [header];
  
  const agg = {};
  for (const r of records) {
    const month = r.date.substring(0, 7);
    const key = `${month}_${r.userId}`;
    if (!agg[key]) {
      agg[key] = { month, userId: r.userId, totals: { total: 0, actual: 0, recall: 0, owner: 0, prospect: 0, appoint: 0 } };
    }
    for (const k of KPI_KEYS) {
      agg[key].totals[k] += (r.totals?.[k] || 0);
    }
  }
  
  for (const val of Object.values(agg)) {
    const row = [val.month, usersMap[val.userId] || '不明'];
    for (const k of KPI_KEYS) {
      row.push(val.totals[k]);
    }
    rows.push(row);
  }
  return rows.map(r => r.join(',')).join('\r\n');
}

export async function exportKpiToCsv({
  dataType,
  startDate,
  endDate,
  productIds,
  visibleUserIds,
  usersData,
  user
}) {
  const usersMap = {};
  usersData.forEach(u => { usersMap[u.id] = u.name; });

  for (const productId of productIds) {
    const chunks = [];
    for (let i = 0; i < visibleUserIds.length; i += 10) {
      chunks.push(visibleUserIds.slice(i, i + 10));
    }
    
    let allRecords = [];
    for (const chunk of chunks) {
      if (chunk.length === 0) continue;
      // 1回の出力で取得するレコード数の上限を10,000件に設定
      const kpiQuery = query(
        collection(db, 'dailyKpi'),
        where('productId', '==', productId),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        where('userId', 'in', chunk),
        limit(10000)
      );
      const snap = await getDocs(kpiQuery);
      allRecords.push(...snap.docs.map(d => d.data()));
    }

    if (allRecords.length > 10000) {
      allRecords = allRecords.slice(0, 10000);
    }

    if (allRecords.length === 0) {
      console.log(`No records found for product: ${productId}`);
      continue;
    }

    let csvContent = '';
    if (dataType === 'hourly') {
      csvContent = generateHourlyCsv(allRecords, usersMap);
    } else if (dataType === 'daily') {
      csvContent = generateDailyCsv(allRecords, usersMap);
    } else {
      csvContent = generateMonthlyCsv(allRecords, usersMap);
    }

    const startStr = startDate.replace(/-/g, '');
    const endStr = endDate.replace(/-/g, '');
    const fileName = `時間別出力_${productId}_${startStr}_${endStr}.csv`;
    
    downloadCsv(csvContent, fileName);

    await addDoc(collection(db, 'auditLogs'), {
      action: 'csvExport',
      executedBy: {
        uid: user.uid,
        email: user.email,
        name: user.name || '',
        role: user.role
      },
      target: {
        type: 'csv',
        id: `${productId}_${startDate}_${endDate}`,
        name: fileName
      },
      metadata: {
        productId,
        startDate,
        endDate,
        dataType,
        recordCount: allRecords.length
      },
      timestamp: serverTimestamp()
    });
  }
}
