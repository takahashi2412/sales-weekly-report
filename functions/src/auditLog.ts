import * as admin from 'firebase-admin';

export async function recordAuditLog(params: {
  action: string;
  executorUid: string;
  target: { type: string; id: string; name: string };
  changes?: { before?: any; after?: any };
  metadata?: any;
}) {
  try {
    // 実行者の情報を取得
    const executorDoc = await admin.firestore()
      .collection('users').doc(params.executorUid).get();
    const executor = executorDoc.exists ? executorDoc.data() : null;
    
    await admin.firestore().collection('auditLogs').add({
      action: params.action,
      executedBy: {
        uid: params.executorUid,
        email: executor?.email || '',
        name: executor?.name || '',
        role: executor?.role || ''
      },
      target: params.target,
      changes: params.changes || {},
      metadata: params.metadata || {},
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error('Failed to record audit log:', e);
    // ログ記録失敗はメイン処理を止めない
  }
}
