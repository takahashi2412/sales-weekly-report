import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc, getDocs, collection, addDoc, serverTimestamp, writeBatch, query, where } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Save, Clock, ChevronDown, ChevronUp, Info, UploadCloud, CheckCircle, Plus, Trash2 } from 'lucide-react';

import { getVisibleUsers } from '../../utils/teamUtils';
import './DailyKpiInput.css';

const KPI_KEYS = [
  { key: 'total', label: '架電数' },
  { key: 'actual', label: '有効通話' },
  { key: 'recall', label: '再コール' },
  { key: 'owner', label: '担当者通話' },
  { key: 'prospect', label: '見込数' },
  { key: 'appoint', label: 'アポ数' }
];

const HOUR_LABELS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export default function DailyKpiInput() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [productId, setProductId] = useState('');
  const [targetUserId, setTargetUserId] = useState(user.uid);

  const [dailySummary, setDailySummary] = useState({
    adopt: 0,
    visit: 0,
    order: 0,
    workHours: 0
  });

  const [isHourlyOpen, setIsHourlyOpen] = useState(false);
  const [isCsvImported, setIsCsvImported] = useState(false);
  const [ordersList, setOrdersList] = useState([]);

  const [detailData, setDetailData] = useState(() => {
    const init = {};
    HOUR_LABELS.forEach(h => {
      init[h] = { total: 0, actual: 0, recall: 0, owner: 0, prospect: 0, appoint: 0 };
    });
    return init;
  });

  useEffect(() => {
    const fetchInitialMeta = async () => {
      const snap = await getDocs(collection(db, 'productMasters'));
      const list = [];
      snap.forEach(d => {
        if (d.data().isActive !== false) {
          list.push(d.data());
        }
      });
      setProducts(list);
      if (user?.currentProductId) {
        setProductId(user.currentProductId);
      } else if (list.length > 0) {
        setProductId(list[0].productId);
      }

      const visible = await getVisibleUsers(user);
      setTeamMembers(visible);
    };
    fetchInitialMeta();
  }, [user]);

  // Fetch past data when date, productId or targetUserId changes
  useEffect(() => {
    const fetchPastData = async () => {
      if (!productId || !date || !targetUserId) return;
      const docId = `${targetUserId}_${productId}_${date}`;
      const docRef = doc(db, 'dailyKpi', docId);
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          
          if (data.dailySummary) {
            setDailySummary({
              adopt: data.dailySummary.adopt || 0,
              visit: data.dailySummary.visit || 0,
              order: data.dailySummary.order || 0,
              workHours: data.dailySummary.workHours || 0
            });
          } else {
            setDailySummary({ adopt: 0, visit: 0, order: 0, workHours: 0 });
          }

          const init = {};
          HOUR_LABELS.forEach(h => {
             init[h] = { total: 0, actual: 0, recall: 0, owner: 0, prospect: 0, appoint: 0 };
          });
          if (data.hourlyData && Array.isArray(data.hourlyData)) {
            let hasData = false;
            data.hourlyData.forEach(hd => {
              if (HOUR_LABELS.includes(hd.hour)) {
                init[hd.hour] = {
                  total: hd.total || 0,
                  actual: hd.actual || 0,
                  recall: hd.recall || 0,
                  owner: hd.owner || 0,
                  prospect: hd.prospect || 0,
                  appoint: hd.appoint || 0
                };
                // 1件でも値が入っていれば取込済み扱い
                if (hd.total || hd.actual || hd.recall || hd.owner || hd.prospect || hd.appoint) {
                  hasData = true;
                }
              }
            });
            setIsCsvImported(hasData);
          } else {
            setIsCsvImported(false);
          }
          setDetailData(init);
        } else {
          // Reset to 0 if no data
          const init = {};
          HOUR_LABELS.forEach(h => {
            init[h] = { total: 0, actual: 0, recall: 0, owner: 0, prospect: 0, appoint: 0 };
          });
          setDetailData(init);
          setDailySummary({ adopt: 0, visit: 0, order: 0, workHours: 0 });
          setIsCsvImported(false);
        }

        // Fetch orders for this date
        const ordersQ = query(
          collection(db, 'orders'),
          where('userId', '==', targetUserId),
          where('productId', '==', productId),
          where('orderDate', '==', date)
        );
        const ordersSnap = await getDocs(ordersQ);
        const fetchedOrders = [];
        ordersSnap.forEach(d => {
          fetchedOrders.push({ id: d.id, ...d.data() });
        });
        setOrdersList(fetchedOrders);

      } catch (e) {
        console.error("Error fetching past data:", e);
      }
    };
    fetchPastData();
  }, [productId, date, targetUserId]);

  const handleDetailChange = (hour, key, val) => {
    setDetailData(prev => ({
      ...prev,
      [hour]: {
        ...prev[hour],
        [key]: parseInt(val, 10) || 0
      }
    }));
  };

  const handleSummaryChange = (key, val) => {
    setDailySummary(prev => ({
      ...prev,
      [key]: key === 'workHours' ? (parseFloat(val) || 0) : (parseInt(val, 10) || 0)
    }));
  };

  const handleCsvImportMock = () => {
    alert("一括読込機能は準備中です。");
    setIsCsvImported(true);
  };

  const handleAddOrder = () => {
    setOrdersList(prev => [...prev, { _tempId: Date.now(), grossProfitPoint: 0 }]);
  };

  const handleRemoveOrder = (idx) => {
    setOrdersList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleOrderChange = (idx, val) => {
    setOrdersList(prev => {
      const copy = [...prev];
      copy[idx].grossProfitPoint = parseInt(val, 10) || 0;
      return copy;
    });
  };

  const handleSave = async () => {
    if (!productId || !date || !targetUserId) {
      alert('必須項目を選択してください。');
      return;
    }

    setLoading(true);
    try {
      let totalsToSave = { total: 0, actual: 0, recall: 0, owner: 0, prospect: 0, appoint: 0 };

      const hourlyDataToSave = HOUR_LABELS.map(h => ({
        hour: h,
        ...detailData[h]
      }));
      
      for (const k of KPI_KEYS.map(k => k.key)) {
        totalsToSave[k] = hourlyDataToSave.reduce((sum, h) => sum + (h[k] || 0), 0);
      }

      // Batch for orders
      const batch = writeBatch(db);
      
      const ordersQ = query(
        collection(db, 'orders'),
        where('userId', '==', targetUserId),
        where('productId', '==', productId),
        where('orderDate', '==', date)
      );
      const existingSnap = await getDocs(ordersQ);
      const existingIds = existingSnap.docs.map(d => d.id);
      const currentIds = ordersList.filter(o => o.id).map(o => o.id);
      
      // Delete removed orders
      existingIds.forEach(id => {
        if (!currentIds.includes(id)) {
          batch.delete(doc(db, 'orders', id));
        }
      });
      
      // Add/Update orders
      ordersList.forEach(o => {
        const ref = o.id ? doc(db, 'orders', o.id) : doc(collection(db, 'orders'));
        batch.set(ref, {
          userId: targetUserId,
          productId: productId,
          orderDate: date,
          grossProfitPoint: Number(o.grossProfitPoint) || 0,
          status: o.status || 'provisional',
          updatedAt: serverTimestamp(),
          createdAt: o.createdAt || serverTimestamp()
        }, { merge: true });
      });

      // Update order count in dailySummary
      const orderCount = ordersList.length;
      const updatedDailySummary = { ...dailySummary, order: orderCount };

      const docId = `${targetUserId}_${productId}_${date}`;
      batch.set(doc(db, 'dailyKpi', docId), {
        userId: targetUserId,
        date: date, 
        productId,
        productVersion: 1,
        source: 'manual',
        hourlyData: hourlyDataToSave,
        totals: totalsToSave,
        dailySummary: updatedDailySummary,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      await batch.commit();

      await addDoc(collection(db, 'auditLogs'), {
        action: 'manualKpiInput',
        executedBy: {
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.name || '',
          role: user.role || ''
        },
        target: {
          type: 'kpi',
          id: docId,
          name: `手動KPI入力 (${date})`
        },
        changes: {
          before: null,
          after: { totals: totalsToSave, dailySummary: updatedDailySummary, ordersCount: orderCount }
        },
        timestamp: serverTimestamp()
      });

      alert('日次KPIを保存しました。');
    } catch (e) {
      console.error(e);
      alert('保存に失敗しました: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>日報・KPI日次入力 (K-02)</h1>
        <p>行動データおよびサマリーを入力してください（過去のデータを選択すると自動で表示され、修正が可能です）</p>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          
          {(user.role === 'executive' || user.role === 'manager') && teamMembers.length > 0 && (
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontWeight: 'bold' }}>対象メンバー</label>
              <select 
                value={targetUserId} 
                onChange={e => setTargetUserId(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
              >
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}

          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontWeight: 'bold' }}>対象日</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontWeight: 'bold' }}>対象商材</label>
            <select 
              value={productId} 
              onChange={e => setProductId(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            >
              {products.map(p => <option key={p.productId} value={p.productId}>{p.productName}</option>)}
            </select>
          </div>
        </div>

        {/* Daily Summary Section */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>サマリー入力</h2>
          <div className="summary-grid">
            <div className="form-group">
              <label style={{ fontWeight: 'bold' }}>採用数</label>
              <input 
                type="number" 
                min="0"
                value={dailySummary.adopt}
                onChange={e => handleSummaryChange('adopt', e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '1.1rem' }}
              />
            </div>
            <div className="form-group">
              <label style={{ fontWeight: 'bold' }}>訪問数</label>
              <input 
                type="number" 
                min="0"
                value={dailySummary.visit}
                onChange={e => handleSummaryChange('visit', e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '1.1rem' }}
              />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 'bold' }}>稼働時間</label>
              <input 
                type="number" 
                min="0"
                step="0.5"
                value={dailySummary.workHours}
                onChange={e => handleSummaryChange('workHours', e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '1.1rem' }}
              />
            </div>
          </div>
        </div>

        {/* Orders Details Section */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>受注明細</h2>
            <button type="button" onClick={handleAddOrder} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Plus size={16} /> 受注を追加
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {ordersList.map((order, idx) => (
              <div key={order.id || order._tempId} style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: 'bold', minWidth: '40px' }}>#{idx + 1}</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <label style={{ fontWeight: 'bold' }}>粗利 P</label>
                  <input 
                    type="number" 
                    min="0"
                    value={order.grossProfitPoint || 0}
                    onChange={e => handleOrderChange(idx, e.target.value)}
                    style={{ width: '150px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <button type="button" onClick={() => handleRemoveOrder(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem' }}>
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
            {ordersList.length === 0 && (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>受注はありません</div>
            )}
            <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '0.5rem' }}>
              本日: {ordersList.length} 件 / {ordersList.reduce((sum, o) => sum + (Number(o.grossProfitPoint) || 0), 0).toLocaleString()} P
            </div>
          </div>
        </div>

        {/* Hourly Collapsible Section */}
        <div style={{ marginBottom: '2rem', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
          <div 
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-secondary)', cursor: 'pointer' }}
            onClick={() => setIsHourlyOpen(!isHourlyOpen)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>時間帯別入力</span>
              <ChevronDown size={20} style={{ transform: isHourlyOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }} onClick={e => e.stopPropagation()}>
              {isCsvImported && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#d1fae5', color: '#065f46', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  <CheckCircle size={14} /> CSV取込済み
                </span>
              )}
              <button 
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCsvImportMock}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem' }}
              >
                <UploadCloud size={16} /> CSV一括読込
              </button>
            </div>
          </div>

          <div 
            className="detail-input-wrapper" 
            style={{ 
              maxHeight: isHourlyOpen ? '1000px' : '0', 
              opacity: isHourlyOpen ? 1 : 0,
              overflow: 'hidden', 
              transition: 'all 0.3s ease-in-out' 
            }}
          >
            <div className="detail-input" style={{ overflowX: 'auto', padding: '1rem', background: '#fff' }}>
              <table className="reports-table" style={{ minWidth: '800px', margin: 0 }}>
                <thead>
                  <tr>
                    <th>時間帯</th>
                    {KPI_KEYS.map(k => <th key={k.key}>{k.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {HOUR_LABELS.map(h => (
                    <tr key={h}>
                      <td style={{ fontWeight: 'bold' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Clock size={16} />
                          <span>{h}:00〜</span>
                        </div>
                      </td>
                      {KPI_KEYS.map(k => (
                        <td key={k.key}>
                          <input 
                            type="number" 
                            min="0"
                            value={detailData[h][k.key] || 0}
                            onChange={e => handleDetailChange(h, k.key, e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', textAlign: 'right', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button 
            className="btn btn-primary" 
            onClick={handleSave} 
            disabled={loading}
            style={{ padding: '1rem 3rem', fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)' }}
          >
            <Save size={20} style={{ marginRight: '0.5rem' }} />
            {loading ? '保存中...' : 'データを保存する'}
          </button>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', background: '#f3f4f6', padding: '1rem', borderRadius: '8px', color: '#4b5563', fontSize: '0.9rem' }}>
        <Info size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
        <div>
          ※ 粗利Pは暫定値です。確定値は翌々月に『管理設定 &gt; 月次締め入力』で executive が入力します。<br/>
          ※ KGI目標に対する「今月ここまでの進捗率」はダッシュボードで確認できます。
        </div>
      </div>
    </div>
  );
}
