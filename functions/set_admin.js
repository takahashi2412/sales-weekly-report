const admin = require('firebase-admin');

// 認証情報を環境変数やデフォルトから取得
admin.initializeApp({
  projectId: 'rushup-weekly-report'
});

async function setExecutive() {
  const email = 'keitakahashi2412@gmail.com';
  try {
    // Authからユーザーを取得
    const userRecord = await admin.auth().getUserByEmail(email);
    const uid = userRecord.uid;
    console.log(`Found user: ${uid} (${email})`);

    // カスタムクレームを設定
    await admin.auth().setCustomUserClaims(uid, { role: 'executive' });
    console.log('Successfully set custom claims: { role: "executive" }');

    // Firestoreのusersコレクションを更新
    const db = admin.firestore();
    await db.collection('users').doc(uid).set({
      email: email,
      role: 'executive',
      title: '代表',
    }, { merge: true });
    
    console.log('Successfully updated Firestore users collection');
    process.exit(0);
  } catch (error) {
    console.error('Error setting executive role:', error);
    process.exit(1);
  }
}

setExecutive();
