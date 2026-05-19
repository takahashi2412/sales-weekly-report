"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAuditLog = void 0;
const admin = require("firebase-admin");
async function recordAuditLog(params) {
    try {
        // 実行者の情報を取得
        const executorDoc = await admin.firestore()
            .collection('users').doc(params.executorUid).get();
        const executor = executorDoc.exists ? executorDoc.data() : null;
        await admin.firestore().collection('auditLogs').add({
            action: params.action,
            executedBy: {
                uid: params.executorUid,
                email: (executor === null || executor === void 0 ? void 0 : executor.email) || '',
                name: (executor === null || executor === void 0 ? void 0 : executor.name) || '',
                role: (executor === null || executor === void 0 ? void 0 : executor.role) || ''
            },
            target: params.target,
            changes: params.changes || {},
            metadata: params.metadata || {},
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    catch (e) {
        console.error('Failed to record audit log:', e);
        // ログ記録失敗はメイン処理を止めない
    }
}
exports.recordAuditLog = recordAuditLog;
//# sourceMappingURL=auditLog.js.map