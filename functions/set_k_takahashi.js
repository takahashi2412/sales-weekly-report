const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'rushup-weekly-report' });

async function setExec() {
  const email = 'k.takahashi@rush-up.co.jp';
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { role: 'executive' });
    const db = admin.firestore();
    await db.collection('users').doc(user.uid).set({
      email: email,
      role: 'executive',
      title: '代表',
    }, { merge: true });
    
    // また念のためパスワードをリセット
    await admin.auth().updateUser(user.uid, { password: 'password123' });
    
    console.log(`Set executive role and password to password123 for ${email}`);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
setExec();
