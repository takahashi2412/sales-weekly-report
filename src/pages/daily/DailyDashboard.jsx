import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { FileEdit, ClipboardList, CheckCircle, Clock, XCircle, Users } from 'lucide-react';
import { getVisibleUserIds, getVisibleUsers } from '../../utils/teamUtils';
import '../Dashboard.css';

export default function DailyDashboard() {
  const { user, isManagerOrAbove } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [unsubmittedUsers, setUnsubmittedUsers] = useState([]);
  const [teamsMap, setTeamsMap] = useState({});
  const [productsMap, setProductsMap] = useState({});
  
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        let list = [];
        if (user.role === 'leader') {
          const visibleIds = await getVisibleUserIds(user);
          const promises = visibleIds.map(uid => getDocs(query(
            collection(db, 'dailyReports'),
            where('userId', '==', uid)
          )));
          const snaps = await Promise.all(promises);
          snaps.forEach(snap => snap.forEach(d => list.push({ id: d.id, ...d.data() })));
        } else {
          const q = query(collection(db, 'dailyReports'), orderBy('date', 'desc'), limit(50));
          const snap = await getDocs(q);
          snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        }
        
        if (user.role === 'leader') {
          list.sort((a, b) => b.date.localeCompare(a.date));
          list = list.slice(0, 10);
        }
        
        setReports(list);

        // Fetch unsubmitted users for today
        const visibleUsers = await getVisibleUsers(user);
        let submittedUserIds = new Set();
        if (user.role === 'leader') {
          const promises = visibleUsers.map(u => getDocs(query(
            collection(db, 'dailyReports'),
            where('userId', '==', u.id),
            where('date', '==', todayStr)
          )));
          const snaps = await Promise.all(promises);
          snaps.forEach(snap => {
            if (!snap.empty) submittedUserIds.add(snap.docs[0].data().userId);
          });
        } else {
          const q = query(collection(db, 'dailyReports'), where('date', '==', todayStr));
          const snap = await getDocs(q);
          snap.forEach(d => submittedUserIds.add(d.data().userId));
        }

        const unsubmitted = visibleUsers.filter(u => !submittedUserIds.has(u.id));
        setUnsubmittedUsers(unsubmitted);

        // Fetch teams and products for mapping
        if (unsubmitted.length > 0) {
          const teamsSnap = await getDocs(collection(db, 'teams'));
          const tMap = {};
          teamsSnap.forEach(d => tMap[d.id] = d.data().name);
          setTeamsMap(tMap);

          const productsSnap = await getDocs(collection(db, 'productMasters'));
          const pMap = {};
          productsSnap.forEach(d => pMap[d.id] = d.data().name);
          setProductsMap(pMap);
        }
        
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchRecent();
  }, [user, isManagerOrAbove]);

  const myTodayReport = reports.find(r => r.userId === user.uid && r.date === todayStr);
  const pendingReviews = isManagerOrAbove ? reports.filter(r => r.status === 'submitted') : [];

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>日報ダッシュボード (D-01)</h1>
        <p>日報の提出状況とサマリーを確認します</p>
      </div>

      <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card glass-panel" style={{ padding: '1.5rem' }}>
          <div className="stat-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileEdit size={20} />
            <h3>本日の日報</h3>
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            {myTodayReport ? (
              <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                <CheckCircle size={20} /> 提出済み
              </div>
            ) : (
              <div>
                <p style={{ color: '#ef4444', marginBottom: '1rem', fontWeight: 'bold' }}>未提出</p>
                <Link to="/daily/new" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileEdit size={16} /> 今すぐ作成する
                </Link>
              </div>
            )}
          </div>
        </div>

        {false && isManagerOrAbove && (
          <div className="stat-card glass-panel" style={{ padding: '1.5rem', borderLeft: pendingReviews.length > 0 ? '4px solid #f59e0b' : '4px solid var(--border-color)' }}>
            <div className="stat-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={20} />
              <h3>未確認の日報 (チーム)</h3>
            </div>
            <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem', color: pendingReviews.length > 0 ? '#f59e0b' : 'inherit' }}>
              {pendingReviews.length} <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>件</span>
            </div>
            {/* {pendingReviews.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <Link to="/daily/pending" className="btn btn-secondary btn-sm">確認待ち一覧へ</Link>
              </div>
            )} */}
          </div>
        )}
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <Users size={20} /> 本日の日報未提出者一覧
        </h2>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '1rem' }}>読み込み中...</div>
        ) : unsubmittedUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: '#10b981', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={32} />
            <p style={{ fontWeight: 'bold' }}>本日の日報未提出者はいません</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>ユーザー名</th>
                  <th>所属チーム</th>
                  <th>担当商材</th>
                </tr>
              </thead>
              <tbody>
                {unsubmittedUsers.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 'bold', color: '#ef4444' }}>{u.name}</td>
                    <td>{teamsMap[u.teamId] || u.teamId || '-'}</td>
                    <td>{productsMap[u.currentProductId] || u.currentProductId || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={20} /> 直近の日報
          </h2>
          <Link to="/daily/history" className="btn btn-secondary btn-sm">すべて見る</Link>
        </div>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>読み込み中...</div>
        ) : (
          <div className="table-container">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>提出日</th>
                  <th>提出者</th>
                  <th>内容プレビュー</th>
                  {/* <th>ステータス</th> */}
                </tr>
              </thead>
              <tbody>
                {reports.slice(0, 5).map(r => (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td>{r.userName}</td>
                    <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <Link to={`/daily/${r.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>{r.content}</Link>
                    </td>
                    {/* <td>
                      {r.status === 'reviewed' ? <span style={{ color: '#10b981' }}>確認済</span> : <span style={{ color: '#f59e0b' }}>確認待ち</span>}
                    </td> */}
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr><td colSpan="3" style={{ textAlign: 'center' }}>日報データがありません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
