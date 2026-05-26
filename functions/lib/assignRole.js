"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignUserRole = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.assignUserRole = functions.https.onCall(async (data, context) => {
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
        }
        else {
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
    }
    catch (error) {
        console.error('assignUserRole error:', error);
        if (error.code === 'auth/user-not-found') {
            throw new functions.https.HttpsError('not-found', 'メールアドレス「' + email + '」のアカウントがFirebase Authに存在しません。');
        }
        throw new functions.https.HttpsError('failed-precondition', '権限設定に失敗しました: ' + error.message);
    }
});
//# sourceMappingURL=assignRole.js.map