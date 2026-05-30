import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Save, ArrowRight, ArrowLeft, CheckCircle2, Download, FileSpreadsheet } from 'lucide-react';
import { exportToCSV, exportToPPTX } from '../utils/exportUtils';
import './WeeklyForm.css';

const STEPS = [
  "基本設定",
  "自己点検",
  "組織KPI",
  "予算採算シート",
  "責任者PDCA",
  "メンバーPDCA",
  "育成記録",
  "リスト分析",
  "コミット宣言"
];

export default function WeeklyForm({ injectedReport, isHistoryDetail }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const editReport = injectedReport || location.state?.editReport;

  const [currentStep, setCurrentStep] = useState(0);
  const [editingId, setEditingId] = useState(editReport?.id || null);
  const [isImporting, setIsImporting] = useState(false);
  
  const [formData, setFormData] = useState(editReport?.formData || {
    // 基本情報
    startDate: new Date().toISOString().split('T')[0],
    weekOfMonth: '1',

    // Step 0: 自己点検
    selfCheck1: '○', selfCheck2: '○', selfCheck3: '○', selfCheck4: '○',
    selfCheck5: '○', selfCheck6: '○', selfCheck7: '○',
    
    // Step 1: 組織KPI
    kpiMonthly_grossTarget: '', kpiMonthly_grossCurrent: '',
    kpiMonthly_orderTarget: '', kpiMonthly_orderCurrent: '',
    kpiMonthly_apptTarget: '', kpiMonthly_apptCurrent: '',
    kpiMonthly_actionTarget: '', kpiMonthly_actionCurrent: '',
    kpiWeekly_grossTarget: '', kpiWeekly_grossCurrent: '',
    kpiWeekly_orderTarget: '', kpiWeekly_orderCurrent: '',
    kpiWeekly_apptTarget: '', kpiWeekly_apptCurrent: '',
    kpiWeekly_actionTarget: '', kpiWeekly_actionCurrent: '',

    // Step 2: 予算採算シート
    orgMembers: '', monthlyCostPerMember: 100, // 100万円
    monthlyWorkingDays: 20, weeklyWorkingDays: 5,
    weeklyGrossProfit: '', weeklyOrders: '', 
    avgUnitPrice: '', targetContribution: '',
    
    // Step 2: 責任者PDCA (7 items + Decision)
    pdca1_numbers: '',
    pdca2_problem: '',
    pdca3_action: '',
    pdca4_result: '', pdca4_reproducible: 'あり', pdca4_reason: '',
    pdca5_leadership_reflection: '',
    pdca6_orgIssue: '', pdca6_leaderAction: '',
    pdca7_roiEval: '', pdca_main_decision: '',
    
    // Step 3: メンバーPDCA (Array for multiple members)
    members: [
      { name: '', item: '', kpi: '', problem: '', cause: '', action: '', result: '', reproducible: 'あり', noReproReason: '',
        roleplayDate: '', roleplayTheme: '', roleplayResult: '',
        feedbackGood: '', feedbackBad: '', feedbackAgreed: '', stage: 'STAGE 1' }
    ],

    // Step 5: ロープレ・育成記録
    roleplays: [
      { date: '', target: '', theme: '', result: '', reproducible: 'あり' }
    ],
    bestGrower: '', focusIssue: '', nextWeekMeasure: '',

    // Step 5: リスト分析
    attackRate: '', paidListRate: '', contactRate: '', prospectRate: '', apptRate: '',
    dropListReason: '', pursueListReason: '', newListSource: '', priority: '',

    // Step 6: コミット宣言
    targetOrders: '', targetGross: '', targetAppts: '', targetActions: '',
    commitPriorityAction: '',
    commitTrainName: '', commitTrainIssue: '', commitTrainMeasure: '',
    commitChanges: ''
  });

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleMemberChange = (index, field, value) => {
    const newMembers = [...formData.members];
    newMembers[index][field] = value;
    setFormData({ ...formData, members: newMembers });
  };

  const addMember = () => {
    setFormData({
      ...formData,
      members: [...formData.members, { 
        name: '', item: '', kpi: '', problem: '', cause: '', action: '', result: '', reproducible: 'あり', noReproReason: '',
        roleplayDate: '', roleplayTheme: '', roleplayResult: '',
        feedbackGood: '', feedbackBad: '', feedbackAgreed: '', stage: 'STAGE 1' 
      }]
    });
  };

  const handleRoleplayChange = (index, field, value) => {
    const newRoleplays = [...formData.roleplays];
    newRoleplays[index][field] = value;
    setFormData({ ...formData, roleplays: newRoleplays });
  };

  const addRoleplay = () => {
    setFormData({
      ...formData,
      roleplays: [...formData.roleplays, { date: '', target: '', theme: '', result: '', reproducible: 'あり' }]
    });
  };

  const handleNext = () => { if (currentStep < STEPS.length - 1) setCurrentStep(c => c + 1); };
  const handlePrev = () => { if (currentStep > 0) setCurrentStep(c => c - 1); };
  
  const handleSubmit = async (e) => { 
    if (e) e.preventDefault(); 
    if (!user) {
      alert("ログインしていません。保存できません。");
      return;
    }
    
    const startObj = new Date(formData.startDate);
    const month = startObj.getMonth() + 1;
    const historyTitle = `${month}月 第${formData.weekOfMonth}週目 (対象週: ${formData.startDate}〜)`;

    // 保存日時に時間を追加 (例: 2026-05-13 17:30)
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newReport = {
      userId: user.uid,
      userName: user.name || user.email,
      date: formattedDate,
      week: historyTitle,
      formData: formData,
      updatedAt: now.getTime()
    };
    
    try {
      if (editingId && typeof editingId === 'string' && editingId.length > 10) {
        // Firestoreの既存データを上書き
        const reportRef = doc(db, 'reports', editingId);
        await updateDoc(reportRef, newReport);
        alert('上書き保存しました！引き続き入力できます。');
      } else {
        // 新規保存
        const docRef = await addDoc(collection(db, 'reports'), newReport);
        setEditingId(docRef.id); // 次回から上書きになるようにIDをセット
        alert('途中保存しました！引き続き入力できます。'); 
      }
    } catch (error) {
      console.error("Error saving document: ", error);
      alert('保存中にエラーが発生しました。通信環境を確認してください。');
    }
  };

  const handleImportTrainingData = async () => {
    if (!formData.startDate) {
      alert("基本設定で「対象週（開始日）」を設定してください。");
      return;
    }
    
    setIsImporting(true);
    try {
      // 1. Fetch all users to map memberId -> name
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersMap = {};
      usersSnap.forEach(d => {
        usersMap[d.id] = d.data().name || '不明なメンバー';
      });

      // 2. Calculate date range (startDate to startDate + 6 days)
      const startObj = new Date(formData.startDate);
      const startStr = startObj.toISOString().split('T')[0];
      
      const endObj = new Date(startObj);
      endObj.setDate(endObj.getDate() + 6);
      const endStr = endObj.toISOString().split('T')[0];

      // 3. Fetch training records for this manager
      const q = query(
        collection(db, 'training_records'),
        where('managerId', '==', user.uid)
      );
      const querySnapshot = await getDocs(q);
      
      // Filter by date client-side because Firestore requires composite index for multiple where clauses
      const records = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.date >= startStr && data.date <= endStr) {
          records.push(data);
        }
      });

      if (records.length === 0) {
        alert(`${startStr} 〜 ${endStr} の期間に登録された「メンバー育成」データはありませんでした。`);
        setIsImporting(false);
        return;
      }

      // Group by memberId, taking the latest record (assuming date string sorting works YYYY-MM-DD)
      const latestRecordsMap = {};
      records.forEach(r => {
        if (!latestRecordsMap[r.memberId] || r.date > latestRecordsMap[r.memberId].date) {
          latestRecordsMap[r.memberId] = r;
        }
      });

      // 4. Map to members array
      const importedMembers = Object.values(latestRecordsMap).map(record => ({
        name: usersMap[record.memberId] || '不明',
        item: record.trainingType || '',
        stage: 'STAGE 1', // Default
        kpi: record.step1 || '',
        problem: record.step2 || '',
        cause: record.step3 || '',
        action: record.step4 || '',
        result: record.step5 || '',
        reproducible: (record.step6 && record.step6.trim() !== '') ? 'あり' : 'なし',
        noReproReason: (record.step6 && record.step6.trim() === '') ? '未入力' : '',
        roleplayDate: '', roleplayTheme: '', roleplayResult: '',
        feedbackGood: '', feedbackBad: '', feedbackAgreed: ''
      }));

      // Overwrite or append based on confirmation
      if (window.confirm(`${importedMembers.length}名分の育成記録が見つかりました！\n現在入力されているメンバーPDCAの項目を上書きして自動入力しますか？`)) {
        setFormData({ ...formData, members: importedMembers });
        alert('自動取り込みが完了しました！');
      }

    } catch (error) {
      console.error("Error importing training data:", error);
      alert("取り込み中にエラーが発生しました。");
    } finally {
      setIsImporting(false);
    }
  };

  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    import('../utils/teamUtils').then(({ getVisibleUsers }) => {
      getVisibleUsers(user).then(setTeamMembers).catch(console.error);
    }).catch(console.error);
  }, [user]);

  const handleImportSingleMember = async (index, memberId, memberName) => {
    if (!formData.startDate) {
      alert("基本設定で「対象週（開始日）」を設定してください。");
      return;
    }
    try {
      const startObj = new Date(formData.startDate);
      const startStr = startObj.toISOString().split('T')[0];
      const endObj = new Date(startObj);
      endObj.setDate(endObj.getDate() + 6);
      const endStr = endObj.toISOString().split('T')[0];

      const q = query(
        collection(db, 'training_records'),
        where('managerId', '==', user.uid)
      );
      const querySnapshot = await getDocs(q);
      
      let latestRecord = null;
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.memberId === memberId && data.date >= startStr && data.date <= endStr) {
          if (!latestRecord || data.date > latestRecord.date) {
            latestRecord = data;
          }
        }
      });

      if (latestRecord) {
         const newMembers = [...formData.members];
         newMembers[index] = {
            ...newMembers[index],
            name: memberName,
            item: latestRecord.trainingType || '',
            kpi: latestRecord.step1 || '',
            problem: latestRecord.step2 || '',
            cause: latestRecord.step3 || '',
            action: latestRecord.step4 || '',
            result: latestRecord.step5 || '',
            reproducible: (latestRecord.step6 && latestRecord.step6.trim() !== '') ? 'あり' : 'なし',
            noReproReason: (latestRecord.step6 && latestRecord.step6.trim() === '') ? '未入力' : ''
         };
         setFormData({ ...formData, members: newMembers });
      } else {
         handleMemberChange(index, 'name', memberName);
         alert("この期間の教育進捗データが見つかりませんでした。名前のみ入力しました。");
      }
    } catch (e) {
      console.error(e);
      handleMemberChange(index, 'name', memberName);
    }
  };

  // --- Step 0: 基本設定 ---
  const renderStep0 = () => (
    <div className="step-content animate-fade-in" style={{ textAlign: 'center' }}>
      <img src="/logo.png" alt="Rush up Logo" style={{ maxWidth: '200px', marginBottom: '1.5rem' }} />
      <h3>週次報告 基本設定</h3>
      <p className="step-desc">今回の週報の対象となるスケジュール情報を入力してください。</p>

      <div className="calculation-box highlight-box mb-2" style={{ background: 'var(--bg-secondary)', border: '2px solid var(--accent-primary)', textAlign: 'left' }}>
        <h4 style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>① 対象週の指定</h4>
        
        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontWeight: 'bold' }}>いつから始まる週の報告ですか？</label>
            <input 
              type="date" 
              name="startDate" 
              value={formData.startDate} 
              onChange={handleChange} 
              style={{ fontSize: '1.1rem', padding: '0.5rem', width: '180px' }}
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontWeight: 'bold' }}>第何週目ですか？</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem' }}>第</span>
              <select name="weekOfMonth" value={formData.weekOfMonth} onChange={handleChange} className="small-select" style={{ fontSize: '1.1rem', padding: '0.5rem', width: '80px' }}>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
              <span style={{ fontSize: '1.1rem' }}>週目</span>
            </div>
          </div>
        </div>
      </div>

      <div className="calculation-box mb-2">
        <h4 style={{ marginBottom: '0.5rem' }}>② 稼働日数の設定</h4>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>会社カレンダーに合わせた稼働日数を入力してください。この数値を使って予算・コストが日割り計算されます。</p>
        
        <div className="form-row">
          <div className="form-group">
            <label style={{ fontWeight: 'bold' }}>今月の総稼働日数</label>
            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <input type="number" name="monthlyWorkingDays" value={formData.monthlyWorkingDays} onChange={handleChange} className="small-input" style={{ width: '100px', fontSize: '1.1rem' }}/>
              <span style={{ fontSize: '1.1rem' }}>日</span>
            </div>
          </div>
          <div className="form-group">
            <label style={{ fontWeight: 'bold' }}>今週の稼働日数</label>
            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <input type="number" name="weeklyWorkingDays" value={formData.weeklyWorkingDays} onChange={handleChange} className="small-input" style={{ width: '100px', fontSize: '1.1rem' }}/>
              <span style={{ fontSize: '1.1rem' }}>日</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // --- Step 1: 自己点検 ---
  const renderStep1 = () => (
    <div className="step-content animate-fade-in">
      <h3>自己点検チェックシート</h3>
      <p className="step-desc">経営者として自分の組織を語れているか確認してください。（◎, ○, △, ×）</p>
      
      {[
        { id: 'selfCheck1', label: '1. 数字の因果分析：先週の行動が今週の数字にどう影響したか説明できる' },
        { id: 'selfCheck2', label: '2. 問題定義の質：「症状」ではなく「真の原因」を自分の言葉で語れる' },
        { id: 'selfCheck3', label: '3. 行動設計の具体性：誰が・何を・いつ・何回 が明確に決まっている' },
        { id: 'selfCheck4', label: '4. PDCA完結：前週の「実行結果と再現性」をすべて記入・検証できている' },
        { id: 'selfCheck5', label: '5. 予算・コスト意識：週間ROIと1受注あたりの人件費コストを数字で語れる' },
        { id: 'selfCheck6', label: '6. 組織全体観：部下個人の管理だけでなく組織全体の課題を語れている' },
        { id: 'selfCheck7', label: '7. 主体的意思決定：代表に「どうすれば？」を求めず、自分で決断できている' },
      ].map((item, i) => (
        <div className="form-group row-group" key={i}>
          <label className="flex-label" style={{fontWeight: 'normal'}}>{item.label}</label>
          <select name={item.id} value={formData[item.id]} onChange={handleChange} className="small-select">
            <option value="◎">◎ 深い・できている</option>
            <option value="○">○ 普通</option>
            <option value="△">△ 浅い・不十分</option>
            <option value="×">× できていない</option>
          </select>
        </div>
      ))}
    </div>
  );

  // --- Step 2: 組織KPI ---
  const renderStep2 = () => {
    const calcProg = (cur, tgt) => (tgt && cur) ? Math.round((cur / tgt) * 100) : 0;
    const metrics = [
      { id: 'gross', label: '粗利（P）' },
      { id: 'order', label: '受注件数' },
      { id: 'appt', label: 'アポ件数' },
      { id: 'action', label: '行動件数' }
    ];
    
    return (
      <div className="step-content animate-fade-in">
        <h3>組織KPI ダッシュボード</h3>
        <p className="step-desc">月間・週間の数字を責任者として把握する</p>
        
        <div className="calculation-box mb-2">
          <h4>【月間進捗】</h4>
          <table className="reports-table" style={{width: '100%', marginTop: '1rem'}}>
            <thead><tr><th style={{textAlign:'left'}}>指標</th><th>目標</th><th>現状</th><th>進捗(%)</th></tr></thead>
            <tbody>
              {metrics.map(m => (
                <tr key={'m_'+m.id}>
                  <td>{m.label}</td>
                  <td><input type="number" name={`kpiMonthly_${m.id}Target`} value={formData[`kpiMonthly_${m.id}Target`]} onChange={handleChange} style={{width:'80px'}}/></td>
                  <td><input type="number" name={`kpiMonthly_${m.id}Current`} value={formData[`kpiMonthly_${m.id}Current`]} onChange={handleChange} style={{width:'80px'}}/></td>
                  <td style={{fontWeight:'bold', color:'var(--accent-primary)', textAlign:'center'}}>{calcProg(formData[`kpiMonthly_${m.id}Current`], formData[`kpiMonthly_${m.id}Target`])}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="calculation-box">
          <h4>【今週結果】</h4>
          <table className="reports-table" style={{width: '100%', marginTop: '1rem'}}>
            <thead><tr><th style={{textAlign:'left'}}>指標</th><th>目標</th><th>現状</th><th>進捗(%)</th></tr></thead>
            <tbody>
              {metrics.map(m => (
                <tr key={'w_'+m.id}>
                  <td>{m.label}</td>
                  <td><input type="number" name={`kpiWeekly_${m.id}Target`} value={formData[`kpiWeekly_${m.id}Target`]} onChange={handleChange} style={{width:'80px'}}/></td>
                  <td><input type="number" name={`kpiWeekly_${m.id}Current`} value={formData[`kpiWeekly_${m.id}Current`]} onChange={handleChange} style={{width:'80px'}}/></td>
                  <td style={{fontWeight:'bold', color:'var(--accent-primary)', textAlign:'center'}}>{calcProg(formData[`kpiWeekly_${m.id}Current`], formData[`kpiWeekly_${m.id}Target`])}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- Step 3: 予算採算シート ---
  const renderStep3 = () => {
    const monthlyCost = Number(formData.orgMembers) * Number(formData.monthlyCostPerMember);
    const mDays = Number(formData.monthlyWorkingDays) || 1;
    const wDays = Number(formData.weeklyWorkingDays) || 0;
    const weeklyCost = monthlyCost ? Math.floor(monthlyCost * (wDays / mDays)) : 0;
    
    const costPerOrder = (weeklyCost > 0 && formData.weeklyOrders) ? Math.floor(weeklyCost / formData.weeklyOrders) : 0;
    const roi = (weeklyCost > 0 && formData.weeklyGrossProfit) ? (formData.weeklyGrossProfit / weeklyCost).toFixed(2) : 0;
    const requiredOrders = (formData.avgUnitPrice && weeklyCost) ? Math.ceil(weeklyCost / formData.avgUnitPrice) : 0;

    return (
      <div className="step-content animate-fade-in">
        <h3>予算・採算シート</h3>
        <p className="step-desc">目的（粗利−コスト）から手段（件数）を逆算する</p>
        
        <div className="calculation-box mb-1">
          <h4>【組織コスト（固定）】</h4>
          
          <div className="form-row" style={{alignItems: 'center', marginTop: '1rem'}}>
            <input type="number" name="orgMembers" value={formData.orgMembers} onChange={handleChange} placeholder="◯名" className="small-input"/> 
            <span>名 × {formData.monthlyCostPerMember}万円 ＝ 月間 {monthlyCost} 万円</span>
          </div>
          
          <p className="highlight-text" style={{ marginTop: '0.5rem' }}>
            → 今週のコスト: 月間 {monthlyCost}万 × ({wDays}日/{mDays}日) = <strong>{weeklyCost} P (万円)</strong>
          </p>
        </div>

        <div className="calculation-box highlight-box mb-1">
          <h4>目的から手段へ 逆算する</h4>
          <div className="form-group mt-1">
            <label>目的：組織への貢献 (粗利 − コスト ＝ 目標P)</label>
            <input type="number" name="targetContribution" value={formData.targetContribution} onChange={handleChange} placeholder="目標とする組織貢献度(P)を入力" />
          </div>
          <div className="form-group">
            <label>手段①：必要な週間粗利</label>
            <div className="flex-label" style={{color: 'var(--text-secondary)'}}>今週のコスト分 ＝ <strong>{weeklyCost} P</strong></div>
          </div>
          <div className="form-group">
            <label>手段②：必要な受注件数</label>
            <div className="form-row" style={{alignItems: 'center', marginBottom: '0.5rem'}}>
              <span>平均単価 (P): </span>
              <input type="number" name="avgUnitPrice" value={formData.avgUnitPrice} onChange={handleChange} placeholder="例: 150" className="small-input"/>
            </div>
            <div className="flex-label" style={{color: 'var(--text-secondary)'}}>必要粗利 ÷ 平均単価 ＝ <strong>約 {requiredOrders} 件 / 週</strong></div>
          </div>
        </div>

        <div className="form-row mt-2">
          <div className="form-group">
            <label>今週の粗利 (P/万円)</label>
            <input type="number" name="weeklyGrossProfit" value={formData.weeklyGrossProfit} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>今週の受注件数 (確定のみ)</label>
            <input type="number" name="weeklyOrders" value={formData.weeklyOrders} onChange={handleChange} />
          </div>
        </div>

        <div className="calc-grid">
          <div className="glass-panel stat-mini">
            <span>1受注あたりの人件費コスト</span>
            <strong>{costPerOrder} P</strong>
          </div>
          <div className="glass-panel stat-mini">
            <span>週間ROI</span>
            <strong>{roi} 倍</strong>
          </div>
        </div>
      </div>
    );
  };

  // --- Step 4: 責任者PDCA ---
  const renderStep4 = () => (
    <div className="step-content animate-fade-in">
      <h3>責任者 PDCA（自分自身の振り返り）</h3>
      <p className="step-desc">7項目＋意思決定を入力</p>

      <div className="form-group"><label>1. 数字把握: 今週の自分の数字（受注・アポ・行動）を1行で：</label>
      <input type="text" name="pdca1_numbers" value={formData.pdca1_numbers} onChange={handleChange} /></div>
      
      <div className="form-group"><label>2. 問題定義: 最も重要な問題の「真の原因」は何か：</label>
      <input type="text" name="pdca2_problem" value={formData.pdca2_problem} onChange={handleChange} /></div>
      
      <div className="form-group"><label>3. 行動設計: 来週の具体的な行動（誰が・何を・いつ・何回）：</label>
      <input type="text" name="pdca3_action" value={formData.pdca3_action} onChange={handleChange} /></div>
      
      <div className="form-group calculation-box">
        <label>4. 実行結果と検証: 先週設計した行動の結果と学んだこと：</label>
        <textarea name="pdca4_result" rows="2" value={formData.pdca4_result} onChange={handleChange}></textarea>
        <div className="form-row mt-1">
          <select name="pdca4_reproducible" value={formData.pdca4_reproducible} onChange={handleChange}>
            <option value="あり">◯ 再現性あり</option><option value="なし">× 再現性なし</option>
          </select>
          {formData.pdca4_reproducible === 'なし' && <input type="text" name="pdca4_reason" placeholder="理由" value={formData.pdca4_reason} onChange={handleChange}/>}
        </div>
      </div>

      <div className="form-group">
        <label>5. リーダーシップ行動の振り返り</label>
        <textarea name="pdca5_leadership_reflection" rows="3" placeholder="（例：自分は組織の数字を毎日言葉にしたか？等）自分で気が付いたことを記載してください。" value={formData.pdca5_leadership_reflection} onChange={handleChange}></textarea>
      </div>

      <div className="form-group calculation-box">
        <label>6. 組織全体の課題認識</label>
        <input type="text" name="pdca6_orgIssue" placeholder="組織として今週最も重要な課題は？" value={formData.pdca6_orgIssue} onChange={handleChange} className="mb-1"/>
        <input type="text" name="pdca6_leaderAction" placeholder="自分がリーダーとして何をすべきだったか？" value={formData.pdca6_leaderAction} onChange={handleChange}/>
      </div>

      <div className="form-group calculation-box">
        <label>7. コスト・採算自己評価</label>
        <input type="text" name="pdca7_roiEval" placeholder="今週の組織ROIは目標に対してどうか？コストは適切か？" value={formData.pdca7_roiEval} onChange={handleChange} />
      </div>

      <div className="form-group calculation-box highlight-box mt-2">
        <label>★ 今週 責任者として 最も重要な意思決定</label>
        <p className="step-desc" style={{marginBottom: '0.5rem', fontSize: '0.8rem'}}>代表に聞かずに、自分で決断したことを書く（振り返りのメイントピック）</p>
        <textarea name="pdca_main_decision" rows="3" placeholder="意思決定の内容を記載：" value={formData.pdca_main_decision} onChange={handleChange}></textarea>
      </div>
    </div>
  );

  // --- Step 5: メンバーPDCA ---
  const renderStep5 = () => (
    <div className="step-content animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3>メンバー PDCA</h3>
          <p className="step-desc">各メンバーのKPI、問題定義、行動設計、育成ステージを入力します。</p>
        </div>
        <button 
          type="button" 
          onClick={handleImportTrainingData}
          disabled={isImporting}
          className="btn btn-primary" 
          style={{ background: 'linear-gradient(135deg, #FF003D 0%, #ff4d79 100%)', border: 'none', boxShadow: '0 4px 15px rgba(255, 0, 61, 0.3)' }}
        >
          {isImporting ? '取り込み中...' : '✨ 教育進捗（トラッカー）から一括取り込み'}
        </button>
      </div>
      
      {formData.members.map((member, index) => (
        <div key={index} className="calculation-box mb-2" style={{marginBottom: '2rem'}}>
          <div className="form-row" style={{borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem'}}>
            <div className="form-group" style={{ flex: 1.5 }}>
              <label>担当者名（選択すると教育進捗データを取得します）</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {teamMembers.length > 0 && (
                  <select 
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const selectedMemberId = e.target.selectedOptions[0].getAttribute('data-id');
                      handleImportSingleMember(index, selectedMemberId, e.target.value);
                    }}
                    style={{ flex: 1 }}
                  >
                    <option value="">部下を選択して取込...</option>
                    {teamMembers.filter(tm => tm.id !== user.uid).map(tm => (
                      <option key={tm.id} value={tm.name} data-id={tm.id}>{tm.name}</option>
                    ))}
                  </select>
                )}
                <input type="text" value={member.name} onChange={(e) => handleMemberChange(index, 'name', e.target.value)} placeholder="手入力も可" style={{ flex: 1 }} />
              </div>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>担当項目</label>
              <input type="text" value={member.item} onChange={(e) => handleMemberChange(index, 'item', e.target.value)} placeholder="例: 新規架電" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>育成ステージ</label>
              <select value={member.stage} onChange={(e) => handleMemberChange(index, 'stage', e.target.value)}>
                <option value="STAGE 1">STAGE 1 (報告者)</option>
                <option value="STAGE 2">STAGE 2 (実行者)</option>
                <option value="STAGE 3">STAGE 3 (問題定義)</option>
                <option value="STAGE 4">STAGE 4 (経営者)</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>1. 今週の数字（KPI結果）</label>
              <input type="text" value={member.kpi} onChange={(e) => handleMemberChange(index, 'kpi', e.target.value)} />
            </div>
            <div className="form-group">
              <label>2. 最大の問題（症状ではなく原因）</label>
              <input type="text" value={member.problem} onChange={(e) => handleMemberChange(index, 'problem', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>3. 原因分析（真因：なぜ？をもう1段掘る）</label>
            <input type="text" value={member.cause} onChange={(e) => handleMemberChange(index, 'cause', e.target.value)} />
          </div>

          <div className="form-group">
            <label>4. 行動設計（誰が・何を・いつ・何回）</label>
            <textarea rows="2" value={member.action} onChange={(e) => handleMemberChange(index, 'action', e.target.value)}></textarea>
          </div>

          <div className="form-group highlight-box" style={{padding: '1rem'}}>
            <label>5. 実行結果と検証（＊必須記入）</label>
            <input type="text" placeholder="先週の行動の結果（数値で）：" value={member.result} onChange={(e) => handleMemberChange(index, 'result', e.target.value)} className="mb-1" />
            <div className="form-row" style={{alignItems: 'center'}}>
              <label style={{marginRight: '1rem', fontWeight: 'bold'}}>6. 再現性の検証:</label>
              <select value={member.reproducible} onChange={(e) => handleMemberChange(index, 'reproducible', e.target.value)} style={{width: '150px'}}>
                <option value="あり">◯ あり</option>
                <option value="なし">× なし</option>
              </select>
              {member.reproducible === 'なし' && (
                <input type="text" placeholder="なしの理由を記入" value={member.noReproReason} onChange={(e) => handleMemberChange(index, 'noReproReason', e.target.value)} style={{flex: 1, marginLeft: '1rem'}}/>
              )}
            </div>
          </div>

          <div className="form-group mt-2">
            <label>8. 責任者からの評価とフィードバック</label>
            <div className="form-row">
              <input type="text" placeholder="良い点" value={member.feedbackGood} onChange={(e) => handleMemberChange(index, 'feedbackGood', e.target.value)} />
              <input type="text" placeholder="改善点" value={member.feedbackBad} onChange={(e) => handleMemberChange(index, 'feedbackBad', e.target.value)} />
            </div>
            <input type="text" placeholder="来週の合意事項" value={member.feedbackAgreed} onChange={(e) => handleMemberChange(index, 'feedbackAgreed', e.target.value)} className="mt-1" />
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-secondary w-full" onClick={addMember} style={{width: '100%'}}>
        + メンバーを追加する
      </button>
    </div>
  );

  // --- Step 6: 育成記録 ---
  const renderStep6 = () => (
    <div className="step-content animate-fade-in">
      <h3>ロープレ・育成記録</h3>
      <p className="step-desc">ロープレは「やった回数」ではなく「何を改善したか」で評価する</p>

      <div className="calculation-box mb-2">
        <h4>ロープレ実施記録（今週）</h4>
        <p className="step-desc" style={{fontSize: '0.75rem'}}>※実施したロープレの記録を追加してください</p>
        
        {formData.roleplays.map((rp, index) => (
          <div key={index} className="form-row mt-1" style={{alignItems: 'flex-start', background: '#fff', padding: '1rem', borderRadius: '4px', flexWrap: 'wrap'}}>
            <div className="form-group" style={{minWidth: '150px'}}><label>実施日時</label><input type="text" placeholder="例: 5/12 水" value={rp.date} onChange={(e) => handleRoleplayChange(index, 'date', e.target.value)} /></div>
            <div className="form-group" style={{minWidth: '150px'}}><label>対象者</label><input type="text" placeholder="名前" value={rp.target} onChange={(e) => handleRoleplayChange(index, 'target', e.target.value)} /></div>
            <div className="form-group" style={{minWidth: '200px', flex: 2}}><label>テーマ（改善目的）</label><input type="text" placeholder="テーマ" value={rp.theme} onChange={(e) => handleRoleplayChange(index, 'theme', e.target.value)} /></div>
            <div className="form-group" style={{minWidth: '150px'}}><label>結果(数値)</label><input type="text" placeholder="結果" value={rp.result} onChange={(e) => handleRoleplayChange(index, 'result', e.target.value)} /></div>
            <div className="form-group" style={{minWidth: '120px'}}>
              <label>再現性</label>
              <select value={rp.reproducible} onChange={(e) => handleRoleplayChange(index, 'reproducible', e.target.value)}>
                <option value="あり">◯ あり</option>
                <option value="なし">× なし</option>
              </select>
            </div>
          </div>
        ))}
        
        <button type="button" className="btn btn-secondary w-full mt-1" onClick={addRoleplay} style={{width: '100%'}}>
          + ロープレ記録を追加する
        </button>
      </div>

      <div className="calculation-box highlight-box">
        <h4>育成の進捗サマリー（責任者視点）</h4>
        <div className="form-group mt-1">
          <label>今週最も成長したメンバー：</label>
          <input type="text" name="bestGrower" value={formData.bestGrower} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>最も重点的に育てるべき課題：</label>
          <input type="text" name="focusIssue" value={formData.focusIssue} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>来週の育成施策（具体的に）：</label>
          <textarea name="nextWeekMeasure" rows="2" value={formData.nextWeekMeasure} onChange={handleChange}></textarea>
        </div>
      </div>
    </div>
  );

  // --- Step 7: リスト分析 ---
  const renderStep7 = () => (
    <div className="step-content animate-fade-in">
      <h3>リスト分析</h3>
      <p className="step-desc">数字の背景にある「かけ先の質」を責任者として管理する</p>

      <div className="calculation-box mb-2">
        <h4>組織リスト状況（今週）</h4>
        <div className="calc-grid" style={{gridTemplateColumns: 'repeat(3, 1fr)'}}>
          <div className="form-group">
            <label>企業アタック率</label>
            <div style={{display:'flex', alignItems:'center'}}><input type="number" name="attackRate" value={formData.attackRate} onChange={handleChange} className="small-input"/> %</div>
            <small className="text-muted">理想：72〜78%</small>
          </div>
          <div className="form-group">
            <label>有料リスト比率</label>
            <div style={{display:'flex', alignItems:'center'}}><input type="number" name="paidListRate" value={formData.paidListRate} onChange={handleChange} className="small-input"/> %</div>
          </div>
          <div className="form-group">
            <label>接触率</label>
            <div style={{display:'flex', alignItems:'center'}}><input type="number" name="contactRate" value={formData.contactRate} onChange={handleChange} className="small-input"/> %</div>
          </div>
          <div className="form-group">
            <label>見込み比率</label>
            <div style={{display:'flex', alignItems:'center'}}><input type="number" name="prospectRate" value={formData.prospectRate} onChange={handleChange} className="small-input"/> %</div>
          </div>
          <div className="form-group">
            <label>アポ率</label>
            <div style={{display:'flex', alignItems:'center'}}><input type="number" name="apptRate" value={formData.apptRate} onChange={handleChange} className="small-input"/> %</div>
          </div>
        </div>
      </div>

      <div className="form-group">
        <label>来週のアプローチ方針：捨てるリスト（根拠を書く）</label>
        <textarea name="dropListReason" rows="2" placeholder="例：1か月以内の接触リストは除外" value={formData.dropListReason} onChange={handleChange}></textarea>
      </div>
      <div className="form-group">
        <label>追いかけるリスト（根拠を書く）</label>
        <textarea name="pursueListReason" rows="2" placeholder="例：有料媒体のみ優先" value={formData.pursueListReason} onChange={handleChange}></textarea>
      </div>
      <div className="form-group">
        <label>新規で抜くリスト（ソース・件数）</label>
        <input type="text" name="newListSource" value={formData.newListSource} onChange={handleChange} />
      </div>
      <div className="form-group highlight-box" style={{padding: '1rem'}}>
        <label>★ 来週のかけ先の優先順位</label>
        <textarea name="priority" rows="2" value={formData.priority} onChange={handleChange}></textarea>
      </div>
    </div>
  );

  // --- Step 8: コミット宣言 ---
  const renderStep8 = () => (
    <div className="step-content animate-fade-in">
      <h3>来週 コミット宣言</h3>
      <p className="step-desc">代表に「どうすれば？」を求めず、責任者として自分で決断し、宣言する</p>

      <div className="calculation-box mb-2">
        <label>01 組織目標（週間）</label>
        <div className="form-row mt-1">
          <div className="form-group"><label>受注(件)</label><input type="number" name="targetOrders" value={formData.targetOrders} onChange={handleChange}/></div>
          <div className="form-group"><label>粗利(P)</label><input type="number" name="targetGross" value={formData.targetGross} onChange={handleChange}/></div>
          <div className="form-group"><label>アポ(件)</label><input type="number" name="targetAppts" value={formData.targetAppts} onChange={handleChange}/></div>
          <div className="form-group"><label>行動(件)</label><input type="number" name="targetActions" value={formData.targetActions} onChange={handleChange}/></div>
        </div>
      </div>

      <div className="form-group">
        <label>02 自分自身の最優先行動</label>
        <p className="step-desc" style={{fontSize: '0.8rem', marginBottom: '0.5rem'}}>来週、責任者として最も重要だと判断した行動を1つ：</p>
        <textarea name="commitPriorityAction" rows="2" value={formData.commitPriorityAction} onChange={handleChange}></textarea>
      </div>

      <div className="form-group calculation-box">
        <label>03 育成の最重点（1名・1課題）</label>
        <div className="form-row mt-1">
          <input type="text" name="commitTrainName" placeholder="メンバー名" value={formData.commitTrainName} onChange={handleChange} />
          <input type="text" name="commitTrainIssue" placeholder="課題" value={formData.commitTrainIssue} onChange={handleChange} />
          <input type="text" name="commitTrainMeasure" placeholder="施策" value={formData.commitTrainMeasure} onChange={handleChange} />
        </div>
      </div>

      <div className="form-group highlight-box" style={{padding: '1rem'}}>
        <label>★ 04 先週と変えること</label>
        <p className="step-desc" style={{fontSize: '0.8rem', marginBottom: '0.5rem'}}>先週と何が違うのか。何を改める決意をしたか：</p>
        <textarea name="commitChanges" rows="3" value={formData.commitChanges} onChange={handleChange}></textarea>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch(currentStep) {
      case 0: return renderStep0();
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      case 8: return renderStep8();
      default: return null;
    }
  };

  return (
    <div className="weekly-form-page">
      {!isHistoryDetail && (
        <div className="page-header">
          <h1>週次報告入力</h1>
        </div>
      )}
      <div className="wizard-container glass-panel">
        <div className="stepper">
          {STEPS.map((step, index) => (
            <div key={index} className={`step-item ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}>
              <div className="step-circle">{index < currentStep ? <CheckCircle2 size={16} /> : index + 1}</div>
              <span className="step-label">{step}</span>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="report-form">
          {renderCurrentStep()}
          <div className="form-actions wizard-actions">
            <button type="button" className="btn btn-secondary" onClick={handlePrev} disabled={currentStep === 0}>戻る</button>
            {currentStep < STEPS.length - 1 ? (
              <div style={{display: 'flex', gap: '0.5rem'}}>
                <button type="button" className="btn btn-secondary" onClick={(e) => handleSubmit(e)} style={{background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)'}}>
                  <Save size={18} style={{marginRight: '0.25rem'}} /> 一時保存
                </button>
                <button type="button" className="btn btn-primary" onClick={handleNext}>次へ</button>
              </div>
            ) : (
              <div style={{display: 'flex', gap: '0.5rem'}}>
                <button type="button" className="btn btn-secondary" onClick={() => exportToCSV(formData)} style={{background: '#10b981', color: 'white', border: 'none'}}>
                  <FileSpreadsheet size={18} style={{marginRight: '0.25rem'}} /> CSV
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => exportToPPTX(formData)} style={{background: '#f97316', color: 'white', border: 'none'}}>
                  <Download size={18} style={{marginRight: '0.25rem'}} /> PPTX
                </button>
                <button type="submit" className="btn btn-primary submit-btn"><Save size={18} style={{marginRight: '0.25rem'}} /> 保存する</button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
