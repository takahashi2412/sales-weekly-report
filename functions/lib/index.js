"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedProducts = exports.assignUserRole = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
exports.assignUserRole = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth || context.auth.token.role !== 'executive') {
            throw new functions.https.HttpsError('permission-denied', 'Only executive can assign roles.');
        }
        const { email, firestoreDocId, role, title } = data;
        if (!['executive', 'manager', 'leader'].includes(role)) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid role.');
        }
        let authUser;
        try {
            authUser = await admin.auth().getUserByEmail(email); // emailで検索
        }
        catch (e) {
            throw new functions.https.HttpsError('not-found', '対象のアカウントがFirebase Authに存在しません: ' + email);
        }
        // Set custom user claims using the Auth UID
        await admin.auth().setCustomUserClaims(authUser.uid, { role });
        // Sync role to users collection using the provided firestoreDocId
        const updateData = {
            role,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (title !== undefined) {
            updateData.title = title;
        }
        await admin.firestore().collection('users').doc(firestoreDocId).update(updateData);
        return { success: true };
    }
    catch (error) {
        console.error("Error in assignUserRole:", error);
        let message = error.message || String(error);
        if (error.code === 'auth/user-not-found' || message.includes('user record')) {
            message = '対象のアカウントがFirebase Authに存在しません。メールアドレスが正しく登録されているか確認してください。';
        }
        throw new functions.https.HttpsError('invalid-argument', message);
    }
});
// ------------------------------------------------------------------
// Temporary Seed Function (Call via HTTP to seed productMasters)
// ------------------------------------------------------------------
exports.seedProducts = functions.https.onRequest(async (req, res) => {
    const products = [
        {
            productId: 'visit', productName: 'HP（訪問）', productLabel: '訪問',
            isActive: true, validFrom: '2026-05-01', validTo: null,
            conversionRates: {
                manager: { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 1 },
                pmgr: { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 2 },
                smgr: { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 3 },
                tl: { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 4 },
                general: { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 5 },
            }
        },
        {
            productId: 'web', productName: 'Web', productLabel: 'Web',
            isActive: true, validFrom: '2026-05-01', validTo: null,
            conversionRates: {
                manager: { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 1 },
                pmgr: { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 2 },
                smgr: { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 3 },
                tl: { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 4 },
                general: { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 5 },
            }
        },
        {
            productId: 'replace', productName: 'リプレイス', productLabel: 'リプ',
            isActive: true, validFrom: '2026-05-01', validTo: null,
            conversionRates: {
                manager: { appointRate: 0.035, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 3 },
                pmgr: { appointRate: 0.035, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 5 },
                smgr: { appointRate: 0.035, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 6 },
                tl: { appointRate: 0.040, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 8 },
                general: { appointRate: 0.040, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 8 },
            }
        },
        {
            productId: 'meo', productName: 'MEO', productLabel: 'MEO',
            isActive: true, validFrom: '2026-05-01', validTo: null,
            conversionRates: {
                manager: { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 2 },
                pmgr: { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 4 },
                smgr: { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 5 },
                tl: { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 6 },
                general: { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 7 },
            }
        },
    ];
    try {
        for (const p of products) {
            await admin.firestore().collection('productMasters').doc(p.productId).set(Object.assign(Object.assign({}, p), { createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
        }
        res.send("Seeded products successfully!");
    }
    catch (err) {
        res.status(500).send(err.message);
    }
});
__exportStar(require("./csvImport"), exports);
//# sourceMappingURL=index.js.map