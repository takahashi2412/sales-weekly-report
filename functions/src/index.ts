import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

/**
 * assignUserRole - ロール割当Cloud Function（v4修正版）
 * 根本修正：UIDではなくメールアドレスでFirebase Authユーザーを特定する。
 */
export const assignUserRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'ログインが必要です。');
  }
  if (context.auth.token.role !== 'executive') {
    throw new functions.https.HttpsError('permission-denied', 'executive権限が必要です。');
  }

  const { email, role, title, firestoreDocId } = data;

  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'メールアドレスが必要です。');
  }
  if (!['executive', 'manager', 'leader'].includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', '無効なロールです。');
  }

  try {
    const authUser = await admin.auth().getUserByEmail(email);
    const authUid = authUser.uid;
    await admin.auth().setCustomUserClaims(authUid, { role });

    const docId = firestoreDocId || authUid;
    const userDocRef = admin.firestore().collection('users').doc(docId);
    const userDoc = await userDocRef.get();

    if (userDoc.exists) {
      await userDocRef.update({
        role, title: title || '', uid: authUid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      const querySnap = await admin.firestore().collection('users')
        .where('email', '==', email).limit(1).get();
      if (!querySnap.empty) {
        await querySnap.docs[0].ref.update({
          role, title: title || '', uid: authUid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
    return { success: true, authUid, email, role };
  } catch (error: any) {
    console.error('assignUserRole error:', error);
    if (error.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError('not-found',
        `メールアドレス「${email}」のアカウントがFirebase Authに存在しません。`);
    }
    throw new functions.https.HttpsError('failed-precondition',
      `権限設定に失敗しました: ${error.message}`);
  }
});

export * from './csvImport';

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
