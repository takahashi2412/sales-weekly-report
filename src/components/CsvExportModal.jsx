import { useState } from 'react';
import { exportKpiToCsv } from '../utils/csvExport';
import { useAuth } from '../context/AuthContext';
import { getVisibleUserIds } from '../utils/teamUtils';

const PRODUCTS = [
  { id: 'visit', name: 'HP（訪問）' },
  { id: 'web', name: 'Web' },
  { id: 'replace', name: 'リプレイス' },
  { id: 'meo', name: 'MEO' },
];

export default function CsvExportModal({ isOpen, onClose, usersData }) {
  const { user } = useAuth();
  const [dataType, setDataType] = useState('hourly');
  const [dateMode, setDateMode] = useState('date');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [preset, setPreset] = useState('today');
  const [selectedProducts, setSelectedProducts] = useState(['visit']);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleProductToggle = (id) => {
    setSelectedProducts(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const getPresetDates = (p) => {
    const today = new Date();
    const dStr = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    let start = new Date();
    let end = new Date();

    if (p === 'today') {
      // today is default
    } else if (p === 'yesterday') {
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
    } else if (p === 'thisWeek') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(today.setDate(diff));
      end = new Date(); // up to today
    } else if (p === 'lastWeek') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1) - 7;
      start = new Date(today.getFullYear(), today.getMonth(), diff);
      end = new Date(today.getFullYear(), today.getMonth(), diff + 6);
    } else if (p === 'thisMonth') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (p === 'lastMonth') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (p === 'past30') {
      start.setDate(today.getDate() - 30);
    } else if (p === 'past90') {
      start.setDate(today.getDate() - 90);
    }

    return { s: dStr(start), e: dStr(end) };
  };

  const handleExport = async () => {
    if (selectedProducts.length === 0) {
      alert('商材を1つ以上選択してください');
      return;
    }
    
    let s = startDate;
    let e = endDate;
    if (dateMode === 'preset') {
      const dates = getPresetDates(preset);
      s = dates.s;
      e = dates.e;
    }

    if (!s || !e) {
      alert('期間を指定してください');
      return;
    }
    if (s > e) {
      alert('開始日は終了日以前を指定してください');
      return;
    }

    setIsExporting(true);
    try {
      const visibleUserIds = await getVisibleUserIds(user);
      
      await exportKpiToCsv({
        dataType,
        startDate: s,
        endDate: e,
        productIds: selectedProducts,
        visibleUserIds,
        usersData,
        user
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert('出力中にエラーが発生しました');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="glass-panel" style={{ background: '#fff', padding: '2rem', width: '500px', maxWidth: '90%' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>KPIデータCSV出力</h2>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>1. 出力データ種類</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label><input type="radio" checked={dataType === 'hourly'} onChange={() => setDataType('hourly')} /> 時間帯別データ（14時間帯×6項目）</label>
            <label><input type="radio" checked={dataType === 'daily'} onChange={() => setDataType('daily')} /> 日次合計データ（1日1行・個人別）</label>
            <label><input type="radio" checked={dataType === 'monthly'} onChange={() => setDataType('monthly')} /> 月次集計データ（月単位の集計値）</label>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>2. 期間指定方法</label>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
            <button className={`btn ${dateMode === 'date' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDateMode('date')}>日付指定</button>
            <button className={`btn ${dateMode === 'preset' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDateMode('preset')}>プリセット選択</button>
          </div>
          
          {dateMode === 'date' ? (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
              <span>〜</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
            </div>
          ) : (
            <select value={preset} onChange={e => setPreset(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
              <option value="today">今日</option>
              <option value="yesterday">昨日</option>
              <option value="thisWeek">今週</option>
              <option value="lastWeek">先週</option>
              <option value="thisMonth">今月</option>
              <option value="lastMonth">先月</option>
              <option value="past30">過去30日</option>
              <option value="past90">過去90日</option>
            </select>
          )}
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>3. 対象商材</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem' }}>
            {PRODUCTS.map(p => (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <input type="checkbox" checked={selectedProducts.includes(p.id)} onChange={() => handleProductToggle(p.id)} />
                {p.name}
              </label>
            ))}
          </div>
          <p style={{ fontSize: '0.8rem', color: '#b45309' }}>※選択した商材ごとに別のCSVファイルとしてダウンロードされます</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isExporting}>キャンセル</button>
          <button className="btn btn-primary" onClick={handleExport} disabled={isExporting}>
            {isExporting ? '出力中...' : 'CSV出力'}
          </button>
        </div>
      </div>
    </div>
  );
}
