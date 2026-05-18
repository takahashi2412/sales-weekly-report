import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { Bell, CheckCircle, AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import '../Dashboard.css';

export default function Notifications() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = async () => {
    try {
      const q = query(
        collection(db, 'notifications'), 
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setNotifications(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      await updateDoc(doc(db, 'notifications', n.id), { read: true });
    }
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  // 開発テスト用のモックアラート生成機能
  const generateMockAlert = async () => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        type: 'alert',
        message: '【アラート】アポ獲得率が基準値を下回っています（閾値: 3.0%, 実績: 1.5%）',
        read: false,
        severity: 'high',
        createdAt: serverTimestamp()
      });
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        type: 'system',
        message: '【システム】昨日の実績CSVデータが取り込まれていません。',
        read: false,
        severity: 'medium',
        createdAt: serverTimestamp()
      });
      fetchNotifications();
      alert('テスト用のアラート通知を生成しました');
    } catch (e) {
      console.error(e);
    }
  };

  const getIcon = (type, severity) => {
    if (type === 'alert') {
      return severity === 'high' ? <AlertOctagon size={20} color="#ef4444" /> : <AlertTriangle size={20} color="#f59e0b" />;
    }
    if (type === 'system') return <Info size={20} color="#3b82f6" />;
    return <Bell size={20} color="#8b5cf6" />;
  };

  return (
    <div className="page-container" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>通知一覧 (C-03)</h1>
          <p>アラート・承認結果・システム通知の確認</p>
        </div>
        <button onClick={generateMockAlert} className="btn btn-secondary btn-sm" title="テスト用のアラートを生成します">
          テスト通知生成
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={20} /> 最新の通知
          </h2>
          {notifications.some(n => !n.read) && (
            <button onClick={markAllAsRead} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <CheckCircle size={14} /> すべて既読にする
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>読み込み中...</div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <Bell size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p>新しい通知はありません</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {notifications.map(n => (
              <div 
                key={n.id} 
                style={{ 
                  padding: '1.25rem', 
                  borderRadius: '8px', 
                  border: `1px solid ${n.read ? 'var(--border-color)' : (n.severity === 'high' ? '#fecaca' : '#bfdbfe')}`,
                  background: n.read ? 'transparent' : (n.severity === 'high' ? '#fef2f2' : '#eff6ff'),
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ marginTop: '0.2rem' }}>
                  {getIcon(n.type, n.severity)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : 'たった今'}
                    </span>
                    {!n.read && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: n.severity === 'high' ? '#ef4444' : '#3b82f6' }}>NEW</span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontWeight: n.read ? 'normal' : 'bold', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                    {n.message}
                  </p>
                </div>
                {!n.read && (
                  <button 
                    onClick={() => markAsRead(n.id)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                  >
                    既読
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
