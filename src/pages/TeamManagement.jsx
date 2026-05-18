import { useState, useEffect } from 'react';
import { Network, Plus, Trash2, Edit2, X } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function TeamManagement() {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [activeTab, setActiveTab] = useState('tree'); // 'tree' or 'history'

  const [formData, setFormData] = useState({
    id: '', // Custom ID like 'team_sales1'
    name: '', // e.g. '第一営業部'
    parentId: 'root', // root means top level
    managerId: '' // reference to a user uid
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const uList = [];
      usersSnap.forEach(d => uList.push({ id: d.id, ...d.data() }));
      setUsers(uList);

      const teamsSnap = await getDocs(collection(db, 'teams'));
      const tList = [];
      teamsSnap.forEach(d => tList.push({ id: d.id, ...d.data() }));
      setTeams(tList);

      const assignSnap = await getDocs(collection(db, 'userProductAssignments'));
      const aList = [];
      assignSnap.forEach(d => aList.push({ id: d.id, ...d.data() }));
      setAssignments(aList.sort((a, b) => b.assignedAt - a.assignedAt));

      const prodSnap = await getDocs(collection(db, 'productMasters'));
      const pList = [];
      prodSnap.forEach(d => pList.push({ id: d.id, ...d.data() }));
      setProducts(pList);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEdit = (team) => {
    setEditingTeamId(team.id);
    setFormData({
      id: team.id,
      name: team.name,
      parentId: team.parentId || 'root',
      managerId: team.managerId || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingTeamId(null);
    setFormData({ id: '', name: '', parentId: 'root', managerId: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingTeamId === formData.parentId) {
      alert('エラー: 自分自身を親組織に指定することはできません。');
      return;
    }

    setLoading(true);
    try {
      if (editingTeamId) {
        // Update existing team
        await updateDoc(doc(db, 'teams', editingTeamId), {
          name: formData.name,
          parentId: formData.parentId,
          managerId: formData.managerId
        });
        alert('組織情報を更新しました！');
        cancelEdit();
      } else {
        // Create new team
        const teamId = formData.id.trim() || `team_${Date.now()}`;
        await setDoc(doc(db, 'teams', teamId), {
          name: formData.name,
          parentId: formData.parentId,
          managerId: formData.managerId,
          createdAt: Date.now()
        });
        alert('組織を追加しました！');
        setFormData({ id: '', name: '', parentId: 'root', managerId: '' });
      }
      
      await fetchData();
    } catch (error) {
      console.error("Error saving team:", error);
      alert('保存に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('本当にこのチームを削除しますか？\n（※下層チームがある場合は不具合の原因になるため、先に下層チームの親を変更してください）')) return;
    
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'teams', id));
      await fetchData();
    } catch (error) {
      console.error("Error deleting team:", error);
    } finally {
      setLoading(false);
    }
  };

  // Build tree structure for display
  const buildTree = (parentId, level = 0) => {
    const children = teams.filter(t => t.parentId === parentId);
    if (children.length === 0) return null;

    return (
      <div style={{ marginLeft: level > 0 ? '2rem' : '0', borderLeft: level > 0 ? '2px solid var(--border-color)' : 'none', paddingLeft: level > 0 ? '1rem' : '0' }}>
        {children.map(team => {
          const manager = users.find(u => u.id === team.managerId);
          return (
            <div key={team.id} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{team.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    責任者: {manager ? `${manager.name} (${manager.title})` : '未設定'} | ID: {team.id}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={() => handleEdit(team)} 
                    className="btn btn-secondary btn-sm" 
                    style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    title="組織を編集"
                  >
                    <Edit2 size={16} /> 編集
                  </button>
                  <button 
                    onClick={() => handleDelete(team.id)} 
                    className="btn btn-secondary btn-sm" 
                    style={{ padding: '0.5rem', color: 'red' }}
                    title="組織を削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {buildTree(team.id, level + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="account-management">
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div>
          <h1>チーム・組織管理 (S-02)</h1>
          <p>システム管理者専用: 会社の組織図と商材変更履歴を管理します</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <button 
          onClick={() => setActiveTab('tree')} 
          style={{ 
            padding: '0.5rem 1rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'tree' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeTab === 'tree' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'tree' ? 'bold' : 'normal',
            cursor: 'pointer'
          }}
        >
          組織ツリー管理
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          style={{ 
            padding: '0.5rem 1rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'history' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeTab === 'history' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'history' ? 'bold' : 'normal',
            cursor: 'pointer'
          }}
        >
          商材変更履歴
        </button>
      </div>

      {activeTab === 'tree' ? (
        <div className="content-grid">
          <div className="glass-panel form-section">
          <div className="section-header">
            <h2>
              {editingTeamId ? <Edit2 size={20} /> : <Plus size={20} />} 
              {editingTeamId ? '組織情報の編集' : '新規チームの追加'}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="account-form">
            <div className="form-group">
              <label>組織・チーム名</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="例: 東京本社 第一営業部" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>親組織（上位部署）</label>
                <select name="parentId" value={formData.parentId} onChange={handleChange}>
                  <option value="root">-- 最上位（親なし） --</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>責任者（マネージャー）</label>
                <select name="managerId" value={formData.managerId} onChange={handleChange}>
                  <option value="">-- 指定なし --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.title})</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
                {loading ? '処理中...' : (editingTeamId ? '更新する' : 'チームを追加する')}
              </button>
              {editingTeamId && (
                <button type="button" onClick={cancelEdit} className="btn btn-secondary" style={{ flex: 1 }}>
                  キャンセル
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="glass-panel list-section">
          <div className="section-header">
            <h2><Network size={20} /> 組織ツリー構造</h2>
          </div>
          <div style={{ padding: '1rem 0' }}>
            {loading ? <p>読み込み中...</p> : (teams.length > 0 ? buildTree('root') : <p>まだ組織が登録されていません。</p>)}
          </div>
        </div>
      </div>
      ) : (
      <div className="glass-panel" style={{ width: '100%' }}>
        <div className="section-header">
          <h2>商材変更履歴</h2>
        </div>
        <div className="table-container">
          <table className="reports-table">
            <thead>
              <tr>
                <th>変更日時</th>
                <th>対象メンバー</th>
                <th>割り当て商材</th>
                <th>変更者</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '1rem' }}>
                    {loading ? '読み込み中...' : '履歴はありません'}
                  </td>
                </tr>
              ) : (
                assignments.map(a => {
                  const targetUser = users.find(u => u.id === a.userId);
                  const assigner = users.find(u => u.id === a.assignedBy);
                  const product = products.find(p => p.id === a.productId);
                  return (
                    <tr key={a.id}>
                      <td>{new Date(a.assignedAt).toLocaleString('ja-JP')}</td>
                      <td style={{ fontWeight: 'bold' }}>{targetUser ? targetUser.name : '不明なユーザー'}</td>
                      <td>
                        <span className="status-badge" style={{ background: 'var(--accent-primary)', color: 'white' }}>
                          {product ? product.name : a.productId}
                        </span>
                      </td>
                      <td>{assigner ? assigner.name : '不明な管理者'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
