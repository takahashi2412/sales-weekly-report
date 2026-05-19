import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { BarChart3, Users, Table, ChevronRight, Activity } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';

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
    // 19:00以降を除外
    if (h.hour === 'late' || (typeof h.hour === 'number' && h.hour >= 19)) return false;
    return true;
  }).reduce((acc, h) => {
    if (h.hour === 'early' || h.hour === 8) {
      // 0:00〜8:59を8:00行にまとめる
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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('table'); // table, compare, graph
  const [kpiData, setKpiData] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [productName, setProductName] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch User KPI
        const kpiRef = doc(db, 'dailyKpi', id);
        const kpiSnap = await getDoc(kpiRef);
        
        if (!kpiSnap.exists()) {
          setLoading(false);
          return;
        }
        
        const data = kpiSnap.data();
        data.displayHourly = processHourlyData(data.hourlyData);
        setKpiData(data);

        // Fetch Product Name
        const prodRef = doc(db, 'productMasters', data.productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
          setProductName(prodSnap.data().productName);
        } else {
          setProductName(data.productId);
        }

        // Fetch Team Summary for Comparison
        const summaryId = `${data.productId}_${data.date}`;
        const sumRef = doc(db, 'dailyKpiSummary', summaryId);
        const sumSnap = await getDoc(sumRef);
        if (sumSnap.exists()) {
          const sumData = sumSnap.data();
          sumData.displayHourly = processHourlyData(sumData.hourlyData);
          setTeamData(sumData);
        }

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchData();
  }, [id]);

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>読み込み中...</div>;
  }

  if (!kpiData) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>データが見つかりません。</div>;
  }

  const formatHour = (hour) => `${hour}:00〜`;
  const formatDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    return `${dateStr.substring(0,4)}/${dateStr.substring(4,6)}/${dateStr.substring(6,8)}`;
  };

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <Breadcrumb items={[
        { label: 'KPIダッシュボード', path: '/kpi' },
        { label: 'KPI履歴・推移', path: '/kpi/history' },
        { label: '時間帯別KPI詳細 (K-06)' }
      ]} />

      <div className="page-header" style={{ marginBottom: '2rem', marginTop: '1rem' }}>
        <h1>時間帯別KPI詳細 (K-06)</h1>
        <p style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
          <span><strong>日付:</strong> {formatDate(kpiData.date)}</span>
          <span><strong>商材:</strong> {productName}</span>
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        {[
          { id: 'table', label: 'テーブル表示', icon: <Table size={16} /> },
          { id: 'compare', label: 'チーム比較', icon: <Users size={16} /> },
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

      {/* Tab 1: Table */}
      {activeTab === 'table' && (
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
          <h3 style={{ marginBottom: '1rem' }}>チーム平均との比較</h3>
          {!teamData ? (
            <p style={{ color: 'var(--text-secondary)' }}>比較対象のチームデータがありません。</p>
          ) : (
            <div className="table-container">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>時間帯</th>
                    <th>架電数 (個人)</th>
                    <th>架電数 (チーム平均)</th>
                    <th>差分</th>
                    <th>アポ数 (個人)</th>
                    <th>アポ数 (チーム平均)</th>
                    <th>差分</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiData.displayHourly.map((h, i) => {
                    const teamH = teamData.displayHourly.find(th => th.hour === h.hour) || {};
                    const memberCount = teamData.memberCount || 1;
                    const teamAvgTotal = Math.round((teamH.total || 0) / memberCount * 10) / 10;
                    const teamAvgAppoint = Math.round((teamH.appoint || 0) / memberCount * 10) / 10;
                    
                    const diffTotal = (h.total || 0) - teamAvgTotal;
                    const diffAppoint = (h.appoint || 0) - teamAvgAppoint;

                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 'bold' }}>{formatHour(h.hour)}</td>
                        <td>{h.total || 0}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{teamAvgTotal}</td>
                        <td style={{ color: diffTotal > 0 ? '#10b981' : diffTotal < 0 ? '#ef4444' : 'inherit', fontWeight: 'bold' }}>
                          {diffTotal > 0 ? '+' : ''}{Math.round(diffTotal * 10)/10}
                        </td>
                        <td>{h.appoint || 0}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{teamAvgAppoint}</td>
                        <td style={{ color: diffAppoint > 0 ? '#10b981' : diffAppoint < 0 ? '#ef4444' : 'inherit', fontWeight: 'bold' }}>
                          {diffAppoint > 0 ? '+' : ''}{Math.round(diffAppoint * 10)/10}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Graph */}
      {activeTab === 'graph' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={20} /> 架電数とアポ数の推移
          </h3>
          
          <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '16px', height: '16px', background: 'var(--accent-primary)', borderRadius: '4px' }}></div>
              <span>架電数</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '16px', height: '16px', background: '#10b981', borderRadius: '4px' }}></div>
              <span>アポ数</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', height: '300px', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid var(--border-color)' }}>
            {kpiData.displayHourly.map((h, i) => {
              const maxTotal = Math.max(...kpiData.displayHourly.map(d => d.total || 0), 10);
              const maxAppoint = Math.max(...kpiData.displayHourly.map(d => d.appoint || 0), 5);
              
              const totalHeight = `${((h.total || 0) / maxTotal) * 100}%`;
              // Scale appoint up a bit for visibility if it's very small compared to total, 
              // but we want to show it on its own scale or just alongside. 
              // Usually appoint is much smaller. Let's make it relative to maxAppoint.
              const appointHeight = `${((h.appoint || 0) / maxAppoint) * 100}%`;

              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '100%', width: '100%', justifyContent: 'center' }}>
                    <div 
                      style={{ 
                        width: '40%', 
                        height: totalHeight, 
                        background: 'var(--accent-primary)', 
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                        position: 'relative'
                      }}
                      title={`架電数: ${h.total || 0}`}
                    >
                      <span style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.75rem' }}>
                        {h.total || 0}
                      </span>
                    </div>
                    <div 
                      style={{ 
                        width: '40%', 
                        height: appointHeight, 
                        background: '#10b981', 
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                        position: 'relative'
                      }}
                      title={`アポ数: ${h.appoint || 0}`}
                    >
                      {(h.appoint || 0) > 0 && (
                        <span style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.75rem', color: '#10b981', fontWeight: 'bold' }}>
                          {h.appoint}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {h.hour}:00
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
