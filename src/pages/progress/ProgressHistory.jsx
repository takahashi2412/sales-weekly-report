import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { History } from 'lucide-react';
import '../Dashboard.css';

export default function ProgressHistory() {
  const { user, isManagerOrAbove } = useAuth();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        let q;
        if (user.role === 'leader') {
          q = query(collection(db, 'kpiTargets'), where('userId', '==', user.uid));
        } else {
          q = query(collection(db, 'kpiTargets'), orderBy('targetMonth', 'desc'), limit(50));
        }
        const snap = await getDocs(q);
        let list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        
        if (user.role === 'leader') {
          list.sort((a, b) => b.targetMonth.localeCompare(a.targetMonth));
          list = list.slice(0, 20);
        }
        
        setHistory(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [user, isManagerOrAbove]);

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>進捗履歴 (P-03)</h1>
        <p>過去の月次目標と進捗結果の履歴</p>
      </div>
      
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <History size={20} /> 月次進捗履歴
        </h2>
        
        {loading ? (
          <div style={{ textAlign: 'center' }}>読み込み中...</div>
        ) : (
          <div className="table-container">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>対象月</th>
                  <th>ユーザー</th>
                  <th>対象商材</th>
                  <th>ステータス</th>
                  <th>月間目標アポ数</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center' }}>履歴データがありません</td></tr>
                ) : (
                  history.map((h, i) => (
                    <tr key={i}>
                      <td>{h.targetMonth}</td>
                      <td>{h.userName}</td>
                      <td>{h.productId}</td>
                      <td>
                        {h.status === 'approved' ? <span style={{ color: '#10b981' }}>承認済 (有効)</span> :
                         h.status === 'pending' ? <span style={{ color: '#f59e0b' }}>承認待ち</span> : 
                         <span style={{ color: '#ef4444' }}>却下</span>}
                      </td>
                      <td>{h.monthlyOrderTarget || '-'}</td>
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
