import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronRight, Plus, Calendar, Edit } from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

export default function TrainingDetail() {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [records, setRecords] = useState([]);

  useEffect(() => {
    const fetchMemberData = async () => {
      try {
        setLoading(true);
        // Fetch member info
        const userDoc = await getDoc(doc(db, 'users', memberId));
        if (userDoc.exists()) {
          setMember({ id: userDoc.id, ...userDoc.data() });
        } else {
          alert('メンバーが見つかりません');
          navigate('/training');
          return;
        }

        // Fetch their training records managed by this user
        const q = query(
          collection(db, 'training_records'),
          where('memberId', '==', memberId),
          where('managerId', '==', user.uid)
        );
        const querySnapshot = await getDocs(q);
        const recs = [];
        querySnapshot.forEach(doc => recs.push({ id: doc.id, ...doc.data() }));
        
        // Sort descending by date
        recs.sort((a, b) => b.date.localeCompare(a.date));
        setRecords(recs);

      } catch (error) {
        console.error("Error fetching member data:", error);
      } finally {
        setLoading(false);
      }
    };
    if (memberId) fetchMemberData();
  }, [memberId, user, navigate]);

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center' }}>読み込み中...</div>;
  if (!member) return null;

  return (
    <div className="training-detail-page">
      {/* Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        <Link to="/training" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }} className="hover-underline">メンバー育成</Link>
        <ChevronRight size={16} />
        <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{member.name}</span>
      </div>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1>{member.name} の教育進捗</h1>
          <p>{member.title || '役職未設定'} / 過去の記録数: {records.length}回</p>
        </div>
        <button 
          onClick={() => navigate(`/training/${member.id}/record/new`)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #FF0642, #E8002E)' }}
        >
          <Plus size={18} /> 新規記録を追加
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={20} color="var(--accent-primary)" /> タイムライン
        </h2>

        {records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
            まだ教育記録がありません。右上の「新規記録を追加」から記録を作成してください。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {records.map(record => (
              <div 
                key={record.id} 
                className="record-card hover-lift"
                onClick={() => navigate(`/training/${member.id}/record/${record.date}`)}
                style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  padding: '1.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', 
                  borderRadius: '8px', cursor: 'pointer' 
                }}
              >
                <div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{record.date}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                    {record.trainingType}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {record.step1 || '詳細データなし'}
                  </div>
                </div>
                <div style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Edit size={16} /> 詳細・編集
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
