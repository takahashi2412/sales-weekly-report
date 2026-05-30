import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { History, Calendar, Download, RefreshCw, AlertCircle, BarChart3 } from 'lucide-react';
import { getVisibleUsers, getVisibleUserIds } from '../../utils/teamUtils';
import CsvExportModal from '../../components/CsvExportModal';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import '../Dashboard.css';

export default function KpiHistory() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  
  const [viewScope, setViewScope] = useState(() => {
    if (user.role === 'executive') return 'company';
    if (user.role === 'manager') return 'team';
    return 'personal';
  });

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // デフォルト過去30日
    return d.toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  
  const [errorMsg, setErrorMsg] = useState('');

  const [kpiList, setKpiList] = useState([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const fetchData = async () => {
    const sDateObj = new Date(startDate);
    const eDateObj = new Date(endDate);
    const diffTime = Math.abs(eDateObj - sDateObj);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 92) {
      setErrorMsg('最大表示期間は3ヶ月（92日）を上限としています。期間を狭めてください。');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    try {
      const prodSnap = await getDocs(collection(db, 'productMasters'));
      const prodList = [];
      prodSnap.forEach(d => {
        if (d.data().isActive !== false) prodList.push(d.data());
      });
      setProducts(prodList);

      const visibleUsers = await getVisibleUsers(
        viewScope === 'personal' ? { ...user, role: 'leader' } : user
      );
      setTeamMembers(visibleUsers);
      
      const visibleIds = visibleUsers.map(u => u.id);

      if (visibleIds.length === 0) {
        setKpiList([]);
        return;
      }

      let kpiQuery;
      // ユーザーの指定要件に従いクエリを構築
      if (user.role === 'leader') {
        kpiQuery = query(collection(db, 'dailyKpi'), where('userId', '==', user.uid));
      } else {
        kpiQuery = query(collection(db, 'dailyKpi'), orderBy('date', 'desc'), limit(1500));
      }
      
      const kpiSnap = await getDocs(kpiQuery);
      const kpis = [];
      
      kpiSnap.forEach(d => {
        const data = d.data();
        
        // メモリ内で日付フィルタリング
        if (data.date >= startDate && data.date <= endDate) {
          if (visibleIds.includes(data.userId)) {
            const member = visibleUsers.find(u => u.id === data.userId);
            kpis.push({ id: d.id, userName: member?.name || '不明', ...data });
          }
        }
      });
      
      kpis.sort((a, b) => b.date.localeCompare(a.date)); // 降順
      setKpiList(kpis);
      
    } catch (e) {
      console.error(e);
      setErrorMsg('データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [viewScope, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFetchClick = () => {
    fetchData();
  };

  const formatDate = (d) => {
    if (!d) return '';
    if (d.includes('-')) return d.replace(/-/g, '/');
    if (d.length === 8) return `${d.substring(0, 4)}/${d.substring(4, 6)}/${d.substring(6, 8)}`;
    return d;
  };

  // チャート用のデータ集計（日付昇順で日次の合計を集計）
  const chartData = useMemo(() => {
    const agg = {};
    kpiList.forEach(k => {
      const date = formatDate(k.date);
      if (!agg[date]) {
        agg[date] = { date, totalCalls: 0, appoints: 0, timestamp: k.date };
      }
      agg[date].totalCalls += (k.totals?.total || 0);
      agg[date].appoints += (k.totals?.appoint || 0);
    });
    
    // 日付昇順にソート（グラフ描画のため）
    return Object.values(agg).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [kpiList]);

  return (
    <div className="page-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>KPI履歴・推移 (K-04)</h1>
        <p>過去のKPIデータ推移と詳細履歴一覧</p>
      </div>

      {errorMsg && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={20} />
          {errorMsg}
        </div>
      )}

      <div className="filter-bar glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontWeight: 'bold' }}>対象:</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {user.role === 'executive' && (
                <button 
                  onClick={() => setViewScope('company')}
                  style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: viewScope === 'company' ? 'var(--accent-primary)' : 'transparent', color: viewScope === 'company' ? 'white' : 'var(--text-primary)', cursor: 'pointer' }}
                >
                  全社
                </button>
              )}
              {(user.role === 'manager' || user.role === 'executive') && (
                <button 
                  onClick={() => setViewScope('team')}
                  style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: viewScope === 'team' ? 'var(--accent-primary)' : 'transparent', color: viewScope === 'team' ? 'white' : 'var(--text-primary)', cursor: 'pointer' }}
                >
                  組織
                </button>
              )}
              <button 
                onClick={() => setViewScope('personal')}
                style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: viewScope === 'personal' ? 'var(--accent-primary)' : 'transparent', color: viewScope === 'personal' ? 'white' : 'var(--text-primary)', cursor: 'pointer' }}
              >
                個人
              </button>
            </div>
          </div>

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
        </div>
        
        <button 
          className="btn btn-secondary" 
          onClick={() => setIsExportModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Download size={18} /> CSV出力
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>読み込み中...</div>
      ) : (
        <>
          {chartData.length > 0 && (
            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
              <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={20} /> KPI推移グラフ
              </h2>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" name="総コール数" dataKey="totalCalls" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line yAxisId="right" type="monotone" name="アポ数" dataKey="appoints" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={20} /> 詳細データ一覧
            </h2>

            <div className="table-container">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>メンバー</th>
                    <th>対象商材</th>
                    <th>架電数</th>
                    <th>実コール</th>
                    <th>再コール</th>
                    <th>担当者通話</th>
                    <th>見込数</th>
                    <th>アポ数</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiList.length === 0 ? (
                    <tr><td colSpan="9" style={{ textAlign: 'center' }}>KPIデータがありません</td></tr>
                  ) : (
                    kpiList.map((k, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 'bold' }}>
                          <Link to={`/kpi/detail/${k.userId}`} style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                            {formatDate(k.date)}
                          </Link>
                        </td>
                        <td>{k.userName}</td>
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
        </>
      )}

      <CsvExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        usersData={teamMembers}
      />
    </div>
  );
}
