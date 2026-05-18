"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignUserRole = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
exports.assignUserRole = functions.https.onCall(async (data, context) => {
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
//# sourceMappingURL=index.js.map