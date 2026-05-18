import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';

export default function ReportApproval() {
  const { user } = useAuth();

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>承認管理 (R-06)</h1>
        <p>承認待ちのレポート一覧</p>
      </div>
      
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>この画面は現在開発中（Phase 2 モックアップ）です。</p>
      </div>
    </div>
  );
}
