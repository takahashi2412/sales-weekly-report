import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';

export default function ProgressCompare() {
  const { user } = useAuth();

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>比較分析 (P-04)</h1>
        <p>メンバー間・チーム間の進捗比較</p>
      </div>
      
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>この画面は現在開発中（Phase 2 モックアップ）です。</p>
      </div>
    </div>
  );
}
