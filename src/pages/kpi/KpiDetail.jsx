import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { Activity, Calendar, History, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { useAuth } from '../../context/AuthContext';
import { getVisibleUserIds, getVisibleUsers } from '../../utils/teamUtils';
import '../Dashboard.css';

const KPI_KEYS = ['total', 'actual', 'recall', 'owner', 'prospect', 'appoint'];
const KPI_LABELS = {
  total: '架電数',
  actual: '有効通話',
  recall: '再コール',
  owner: '担当者通話',
  prospect: '見込数',
  appoint: 'アポ数'
};
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export default function KpiDetail() {
  let { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // if no id is provided, default to user.uid
  if (!id) {
    id = user.uid;
  }

  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [products, setProducts] = useState([]);
  const [targetUser, setTargetUser] = useState(null);
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  const [selectedProduct, setSelectedProduct] = useState('all');
  const [selectedHourlyMetric, setSelectedHourlyMetric] = useState('total');

  const [dailyKpis, setDailyKpis] = useState([]);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      setLoading(true);
      setAuthError('');
      try {
        if (user.role === 'leader' && id !== user.uid) {
          navigate('/dashboard'); // 権限エラー時はリダイレクト
          return;
        }

        const visibleUsers = await getVisibleUsers(user);
        const tUser = visibleUsers.find(u => u.id === id);

        if (!tUser && user.role !== 'executive') {
          // executive may see everyone, but others are restricted
          setAuthError('アクセス権限がありません。');
          setLoading(false);
          return;
        }
        
        // Ensure user info is fetched
        if (!tUser) {
          const uSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', id)));
          if (!uSnap.empty) {
            setTargetUser({ id: uSnap.docs[0].id, ...uSnap.docs[0].data() });
          } else {
            setAuthError('ユーザーが見つかりません。');
            setLoading(false);
            return;
          }
        } else {
          setTargetUser(tUser);
        }

        const prodSnap = await getDocs(collection(db, 'productMasters'));
        const pList = [];
        prodSnap.forEach(d => { if (d.data().isActive !== false) pList.push(d.data()); });
        setProducts(pList);

        await fetchData(id);
      } catch (e) {
        console.error(e);
        setErrorMsg('データ取得に失敗しました。');
      }
      setLoading(false);
    };

    checkAuthAndFetch();
  }, [id, user, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async (userId) => {
    const sDateObj = new Date(startDate);
    const eDateObj = new Date(endDate);
    const diffTime = Math.abs(eDateObj - sDateObj);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 92) {
      setErrorMsg('最大表示期間は3ヶ月（92日）を上限としています。期間を狭めてください。');
      return;
    }
    setErrorMsg('');

    try {
      const q = query(
        collection(db, 'dailyKpi'),
        where('userId', '==', userId),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      
      list.sort((a, b) => b.date.localeCompare(a.date));
      setDailyKpis(list);
    } catch (e) {
      console.error(e);
      setErrorMsg('データ取得に失敗しました。');
    }
  };

  const handleFetchClick = () => {
    setLoading(true);
    fetchData(id).then(() => setLoading(false));
  };

  const filteredKpis = useMemo(() => {
    if (selectedProduct === 'all') return dailyKpis;
    return dailyKpis.filter(k => k.productId === selectedProduct);
  }, [dailyKpis, selectedProduct]);

  // 時間帯別データの集計 (全日付をマージ)
  const aggregatedHourly = useMemo(() => {
    const map = {};
    HOURS.forEach(h => {
      map[h] = { hour: h, total: 0, actual: 0, recall: 0, owner: 0, prospect: 0, appoint: 0 };
    });

    filteredKpis.forEach(kpi => {
      if (!kpi.hourlyData || !Array.isArray(kpi.hourlyData)) return;
      kpi.hourlyData.forEach(hd => {
        let h = hd.hour;
        if (h === 'early') h = 8;
        if (h === 'late' || h > 18) return;
        h = Number(h);
        
        if (map[h]) {
          KPI_KEYS.forEach(key => {
            map[h][key] += (hd[key] || 0);
          });
        }
      });
    });
    
    return Object.values(map).sort((a, b) => a.hour - b.hour);
  }, [filteredKpis]);

  const formatDate = (d) => {
    if (!d) return '';
    if (d.includes('-')) return d.replace(/-/g, '/');
    if (d.length === 8) return `${d.substring(0, 4)}/${d.substring(4, 6)}/${d.substring(6, 8)}`;
    return d;
  };

  const getMaxMetricValue = () => {
    if (aggregatedHourly.length === 0) return 1;
    const max = Math.max(...aggregatedHourly.map(h => h[selectedHourlyMetric] || 0));
    return max === 0 ? 1 : max;
  };

  if (authError) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: '#b91c1c' }}>{authError}</div>;
  }

  return (
    <div className="page-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Breadcrumb items={[
        { label: 'KPI履歴・推移', path: '/kpi/history' },
        { label: 'KPI詳細 (K-06)' }
      ]} />

      <div className="page-header" style={{ marginBottom: '2rem', marginTop: '1rem' }}>
        <h1>KPI詳細 (K-06): {targetUser?.name || '読み込み中...'}</h1>
        <p>対象ユーザーの日次KPI一覧および時間帯別ヒートマップ</p>
      </div>

      {errorMsg && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={20} />
          {errorMsg}
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
          <Calendar size={18} style={{ color: 'var(--text-secondary)' }} />
          <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>期間:</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} 
          />
          <span>〜</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} 
          />
          <button 
            onClick={handleFetchClick}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem' }}
          >
            <RefreshCw size={14} /> 反映
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontWeight: 'bold' }}>商材:</label>
          <select 
            value={selectedProduct} 
            onChange={e => setSelectedProduct(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
          >
            <option value="all">全商材合計</option>
            {products.map(p => <option key={p.productId} value={p.productId}>{p.productName}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>データを集計中...</div>
      ) : (
        <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: '1fr' }}>
          
          {/* 時間帯別KPIヒートマップ */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={20} /> 時間帯別アクティビティ（期間合計）
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>表示指標:</label>
                <select 
                  value={selectedHourlyMetric} 
                  onChange={e => setSelectedHourlyMetric(e.target.value)}
                  style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                >
                  {KPI_KEYS.map(k => <option key={k} value={k}>{KPI_LABELS[k]}</option>)}
                </select>
              </div>
            </div>

            <div style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '4px', minWidth: '600px' }}>
                {aggregatedHourly.map(h => {
                  const val = h[selectedHourlyMetric] || 0;
                  const maxVal = getMaxMetricValue();
                  const intensity = Math.max(0.05, val / maxVal);
                  
                  return (
                    <div key={h.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ 
                        width: '100%', 
                        height: '100px', 
                        backgroundColor: `rgba(59, 130, 246, ${intensity})`,
                        border: '1px solid rgba(0,0,0,0.05)',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: intensity > 0.5 ? 'white' : 'var(--text-primary)',
                        fontWeight: 'bold',
                        transition: 'background-color 0.3s'
                      }}>
                        {val}
                      </div>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {h.hour}:00
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="table-container" style={{ marginTop: '2rem' }}>
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>時間帯</th>
                    {KPI_KEYS.map(k => <th key={k}>{KPI_LABELS[k]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {aggregatedHourly.map((h) => (
                    <tr key={h.hour}>
                      <td style={{ fontWeight: 'bold' }}>{h.hour}:00〜</td>
                      {KPI_KEYS.map(k => (
                        <td key={k}>{h[k] || 0}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 日次KPI一覧 */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={20} /> 日次KPIデータ一覧
            </h2>
            <div className="table-container">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>商材</th>
                    <th>架電数</th>
                    <th>有効通話</th>
                    <th>再コール</th>
                    <th>担当者通話</th>
                    <th>見込数</th>
                    <th>アポ数</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKpis.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center' }}>データがありません</td></tr>
                  ) : (
                    filteredKpis.map((k, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 'bold' }}>{formatDate(k.date)}</td>
                        <td>{products.find(p => p.productId === k.productId)?.productName || k.productId}</td>
                        <td>{k.totals?.total || 0}</td>
                        <td>{k.totals?.actual || 0}</td>
                        <td>{k.totals?.recall || 0}</td>
                        <td>{k.totals?.owner || 0}</td>
                        <td>{k.totals?.prospect || 0}</td>
                        <td>{k.totals?.appoint || 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
