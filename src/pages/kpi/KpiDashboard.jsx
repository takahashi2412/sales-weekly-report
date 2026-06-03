import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { BarChart3, Target, Calendar, TrendingUp, Search, AlertCircle, RefreshCw, Briefcase, Users, FileText } from 'lucide-react';
import { getVisibleUserIds } from '../../utils/teamUtils';
import '../Dashboard.css';

export default function KpiDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [viewScope, setViewScope] = useState(() => {
    if (user.role === 'executive') return 'company';
    if (user.role === 'manager') return 'team';
    return 'personal';
  });

  const [activeTab, setActiveTab] = useState('progress');

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  
  const [errorMsg, setErrorMsg] = useState('');

  const [dashboardData, setDashboardData] = useState([]);
  const [kgiTargets, setKgiTargets] = useState({ order: 0, adopt: 0, visit: 0, grossProfit: 0 });

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

      const allUsersSnap = await getDocs(collection(db, 'users'));
      const allUserIds = allUsersSnap.docs.map(d => d.id);
      
      let visibleIds = [];
      if (viewScope === 'personal') {
        visibleIds = [user.uid];
      } else if (viewScope === 'company' && user.role === 'executive') {
        visibleIds = allUserIds;
      } else {
        visibleIds = await getVisibleUserIds(user);
      }

      if (visibleIds.length === 0) {
        setDashboardData([]);
        setKgiTargets({ order: 0, adopt: 0, visit: 0 });
        setLoading(false);
        return;
      }

      // 1. Fetch KGI Targets for the target month (based on endDate)
      const targetMonthStr = `${eDateObj.getFullYear()}-${String(eDateObj.getMonth() + 1).padStart(2, '0')}`;
      let tDocs = [];
      if (user.role === 'leader') {
        const promises = visibleIds.map(uid => getDocs(query(
          collection(db, 'kpiTargets'),
          where('userId', '==', uid),
          where('targetMonth', '==', targetMonthStr)
        )));
        const snaps = await Promise.all(promises);
        snaps.forEach(snap => snap.forEach(d => tDocs.push(d)));
      } else {
        const targetsQ = query(collection(db, 'kpiTargets'), where('targetMonth', '==', targetMonthStr));
        const tSnap = await getDocs(targetsQ);
        tSnap.forEach(d => tDocs.push(d));
      }
      
      let kgiAgg = { order: 0, adopt: 0, visit: 0, grossProfit: 0 };
      tDocs.forEach(d => {
        const t = d.data();
        if ((t.status === 'approved' || t.status === 'pending') && visibleIds.includes(t.userId)) {
          if (selectedProduct === 'all' || t.productId === selectedProduct) {
            kgiAgg.order += (t.monthlyOrderTarget || 0);
            kgiAgg.adopt += (t.calculatedTargets?.requiredAdoptions || 0);
            kgiAgg.visit += (t.calculatedTargets?.requiredAppoints || 0); // visit = requiredAppoints in our mapping
            kgiAgg.grossProfit += (t.grossProfitTarget || 0);
          }
        }
      });
      setKgiTargets(kgiAgg);

      // 2. Fetch daily KPIs
      let kpiDocs = [];
      if (user.role === 'leader') {
        const promises = visibleIds.map(uid => getDocs(query(
          collection(db, 'dailyKpi'),
          where('userId', '==', uid),
          where('date', '>=', startDate),
          where('date', '<=', endDate)
        )));
        const snaps = await Promise.all(promises);
        snaps.forEach(snap => snap.forEach(d => kpiDocs.push(d)));
      } else {
        const kpiQuery = query(
          collection(db, 'dailyKpi'),
          where('date', '>=', startDate),
          where('date', '<=', endDate)
        );
        const kpiSnap = await getDocs(kpiQuery);
        kpiSnap.forEach(d => kpiDocs.push(d));
      }
      
      const aggregated = {};
      
      kpiDocs.forEach(d => {
        const data = d.data();
        
        if (user.role === 'leader' && viewScope === 'personal' && (data.date < startDate || data.date > endDate)) {
          return;
        }

        if (visibleIds.includes(data.userId)) {
          const key = `${data.date}_${data.productId}`;
          if (!aggregated[key]) {
            aggregated[key] = {
              date: data.date,
              productId: data.productId,
              totals: { total: 0, actual: 0, recall: 0, owner: 0, prospect: 0, appoint: 0 },
              dailySummary: { adopt: 0, visit: 0, order: 0, workHours: 0 }
            };
          }
          const aggTotals = aggregated[key].totals;
          const dTotals = data.totals || {};
          aggTotals.total += (dTotals.total || 0);
          aggTotals.actual += (dTotals.actual || 0);
          aggTotals.recall += (dTotals.recall || 0);
          aggTotals.owner += (dTotals.owner || 0);
          aggTotals.prospect += (dTotals.prospect || 0);
          aggTotals.appoint += (dTotals.appoint || 0);

          const aggSum = aggregated[key].dailySummary;
          const dSum = data.dailySummary || {};
          aggSum.adopt += (dSum.adopt || 0);
          aggSum.visit += (dSum.visit || 0);
          aggSum.order += (dSum.order || 0);
          aggSum.workHours += (dSum.workHours || 0);
          if (typeof aggSum.grossProfit === 'undefined') aggSum.grossProfit = 0;
        }
      });

      // 3. Fetch orders for gross profit
      let ordersDocs = [];
      if (user.role === 'leader') {
        const promises = visibleIds.map(uid => getDocs(query(
          collection(db, 'orders'),
          where('userId', '==', uid),
          where('orderDate', '>=', startDate),
          where('orderDate', '<=', endDate)
        )));
        const snaps = await Promise.all(promises);
        snaps.forEach(snap => snap.forEach(d => ordersDocs.push(d)));
      } else {
        const ordersQuery = query(
          collection(db, 'orders'),
          where('orderDate', '>=', startDate),
          where('orderDate', '<=', endDate)
        );
        const ordersSnap = await getDocs(ordersQuery);
        ordersSnap.forEach(d => ordersDocs.push(d));
      }
      
      ordersDocs.forEach(d => {
        const data = d.data();
        if (user.role === 'leader' && viewScope === 'personal' && (data.orderDate < startDate || data.orderDate > endDate)) {
          return;
        }
        if (visibleIds.includes(data.userId)) {
          const key = `${data.orderDate}_${data.productId}`;
          if (!aggregated[key]) {
            aggregated[key] = {
              date: data.orderDate,
              productId: data.productId,
              totals: { total: 0, actual: 0, recall: 0, owner: 0, prospect: 0, appoint: 0 },
              dailySummary: { adopt: 0, visit: 0, order: 0, workHours: 0, grossProfit: 0 }
            };
          }
          if (typeof aggregated[key].dailySummary.grossProfit === 'undefined') aggregated[key].dailySummary.grossProfit = 0;
          aggregated[key].dailySummary.grossProfit += (Number(data.grossProfitPoint) || 0);
        }
      });

      const sorted = Object.values(aggregated).sort((a, b) => b.date.localeCompare(a.date));
      setDashboardData(sorted);
      
    } catch (e) {
      console.error(e);
      setErrorMsg('データの取得に失敗しました。管理者にお問い合わせください。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [viewScope, user, startDate, endDate]);

  const handleFetchClick = () => {
    fetchData();
  };

  const filteredSummaries = selectedProduct === 'all' 
    ? dashboardData 
    : dashboardData.filter(s => s.productId === selectedProduct);

  const aggregateTotals = () => {
    const agg = { 
      total: 0, actual: 0, recall: 0, owner: 0, prospect: 0, appoint: 0,
      adopt: 0, visit: 0, order: 0, workHours: 0, grossProfit: 0
    };
    filteredSummaries.forEach(s => {
      ['total', 'actual', 'recall', 'owner', 'prospect', 'appoint'].forEach(k => {
        agg[k] += s.totals[k] || 0;
      });
      ['adopt', 'visit', 'order', 'workHours', 'grossProfit'].forEach(k => {
        agg[k] += s.dailySummary[k] || 0;
      });
    });
    return agg;
  };

  const totals = aggregateTotals();

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 10) return dateStr;
    return `${dateStr.substring(0,4)}/${dateStr.substring(5,7)}/${dateStr.substring(8,10)}`;
  };

  const calcProgress = (current, target) => {
    if (!target) return 0;
    return Math.min(100, Math.round((current / target) * 100));
  };

  const orderProgress = calcProgress(totals.order, kgiTargets.order);
  const adoptProgress = calcProgress(totals.adopt, kgiTargets.adopt);
  const visitProgress = calcProgress(totals.visit, kgiTargets.visit);
  const grossProfitProgress = calcProgress(totals.grossProfit, kgiTargets.grossProfit);

  const applyDatePreset = (preset) => {
    const d = new Date();
    let s, e;
    switch (preset) {
      case 'thisMonth':
        s = new Date(d.getFullYear(), d.getMonth(), 1);
        e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        s = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        e = new Date(d.getFullYear(), d.getMonth(), 0);
        break;
      case 'thisWeek':
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        s = new Date(d.setDate(diff));
        e = new Date(s);
        e.setDate(s.getDate() + 6);
        break;
      case 'lastWeek':
        const lw = new Date();
        const lwDay = lw.getDay();
        const lwDiff = lw.getDate() - lwDay + (lwDay === 0 ? -6 : 1) - 7;
        s = new Date(lw.setDate(lwDiff));
        e = new Date(s);
        e.setDate(s.getDate() + 6);
        break;
      default:
        return;
    }
    setStartDate(s.toISOString().split('T')[0]);
    setEndDate(e.toISOString().split('T')[0]);
  };

  return (
    <div className="page-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>KPIダッシュボード (K-01)</h1>
        <p>各種データから状況を把握し、ボトルネックを特定します</p>
      </div>

      {errorMsg && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={20} />
          {errorMsg}
        </div>
      )}

      <div className="filter-bar glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', width: '100%' }}>
          <label style={{ fontWeight: 'bold' }}>期間プリセット:</label>
          <button onClick={() => applyDatePreset('thisMonth')} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem 0.8rem' }}>当月</button>
          <button onClick={() => applyDatePreset('lastMonth')} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem 0.8rem' }}>先月</button>
          <button onClick={() => applyDatePreset('thisWeek')} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem 0.8rem' }}>今週</button>
          <button onClick={() => applyDatePreset('lastWeek')} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem 0.8rem' }}>先週</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontWeight: 'bold' }}>表示範囲:</label>
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
                自チーム
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontWeight: 'bold' }}>商材フィルター:</label>
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

      <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', marginBottom: '2rem' }}>
        <button 
          onClick={() => setActiveTab('progress')}
          style={{ padding: '1rem 2rem', fontSize: '1.1rem', fontWeight: 'bold', background: 'none', border: 'none', borderBottom: activeTab === 'progress' ? '3px solid var(--accent-primary)' : '3px solid transparent', color: activeTab === 'progress' ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Target size={20} /> KPI表記・進捗
        </button>
        <button 
          onClick={() => setActiveTab('analysis')}
          style={{ padding: '1rem 2rem', fontSize: '1.1rem', fontWeight: 'bold', background: 'none', border: 'none', borderBottom: activeTab === 'analysis' ? '3px solid var(--accent-primary)' : '3px solid transparent', color: activeTab === 'analysis' ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <AlertCircle size={20} /> 分析・問題点
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          style={{ padding: '1rem 2rem', fontSize: '1.1rem', fontWeight: 'bold', background: 'none', border: 'none', borderBottom: activeTab === 'history' ? '3px solid var(--accent-primary)' : '3px solid transparent', color: activeTab === 'history' ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Calendar size={20} /> 日時指定
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>データを集計中...</div>
      ) : (
        <>
          {activeTab === 'progress' && (
            <div className="animate-fade-in">
              <h2 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', color: 'var(--text-secondary)' }}>KGI目標に対する進捗</h2>
              <div className="kgi-grid" style={{ marginBottom: '2rem' }}>
                <div className="stat-card glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981' }}>
                  <div className="stat-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                      <Briefcase size={20} style={{ color: '#10b981' }} />
                      <h3>受注（件）</h3>
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem', color: '#10b981' }}>
                    {totals.order} <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>/ {kgiTargets.order}件 <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>({orderProgress}%)</span></span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-primary)', borderRadius: '4px', marginTop: '1rem', overflow: 'hidden' }}>
                    <div style={{ width: `${orderProgress}%`, height: '100%', background: '#10b981' }} />
                  </div>
                </div>

                <div className="stat-card glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #3b82f6' }}>
                  <div className="stat-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                      <Users size={20} style={{ color: '#3b82f6' }} />
                      <h3>採用</h3>
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem', color: '#3b82f6' }}>
                    {totals.adopt} <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>/ {kgiTargets.adopt}件 <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>({adoptProgress}%)</span></span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-primary)', borderRadius: '4px', marginTop: '1rem', overflow: 'hidden' }}>
                    <div style={{ width: `${adoptProgress}%`, height: '100%', background: '#3b82f6' }} />
                  </div>
                </div>

                <div className="stat-card glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
                  <div className="stat-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                      <FileText size={20} style={{ color: '#f59e0b' }} />
                      <h3>訪問</h3>
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem', color: '#f59e0b' }}>
                    {totals.visit} <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>/ {kgiTargets.visit}件 <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>({visitProgress}%)</span></span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-primary)', borderRadius: '4px', marginTop: '1rem', overflow: 'hidden' }}>
                    <div style={{ width: `${visitProgress}%`, height: '100%', background: '#f59e0b' }} />
                  </div>
                </div>

                <div className="stat-card glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #8b5cf6' }}>
                  <div className="stat-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                      <TrendingUp size={20} style={{ color: '#8b5cf6' }} />
                      <h3>粗利 (P)</h3>
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem', color: '#8b5cf6' }}>
                    {totals.grossProfit.toLocaleString()} <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>/ {kgiTargets.grossProfit.toLocaleString()} P <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>({grossProfitProgress}%)</span></span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-primary)', borderRadius: '4px', marginTop: '1rem', overflow: 'hidden' }}>
                    <div style={{ width: `${grossProfitProgress}%`, height: '100%', background: '#8b5cf6' }} />
                  </div>
                </div>
              </div>

              <h2 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', color: 'var(--text-secondary)', marginTop: '2rem' }}>KPIサマリー</h2>
              <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
                <div className="stat-card glass-panel" style={{ padding: '1.5rem' }}>
                  <div className="stat-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <Target size={20} />
                    <h3>合計架電数</h3>
                  </div>
                  <div className="stat-value" style={{ fontSize: '2.5rem', fontWeight: 'bold', marginTop: '1rem' }}>
                    {totals.total.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>件</span>
                  </div>
                </div>
                
                <div className="stat-card glass-panel" style={{ padding: '1.5rem' }}>
                  <div className="stat-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <BarChart3 size={20} />
                    <h3>有効通話 / 担当者通話</h3>
                  </div>
                  <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem' }}>
                    {totals.actual.toLocaleString()} <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>/ {totals.owner.toLocaleString()}</span>
                  </div>
                </div>

                <div className="stat-card glass-panel" style={{ padding: '1.5rem' }}>
                  <div className="stat-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <TrendingUp size={20} />
                    <h3>見込数 / アポ数</h3>
                  </div>
                  <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem' }}>
                    {totals.prospect.toLocaleString()} <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>/ {totals.appoint.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="animate-fade-in">
              <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                <AlertCircle size={48} style={{ color: '#f59e0b', margin: '0 auto 1rem auto' }} />
                <h3>ボトルネックの特定・改善アクション</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
                  現在蓄積されたデータをもとに、AIによる分析結果や特定された問題点がここに表示されます。
                  <br />（※分析エンジンの統合後に詳細データが表示されます）
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
                  <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #fcd34d', flex: 1, maxWidth: '300px' }}>
                    <h4 style={{ color: '#d97706', marginBottom: '0.5rem' }}>現在のボトルネック</h4>
                    <p style={{ fontWeight: 'bold' }}>アポ率低下 (先週比 -2.1%)</p>
                  </div>
                  <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #6ee7b7', flex: 1, maxWidth: '300px' }}>
                    <h4 style={{ color: '#059669', marginBottom: '0.5rem' }}>推奨アクション</h4>
                    <p style={{ fontWeight: 'bold' }}>初期トークの切り返し強化研修</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="animate-fade-in">
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={18} /> データ一覧（期間指定）
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
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
                
                <div className="table-container">
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>日付</th>
                        <th>商材</th>
                        <th>採用数</th>
                        <th>訪問数</th>
                        <th>受注(件)</th>
                        <th>粗利(P)</th>
                        <th>架電数</th>
                        <th>有効通話</th>
                        <th>アポ数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSummaries.length === 0 ? (
                        <tr><td colSpan="8" style={{ textAlign: 'center' }}>指定期間のデータがありません</td></tr>
                      ) : (
                        filteredSummaries.map((s, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 'bold' }}>{formatDate(s.date)}</td>
                            <td>{products.find(p => p.productId === s.productId)?.productName || s.productId}</td>
                            <td>{s.dailySummary?.adopt || 0}</td>
                            <td>{s.dailySummary?.visit || 0}</td>
                            <td>{s.dailySummary?.order || 0}</td>
                            <td>{s.dailySummary?.grossProfit || 0}</td>
                            <td>{s.totals?.total || 0}</td>
                            <td>{s.totals?.actual || 0}</td>
                            <td>{s.totals?.appoint || 0}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
