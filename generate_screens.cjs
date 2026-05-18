const fs = require('fs');
const path = require('path');

const screens = [
  // KPI (P2-6 ~ P2-9)
  { path: 'kpi/KpiDashboard.jsx', name: 'KpiDashboard', title: 'KPIダッシュボード (K-01)', desc: '商材別・全社合計のKPIサマリー' },
  { path: 'kpi/KpiHistory.jsx', name: 'KpiHistory', title: 'KPI履歴・推移 (K-04)', desc: '日次・週次・月次のKPI推移データ（手動/CSV入力バッジ付き）' },
  { path: 'kpi/KpiCompare.jsx', name: 'KpiCompare', title: 'KPI比較・着地予測 (K-05)', desc: 'メンバー間・チーム間のKPI比較と月末着地予測' },
  { path: 'kpi/KpiDetail.jsx', name: 'KpiDetail', title: 'KPI詳細 (K-06)', desc: '個人のKPI詳細分析データ' },
  // Daily (P2-10)
  { path: 'daily/DailyDashboard.jsx', name: 'DailyDashboard', title: '日報ダッシュボード (D-01)', desc: '全社提出状況・サマリー' },
  { path: 'daily/DailyInput.jsx', name: 'DailyInput', title: '日報入力 (D-02)', desc: '全ロール共通の入力フォーム' },
  { path: 'daily/DailyHistory.jsx', name: 'DailyHistory', title: '日報履歴 (D-03)', desc: 'フィルター付き履歴' },
  { path: 'daily/DailyDetail.jsx', name: 'DailyDetail', title: '日報詳細 (D-04)', desc: '個別日報の閲覧と確認' },
  { path: 'daily/DailyPending.jsx', name: 'DailyPending', title: '未提出・確認待ち (D-05)', desc: '未提出一覧と確認待ちのタブ切替' },
  // Progress (P2-11)
  { path: 'progress/ProgressDashboard.jsx', name: 'ProgressDashboard', title: '進捗ダッシュボード (P-01)', desc: '全社・チーム・個人の進捗サマリー' },
  { path: 'progress/ProgressDetail.jsx', name: 'ProgressDetail', title: '進捗詳細 (P-02)', desc: '期間フィルターでの週次/月次切替' },
  { path: 'progress/ProgressHistory.jsx', name: 'ProgressHistory', title: '進捗履歴 (P-03)', desc: '期間・対象フィルター付き履歴' },
  { path: 'progress/ProgressCompare.jsx', name: 'ProgressCompare', title: '比較分析 (P-04)', desc: 'メンバー間・チーム間の進捗比較' },
  // Improve (P2-12)
  { path: 'improve/ImproveDashboard.jsx', name: 'ImproveDashboard', title: '改善ダッシュボード (I-01)', desc: 'タスク状況サマリー' },
  { path: 'improve/ImproveTasks.jsx', name: 'ImproveTasks', title: '改善タスク一覧 (I-02)', desc: 'フィルター付きタスク一覧' },
  { path: 'improve/ImproveTaskDetail.jsx', name: 'ImproveTaskDetail', title: '改善タスク詳細 (I-03)', desc: 'タスク詳細と進捗更新' },
  { path: 'improve/ImproveHistory.jsx', name: 'ImproveHistory', title: '改善履歴 (I-04)', desc: '過去のタスク一覧' },
  { path: 'improve/ImproveAnalysis.jsx', name: 'ImproveAnalysis', title: '改善効果分析 (I-05)', desc: '改善前後の比較分析' },
  // Education (P2-13)
  { path: 'education/EducationDashboard.jsx', name: 'EducationDashboard', title: '教育ダッシュボード (E-01)', desc: '教育状況サマリー' },
  { path: 'education/EducationNew.jsx', name: 'EducationNew', title: '教育メモ入力 (E-02)', desc: '部下を選択して教育記録を作成' },
  { path: 'education/EducationHistory.jsx', name: 'EducationHistory', title: '教育メモ履歴 (E-03)', desc: 'フィルター付き教育履歴' },
  { path: 'education/EducationUserDetail.jsx', name: 'EducationUserDetail', title: '部下別教育詳細 (E-04)', desc: '特定部下の教育履歴' },
  { path: 'education/EducationThemeAnalysis.jsx', name: 'EducationThemeAnalysis', title: '教育テーマ別分析 (E-05)', desc: 'テーマ別の効果分析' },
  // Reports (P2-14)
  { path: 'reports/ReportDashboard.jsx', name: 'ReportDashboard', title: 'レポートダッシュボード (R-01)', desc: '提出状況サマリー' },
  { path: 'reports/ReportDrafts.jsx', name: 'ReportDrafts', title: '下書き一覧 (R-03)', desc: '一時保存中のレポート' },
  { path: 'reports/ReportApproval.jsx', name: 'ReportApproval', title: '承認管理 (R-06)', desc: '承認待ちのレポート一覧' },
  // Notifications & Profile (P2-16)
  { path: 'common/Profile.jsx', name: 'Profile', title: 'プロフィール設定 (C-02)', desc: '名前・パスワードなどの変更' },
  { path: 'common/Notifications.jsx', name: 'Notifications', title: '通知一覧 (C-03)', desc: 'アラート・承認通知・システム通知' },
  // Settings (P2-17)
  { path: 'settings/RoleManagement.jsx', name: 'RoleManagement', title: '権限管理 (S-03)', desc: 'ユーザーへのロール割当' },
  { path: 'settings/FieldSettings.jsx', name: 'FieldSettings', title: '項目設定 (S-04)', desc: '各種入力項目のカスタマイズ' }
];

const template = (name, title, desc) => `import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import '../history/History.css';

export default function ${name}() {
  const { user } = useAuth();

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>${title}</h1>
        <p>${desc}</p>
      </div>
      
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>この画面は現在開発中（Phase 2 モックアップ）です。</p>
      </div>
    </div>
  );
}
`;

const baseDir = path.join(__dirname, 'src', 'pages');

screens.forEach(s => {
  const fullPath = path.join(baseDir, s.path);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(fullPath)) {
    // If it relies on ../history/History.css, wait I removed that! 
    // I will replace ../history/History.css with nothing in template
    fs.writeFileSync(fullPath, template(s.name, s.title, s.desc).replace("import '../history/History.css';\n", ""), 'utf8');
    console.log('Created: ' + s.path);
  }
});
