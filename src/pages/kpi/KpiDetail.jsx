import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { BarChart3, Users, Table, Activity } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';
import { useAuth } from '../../context/AuthContext';
import { getVisibleUsers } from '../../utils/teamUtils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart
} from 'recharts';

const KPI_KEYS = ['total', 'actual', 'recall', 'owner', 'prospect', 'appoint'];
const KPI_LABELS = {
  total: '架電数',
  actual: '有効通話',
  recall: '再コール',
  owner: '担当者通話',
  prospect: '見込数',
  appoint: 'アポ数'
};

const processHourlyData = (hourlyData) => {
  if (!hourlyData || !Array.isArray(hourlyData)) return [];
  
  return hourlyData.filter(h => {
    if (h.hour === 'late' || (typeof h.hour === 'number' && h.hour >= 19)) return false;
    return true;
  }).reduce((acc, h) => {
    if (h.hour === 'early' || h.hour === 8) {
      const existing = acc.find(a => a.hour === 8);
      if (existing) {
        Object.keys(h).forEach(k => {
          if (k !== 'hour') existing[k] += (h[k] || 0);
        });
      } else {
        acc.push({ ...h, hour: 8 });
      }
    } else {
      acc.push({ ...h, hour: Number(h.hour) });
    }
    return acc;
  }, []).sort((a, b) => a.hour - b.hour);
};

export default function KpiDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('table'); // table, compare, graph
  
  const [products, setProducts] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedUser, setSelectedUser] = useState(user.uid);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedMetric, setSelectedMetric] = useState('total');

  const [kpiData, setKpiData] = useState(null);
  const [allTeamKpiData, setAllTeamKpiData] = useState([]);

  useEffect(() => {
    const fetchInitialMeta = async () => {
      try {
        const prodSnap = await getDocs(collection(db, 'productMasters'));
        const pList = [];
        prodSnap.forEach(d => { if (d.data().isActive !== false) pList.push(d.data()); });
        setProducts(pList);
        
        const visible = await getVisibleUsers(user);
        setTeamMembers(visible);

        if (id) {
          const parts = id.split('_');
          if (parts.length === 3) {
            setSelectedUser(parts[0]);
            setSelectedProduct(parts[1]);
            const d = parts[2];
            setSelectedDate(`${d.substring(0,4)}-${d.substring(4,6)}-${d.substring(6,8)}`);
          } else {
            setSelectedDate(new Date().toISOString().split('T')[0]);
            if (pList.length > 0) setSelectedProduct(pList[0].productId);
          }
        } else {
          setSelectedDate(new Date().toISOString().split('T')[0]);
          if (pList.length > 0) setSelectedProduct(pList[0].productId);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialMeta();
  }, [id, user]);

  useEffect(() => {
    if (loading || !selectedDate || !selectedProduct) return;
    
    const fetchKpi = async () => {
      setLoading(true);
      try {
        const formattedDate = selectedDate.replace(/-/g, '');
        
        const q = query(
          collection(db, 'dailyKpi'),
          where('userId', '==', selectedUser),
          where('date', '==', formattedDate),
          where('productId', '==', selectedProduct)
        );
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const d = snap.docs[0].data();
          d.displayHourly = processHourlyData(d.hourlyData);
          setKpiData(d);
        } else {
          setKpiData(null);
        }

        if (user.role === 'executive' || user.role === 'manager') {
          const tq = query(
            collection(db, 'dailyKpi'), 
            where('date', '==', formattedDate),
            where('productId', '==', selectedProduct)
          );
          const tSnap = await getDocs(tq);
          const allKpis = [];
          tSnap.forEach(d => {
            const dt = d.data();
            if (teamMembers.find(m => m.id === dt.userId)) {
              dt.displayHourly = processHourlyData(dt.hourlyData);
              allKpis.push(dt);
            }
          });
          setAllTeamKpiData(allKpis);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchKpi();
  }, [selectedDate, selectedUser, selectedProduct, loading, teamMembers]);

  if (loading && products.length === 0) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>読み込み中...</div>;
  }

  const formatHour = (hour) => `${hour}:00〜`;

  const getGraphData = () => {
    if (!kpiData) return [];
    return kpiData.displayHourly.map(h => ({
      name: `${h.hour}:00`,
      架電数: h.total || 0,
      有効通話率: (h.total || 0) > 0 ? Math.round(((h.actual || 0) / h.total) * 100) : 0
    }));
  };

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <Breadcrumb items={[
        { label: 'KPIダッシュボード', path: '/kpi' },
        { label: '時間帯別KPI詳細 (K-06)' }
      ]} />

      <div className="page-header" style={{ marginBottom: '2rem', marginTop: '1rem' }}>
        <h1>時間帯別KPI詳細 (K-06)</h1>
        <p>個人の時間帯別データの確認とチーム比較</p>
      </div>

      {/* Filters */}
      <div className="filter-bar glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontWeight: 'bold' }}>日付:</label>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={e => setSelectedDate(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontWeight: 'bold' }}>商材:</label>
          <select 
            value={selectedProduct} 
            onChange={e => setSelectedProduct(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
          >
            {products.map(p => <option key={p.productId} value={p.productId}>{p.productName}</option>)}
          </select>
        </div>

        {teamMembers.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontWeight: 'bold' }}>対象者:</label>
            <select 
              value={selectedUser} 
              onChange={e => setSelectedUser(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            >
              {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        {[
          { id: 'table', label: 'テーブル表示', icon: <Table size={16} /> },
          ...(user.role === 'executive' || user.role === 'manager' || user.role === 'leader' 
            ? [{ id: 'compare', label: 'チーム比較', icon: <Users size={16} /> }] : []),
          { id: 'graph', label: 'グラフ分析', icon: <BarChart3 size={16} /> }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)} 
            style={{ 
              padding: '0.75rem 1.5rem', 
              background: 'none', 
              border: 'none', 
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {!kpiData && activeTab !== 'compare' && (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          指定された条件のデータが見つかりません。
        </div>
      )}

      {/* Tab 1: Table */}
      {activeTab === 'table' && kpiData && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>個人の時間帯別データ</h3>
          <div className="table-container">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>時間帯</th>
                  {KPI_KEYS.map(k => <th key={k}>{KPI_LABELS[k]}</th>)}
                </tr>
              </thead>
              <tbody>
                {kpiData.displayHourly.map((h, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 'bold' }}>{formatHour(h.hour)}</td>
                    {KPI_KEYS.map(k => (
                      <td key={k}>{h[k] || 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)', fontWeight: 'bold' }}>
                  <td>合計</td>
                  {KPI_KEYS.map(k => (
                    <td key={k}>{kpiData.totals?.[k] || 0}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Compare */}
      {activeTab === 'compare' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          {(user.role === 'leader' || user.role === 'member') ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              権限がありません。チーム比較はマネージャー以上のみ閲覧可能です。
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>チームメンバー時間帯比較</h3>
                <select 
                  value={selectedMetric}
                  onChange={e => setSelectedMetric(e.target.value)}
                  style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                >
                  {KPI_KEYS.map(k => <option key={k} value={k}>{KPI_LABELS[k]}</option>)}
                </select>
              </div>

              {allTeamKpiData.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>比較対象のデータがありません。</p>
              ) : (
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: '120px' }}>メンバー名</th>
                        {[8,9,10,11,12,13,14,15,16,17,18].map(h => (
                          <th key={h}>{h}:00〜</th>
                        ))}
                        <th>合計</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map(m => {
                        const memberKpi = allTeamKpiData.find(d => d.userId === m.id);
                        if (!memberKpi) return null;
                        return (
                          <tr key={m.id} style={{ background: m.id === selectedUser ? 'rgba(59,130,246,0.1)' : 'transparent' }}>
                            <td style={{ fontWeight: 'bold' }}>{m.name}</td>
                            {[8,9,10,11,12,13,14,15,16,17,18].map(h => {
                              const hData = memberKpi.displayHourly.find(dh => dh.hour === h);
                              return <td key={h}>{hData ? (hData[selectedMetric] || 0) : 0}</td>;
                            })}
                            <td style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                              {memberKpi.totals?.[selectedMetric] || 0}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab 3: Graph */}
      {activeTab === 'graph' && kpiData && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={20} /> 時間帯別の架電数・有効通話率
          </h3>
          
          <div style={{ width: '100%', height: '400px' }}>
            <ResponsiveContainer>
              <ComposedChart data={getGraphData()} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: 'none', borderRadius: '8px', color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="架電数" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Line yAxisId="right" type="monotone" dataKey="有効通話率" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
