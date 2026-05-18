import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const assignUserRole = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.role !== 'executive') {
    throw new functions.https.HttpsError('permission-denied', 'Only executive can assign roles.');
  }
  
  const { uid, role, title } = data;
  
  if (!['executive', 'manager', 'leader'].includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid role.');
  }
  
  // Set custom user claims
  await admin.auth().setCustomUserClaims(uid, { role });
  
  // Sync role to users collection
  await admin.firestore().collection('users').doc(uid).update({
    role,
    title,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  return { success: true };
});
