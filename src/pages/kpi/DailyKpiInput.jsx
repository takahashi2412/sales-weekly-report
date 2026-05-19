import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Save, Clock, FileText } from 'lucide-react';

import { getVisibleUsers } from '../../utils/teamUtils';

const KPI_KEYS = [
  { key: 'total', label: '架電数' },
  { key: 'actual', label: '有効通話' },
  { key: 'recall', label: '再コール' },
  { key: 'owner', label: '担当者通話' },
  { key: 'prospect', label: '見込数' },
  { key: 'appoint', label: 'アポ数' }
];

const HOUR_LABELS = [
  'early',
  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  'late'
];

const HOUR_DISPLAY = {
  'early': '0:00〜8:59',
  'late': '21:00〜23:59'
};

export default function DailyKpiInput() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [productId, setProductId] = useState('');
  const [targetUserId, setTargetUserId] = useState(user.uid);
  const [mode, setMode] = useState('summary'); // 'summary' | 'detail'

  const [summaryData, setSummaryData] = useState({
    total: 0, actual: 0, recall: 0, owner: 0, prospect: 0, appoint: 0
  });

  const [detailData, setDetailData] = useState(() => {
    const init = {};
    HOUR_LABELS.forEach(h => {
      init[h] = { total: 0, actual: 0, recall: 0, owner: 0, prospect: 0, appoint: 0 };
    });
    return init;
  });

  useEffect(() => {
    const fetchInitialMeta = async () => {
      const snap = await getDocs(collection(db, 'productMasters'));
      const list = [];
      snap.forEach(d => {
        if (d.data().isActive !== false) {
          list.push(d.data());
        }
      });
      setProducts(list);
      if (user?.currentProductId) {
        setProductId(user.currentProductId);
      } else if (list.length > 0) {
        setProductId(list[0].productId);
      }

      const visible = await getVisibleUsers(user);
      setTeamMembers(visible);
    };
    fetchInitialMeta();
  }, [user]);

  const handleSummaryChange = (key, val) => {
    setSummaryData(prev => ({ ...prev, [key]: parseInt(val, 10) || 0 }));
  };

  const handleDetailChange = (hour, key, val) => {
    setDetailData(prev => ({
      ...prev,
      [hour]: {
        ...prev[hour],
        [key]: parseInt(val, 10) || 0
      }
    }));
  };

  const handleSave = async () => {
    if (!productId || !date || !targetUserId) {
      alert('必須項目を選択してください。');
      return;
    }

    setLoading(true);
    try {
      let hourlyDataToSave = [];
      let totalsToSave = { total: 0, actual: 0, recall: 0, owner: 0, prospect: 0, appoint: 0 };

      if (mode === 'summary') {
        const hourCount = 12;
        const perHour = {};
        for (const k of KPI_KEYS.map(k => k.key)) {
          perHour[k] = Math.floor(summaryData[k] / hourCount);
          totalsToSave[k] = summaryData[k]; 
        }

        hourlyDataToSave = HOUR_LABELS.map(h => {
          if (h === 'early' || h === 'late') {
            return { hour: h, total: 0, actual: 0, recall: 0, owner: 0, prospect: 0, appoint: 0 };
          }
          return { hour: h, ...perHour };
        });
      } else {
        hourlyDataToSave = HOUR_LABELS.map(h => ({
          hour: h,
          ...detailData[h]
        }));
        
        for (const k of KPI_KEYS.map(k => k.key)) {
          totalsToSave[k] = hourlyDataToSave.reduce((sum, h) => sum + (h[k] || 0), 0);
        }
      }

      const docId = `${targetUserId}_${productId}_${date.replace(/-/g, '')}`;
      await setDoc(doc(db, 'dailyKpi', docId), {
        userId: targetUserId,
        date: date.replace(/-/g, ''), 
        productId,
        productVersion: 1,
        source: 'manual',
        hourlyData: hourlyDataToSave,
        totals: totalsToSave,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      alert('日次KPIを保存しました。');
    } catch (e) {
      console.error(e);
      alert('保存に失敗しました: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>日報・KPI手動入力 (K-02)</h1>
        <p>CSV取込が利用できない場合や、一部修正を行いたい場合のバックアップ入力画面です</p>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          
          {(user.role === 'executive' || user.role === 'manager') && teamMembers.length > 0 && (
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontWeight: 'bold' }}>対象メンバー</label>
              <select 
                value={targetUserId} 
                onChange={e => setTargetUserId(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
              >
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}

          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontWeight: 'bold' }}>対象日</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontWeight: 'bold' }}>対象商材</label>
            <select 
              value={productId} 
              onChange={e => setProductId(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            >
              {products.map(p => <option key={p.productId} value={p.productId}>{p.productName}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button 
            className={`btn ${mode === 'summary' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('summary')}
            style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            <FileText size={18} style={{ marginRight: '0.5rem' }} /> 合計のみ入力モード
          </button>
          <button 
            className={`btn ${mode === 'detail' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('detail')}
            style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            <Clock size={18} style={{ marginRight: '0.5rem' }} /> 時間帯別 詳細モード
          </button>
        </div>

        {mode === 'summary' ? (
          <div className="summary-input" style={{ background: 'var(--bg-secondary)', padding: '2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center' }}>
              1日分の合計数値を入力してください。時間帯別（9時〜20時）に均等割り当てされて保存されます。
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem' }}>
              {KPI_KEYS.map(k => (
                <div key={k.key} className="form-group">
                  <label>{k.label}</label>
                  <input 
                    type="number" 
                    min="0"
                    value={summaryData[k.key]}
                    onChange={e => handleSummaryChange(k.key, e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', fontSize: '1.25rem', textAlign: 'center', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="detail-input" style={{ overflowX: 'auto', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <table className="reports-table" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <th>時間帯</th>
                  {KPI_KEYS.map(k => <th key={k.key}>{k.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {HOUR_LABELS.map(h => (
                  <tr key={h}>
                    <td style={{ fontWeight: 'bold' }}>{typeof h === 'number' ? `${h}:00〜` : HOUR_DISPLAY[h]}</td>
                    {KPI_KEYS.map(k => (
                      <td key={k.key}>
                        <input 
                          type="number" 
                          min="0"
                          value={detailData[h][k.key] || 0}
                          onChange={e => handleDetailChange(h, k.key, e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', textAlign: 'right' }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button 
            className="btn btn-primary" 
            onClick={handleSave} 
            disabled={loading}
            style={{ padding: '1rem 3rem', fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center' }}
          >
            <Save size={20} style={{ marginRight: '0.5rem' }} />
            {loading ? '保存中...' : 'データを保存する'}
          </button>
        </div>
      </div>
    </div>
  );
}
