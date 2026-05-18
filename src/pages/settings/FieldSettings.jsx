import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';

export default function FieldSettings() {
  const { user } = useAuth();

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>項目設定 (S-04)</h1>
        <p>各種入力項目のカスタマイズ</p>
      </div>
      
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>この画面は現在開発中（Phase 2 モックアップ）です。</p>
      </div>
    </div>
  );
}
