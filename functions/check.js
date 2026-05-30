const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'rushup-weekly-report' });
const db = admin.firestore();
async function check() {
  const wSnap = await db.collection('weeklyReports').limit(1).get();
  const rSnap = await db.collection('reports').limit(1).get();
  console.log(`weeklyReports count: ${wSnap.size}`);
  console.log(`reports count: ${rSnap.size}`);
}
check().catch(console.error);
