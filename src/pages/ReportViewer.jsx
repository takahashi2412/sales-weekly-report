import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { exportToPPTX, exportToCSV } from '../utils/exportUtils';
import './WeeklyForm.css'; // Reuse some CSS

export default function ReportViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const docRef = doc(db, 'reports', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setReport({ id: docSnap.id, ...docSnap.data() });
        } else {
          alert('レポートが見つかりません。');
          navigate('/dashboard');
        }
      } catch (error) {
        console.error("Error fetching report:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id, navigate]);

  if (loading) return <div style={{padding: '3rem', textAlign: 'center'}}>データを読み込み中...</div>;
  if (!report) return null;

  const fd = report.formData;

  const handleExportPPTX = () => {
    exportToPPTX(fd, report.userName || 'メンバー');
  };

  const handleExportCSV = () => {
    // CSV expects an array
    exportToCSV([report], 'weekly_report_details.csv');
  };

  const renderSectionHeader = (title) => (
    <h3 style={{ 
      borderBottom: '2px solid var(--accent-primary)', 
      paddingBottom: '0.5rem', 
      marginTop: '2rem',
      marginBottom: '1rem',
      color: 'var(--text-primary)'
    }}>{title}</h3>
  );

  const renderDataRow = (label, value) => (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0.75rem 0' }}>
      <div style={{ width: '30%', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ width: '70%', whiteSpace: 'pre-wrap' }}>{value || '-'}</div>
    </div>
  );

  // 計算値の再現
  const monthlyCost = Number(fd.orgMembers) * Number(fd.monthlyCostPerMember);
  const mDays = Number(fd.monthlyWorkingDays) || 1;
  const wDays = Number(fd.weeklyWorkingDays) || 0;
  const weeklyCost = monthlyCost ? Math.floor(monthlyCost * (wDays / mDays)) : 0;
  const roi = (weeklyCost > 0 && fd.weeklyGrossProfit) ? (fd.weeklyGrossProfit / weeklyCost).toFixed(2) : 0;

  return (
    <div className="form-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
      <button 
        onClick={() => navigate('/dashboard')} 
        className="btn btn-secondary" 
        style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
      >
        <ArrowLeft size={16} /> ダッシュボードへ戻る
      </button>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2>{report.userName || 'メンバー'}の週次報告</h2>
            <p className="text-muted" style={{ marginTop: '0.5rem' }}>対象週: {report.week}</p>
            <p className="text-muted">最終更新日時: {report.date}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleExportPPTX} className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <FileText size={16} /> PPTX出力
            </button>
            <button onClick={handleExportCSV} className="btn btn-secondary" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <FileSpreadsheet size={16} /> CSV
            </button>
          </div>
        </div>

        {renderSectionHeader('基本設定')}
        {renderDataRow('対象週の開始日', fd.startDate)}
        {renderDataRow('第何週目', `第 ${fd.weekOfMonth} 週目`)}
        {renderDataRow('今月の総稼働日数', `${fd.monthlyWorkingDays} 日`)}
        {renderDataRow('今週の稼働日数', `${fd.weeklyWorkingDays} 日`)}

        {renderSectionHeader('自己点検チェック')}
        {renderDataRow('1. 数字の因果分析', fd.selfCheck1)}
        {renderDataRow('2. 問題定義の質', fd.selfCheck2)}
        {renderDataRow('3. 行動設計の具体性', fd.selfCheck3)}
        {renderDataRow('4. PDCA完結', fd.selfCheck4)}
        {renderDataRow('5. 予算・コスト意識', fd.selfCheck5)}
        {renderDataRow('6. 組織全体観', fd.selfCheck6)}
        {renderDataRow('7. 主体的意思決定', fd.selfCheck7)}

        {renderSectionHeader('予算・採算実績')}
        {renderDataRow('組織メンバー数', `${fd.orgMembers} 名`)}
        {renderDataRow('1人あたり月間人件費', `${fd.monthlyCostPerMember} 万円`)}
        {renderDataRow('今週の組織コスト（自動計算）', `${weeklyCost} 万円`)}
        {renderDataRow('平均単価', `${fd.avgUnitPrice} 万円`)}
        {renderDataRow('今週の粗利', `${fd.weeklyGrossProfit} 万円`)}
        {renderDataRow('今週の受注件数', `${fd.weeklyOrders} 件`)}
        {renderDataRow('週間ROI（粗利÷コスト）', `${roi} 倍`)}

        {renderSectionHeader('責任者 PDCA')}
        {renderDataRow('1. 数字把握', fd.pdca1_numbers)}
        {renderDataRow('2. 問題定義', fd.pdca2_problem)}
        {renderDataRow('3. 行動設計', fd.pdca3_action)}
        {renderDataRow('4. 前週の実行結果', fd.pdca4_result)}
        {renderDataRow('5. 成功事例の共有', fd.pdca5_success)}
        {renderDataRow('6. 失敗事例と教訓', fd.pdca6_failure)}
        {renderDataRow('7. 改善施策', fd.pdca7_improvement)}
        {renderDataRow('代表に決断してほしいこと', fd.pdca_decision)}

        {renderSectionHeader('部下教育の進捗と課題')}
        {fd.roleplays && fd.roleplays.map((rp, index) => (
          <div key={index} style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>メンバー {index + 1}: {rp.name || '未入力'}</h4>
            {renderDataRow('ロープレ日', rp.roleplayDate)}
            {renderDataRow('課題（テーマ）', rp.roleplayTheme)}
            {renderDataRow('結果・改善点', rp.roleplayResult)}
            {renderDataRow('良かった点', rp.feedbackGood)}
            {renderDataRow('改善点', rp.feedbackBad)}
            {renderDataRow('合意したネクストアクション', rp.feedbackAgreed)}
            {renderDataRow('現在の教育ステージ', rp.stage)}
          </div>
        ))}
      </div>
    </div>
  );
}
