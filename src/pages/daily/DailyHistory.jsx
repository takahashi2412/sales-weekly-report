import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { History, FileText, CheckCircle, Clock, Download } from 'lucide-react';
import { getVisibleUserIds } from '../../utils/teamUtils';
import { exportDailyReportsCsv } from '../../utils/csvExport';
import '../Dashboard.css';

export default function DailyHistory() {
  const { user, isManagerOrAbove } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [filterType, setFilterType] = useState('me'); // 'me' | 'team' | 'all'
  
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  const [startDate, setStartDate] = useState(
    `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`
  );
  const [endDate, setEndDate] = useState(
    `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
  );

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        let list = [];
        if (user.role === 'leader') {
          const visibleIds = await getVisibleUserIds(user);
          const promises = visibleIds.map(uid => getDocs(query(
            collection(db, 'dailyReports'),
            where('userId', '==', uid),
            where('date', '>=', startDate),
            where('date', '<=', endDate)
          )));
          const snaps = await Promise.all(promises);
          snaps.forEach(snap => snap.forEach(d => list.push({ id: d.id, ...d.data() })));
        } else {
          const q = query(
            collection(db, 'dailyReports'), 
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'desc')
          );
          const snap = await getDocs(q);
          snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        }

        if (user.role === 'leader') {
          list.sort((a, b) => b.date.localeCompare(a.date));
        }
        
        if (filterType === 'me' && user.role !== 'leader') {
          list = list.filter(r => r.userId === user.uid);
        } else if (filterType === 'me' && user.role === 'leader') {
          list = list.filter(r => r.userId === user.uid);
        }
        
        setReports(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [user, filterType, startDate, endDate, isManagerOrAbove]);

  const handleExportCsv = async () => {
    try {
      const [teamsSnap, productsSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'teams')),
        getDocs(collection(db, 'productMasters')),
        getDocs(collection(db, 'users'))
      ]);
      const teamsMap = {};
      teamsSnap.forEach(d => teamsMap[d.id] = d.data().name);
      const productsMap = {};
      productsSnap.forEach(d => productsMap[d.id] = d.data().name);
      const usersMap = {};
      usersSnap.forEach(d => usersMap[d.id] = d.data().name);
      
      const scopeLabel = filterType === 'me' ? '自分' : 'チーム';
      
      await exportDailyReportsCsv({
        reports,
        usersMap,
        teamsMap,
        productsMap,
        startDate,
        endDate,
        scopeLabel,
        user
      });
      alert('CSVを出力しました');
    } catch (e) {
      console.error(e);
      alert('CSV出力中にエラーが発生しました');
    }
  };

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>日報履歴 (D-03)</h1>
          <p>過去の日報提出履歴を確認します</p>
        </div>
        <button onClick={handleExportCsv} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Download size={18} /> CSV 出力
        </button>
      </div>

      <div className="filter-bar glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 'bold' }}>表示対象: </div>
        <select 
          value={filterType} 
          onChange={e => setFilterType(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', marginRight: '1rem' }}
        >
          <option value="me">自分の日報</option>
          {isManagerOrAbove && <option value="all">チーム/全社の日報</option>}
        </select>
        
        <div style={{ fontWeight: 'bold' }}>期間: </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input-field"
            style={{ width: 'auto' }}
          />
          <span>〜</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input-field"
            style={{ width: 'auto' }}
          />
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={20} /> 日報一覧
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>読み込み中...</div>
        ) : (
          <div className="table-container">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>提出日</th>
                  <th>提出者</th>
                  <th>内容プレビュー</th>
                  {/* <th>ステータス</th> */}
                  <th>アクション</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center' }}>日報データがありません</td></tr>
                ) : (
                  reports.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 'bold' }}>{r.date}</td>
                      <td>{r.userName}</td>
                      <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.content}
                      </td>
                      {/* <td>
                        {r.status === 'reviewed' ? (
                          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><CheckCircle size={14}/> 確認済</span>
                        ) : (
                          <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Clock size={14}/> 確認待ち</span>
                        )}
                      </td> */}
                      <td>
                        <Link to={`/daily/${r.id}`} className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
                          <FileText size={14} style={{ marginRight: '0.2rem' }}/> 詳細を見る
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
