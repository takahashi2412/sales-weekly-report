import { useState, useEffect } from 'react';
import { Package, Plus, Edit2, CheckCircle, XCircle } from 'lucide-react';
import { db } from '../firebase';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import './AccountManagement.css'; // Reuse styles

export default function ProductManagement() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    isActive: true
  });

  const fetchData = async () => {
    try {
      const snap = await getDocs(collection(db, 'productMasters'));
      const list = [];
      snap.forEach(d => list.push({ _id: d.id, ...d.data() }));
      setProducts(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // document ID is the product ID (e.g. 'visit')
      const docId = editingId || formData.id;
      await setDoc(doc(db, 'productMasters', docId), {
        id: docId,
        name: formData.name,
        description: formData.description,
        isActive: formData.isActive,
        updatedAt: Date.now()
      }, { merge: true });

      alert('商材情報を保存しました。');
      setFormData({ id: '', name: '', description: '', isActive: true });
      setEditingId(null);
      await fetchData();
    } catch (error) {
      console.error(error);
      alert('保存に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (p) => {
    setEditingId(p._id);
    setFormData({
      id: p._id,
      name: p.name || '',
      description: p.description || '',
      isActive: p.isActive !== false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ id: '', name: '', description: '', isActive: true });
  };

  return (
    <div className="account-management">
      <div className="page-header">
        <div>
          <h1>商材マスタ管理 (S-06)</h1>
          <p>システム管理者専用: 取り扱い商材の設定と管理を行います</p>
        </div>
      </div>

      <div className="content-grid">
        <div className="glass-panel form-section">
          <div className="section-header">
            <h2>
              {editingId ? <Edit2 size={20} /> : <Plus size={20} />}
              {editingId ? '商材情報の編集' : '新規商材の登録'}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="account-form">
            <div className="form-group">
              <label>商材ID (半角英数・作成後の変更不可)</label>
              <input
                type="text"
                name="id"
                value={formData.id}
                onChange={handleChange}
                required
                disabled={!!editingId}
                placeholder="例: visit"
              />
            </div>
            <div className="form-group">
              <label>商材名</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="例: HP（訪問）"
              />
            </div>
            <div className="form-group">
              <label>説明・備考</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                id="isActiveCheck"
              />
              <label htmlFor="isActiveCheck" style={{ margin: 0, cursor: 'pointer' }}>有効（一覧に表示する）</label>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
                {loading ? '処理中...' : (editingId ? '更新する' : '登録する')}
              </button>
              {editingId && (
                <button type="button" onClick={cancelEdit} className="btn btn-secondary" style={{ flex: 1 }}>
                  キャンセル
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="glass-panel list-section">
          <div className="section-header">
            <h2><Package size={20} /> 登録済み商材一覧</h2>
          </div>
          <div className="table-container">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>商材ID</th>
                  <th>商材名</th>
                  <th>ステータス</th>
                  <th>アクション</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '1rem' }}>
                      {loading ? '読み込み中...' : '登録されている商材はありません'}
                    </td>
                  </tr>
                ) : (
                  products.map(p => (
                    <tr key={p._id} style={editingId === p._id ? { background: 'var(--bg-secondary)' } : {}}>
                      <td style={{ fontFamily: 'monospace' }}>{p._id}</td>
                      <td style={{ fontWeight: 'bold' }}>{p.name}</td>
                      <td>
                        {p.isActive !== false ? (
                          <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle size={14} /> 有効
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <XCircle size={14} /> 無効
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleEdit(p)}
                          style={{ padding: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <Edit2 size={14} /> 編集
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
