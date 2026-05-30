import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, FileSpreadsheet, Edit } from 'lucide-react';
import { exportToPPTX, exportToCSV } from '../../utils/exportUtils';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

export default function HistoryList() {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        let q;
        if (user.role === 'leader') {
          q = query(collection(db, 'reports'), where('userId', '==', user.uid));
        } else {
          q = query(collection(db, 'reports'), orderBy('date', 'desc'), limit(50));
        }
        const querySnapshot = await getDocs(q);

        let list = [];
        querySnapshot.forEach(d => list.push({ id: d.id, ...d.data() }));

        if (user.role === 'leader') {
          list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        }
        
        setHistoryData(list);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  if (loading) {
    return <div style={{padding: '3rem', textAlign: 'center'}}>データを読み込み中...</div>;
  }

  return (
    <div className="my-history">
      <div className="page-header">
        <div>
          <h1>過去の提出履歴</h1>
          <p>これまでに提出した週次報告の一覧</p>
        </div>
      </div>

      <div className="reports-section glass-panel" style={{ marginTop: '2rem' }}>
        <div className="section-header">
          <h2><FileText size={20} /> マイヒストリー</h2>
        </div>
        
        <div className="table-container">
          <table className="reports-table">
            <thead>
              <tr>
                <th>対象週</th>
                <th>目標売上</th>
                <th>実績売上</th>
                <th>提出日</th>
                <th>アクション</th>
              </tr>
            </thead>
            <tbody>
              {historyData.length === 0 ? (
                <tr><td colSpan="5" style={{textAlign: 'center', padding: '2rem'}}>まだ保存された報告履歴がありません。「報告入力」から保存してください。</td></tr>
              ) : historyData.map(report => (
                <tr key={report.id}>
                  <td>{report.week}</td>
                  <td>{report.formData.kpiWeekly_grossTarget || '-'} P</td>
                  <td>{report.formData.weeklyGrossProfit || '-'} P</td>
                  <td>{report.date}</td>
                  <td>
                    <div style={{display: 'flex', gap: '0.5rem'}}>
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/history/${report.id}`)} style={{background: 'var(--accent-primary)', color: 'white', border: 'none'}}>
                        <Edit size={14} style={{marginRight: '0.25rem'}} /> 詳細・編集
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => exportToPPTX(report.formData)} style={{background: '#f97316', color: 'white', border: 'none'}}>
                        <Download size={14} style={{marginRight: '0.25rem'}} /> PPTX
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => exportToCSV(report.formData)} style={{background: '#10b981', color: 'white', border: 'none'}}>
                        <FileSpreadsheet size={14} style={{marginRight: '0.25rem'}} /> CSV
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
