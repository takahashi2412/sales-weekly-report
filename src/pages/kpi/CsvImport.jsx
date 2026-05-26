import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Upload, FileText, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const PRODUCTS = [
  { id: 'visit', name: 'HP（訪問）' },
  { id: 'web', name: 'Web' },
  { id: 'replace', name: 'リプレイス' },
  { id: 'meo', name: 'MEO' },
];

export default function CsvImport() {
  const { user } = useAuth();
  const [productId, setProductId] = useState('visit');
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [step, setStep] = useState(1); // 1:選択 2:パース中 3:プレビュー 4:処理中 5:完了
  const [errorMsg, setErrorMsg] = useState('');

  const handleParse = async () => {
    if (!file) return;
    setErrorMsg('');
    
    // Check filename explicitly
    if (!file.name.includes(`_${productId}_`)) {
      setErrorMsg(`選択した商材(${productId})とファイル名が一致しません。`);
      return;
    }
    
    setStep(2);

    try {
      // Read file to Base64
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const functions = getFunctions();
      const parse = httpsCallable(functions, 'parseHourlyKpiCsv');
      const result = await parse({ fileBuffer: base64, fileName: file.name });
      
      setPreviewData(result.data);
      setStep(3);
    } catch (e) {
      console.error(e);
      setErrorMsg('パース失敗: ' + (e.message || '不明なエラー'));
      setStep(1);
    }
  };

  const handleCommit = async (overwrite) => {
    setStep(4);
    setErrorMsg('');
    try {
      const functions = getFunctions();
      const commit = httpsCallable(functions, 'commitCsvImport');
      const result = await commit({
        productId: previewData.productId,
        targetDate: previewData.targetDate,
        fileName: previewData.fileName,
        members: previewData.members,
        summary: previewData.summary,
        overwrite,
      });
      alert(`取込完了：${result.data.successCount}件のデータを保存しました`);
      setStep(5);
    } catch (e) {
      console.error(e);
      setErrorMsg('確定保存に失敗しました: ' + (e.message || '不明なエラー'));
      setStep(3);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreviewData(null);
    setStep(1);
    setErrorMsg('');
  };

  return (
    <div className="csv-import page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>実績CSV取込 (K-07)</h1>
          <p>基幹システムから出力した時間別KPI（CP932形式）をアップロードします</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <ShieldCheck size={16} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontSize: '0.9rem' }}>
            操作者: <strong>{user?.name}</strong> ({user?.role})
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="alert-error glass-panel" style={{ background: '#fee2e2', color: '#b91c1c', borderLeft: '4px solid #ef4444', marginBottom: '2rem' }}>
          <AlertTriangle size={20} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          {errorMsg}
        </div>
      )}

      {step === 1 && (
        <div className="glass-panel" style={{ padding: '2rem', maxWidth: '600px' }}>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>対象商材を選択</label>
            <select 
              value={productId} 
              onChange={e => setProductId(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            >
              {PRODUCTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>CSVファイル</label>
            <div style={{ border: '2px dashed var(--border-color)', padding: '2rem', textAlign: 'center', borderRadius: '8px' }}>
              <input 
                type="file" 
                accept=".csv" 
                onChange={e => setFile(e.target.files?.[0])}
                id="csv-upload"
                style={{ display: 'none' }}
              />
              <label htmlFor="csv-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Upload size={32} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
                {file ? (
                  <span style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>{file.name}</span>
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>クリックしてファイルを選択するか、ドラッグ＆ドロップ</span>
                )}
              </label>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              ファイル名形式：時間別_&#123;productId&#125;_YYYYMMDD.csv
            </p>
          </div>

          <button 
            className="btn btn-primary" 
            onClick={handleParse} 
            disabled={!file}
            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            <FileText size={18} style={{ marginRight: '0.5rem' }} />
            プレビュー・チェック実行
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="spinner" style={{ border: '4px solid #f3f3f3', borderTop: '4px solid var(--accent-primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          <p>CSVを解析しています...</p>
        </div>
      )}

      {step === 3 && previewData && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center' }}>
              <CheckCircle size={24} style={{ color: '#10b981', marginRight: '0.5rem' }} />
              プレビュー・名寄せ結果
            </h2>
            <button className="btn btn-secondary" onClick={resetForm}>やり直す</button>
          </div>
          
          <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
            <div><span style={{ color: 'var(--text-secondary)' }}>対象商材:</span> {PRODUCTS.find(p => p.id === previewData.productId)?.name}</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>対象日:</span> {previewData.targetDate}</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>読込件数:</span> {previewData.totalMembers}名</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>名寄せ成功:</span> <span style={{ color: '#10b981', fontWeight: 'bold' }}>{previewData.matchedCount}</span> 名</div>
          </div>

          {previewData.unmatchedCount > 0 && (
            <div className="alert-warning" style={{ background: '#fffbeb', color: '#b45309', padding: '1rem', borderRadius: '4px', borderLeft: '4px solid #f59e0b', marginBottom: '2rem' }}>
              <AlertTriangle size={18} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
              システムに存在しない名前が {previewData.unmatchedCount} 件あります。これらは無視して取り込まれます。
            </div>
          )}

          <div className="table-container" style={{ marginBottom: '2rem' }}>
            <table className="reports-table">
              <thead>
                <tr>
                  <th>名前 (CSV)</th>
                  <th>名寄せ状況</th>
                  <th>架電数</th>
                  <th>有効通話</th>
                  <th>再コール</th>
                  <th>担当者通話</th>
                  <th>見込数</th>
                  <th>アポ数</th>
                </tr>
              </thead>
              <tbody>
                {previewData.members.map((m, idx) => (
                  <tr key={idx}>
                    <td>{m.name}</td>
                    <td>
                      {m.matched ? (
                        <span style={{ color: '#10b981', fontSize: '0.9rem' }}>✓ マッチ</span>
                      ) : (
                        <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>✗ 未登録</span>
                      )}
                    </td>
                    <td>{m.totals.total}</td>
                    <td>{m.totals.actual}</td>
                    <td>{m.totals.recall}</td>
                    <td>{m.totals.owner}</td>
                    <td>{m.totals.prospect}</td>
                    <td>{m.totals.appoint}</td>
                  </tr>
                ))}
                {/* 合計行 */}
                <tr style={{ background: 'var(--bg-secondary)', fontWeight: 'bold' }}>
                  <td colSpan="2">全体合計</td>
                  <td>{previewData.summary.totals.total}</td>
                  <td>{previewData.summary.totals.actual}</td>
                  <td>{previewData.summary.totals.recall}</td>
                  <td>{previewData.summary.totals.owner}</td>
                  <td>{previewData.summary.totals.prospect}</td>
                  <td>{previewData.summary.totals.appoint}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => handleCommit(true)}>
              上書き保存 (既存データがある場合)
            </button>
            <button className="btn btn-primary" onClick={() => handleCommit(false)}>
              確定して保存
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="spinner" style={{ border: '4px solid #f3f3f3', borderTop: '4px solid #10b981', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          <p>データベースに保存しています...</p>
        </div>
      )}

      {step === 5 && (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <CheckCircle size={64} style={{ color: '#10b981', margin: '0 auto 1rem' }} />
          <h2>取込が完了しました</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
            ダッシュボードまたはKPI詳細画面から取り込んだデータを確認できます。
          </p>
          <button className="btn btn-primary" onClick={resetForm} style={{ marginTop: '2rem' }}>
            続けて別のファイルを取り込む
          </button>
        </div>
      )}
    </div>
  );
}
