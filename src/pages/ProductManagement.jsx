import { useState, useEffect } from 'react';
import { Package, Plus, Edit2, CheckCircle, XCircle } from 'lucide-react';
import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import './AccountManagement.css'; // Reuse styles

export default function ProductManagement() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  
  const defaultRates = {
    manager: { appointRate: 0, adoptionRate: 0, orderRate: 0, monthlyOrderTarget: 0 },
    pmgr:    { appointRate: 0, adoptionRate: 0, orderRate: 0, monthlyOrderTarget: 0 },
    smgr:    { appointRate: 0, adoptionRate: 0, orderRate: 0, monthlyOrderTarget: 0 },
    tl:      { appointRate: 0, adoptionRate: 0, orderRate: 0, monthlyOrderTarget: 0 },
    general: { appointRate: 0, adoptionRate: 0, orderRate: 0, monthlyOrderTarget: 0 },
  };

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    isActive: true,
    conversionRates: defaultRates
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

  const handleRateChange = (role, field, value) => {
    setFormData(prev => ({
      ...prev,
      conversionRates: {
        ...prev.conversionRates,
        [role]: {
          ...prev.conversionRates[role],
          [field]: parseFloat(value) || 0
        }
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // document ID is the product ID (e.g. 'visit')
      const docId = editingId || formData.id;
      const oldProduct = editingId ? products.find(p => p._id === docId) : null;
      
      await setDoc(doc(db, 'productMasters', docId), {
        id: docId,
        name: formData.name,
        description: formData.description,
        isActive: formData.isActive,
        conversionRates: formData.conversionRates,
        updatedAt: Date.now()
      }, { merge: true });

      await addDoc(collection(db, 'auditLogs'), {
        action: editingId ? 'productUpdate' : 'productCreate',
        executedBy: {
          uid: user.uid,
          email: user.email,
          name: user.name || '',
          role: user.role || ''
        },
        target: {
          type: 'product',
          id: docId,
          name: formData.name
        },
        changes: {
          before: oldProduct || null,
          after: formData
        },
        timestamp: serverTimestamp()
      });

      alert('商材情報を保存しました。');
      setFormData({ id: '', name: '', description: '', isActive: true, conversionRates: defaultRates });
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
      isActive: p.isActive !== false,
      conversionRates: p.conversionRates || defaultRates
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ id: '', name: '', description: '', isActive: true, conversionRates: defaultRates });
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
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                id="isActiveCheck"
              />
              <label htmlFor="isActiveCheck" style={{ margin: 0, cursor: 'pointer' }}>有効（一覧に表示する）</label>
            </div>

            <div className="form-group">
              <label>コンバージョン基準値設定 (KGI初期値)</label>
              <div style={{ overflowX: 'auto', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <table className="reports-table" style={{ minWidth: '600px', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>役職</th>
                      <th>アポ率 (例: 0.013)</th>
                      <th>採用率 (例: 0.4)</th>
                      <th>受注率 (例: 0.2)</th>
                      <th>月次目標受注数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['manager', 'pmgr', 'smgr', 'tl', 'general'].map(role => (
                      <tr key={role}>
                        <td style={{ fontWeight: 'bold' }}>{role}</td>
                        <td>
                          <input type="number" step="0.001" style={{ width: '80px', padding: '0.25rem' }} value={formData.conversionRates[role]?.appointRate ?? 0} onChange={e => handleRateChange(role, 'appointRate', e.target.value)} />
                        </td>
                        <td>
                          <input type="number" step="0.01" style={{ width: '80px', padding: '0.25rem' }} value={formData.conversionRates[role]?.adoptionRate ?? 0} onChange={e => handleRateChange(role, 'adoptionRate', e.target.value)} />
                        </td>
                        <td>
                          <input type="number" step="0.01" style={{ width: '80px', padding: '0.25rem' }} value={formData.conversionRates[role]?.orderRate ?? 0} onChange={e => handleRateChange(role, 'orderRate', e.target.value)} />
                        </td>
                        <td>
                          <input type="number" style={{ width: '80px', padding: '0.25rem' }} value={formData.conversionRates[role]?.monthlyOrderTarget ?? 0} onChange={e => handleRateChange(role, 'monthlyOrderTarget', e.target.value)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
