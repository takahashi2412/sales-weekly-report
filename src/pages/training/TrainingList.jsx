import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Users, ChevronRight, Activity } from 'lucide-react';
import { db } from '../../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

export default function TrainingList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subordinates, setSubordinates] = useState([]);
  const [recordsStats, setRecordsStats] = useState({});

  useEffect(() => {
    const fetchBaseData = async () => {
      try {
        setLoading(true);
        // Fetch teams
        const teamsSnap = await getDocs(collection(db, 'teams'));
        const tList = [];
        teamsSnap.forEach(d => tList.push({ id: d.id, ...d.data() }));

        // Fetch users
        const usersSnap = await getDocs(collection(db, 'users'));
        const uList = [];
        usersSnap.forEach(d => uList.push({ id: d.id, ...d.data() }));

        // Filter subordinates based on RBAC
        let visibleUsers = [];
        if (user?.roleGroup === 'executive') {
          visibleUsers = uList;
        } else if (user?.roleGroup === 'manager') {
          const managedTeamIds = new Set();
          
          const findChildren = (parentId) => {
            const children = tList.filter(t => t.parentId === parentId);
            children.forEach(child => {
              managedTeamIds.add(child.id);
              findChildren(child.id);
            });
          };

          const directManagedTeams = tList.filter(t => t.managerId === user.uid);
          directManagedTeams.forEach(t => {
            managedTeamIds.add(t.id);
            findChildren(t.id);
          });

          visibleUsers = uList.filter(u => managedTeamIds.has(u.teamId));
        }
        
        setSubordinates(visibleUsers);

        // Fetch all training records for these users
        if (visibleUsers.length > 0) {
          const q = query(collection(db, 'training_records'), where('managerId', '==', user.uid));
          const recSnap = await getDocs(q);
          const stats = {};
          
          recSnap.forEach(doc => {
            const data = doc.data();
            const mId = data.memberId;
            if (!stats[mId]) {
              stats[mId] = { latestDate: data.date, count: 1, latestType: data.trainingType };
            } else {
              stats[mId].count += 1;
              if (data.date > stats[mId].latestDate) {
                stats[mId].latestDate = data.date;
                stats[mId].latestType = data.trainingType;
              }
            }
          });
          setRecordsStats(stats);
        }

      } catch (error) {
        console.error("Error fetching base data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBaseData();
  }, [user]);

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center' }}>読み込み中...</div>;

  return (
    <div className="training-list-page">
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1><Target size={28} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'bottom' }} />メンバー育成</h1>
          <p>育成対象のメンバーを選択してください</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {subordinates.length === 0 ? (
          <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            配下に育成対象のメンバーがいません。
          </div>
        ) : (
          subordinates.map(member => {
            const stat = recordsStats[member.id] || null;
            return (
              <div 
                key={member.id} 
                className="glass-panel hover-lift"
                onClick={() => navigate(`/training/${member.id}`)}
                style={{ cursor: 'pointer', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{member.title || '役職未設定'}</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{member.name}</div>
                  </div>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(232, 0, 46, 0.1)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={20} />
                  </div>
                </div>

                <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>記録回数</span>
                    <span style={{ fontWeight: 'bold' }}>{stat ? stat.count : 0} 回</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>最終更新日</span>
                    <span style={{ fontWeight: 'bold' }}>{stat ? stat.latestDate : '未記録'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', color: 'var(--accent-primary)', fontWeight: 'bold', fontSize: '0.875rem', alignItems: 'center' }}>
                  詳細を見る <ChevronRight size={16} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
