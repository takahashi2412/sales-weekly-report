import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';

const formatDate = (dateObj) => {
  if (!dateObj) return '-';
  const d = dateObj.toDate ? dateObj.toDate() : new Date(dateObj);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

const AuditLog = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  
  // Filters
  const [filterAction, setFilterAction] = useState('all');
  const [filterTarget, setFilterTarget] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'auditLogs'),
        orderBy('timestamp', 'desc'),
        limit(500)
      );
      const snap = await getDocs(q);
      const fetchedLogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(fetchedLogs);
    } catch (err) {
      console.error('Error fetching logs:', err);
      alert('ログの取得に失敗しました。権限を確認してください。');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['日時', 'アクション', '実行者名', '実行者Role', '対象種別', '対象名'];
    const rows = filteredLogs.map(log => [
      formatDate(log.timestamp),
      log.action,
      log.executedBy?.name || '',
      log.executedBy?.role || '',
      log.target?.type || '',
      log.target?.name || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${v}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit_logs_${new Date().getTime()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = logs.filter(log => {
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    if (filterTarget !== 'all' && log.target?.type !== filterTarget) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">監査ログ</h1>
          <p className="text-sm text-gray-500 mt-1">システム全体の操作履歴 (S-07)</p>
        </div>
        <button
          onClick={handleExportCsv}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          CSVダウンロード
        </button>
      </div>

      <div className="bg-white p-4 rounded shadow mb-6 flex gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">アクション種別</label>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="border rounded px-3 py-1.5 w-48"
          >
            <option value="all">全アクション</option>
            <option value="roleChange">ロール変更</option>
            <option value="csvImport">CSV取込</option>
            <option value="accountCreate">アカウント作成</option>
            <option value="accountUpdate">アカウント編集</option>
            <option value="accountDelete">アカウント削除</option>
            <option value="productCreate">商材作成</option>
            <option value="productUpdate">商材編集</option>
            <option value="teamCreate">チーム作成</option>
            <option value="teamUpdate">チーム編集</option>
            <option value="manualKpiInput">手動KPI入力</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">対象種別</label>
          <select
            value={filterTarget}
            onChange={(e) => setFilterTarget(e.target.value)}
            className="border rounded px-3 py-1.5 w-48"
          >
            <option value="all">全対象</option>
            <option value="user">User</option>
            <option value="csv">CSV</option>
            <option value="product">Product</option>
            <option value="team">Team</option>
            <option value="kpi">KPI</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">読み込み中...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日時</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">実行者</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">アクション</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">対象</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">詳細</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(log.timestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.executedBy?.name || log.executedBy?.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">{log.action}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.target?.name || log.target?.id} ({log.target?.type})
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      詳細
                    </button>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-gray-500">ログが見つかりません</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">ログ詳細</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <h3 className="font-semibold text-gray-700">基本情報</h3>
                <pre className="bg-gray-50 p-2 rounded text-xs mt-1 overflow-x-auto">
                  {JSON.stringify({
                    id: selectedLog.id,
                    action: selectedLog.action,
                    timestamp: selectedLog.timestamp?.toDate()?.toISOString()
                  }, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700">実行者・対象</h3>
                <pre className="bg-gray-50 p-2 rounded text-xs mt-1 overflow-x-auto">
                  {JSON.stringify({
                    executedBy: selectedLog.executedBy,
                    target: selectedLog.target
                  }, null, 2)}
                </pre>
              </div>
            </div>
            
            <h3 className="font-semibold text-gray-700 mt-4 border-t pt-4">変更内容 (Changes)</h3>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <div className="text-sm font-medium text-red-600 mb-1">Before</div>
                <pre className="bg-red-50 text-red-800 p-3 rounded text-xs overflow-x-auto max-h-64">
                  {JSON.stringify(selectedLog.changes?.before || {}, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-sm font-medium text-green-600 mb-1">After</div>
                <pre className="bg-green-50 text-green-800 p-3 rounded text-xs overflow-x-auto max-h-64">
                  {JSON.stringify(selectedLog.changes?.after || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLog;
