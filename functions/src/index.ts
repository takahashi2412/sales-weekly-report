import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const assignUserRole = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth || context.auth.token.role !== 'executive') {
      throw new functions.https.HttpsError('permission-denied', 'Only executive can assign roles.');
    }
    
    const { uid, role, title } = data;
    
    if (!['executive', 'manager', 'leader'].includes(role)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid role.');
    }
    
    try {
      await admin.auth().getUser(uid); // 存在確認
    } catch (e) {
      throw new functions.https.HttpsError('not-found', '対象のアカウントがFirebase Authに存在しません: ' + uid);
    }
    
    // Set custom user claims using the correct Auth UID
    await admin.auth().setCustomUserClaims(uid, { role });
    
    // Sync role to users collection using the original document ID
    const updateData: any = {
      role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (title !== undefined) {
      updateData.title = title;
    }
    
    await admin.firestore().collection('users').doc(uid).update(updateData);
    
    return { success: true };
  } catch (error: any) {
    console.error("Error in assignUserRole:", error);
    
    // Convert common Firebase Auth errors to readable messages
    let message = error.message || String(error);
    if (error.code === 'auth/user-not-found' || message.includes('user record')) {
      message = '対象のアカウントがFirebase Authに存在しません。メールアドレスが正しく登録されているか確認してください。';
    }
    
    // Always use invalid-argument so the client UI sees the true message
    throw new functions.https.HttpsError('invalid-argument', message);
  }
});

export const debugAssign = functions.https.onRequest(async (req, res) => {
  try {
    const uid = req.query.uid as string;
    if (!uid) {
      res.send("No uid provided. Use ?uid=xxx");
      return;
    }
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      res.send(`User doc ${uid} not found`);
      return;
    }
    const email = userDoc.data()?.email;
    if (!email) {
      res.send(`User doc ${uid} has no email`);
      return;
    }
    const authUser = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(authUser.uid, { role: 'manager' });
    
    res.send(`Success! Auth UID: ${authUser.uid}, Email: ${email}`);
  } catch (e: any) {
    res.send(`ERROR: ${e.message}\nSTACK: ${e.stack}`);
  }
});

// ------------------------------------------------------------------
// Temporary Seed Function (Call via HTTP to seed productMasters)
// ------------------------------------------------------------------
export const seedProducts = functions.https.onRequest(async (req, res) => {
  const products = [
    {
      productId: 'visit', productName: 'HP（訪問）', productLabel: '訪問',
      isActive: true, validFrom: '2026-05-01', validTo: null,
      conversionRates: {
        manager: { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 1 },
        pmgr:    { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 2 },
        smgr:    { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 3 },
        tl:      { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 4 },
        general: { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 5 },
      }
    },
    {
      productId: 'web', productName: 'Web', productLabel: 'Web',
      isActive: true, validFrom: '2026-05-01', validTo: null,
      conversionRates: {
        manager: { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 1 },
        pmgr:    { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 2 },
        smgr:    { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 3 },
        tl:      { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 4 },
        general: { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 5 },
      }
    },
    {
      productId: 'replace', productName: 'リプレイス', productLabel: 'リプ',
      isActive: true, validFrom: '2026-05-01', validTo: null,
      conversionRates: {
        manager: { appointRate: 0.035, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 3 },
        pmgr:    { appointRate: 0.035, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 5 },
        smgr:    { appointRate: 0.035, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 6 },
        tl:      { appointRate: 0.040, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 8 },
        general: { appointRate: 0.040, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 8 },
      }
    },
    {
      productId: 'meo', productName: 'MEO', productLabel: 'MEO',
      isActive: true, validFrom: '2026-05-01', validTo: null,
      conversionRates: {
        manager: { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 2 },
        pmgr:    { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 4 },
        smgr:    { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 5 },
        tl:      { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 6 },
        general: { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 7 },
      }
    },
  ];

  try {
    for (const p of products) {
      await admin.firestore().collection('productMasters').doc(p.productId).set({
        ...p,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    res.send("Seeded products successfully!");
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});
