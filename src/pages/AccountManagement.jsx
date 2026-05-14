import { useState, useEffect } from 'react';
import { UserPlus, Users, Eye, EyeOff, Edit2, X, KeyRound } from 'lucide-react';
import { db, firebaseConfig, auth } from '../firebase';
import { collection, doc, setDoc, updateDoc, getDocs } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import './AccountManagement.css';

// Initialize a secondary app just for creating users so the admin doesn't get logged out
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

export default function AccountManagement() {
  const [accounts, setAccounts] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    teamId: '',
    title: '一般'
  });

  const titles = ['一般', 'TL', 'SM', 'PMG', 'MG', '副統括', '統括', '役員', '取締役', '代表'];

  const fetchData = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersList = [];
      querySnapshot.forEach((doc) => {
        usersList.push({ id: doc.id, ...doc.data() });
      });
      setAccounts(usersList);

      const teamsSnap = await getDocs(collection(db, 'teams'));
      const tList = [];
      teamsSnap.forEach(d => tList.push({ id: d.id, ...d.data() }));
      setTeams(tList);
    } catch (error) {
      console.error("Error fetching data: ", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEdit = (user) => {
    setEditingUserId(user.id);
    setFormData({
      email: user.email,
      password: '', // Leave empty for edit
      name: user.name,
      teamId: user.teamId || '',
      title: user.title
    });
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setFormData({ email: '', password: '', name: '', teamId: '', title: '一般' });
  };

  const handlePasswordReset = async (userEmail) => {
    if (!window.confirm(`${userEmail} 宛にパスワード再設定メールを送信しますか？`)) return;
    
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, userEmail);
      alert('パスワード再設定メールを送信しました。該当者にメールの受信箱（迷惑メールフォルダ含む）をご確認いただくようお伝えください。');
    } catch (error) {
      console.error("Error sending reset email:", error);
      alert('メールの送信に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedTeam = teams.find(t => t.id === formData.teamId);

      if (editingUserId) {
        // --- UPDATE EXISTING USER PROFILE ---
        await updateDoc(doc(db, 'users', editingUserId), {
          name: formData.name,
          teamId: formData.teamId,
          branch: selectedTeam ? selectedTeam.name : '未設定',
          title: formData.title
        });
        alert(`メンバー情報（${formData.name}）を更新しました！\n※メールアドレス・パスワードの変更はここではできません。`);
        cancelEdit();
      } else {
        // --- CREATE NEW USER ---
        // 1. Create user in Firebase Auth using secondary app
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        const newUserId = userCredential.user.uid;

        // 2. Sign out the secondary app immediately
        await signOut(secondaryAuth);

        // 3. Save profile data to Firestore 'users' collection using the primary app's db
        await setDoc(doc(db, 'users', newUserId), {
          email: formData.email,
          name: formData.name,
          teamId: formData.teamId,
          branch: selectedTeam ? selectedTeam.name : '未設定', // backward compat
          title: formData.title,
          createdAt: Date.now()
        });

        alert(`アカウントを作成しました！\n氏名: ${formData.name}`);
        setFormData({ email: '', password: '', name: '', teamId: '', title: '一般' });
      }
      
      await fetchData();

    } catch (error) {
      console.error("Error creating account:", error);
      if (error.code === 'auth/email-already-in-use') {
        alert('このメールアドレスは既に登録されています。');
      } else if (error.code === 'auth/weak-password') {
        alert('パスワードは6文字以上にしてください。');
      } else {
        alert(`アカウントの作成に失敗しました: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="account-management">
      <div className="page-header">
        <div>
          <h1>チーム管理（ユーザー追加）</h1>
          <p>システム管理者専用: 新しい営業メンバーのアカウントと名簿データを作成します</p>
        </div>
      </div>

      <div className="content-grid">
        <div className="glass-panel form-section">
          <div className="section-header">
            <h2>
              {editingUserId ? <Edit2 size={20} /> : <UserPlus size={20} />} 
              {editingUserId ? 'メンバー情報の編集' : '新規アカウント作成'}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="account-form">
            <div className="form-group">
              <label>メールアドレス (ログインID)</label>
              <input 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange} 
                required 
                placeholder="例: yamada@example.com" 
                disabled={!!editingUserId} // Disallow email change during edit
                style={{ opacity: editingUserId ? 0.6 : 1 }}
              />
            </div>
            {!editingUserId && (
              <div className="form-group">
              <label>初期パスワード (6文字以上)</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  name="password" 
                  value={formData.password} 
                  onChange={handleChange} 
                  required 
                  placeholder="••••••••" 
                  minLength="6" 
                  style={{ width: '100%', paddingRight: '2.5rem' }}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ 
                    position: 'absolute', right: '0.5rem', background: 'none', border: 'none', 
                    cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' 
                  }}
                  title={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            )}
            <div className="form-group">
              <label>氏名</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="例: 山田 太郎" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>所属・チーム</label>
                <select name="teamId" value={formData.teamId} onChange={handleChange} required>
                  <option value="">-- 組織を選択してください --</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                  <option value="none">所属なし (経営層など)</option>
                </select>
              </div>
              <div className="form-group">
                <label>役職</label>
                <select name="title" value={formData.title} onChange={handleChange} required>
                  {titles.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
                {loading ? '処理中...' : (editingUserId ? '更新する' : 'アカウントを発行する')}
              </button>
              {editingUserId && (
                <button type="button" onClick={cancelEdit} className="btn btn-secondary" style={{ flex: 1 }}>
                  キャンセル
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="glass-panel list-section">
          <div className="section-header">
            <h2><Users size={20} /> 登録済みメンバー名簿</h2>
          </div>
          <div className="table-container">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>氏名</th>
                  <th>メールアドレス</th>
                  <th>所属・チーム</th>
                  <th>役職</th>
                  <th>アクション</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{textAlign: 'center', padding: '1rem'}}>
                      {loading ? '読み込み中...' : '登録されているメンバーはいません'}
                    </td>
                  </tr>
                ) : (
                  accounts.map((acc) => {
                    const teamName = teams.find(t => t.id === acc.teamId)?.name || acc.branch || '未設定';
                    return (
                      <tr key={acc.id} style={editingUserId === acc.id ? { background: 'var(--bg-secondary)' } : {}}>
                        <td style={{fontWeight: 'bold'}}>{acc.name}</td>
                        <td>{acc.email}</td>
                        <td>{teamName}</td>
                        <td>
                          <span className="status-badge" style={{background: 'var(--bg-secondary)', color: 'var(--text-primary)'}}>
                            {acc.title}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              className="btn btn-secondary btn-sm" 
                              onClick={() => handleEdit(acc)}
                              style={{ padding: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              title="メンバー情報を編集"
                            >
                              <Edit2 size={14} /> 編集
                            </button>
                            <button 
                              className="btn btn-secondary btn-sm" 
                              onClick={() => handlePasswordReset(acc.email)}
                              style={{ padding: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent-primary)' }}
                              title="パスワード再設定メールを送信"
                            >
                              <KeyRound size={14} /> リセット
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
