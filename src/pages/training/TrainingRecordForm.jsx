import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Save, Trash2, Calendar, Target, ChevronRight } from 'lucide-react';
import { db } from '../../firebase';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import Breadcrumb from '../../components/Breadcrumb';
import './Training.css';

export default function TrainingRecordForm() {
  const { memberId, recordId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [member, setMember] = useState(null);
  
  const isNew = recordId === 'new';
  const todayStr = new Date().toLocaleDateString('ja-JP').split('/').map(n => n.padStart(2, '0')).join('-');
  const [selectedDate, setSelectedDate] = useState(isNew ? todayStr : recordId);
  
  const initialForm = {
    trainingType: 'アポ',
    step1: '',
    step2: '',
    step3: '',
    step4: '',
    step5: '',
    step6: '',
    step7: ''
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    const fetchRecord = async () => {
      try {
        setLoading(true);
        // Fetch member name for breadcrumbs
        const userDoc = await getDoc(doc(db, 'users', memberId));
        if (userDoc.exists()) setMember({ id: userDoc.id, ...userDoc.data() });

        if (!isNew) {
          const docRef = doc(db, 'training_records', `${memberId}_${recordId}`);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setFormData({ ...initialForm, ...docSnap.data() });
            setSelectedDate(docSnap.data().date);
          } else {
            alert('指定された記録が見つかりません');
            navigate(`/training/${memberId}`);
          }
        }
      } catch (error) {
        console.error("Error fetching record:", error);
      } finally {
        setLoading(false);
      }
    };
    if (memberId && user) fetchRecord();
  }, [memberId, recordId, isNew, navigate, user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedDate) {
      alert("日付を選択してください");
      return;
    }
    
    setSaving(true);
    try {
      const dbRecordId = `${memberId}_${selectedDate}`;
      await setDoc(doc(db, 'training_records', dbRecordId), {
        ...formData,
        memberId: memberId,
        managerId: user.uid,
        date: selectedDate,
        updatedAt: Date.now()
      });
      alert("記録を保存しました！");
      navigate(`/training/${memberId}`);
    } catch (error) {
      console.error("Error saving record:", error);
      alert("保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("この日の記録を完全に削除しますか？")) return;
    
    setSaving(true);
    try {
      const dbRecordId = `${memberId}_${selectedDate}`;
      await deleteDoc(doc(db, 'training_records', dbRecordId));
      alert("記録を削除しました。");
      navigate(`/training/${memberId}`);
    } catch (error) {
      console.error("Error deleting record:", error);
      alert("削除に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center' }}>読み込み中...</div>;

  return (
    <div className="training-record-form">
      {/* Breadcrumbs */}
      <Breadcrumb items={[
        { label: 'メンバー育成', path: '/training' },
        { label: member?.name || 'メンバー', path: `/training/${memberId}` },
        { label: isNew ? '新規記録の追加' : `${selectedDate} の記録` }
      ]} />

      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>{isNew ? '新規記録を追加' : '記録の編集'}</h1>
          <p>{member?.name} の教育進捗（7ステップ）を入力します</p>
        </div>
      </div>

      <div className="glass-panel form-panel">
        <form onSubmit={handleSave}>
          <div className="form-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
              <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
                <label style={{ fontSize: '0.8rem', margin: '0 0 0.25rem 0' }}>対象日付</label>
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  disabled={!isNew}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: isNew ? 'white' : 'var(--bg-secondary)' }}
                />
              </div>
              <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
                <label style={{ fontSize: '0.8rem', margin: '0 0 0.25rem 0' }}>項目選択</label>
                <select name="trainingType" value={formData.trainingType} onChange={handleChange} style={{ padding: '0.5rem' }}>
                  <option value="アポ">アポ</option>
                  <option value="営業">営業</option>
                  <option value="その他">その他</option>
                </select>
              </div>
            </div>
          </div>

          <div className="steps-container compact-mode" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="calculation-box mb-2" style={{ padding: '1.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block', color: 'var(--text-secondary)' }}>1. 今週の数字（KPI結果）</label>
                <textarea name="step1" value={formData.step1} onChange={handleChange} rows="2" placeholder="現在の状況を具体的な数値で記入..." className="step-textarea" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }}></textarea>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block', color: 'var(--text-secondary)' }}>2. 最大の問題（症状ではなく原因）</label>
                <textarea name="step2" value={formData.step2} onChange={handleChange} rows="2" placeholder="数字から読み取れる現状の課題..." className="step-textarea" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }}></textarea>
              </div>

              <div className="form-group" style={{ marginTop: '1.25rem' }}>
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block', color: 'var(--text-secondary)' }}>3. 原因分析（真因：なぜ？をもう1段掘る）</label>
                <textarea name="step3" value={formData.step3} onChange={handleChange} rows="2" placeholder="なぜその問題が発生しているのか、根本原因を分析..." className="step-textarea" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }}></textarea>
              </div>

              <div className="form-group" style={{ marginTop: '1.25rem' }}>
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block', color: 'var(--text-secondary)' }}>4. 行動設計（誰が・何を・いつ・何回）</label>
                <textarea name="step4" value={formData.step4} onChange={handleChange} rows="2" placeholder="原因を解決するために、今週どのような具体的な行動を取りますか？" className="step-textarea" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }}></textarea>
              </div>

              <div className="form-group highlight-box" style={{ marginTop: '1.25rem', padding: '1.5rem', background: 'rgba(232, 0, 46, 0.03)', border: '1px solid rgba(232, 0, 46, 0.1)', borderRadius: '8px' }}>
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block', color: 'var(--text-secondary)' }}>5. 実行結果と検証</label>
                <textarea name="step5" value={formData.step5} onChange={handleChange} rows="2" placeholder="先週の行動の結果（数値で）や検証結果を記入：" className="step-textarea mb-1" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1rem', resize: 'vertical' }}></textarea>
                
                <div className="form-row" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <label style={{ fontWeight: 'bold', margin: 0, color: 'var(--text-secondary)' }}>6. 再現性の検証:</label>
                  <select 
                    name="step6_select"
                    value={formData.step6 && formData.step6.trim() !== '' ? 'なし' : 'あり'} 
                    onChange={(e) => {
                      if (e.target.value === 'あり') {
                        setFormData({...formData, step6: ''});
                      } else {
                        if (!formData.step6) setFormData({...formData, step6: ' '});
                      }
                    }}
                    style={{ width: '150px', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="あり">◯ あり</option>
                    <option value="なし">× なし</option>
                  </select>
                  
                  {formData.step6 && formData.step6.trim() !== '' && (
                    <textarea 
                      name="step6"
                      value={formData.step6.trim()}
                      onChange={(e) => setFormData({...formData, step6: e.target.value})}
                      rows="2"
                      placeholder="なしの理由を記入"
                      className="step-textarea"
                      style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }}
                    ></textarea>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1.25rem' }}>
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block', color: 'var(--text-secondary)' }}>7. その他備考</label>
                <textarea name="step7" value={formData.step7} onChange={handleChange} rows="2" placeholder="進捗の状況や追記事項などを記入してください。" className="step-textarea" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }}></textarea>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            {!isNew && (
              <button type="button" onClick={handleDelete} className="btn btn-secondary" style={{ padding: '1rem', color: 'var(--brand-red)' }} disabled={saving}>
                <Trash2 size={20} style={{ marginRight: '0.5rem' }} /> 記録を削除
              </button>
            )}
            <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '1rem', fontSize: '1.1rem' }} disabled={saving}>
              <Save size={20} style={{ marginRight: '0.5rem' }} /> {saving ? '保存中...' : '記録を保存する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
