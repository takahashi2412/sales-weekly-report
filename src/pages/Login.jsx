import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Login() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    const result = await login(id, password);
    if (!result.success) {
      if (result.error === 'auth/invalid-credential') {
        alert('パスワードが間違っているか、アカウントが登録されていません。');
      } else if (result.error === 'auth/invalid-email') {
        alert('メールアドレスの形式が正しくありません。');
      } else {
        alert(`ログインに失敗しました（エラー: ${result.error}）。設定をご確認ください。`);
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass-panel">
        <div className="login-header">
          <h1>Rushup</h1>
          <p>週次報告システムへようこそ</p>
        </div>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>メールアドレス</label>
            <input 
              type="email" 
              placeholder="email@example.com" 
              value={id}
              onChange={e => setId(e.target.value)}
              required 
            />
          </div>
          <div className="form-group">
            <label>パスワード</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required 
            />
          </div>
          
          <button type="submit" className="btn btn-primary w-full" style={{ width: '100%', marginTop: '1rem' }}>
            <LogIn size={18} />
            ログイン
          </button>
        </form>
      </div>
    </div>
  );
}
