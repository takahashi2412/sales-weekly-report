

=== Rushup営業PF_Firestoreセキュリティルール設計書_v4.docx ===


Rushup 営業プラットフォーム
Firestoreセキュリティルール設計書
Version 4.0（CSV取込・dailyKpiSummary対応）
作成日：2026年5月18日
項目
内容
対象DB
Cloud Firestore（rushup-weekly-report）
ロール構成
executive / manager / leader（3種）
対象コレクション
14コレクション（v3:12 + dailyKpiSummary + csvImportLogs）
実装フェーズ
Phase 1（簡易版）→ Phase 2（CSV取込対応含む完全版）
v4変更点
★ dailyKpiSummary・csvImportLogs追加　★ dailyKpiのCSV取込上書きルール　★ CSV関連はmanager以上に拡大


1. 設計原則と前提知識
1.1 セキュリティ設計の5原則
原則
内容
① 最小権限
各ロールは業務上必要な最小限のデータのみアクセス可能
② 本人書込
業務データは本人のみ書込可（CSV取込はmanager以上の例外）
③ 階層読取
managerは配下メンバーのデータを読取可
④ 商材マスタ保護
productMastersはexecutiveのみ変更可
★ ⑤ CSV取込権限
CSV取込（dailyKpi一括書込・dailyKpiSummary・csvImportLogs）はmanager以上に限定
1.2 ロール判定の仕組み
Firebase Auth のカスタムクレームに role を設定（request.auth.token.role で参照）
カスタムクレームはCloud Functions（Admin SDK）で設定
users コレクションの role フィールドと常に同期


2. コレクション別アクセス権限設計（v4 14コレクション）
コレクション
executive
manager
leader
System
備考
productMasters
R/W
R
R
—
executiveのみ書込
userProductAssignments
R/W
R/W(部下)
R(自分)
—
manager以上が割当
users
R/W
R(部下)/W(自分)
R/W(自分)
—
roleはexecutiveのみ
teams
R/W
R
R
—
executiveのみ書込
▲ dailyKpi
R全社
R(部下) W(自分+CSV取込)
R/W(自分)
R/W
▲ source=csv_importはmanager以上が部下分も書込可
★ dailyKpiSummary
R全社
R/W
R
R/W
★ 商材別の全社合計。manager以上が書込
★ csvImportLogs
R全社
R/W
R(自分実行分)
—
★ 取込履歴。削除禁止
kpiTargets
R全社
R(部下)/W承認
R/W(自分)
—
承認はmanager以上
weeklyReports
R全社
R(部下)/W(自分)
R/W(自分)
—
本人のみ書込
educationRecords
R全社
R/W(担当)
R(自分)
—
trainerIdがmanager以上
improveTasks
R全社
R/W(担当)
R/W(自分)
—
assignedByがmanager以上
aiAnalysis
R全社
R(部下)
R(自分)
R/W
フロント書込不可
notifications
R全社
R/W(部下)
R/W(自分)
R/W
既読更新のみ本人
alerts
R全社
R(部下)
R(自分)
R/W
フロント書込不可


3. Phase 1 セキュリティルール（簡易版・CSV対応）
Phase 1では「ログイン必須」「自分のデータのみ書込」「同チームのデータは読取可」を基本とする。CSV取込関連のルールも含む（Phase 2でK-07実装時に有効化）。
以下のルールをそのまま firestore.rules にコピーしてください。
rules_version = &apos;2&apos;;
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() { return request.auth != null; }
    function getRole() { return request.auth.token.role; }
    function isExecutive() { return isAuthenticated() &amp;&amp; getRole() == &apos;executive&apos;; }
    function isManagerOrAbove() {
      return isAuthenticated() &amp;&amp; (getRole() == &apos;executive&apos; || getRole() == &apos;manager&apos;);
    }
    function isOwner(userId) { return isAuthenticated() &amp;&amp; request.auth.uid == userId; }

    // ★ productMasters
    match /productMasters/{productId} {
      allow read: if isAuthenticated();
      allow create, update, delete: if isExecutive();
    }

    // ★ userProductAssignments
    match /userProductAssignments/{assignmentId} {
      allow read: if isAuthenticated() &amp;&amp;
        (resource.data.userId == request.auth.uid || isManagerOrAbove());
      allow create: if isManagerOrAbove() &amp;&amp;
        request.resource.data.assignedBy == request.auth.uid;
      allow update: if isManagerOrAbove();
      allow delete: if isExecutive();
    }

    // users
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow update: if isOwner(userId) &amp;&amp;
        !(&apos;role&apos; in request.resource.data.diff(resource.data).affectedKeys()) &amp;&amp;
        !(&apos;currentProductId&apos; in request.resource.data.diff(resource.data).affectedKeys());
      allow create, delete: if isExecutive();
      allow update: if isExecutive();
    }

    // teams
    match /teams/{teamId} {
      allow read: if isAuthenticated();
      allow create, update, delete: if isExecutive();
    }

    // ▲ dailyKpi（v4: CSV取込上書きルール追加）
    match /dailyKpi/{docId} {
      allow read: if isAuthenticated() &amp;&amp;
        (resource.data.userId == request.auth.uid || isManagerOrAbove());
      // 作成：本人 OR manager以上（CSV取込時）
      allow create: if isAuthenticated() &amp;&amp; (
        request.resource.data.userId == request.auth.uid ||
        (isManagerOrAbove() &amp;&amp; request.resource.data.source == &apos;csv_import&apos;)
      );
      // 更新：本人（手動修正）OR manager以上（CSV取込上書き）
      allow update: if isAuthenticated() &amp;&amp; (
        (resource.data.userId == request.auth.uid &amp;&amp;
         request.resource.data.userId == request.auth.uid) ||
        (isManagerOrAbove() &amp;&amp; request.resource.data.source == &apos;csv_import&apos;)
      );
      allow delete: if isExecutive();
    }

    // ★ dailyKpiSummary（v4新規）— 商材別の全社合計
    match /dailyKpiSummary/{summaryId} {
      allow read: if isAuthenticated();
      allow create, update: if isManagerOrAbove();
      allow delete: if isExecutive();
    }

    // ★ csvImportLogs（v4新規）— CSV取込履歴
    match /csvImportLogs/{logId} {
      // 全ログインユーザーが読取可
      allow read: if isAuthenticated();
      // 作成はmanager以上（importedByが自分のUIDと一致）
      allow create: if isManagerOrAbove() &amp;&amp;
        request.resource.data.importedBy == request.auth.uid;
      // 更新はexecutiveのみ（手動修正用）
      allow update: if isExecutive();
      // 削除は禁止（履歴は永久保持）
      allow delete: if false;
    }

    // kpiTargets
    match /kpiTargets/{docId} {
      allow read: if isAuthenticated() &amp;&amp;
        (resource.data.userId == request.auth.uid || isManagerOrAbove());
      allow create: if isAuthenticated() &amp;&amp;
        request.resource.data.userId == request.auth.uid &amp;&amp;
        request.resource.data.status == &apos;pending&apos;;
      allow update: if isAuthenticated() &amp;&amp; (
        (resource.data.userId == request.auth.uid &amp;&amp;
         resource.data.status == &apos;pending&apos; &amp;&amp;
         request.resource.data.userId == request.auth.uid) ||
        (isManagerOrAbove() &amp;&amp;
         request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly([&apos;status&apos;, &apos;approvedBy&apos;, &apos;comment&apos;, &apos;updatedAt&apos;]))
      );
      allow delete: if isExecutive();
    }

    // weeklyReports
    match /weeklyReports/{docId} {
      allow read: if isAuthenticated() &amp;&amp;
        (resource.data.userId == request.auth.uid || isManagerOrAbove());
      allow create: if isAuthenticated() &amp;&amp;
        request.resource.data.userId == request.auth.uid;
      allow update: if isAuthenticated() &amp;&amp;
        resource.data.userId == request.auth.uid &amp;&amp;
        request.resource.data.userId == request.auth.uid;
      allow delete: if isAuthenticated() &amp;&amp;
        (resource.data.userId == request.auth.uid || isExecutive());
    }

    // educationRecords
    match /educationRecords/{docId} {
      allow read: if isAuthenticated() &amp;&amp;
        (resource.data.userId == request.auth.uid || isManagerOrAbove());
      allow create: if isManagerOrAbove() &amp;&amp;
        request.resource.data.trainerId == request.auth.uid;
      allow update: if isManagerOrAbove() &amp;&amp;
        resource.data.trainerId == request.auth.uid;
      allow delete: if isExecutive();
    }

    // improveTasks
    match /improveTasks/{docId} {
      allow read: if isAuthenticated() &amp;&amp;
        (resource.data.userId == request.auth.uid ||
         resource.data.assignedBy == request.auth.uid ||
         isManagerOrAbove());
      allow create: if isManagerOrAbove() &amp;&amp;
        request.resource.data.assignedBy == request.auth.uid;
      allow update: if isAuthenticated() &amp;&amp; (
        (resource.data.userId == request.auth.uid &amp;&amp;
         request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly([&apos;status&apos;, &apos;result&apos;, &apos;updatedAt&apos;, &apos;comments&apos;])) ||
        resource.data.assignedBy == request.auth.uid ||
        isExecutive()
      );
      allow delete: if isExecutive();
    }

    // aiAnalysis — フロント書込不可
    match /aiAnalysis/{docId} {
      allow read: if isAuthenticated() &amp;&amp;
        (resource.data.userId == request.auth.uid || isManagerOrAbove());
      allow write: if false;
    }

    // notifications — 既読のみ本人が更新可
    match /notifications/{docId} {
      allow read: if isAuthenticated() &amp;&amp;
        (resource.data.userId == request.auth.uid || isManagerOrAbove());
      allow update: if isAuthenticated() &amp;&amp;
        resource.data.userId == request.auth.uid &amp;&amp;
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([&apos;read&apos;]);
      allow create, delete: if false;
    }

    // alerts — フロント書込不可
    match /alerts/{docId} {
      allow read: if isAuthenticated() &amp;&amp;
        (resource.data.userId == request.auth.uid || isManagerOrAbove());
      allow write: if false;
    }
  }
}


4. テストケース一覧（v4追加分含む）
4.1 CSV取込関連テスト（v4新規）
No.
操作
実行ロール
期待結果
確認観点
CSV-1
CSV取込（part下のdailyKpi一括作成）
manager
✅ 許可
source=csv_importでmanager以上が部下分のdailyKpiを作成できる
CSV-2
CSV取込
leader
❌ 拒否
leaderはCSV取込でのdailyKpi一括作成ができない
CSV-3
dailyKpiSummary作成
manager
✅ 許可
商材別の全社合計を作成できる
CSV-4
dailyKpiSummary作成
leader
❌ 拒否
leaderは全社合計を作成できない
CSV-5
csvImportLogs作成
manager
✅ 許可
importedByが自分のUIDで取込ログを作成できる
CSV-6
他人をimportedByで取込ログ作成
manager
❌ 拒否
importedByを他人のIDにすり替えると拒否
CSV-7
csvImportLogs削除
executive
❌ 拒否
履歴削除は全員不可（永久保持）
CSV-8
dailyKpi.sourceを&quot;csv_import&quot;で部下分を更新
manager
✅ 許可
CSV取込時の上書きが可能
CSV-9
dailyKpiの履歴データを削除
manager
❌ 拒否
削除はexecutiveのみ。managerでも不可
4.2 その他重要テスト（v3から継承）
No.
操作
実行ロール
期待結果
確認観点
A-1
productMastersに書込
manager
❌ 拒否
manager以下はproductMastersの書込不可
A-2
自分のroleを変更
manager
❌ 拒否
自己昇格の防止
A-3
他人のdailyKpiを手動入力
leader
❌ 拒否
source=manualは本人のみ
A-4
未ログインで全コレクション
未認証
❌ 拒否
全アクセス拒否
A-5
KGI承認
manager
✅ 許可
status・approvedByのみ変更可


5. Phase 1 リリース前チェックリスト
No.
確認項目
確認方法
□
productMastersへの不正書込が拒否される
テスト A-1
□
自己昇格が拒否される（role変更）
テスト A-2
□
他人のデータ書込が拒否される
テスト A-3
□
未ログインで全拒否
テスト A-4
□
CSV取込がmanager以上のみ許可される（Phase 2リリース前）
テスト CSV-1〜9
□
カスタムクレームが正しく設定される
getIdTokenResult()でrole確認
□
Firestore Emulatorで全テストケース通過
firebase emulators:start

=== Rushup営業PF_Phase1_Phase2実装指示書_v4.docx ===


Rushup 営業プラットフォーム
Phase 1 + Phase 2 実装指示書
Google Antigravity 実装担当 向け（v4.0 完全版）
作成日：2026年5月18日　　設計：Claude（Rushupプロジェクト）
項目
内容
対象リポジトリ
https://github.com/takahashi2412/sales-weekly-report
公開URL
https://rushup-weekly-report.web.app
技術スタック
React + Vite / Firebase Auth / Cloud Firestore / Cloud Functions / Firebase Hosting
目標期間
Phase 1: 2週間　+　Phase 2: 3〜5週間（合計 約7週間）
Phase 1 の目標
認証・商材マスタ・組織管理・ダッシュボードの土台完成
Phase 2 の目標
CSV自動取込・KGI承認フロー・KPI入力・改善管理・教育管理の完成
参照設計書
・Rushup営業PF_簡易仕様書_v4.docx
・Rushup営業PF_画面構成設計書_v4.docx
・Rushup営業PF_Firestoreセキュリティルール設計書_v4.docx


0. 全体方針と前提
0.1 v4の重要変更点（必ず確認）
Phase 1には「商材マスタ管理」が含まれます。Phase 2には「CSV自動取込」が含まれます。両方ともコア機能のため、設計書通りに実装してください。

KPI入力方式は「CSV自動取込（メイン）＋手動入力（バックアップ）」の2系統
CSVは商材ごとに別ファイル（ファイル名に商材ID）。文字コードはCP932
時間帯は14時間帯（v3の11時間帯から変更）。0:00〜23:59を含む
CSV取込権限はmanager以上（executive限定ではない）
商材ごとの全社合計を dailyKpiSummary に保存（ダッシュボード高速化）
0.2 既存コードの状態
機能
状態
Phase 1/2 での対応
週次報告入力（WeeklyForm）
✅ 完了
Phase 1：そのまま移植
マイヒストリー
✅ 完了
Phase 1：R-04として改修
PowerPoint/CSV出力
✅ 完了
Phase 1：Firestore対応確認
Firestore移行
✅ 完了
Phase 1：セキュリティルール更新
ログイン画面
⚠️ UIのみ
Phase 1：Firebase Auth実装
ダッシュボード
⚠️ モック
Phase 1：ロール別・商材別に実装
チーム管理（TeamManagement.jsx）
⚠️ 一部
Phase 1：S-02として改修
★ 商材マスタ
🆕 未実装
Phase 1：S-06として新規作成
★ CSV取込
🆕 未実装
Phase 2：K-07として新規作成
★ dailyKpiSummary
🆕 未実装
Phase 2：CSV取込時に同時書込


Phase 1：土台構築（目安2週間）
Phase 1 実装順序
No.
タスク
依存
期間
優先度
画面
P1-1
Firebase Auth実装（3ロール・カスタムクレーム）
なし
1〜2日
🔴 最高
C-01
P1-2
Firestoreルール Phase 1全面更新
P1-1
0.5日
🔴 最高
—
P1-3
useAuth + AuthGuard + ルーティング
P1-1,2
0.5日
🔴 最高
共通
P1-4
サイドバー + トップバー（商材バッジ含む）
P1-3
0.5日
🟠 高
共通
P1-5
S-01 ユーザー管理（担当商材フィールド）
P1-3,4
1日
🟠 高
S-01
P1-6
S-06 商材マスタ管理（新規作成）
P1-3,4
1〜1.5日
🟠 高
S-06
P1-7
S-02 組織管理（商材変更履歴タブ）
P1-5,6
1〜1.5日
🟠 高
S-02
P1-8
H-01 ダッシュボード（ロール別）
P1-5,6,7
1〜1.5日
🟡 中
H-01
P1-9
R-02 週次報告（既存移植）
P1-3
0.5日
🟡 中
R-02
P1-10
R-04 提出履歴 + R-05 レポート詳細
P1-9
0.5日
🟡 中
R-04,05
P1-11
PPT/CSV出力 Firestore対応確認
P1-3
0.5日
🟢 低
—
P1-12
レスポンシブ崩れ修正
全完了
0.5日
🟢 低
全画面
P1-1：Firebase Auth + Cloud Functions実装
// functions/src/auth.ts
import * as functions from &apos;firebase-functions&apos;;
import * as admin from &apos;firebase-admin&apos;;
admin.initializeApp();

export const assignUserRole = functions.https.onCall(async (data, context) =&gt; {
  if (!context.auth || context.auth.token.role !== &apos;executive&apos;) {
    throw new functions.https.HttpsError(&apos;permission-denied&apos;, &apos;Only executive can assign roles.&apos;);
  }
  const { uid, role, title } = data;
  if (![&apos;executive&apos;,&apos;manager&apos;,&apos;leader&apos;].includes(role)) {
    throw new functions.https.HttpsError(&apos;invalid-argument&apos;, &apos;Invalid role.&apos;);
  }
  await admin.auth().setCustomUserClaims(uid, { role });
  await admin.firestore().collection(&apos;users&apos;).doc(uid).update({
    role, title,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { success: true };
});
P1-3：useAuth フック
// src/hooks/useAuth.ts
import { useState, useEffect, createContext, useContext } from &apos;react&apos;;
import { getAuth, onAuthStateChanged } from &apos;firebase/auth&apos;;
import { doc, getDoc } from &apos;firebase/firestore&apos;;
import { db } from &apos;../firebase/config&apos;;

export type UserRole = &apos;executive&apos; | &apos;manager&apos; | &apos;leader&apos;;

const AuthContext = createContext&lt;any&gt;(null);

export const AuthProvider = ({ children }) =&gt; {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() =&gt; {
    const auth = getAuth();
    return onAuthStateChanged(auth, async (fbUser) =&gt; {
      if (fbUser) {
        const tokenResult = await fbUser.getIdTokenResult(true);
        const role = (tokenResult.claims.role as UserRole) || &apos;leader&apos;;
        const userDoc = await getDoc(doc(db, &apos;users&apos;, fbUser.uid));
        const data = userDoc.data();
        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
          role,
          title: data?.title || &apos;&apos;,
          teamId: data?.teamId || &apos;&apos;,
          currentProductId: data?.currentProductId || &apos;&apos;,
        });
      } else { setUser(null); }
      setLoading(false);
    });
  }, []);

  const isExecutive = user?.role === &apos;executive&apos;;
  const isManagerOrAbove = [&apos;executive&apos;,&apos;manager&apos;].includes(user?.role);
  return (
    &lt;AuthContext.Provider value={{ user, loading, isExecutive, isManagerOrAbove }}&gt;
      {children}
    &lt;/AuthContext.Provider&gt;
  );
};

export const useAuth = () =&gt; useContext(AuthContext);
P1-6：S-06 商材マスタ初期データ投入
// scripts/seedProductMasters.ts
// 実行: npx ts-node scripts/seedProductMasters.ts
import * as admin from &apos;firebase-admin&apos;;
admin.initializeApp();
const db = admin.firestore();

const products = [
  {
    productId: &apos;visit&apos;, productName: &apos;HP（訪問）&apos;, productLabel: &apos;訪問&apos;,
    isActive: true, validFrom: &apos;2026-05-01&apos;, validTo: null,
    conversionRates: {
      manager: { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 1 },
      pmgr:    { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 2 },
      smgr:    { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 3 },
      tl:      { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 4 },
      general: { appointRate: 0.013, adoptionRate: 0.40, orderRate: 0.20, monthlyOrderTarget: 5 },
    }
  },
  {
    productId: &apos;web&apos;, productName: &apos;Web&apos;, productLabel: &apos;Web&apos;,
    isActive: true, validFrom: &apos;2026-05-01&apos;, validTo: null,
    conversionRates: {
      manager: { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 1 },
      pmgr:    { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 2 },
      smgr:    { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 3 },
      tl:      { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 4 },
      general: { appointRate: 0.020, adoptionRate: 0.50, orderRate: 0.15, monthlyOrderTarget: 5 },
    }
  },
  {
    productId: &apos;replace&apos;, productName: &apos;リプレイス&apos;, productLabel: &apos;リプ&apos;,
    isActive: true, validFrom: &apos;2026-05-01&apos;, validTo: null,
    conversionRates: {
      manager: { appointRate: 0.035, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 3 },
      pmgr:    { appointRate: 0.035, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 5 },
      smgr:    { appointRate: 0.035, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 6 },
      tl:      { appointRate: 0.040, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 8 },
      general: { appointRate: 0.040, adoptionRate: 1.0, orderRate: 0.25, monthlyOrderTarget: 8 },
    }
  },
  {
    productId: &apos;meo&apos;, productName: &apos;MEO&apos;, productLabel: &apos;MEO&apos;,
    isActive: true, validFrom: &apos;2026-05-01&apos;, validTo: null,
    conversionRates: {
      manager: { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 2 },
      pmgr:    { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 4 },
      smgr:    { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 5 },
      tl:      { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 6 },
      general: { appointRate: 0.020, adoptionRate: 1.0, orderRate: 0.20, monthlyOrderTarget: 7 },
    }
  },
];

(async () =&gt; {
  for (const p of products) {
    await db.collection(&apos;productMasters&apos;).doc(p.productId).set({
      ...p,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(&apos;✅ &apos; + p.productName);
  }
})();


Phase 2：機能拡張（目安3〜5週間、CSV取込含む）
Phase 2 実装順序
No.
タスク
依存
期間
優先度
画面
P2-1
★ Cloud Functions: parseHourlyKpiCsv
P1完了
2日
🔴 最高
Functions
P2-2
★ Cloud Functions: commitCsvImport
P2-1
1日
🔴 最高
Functions
P2-3
★ K-07 CSV取込画面（5ステップ）
P2-1,2
2〜3日
🔴 最高
K-07
P2-4
K-02 KPI日次入力（手動・バックアップ）
P1完了
1.5日
🟠 高
K-02
P2-5
K-03 KGI月次設定（承認フロー）
P1完了
2日
🟠 高
K-03
P2-6
K-01 KPIダッシュボード（商材別・全社合計）
P2-3
1.5日
🟠 高
K-01
P2-7
K-04 KPI履歴・推移（sourceバッジ）
P2-3
1日
🟡 中
K-04
P2-8
K-05 KPI比較・着地予測
P2-3
1日
🟡 中
K-05
P2-9
K-06 KPI詳細
P2-3
1日
🟡 中
K-06
P2-10
D-01〜D-05 日報管理 全5画面
P1完了
2日
🟡 中
D-01〜05
P2-11
P-01〜P-04 進捗管理 全4画面
P2-3,6
2日
🟡 中
P-01〜04
P2-12
I-01〜I-05 改善管理 全5画面
P1完了
1.5日
🟡 中
I-01〜05
P2-13
E-01〜E-05 教育管理 5画面
P1完了
1.5日
🟡 中
E-01〜05
P2-14
R-01,03,06 レポート残り3画面
P1完了
1日
🟢 低
R-01,03,06
P2-15
アラート通知（6パターン・取込忘れ含む）
P2-3
1.5日
🟢 低
C-03
P2-16
C-02 プロフィール・C-03 通知一覧
P2-15
1日
🟢 低
C-02,03
P2-17
S-03,S-04 権限・項目設定
P1完了
1日
🟢 低
S-03,04
P2-1 + P2-2：Cloud Functions CSV取込
parseHourlyKpiCsv（CSVパース＋プレビュー返却）
// functions/src/csvImport.ts
import * as functions from &apos;firebase-functions&apos;;
import * as admin from &apos;firebase-admin&apos;;
import iconv from &apos;iconv-lite&apos;;
import { parse } from &apos;csv-parse/sync&apos;;

const PRODUCT_IDS = [&apos;visit&apos;, &apos;web&apos;, &apos;replace&apos;, &apos;meo&apos;];

export const parseHourlyKpiCsv = functions.https.onCall(async (data, context) =&gt; {
  // 1. 権限チェック：manager以上
  if (!context.auth || ![&apos;executive&apos;,&apos;manager&apos;].includes(context.auth.token.role)) {
    throw new functions.https.HttpsError(&apos;permission-denied&apos;, &apos;Only manager+ can import CSV.&apos;);
  }

  const { fileBuffer, fileName } = data;  // fileBufferはBase64

  // 2. ファイル名から商材IDと日付を抽出
  // 例: &quot;時間別_visit_20260518_20260518.csv&quot;
  const match = fileName.match(/時間別_([a-z]+)_(\d{4})(\d{2})(\d{2})_(\d{4})(\d{2})(\d{2})\.csv/);
  if (!match) {
    throw new functions.https.HttpsError(&apos;invalid-argument&apos;,
      &apos;Invalid filename. Expected: 時間別_{productId}_YYYYMMDD_YYYYMMDD.csv&apos;);
  }
  const [, productId, sy, sm, sd, ey, em, ed] = match;
  if (!PRODUCT_IDS.includes(productId)) {
    throw new functions.https.HttpsError(&apos;invalid-argument&apos;,
      `Invalid productId in filename: ${productId}`);
  }
  const targetDate = `${sy}-${sm}-${sd}`;
  if (targetDate !== `${ey}-${em}-${ed}`) {
    throw new functions.https.HttpsError(&apos;invalid-argument&apos;,
      &apos;Multi-day CSV is not supported. Start and end date must match.&apos;);
  }

  // 3. productMasters の存在確認
  const productDoc = await admin.firestore()
    .collection(&apos;productMasters&apos;).doc(productId).get();
  if (!productDoc.exists) {
    throw new functions.https.HttpsError(&apos;not-found&apos;,
      `Product not found: ${productId}`);
  }

  // 4. CP932 → UTF-8 デコード
  const buffer = Buffer.from(fileBuffer, &apos;base64&apos;);
  const text = iconv.decode(buffer, &apos;cp932&apos;);

  // 5. CSVパース
  const records = parse(text, { skip_empty_lines: true });

  // 6. バリデーション
  if (records.length &lt; 4) {
    throw new functions.https.HttpsError(&apos;invalid-argument&apos;, &apos;Not enough rows.&apos;);
  }
  if (records[0].length !== 85) {
    throw new functions.https.HttpsError(&apos;invalid-argument&apos;,
      `Invalid column count: ${records[0].length} (expected 85)`);
  }

  // 7. 時間帯定義（14時間帯）
  const HOUR_LABELS = [
    &apos;early&apos;,  // 0:00〜8:59
    9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    &apos;late&apos;,   // 21:00〜23:59
  ];
  const KPI_KEYS = [&apos;total&apos;,&apos;actual&apos;,&apos;recall&apos;,&apos;owner&apos;,&apos;prospect&apos;,&apos;appoint&apos;];

  // 8. メンバー名→userIdの名寄せ準備
  const usersSnap = await admin.firestore().collection(&apos;users&apos;).get();
  const usersByName = new Map(usersSnap.docs.map(d =&gt; [d.data().name, d.data()]));

  // 9. データ行をパース（3行目〜最終行の1つ前）
  const dataRows = records.slice(2, -1);
  const summaryRow = records[records.length - 1]; // 「合計」行

  const parsedMembers = [];
  for (const row of dataRows) {
    const name = row[0]?.trim();
    if (!name || name === &apos;合計&apos;) continue;

    const userData = usersByName.get(name);
    const userId = userData?.uid || null;

    // 14時間帯×6項目をパース
    const hourlyData = [];
    let col = 1;
    for (const hour of HOUR_LABELS) {
      const d: any = { hour };
      for (const key of KPI_KEYS) {
        d[key] = parseInt(row[col], 10) || 0;
        col++;
      }
      hourlyData.push(d);
    }

    // 日次合計
    const totals: any = {};
    for (const key of KPI_KEYS) {
      totals[key] = hourlyData.reduce((s, h) =&gt; s + (h[key] || 0), 0);
    }

    parsedMembers.push({
      name, userId, hourlyData, totals,
      matched: userId !== null,
      warnings: userId === null ? [&apos;名前がusersに見つかりません&apos;] : [],
    });
  }

  // 10. 全社合計（CSVの「合計」行）をパース
  const summaryHourly = [];
  let sCol = 1;
  for (const hour of HOUR_LABELS) {
    const d: any = { hour };
    for (const key of KPI_KEYS) {
      d[key] = parseInt(summaryRow[sCol], 10) || 0;
      sCol++;
    }
    summaryHourly.push(d);
  }
  const summaryTotals: any = {};
  for (const key of KPI_KEYS) {
    summaryTotals[key] = summaryHourly.reduce((s, h) =&gt; s + (h[key] || 0), 0);
  }

  return {
    productId,
    targetDate,
    fileName,
    totalMembers: parsedMembers.length,
    matchedCount: parsedMembers.filter(m =&gt; m.matched).length,
    unmatchedCount: parsedMembers.filter(m =&gt; !m.matched).length,
    members: parsedMembers,
    summary: { hourlyData: summaryHourly, totals: summaryTotals },
  };
});
commitCsvImport（プレビュー後の確定保存）
// 確定保存：dailyKpi（個人別）+ dailyKpiSummary（全社合計）+ csvImportLogs（履歴）
export const commitCsvImport = functions.https.onCall(async (data, context) =&gt; {
  if (!context.auth || ![&apos;executive&apos;,&apos;manager&apos;].includes(context.auth.token.role)) {
    throw new functions.https.HttpsError(&apos;permission-denied&apos;, &apos;Only manager+ can commit.&apos;);
  }

  const { productId, targetDate, fileName, members, summary, overwrite } = data;
  const db = admin.firestore();
  const batch = db.batch();

  // 1. 取込ログを記録
  const logRef = db.collection(&apos;csvImportLogs&apos;).doc();
  batch.set(logRef, {
    fileName, productId, targetDate,
    importedBy: context.auth.uid,
    importedAt: admin.firestore.FieldValue.serverTimestamp(),
    totalMembers: members.length,
    successCount: 0, // 後でupdate
    status: &apos;in_progress&apos;,
  });

  // 2. メンバー別dailyKpiを一括書込
  let successCount = 0;
  for (const member of members) {
    if (!member.userId) continue;
    const docId = `${member.userId}_${productId}_${targetDate}`;
    const docRef = db.collection(&apos;dailyKpi&apos;).doc(docId);
    const existing = await docRef.get();
    if (existing.exists &amp;&amp; !overwrite) continue;

    batch.set(docRef, {
      userId: member.userId,
      date: targetDate,
      productId,
      productVersion: 1,
      source: &apos;csv_import&apos;,
      csvFileName: fileName,
      importLogId: logRef.id,
      importedBy: context.auth.uid,
      importedAt: admin.firestore.FieldValue.serverTimestamp(),
      hourlyData: member.hourlyData,
      totals: member.totals,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    successCount++;
  }

  // 3. dailyKpiSummary（商材別の全社合計）を保存
  const summaryId = `${productId}_${targetDate}`;
  const summaryRef = db.collection(&apos;dailyKpiSummary&apos;).doc(summaryId);
  batch.set(summaryRef, {
    summaryId, productId, date: targetDate,
    hourlyData: summary.hourlyData,
    totals: summary.totals,
    memberCount: successCount,
    importLogId: logRef.id,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 4. ログを完了に更新
  batch.update(logRef, { successCount, status: &apos;completed&apos; });

  await batch.commit();
  return { success: true, successCount, logId: logRef.id };
});
package.json への追加
// functions/package.json
&quot;dependencies&quot;: {
  &quot;firebase-admin&quot;: &quot;^12.0.0&quot;,
  &quot;firebase-functions&quot;: &quot;^4.0.0&quot;,
  &quot;iconv-lite&quot;: &quot;^0.6.3&quot;,
  &quot;csv-parse&quot;: &quot;^5.5.0&quot;
}
P2-3：K-07 CSV取込画面の実装
// src/pages/kpi/CsvImport.tsx（要点抜粋）
import { useState } from &apos;react&apos;;
import { getFunctions, httpsCallable } from &apos;firebase/functions&apos;;

const PRODUCTS = [
  { id: &apos;visit&apos;, name: &apos;HP（訪問）&apos; },
  { id: &apos;web&apos;, name: &apos;Web&apos; },
  { id: &apos;replace&apos;, name: &apos;リプレイス&apos; },
  { id: &apos;meo&apos;, name: &apos;MEO&apos; },
];

export const CsvImport = () =&gt; {
  const [productId, setProductId] = useState(&apos;visit&apos;);
  const [file, setFile] = useState&lt;File | null&gt;(null);
  const [previewData, setPreviewData] = useState(null);
  const [step, setStep] = useState(1); // 1:選択 2:パース中 3:プレビュー 4:名寄せ 5:確定

  const handleParse = async () =&gt; {
    if (!file) return;
    setStep(2);
    // ファイル名と商材の一致確認
    if (!file.name.includes(`_${productId}_`)) {
      alert(&apos;選択した商材とファイル名が一致しません&apos;);
      setStep(1);
      return;
    }
    // Base64エンコードして送信
    const buffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const functions = getFunctions();
    const parse = httpsCallable(functions, &apos;parseHourlyKpiCsv&apos;);
    try {
      const result = await parse({ fileBuffer: base64, fileName: file.name });
      setPreviewData(result.data);
      setStep(3);
    } catch (e) {
      alert(&apos;パース失敗: &apos; + e.message);
      setStep(1);
    }
  };

  const handleCommit = async (overwrite: boolean) =&gt; {
    const functions = getFunctions();
    const commit = httpsCallable(functions, &apos;commitCsvImport&apos;);
    const result = await commit({
      productId: previewData.productId,
      targetDate: previewData.targetDate,
      fileName: previewData.fileName,
      members: previewData.members,
      summary: previewData.summary,
      overwrite,
    });
    alert(&apos;取込完了：&apos; + result.data.successCount + &apos;件&apos;);
  };

  return (
    &lt;div&gt;
      &lt;h1&gt;CSV取込&lt;/h1&gt;
      {step === 1 &amp;&amp; (
        &lt;&gt;
          &lt;select value={productId} onChange={e =&gt; setProductId(e.target.value)}&gt;
            {PRODUCTS.map(p =&gt; &lt;option key={p.id} value={p.id}&gt;{p.name}&lt;/option&gt;)}
          &lt;/select&gt;
          &lt;input type=&quot;file&quot; accept=&quot;.csv&quot; onChange={e =&gt; setFile(e.target.files?.[0])} /&gt;
          &lt;button onClick={handleParse} disabled={!file}&gt;パース実行&lt;/button&gt;
        &lt;/&gt;
      )}
      {step === 2 &amp;&amp; &lt;div&gt;パース中...&lt;/div&gt;}
      {step === 3 &amp;&amp; previewData &amp;&amp; (
        &lt;&gt;
          &lt;h2&gt;プレビュー（{previewData.totalMembers}名）&lt;/h2&gt;
          {/* メンバー一覧テーブル・合計表示 */}
          &lt;button onClick={() =&gt; handleCommit(false)}&gt;確定保存&lt;/button&gt;
        &lt;/&gt;
      )}
    &lt;/div&gt;
  );
};
P2-4：K-02 手動入力（バックアップ）
K-02は2モード切替を実装します：「日次合計のみ入力モード」と「時間帯別詳細入力モード」。デフォルトは合計のみで心理障壁を下げる。
// src/pages/kpi/DailyKpiInput.tsx（要点）
const [mode, setMode] = useState&lt;&apos;summary&apos;|&apos;detail&apos;&gt;(&apos;summary&apos;);

// summaryモード：6項目を1日分だけ入力
// detailモード：14時間帯×6項目=84項目を入力

const saveSummaryMode = async (totals) =&gt; {
  // 時間帯別データは均等割りで自動分配
  const hourCount = 12; // 9〜20時の12時間帯に均等分配
  const perHour = Object.fromEntries(
    Object.entries(totals).map(([k,v]) =&gt; [k, Math.floor(v/hourCount)])
  );
  const hourlyData = [
    { hour: &apos;early&apos;, total: 0, actual: 0, recall: 0, owner: 0, prospect: 0, appoint: 0 },
    ...Array.from({length: 12}, (_, i) =&gt; ({ hour: i+9, ...perHour })),
    { hour: &apos;late&apos;, total: 0, actual: 0, recall: 0, owner: 0, prospect: 0, appoint: 0 },
  ];
  await setDoc(doc(db, &apos;dailyKpi&apos;, `${user.uid}_${productId}_${date}`), {
    userId: user.uid, date, productId, productVersion: 1,
    source: &apos;manual&apos;,  // 手動入力
    hourlyData, totals,
    createdAt: serverTimestamp(),
  });
};
P2-5：K-03 KGI承認フロー
ステータス
遷移
pending
leaderが作成 → managerに通知
approved
managerが承認 → leaderに通知 → アラート閾値として有効化
rejected
managerが差戻し（コメント付き）→ leaderに通知 → 修正してpendingに戻す


Phase 1 + Phase 2 完了チェックリスト
Phase 1 完了チェック
No.
確認項目
確認方法
□
メール/Google認証でログイン・ログアウト
手動操作
□
useAuth() で user.role が取得できる
console.log
□
未ログインで全URLが /login にリダイレクト
直接URL入力
□
leaderで /settings/users にアクセス→拒否
leaderアカウント
□
productMastersに4商材が登録済み
Firestore Console
□
S-06で商材の追加・編集・月次更新ができる
executive操作
□
S-01でユーザー作成時にcurrentProductIdが設定される
Firestore Console
□
S-01の担当商材設定でuserProductAssignmentsに記録
Firestore Console
□
S-02で商材変更履歴タブが表示・操作できる
executive操作
□
H-01でロール別の表示切替が動作
3ロールで確認
□
R-02で週次報告がFirestoreに保存される
Firestore Console
□
R-05でレポート詳細が表示・PPT出力可能
PPTダウンロード
Phase 2 完了チェック（CSV取込重点）
No.
確認項目
確認方法
□
★ K-07でCSVをアップロード→パース成功
実CSV使用
□
★ プレビューで14時間帯×6項目が正しく表示
画面目視
□
★ 名寄せ：CSV名前→userIdが正しくマッピング
画面表示
□
★ 確定保存でdailyKpiに14時間帯データが保存
Firestore Console
□
★ dailyKpiSummaryに商材別全社合計が保存
Firestore Console
□
★ csvImportLogsに履歴が記録される
Firestore Console
□
★ leaderがK-07にアクセスすると拒否される
leader操作
□
★ ファイル名と商材選択の不一致でエラー表示
故意に不一致
□
★ CP932以外の文字コードCSVでエラー表示
UTF-8 CSVで試行
□
★ 同日の既存データに対し上書き確認モーダル表示
同日2回取込
□
K-02でsource=manualで手動入力ができる
Firestore Console
□
K-03でKGI提案→manager承認→確定の流れが動作
2ロールで操作
□
K-01でdailyKpiSummaryを使った商材別合計が瞬時表示
レスポンスタイム
□
K-04でCSV取込/手動入力のバッジが区別表示
画面目視
□
CSV取込忘れアラート（19:00時点）が発火
Cloud Scheduler確認


質問・不明点の連絡先
実装中に設計上の疑問がある場合は、Claudeプロジェクトチャットに質問してください。設計意図・Firestoreクエリ・コンポーネント構成など何でも対応します。

種別
連絡先
設計上の疑問
Claudeプロジェクトチャット
仕様の確認
K.t.（株式会社Rush up・プロジェクト管理）
CSVフォーマット
K.t.に実サンプル送付を依頼

=== Rushup営業PF_画面構成設計書_v4.docx ===


Rushup 営業プラットフォーム
画面構成設計書
Version 4.0（CSV自動取込対応版）
最終更新：2026年5月18日
項目
内容
最適化前
160+ ページ（ロール別重複定義）
最適化後
49 ページ（v3:48 + K-07追加）
ロール数
3種（executive / manager / leader）
v4主な変更
★ K-07 CSV取込画面を追加（KPI管理 6→7画面）／K-02手動入力を簡易化／全画面で商材別表示対応


v4.0 変更サマリー（v3.0からの差分）
変更区分
対象画面
変更内容
★ 新規追加
K-07 CSV取込画面
manager以上が商材ごとにCSVをアップロード。5ステップフロー（アップロード→パース→プレビュー→名寄せ→確定）
▲ 位置づけ変更
K-02 KPI日次入力
メイン入力 → CSV不備時のバックアップ入力に変更。日次合計のみ入力モードを追加
▲ 機能追加
H-01 総合ダッシュボード
商材別の全社合計ウィジェット（dailyKpiSummaryから瞬時表示）
▲ 機能追加
K-04 KPI履歴・推移
source（manual/csv_import）バッジ表示でデータ取得元を区別


1. 設計方針
1.1 ページ数削減の4原則
原則1：ロール別の画面は作らない。1画面でログインユーザーのロールに応じて表示内容を自動切替
原則2：期間の切替はフィルターで行う
原則3：「個人別」「組織別」「責任者別」はフィルターで切り替える
原則4：商材別の表示切替もフィルターで行う
1.2 ユーザーロール定義（3種）
ロール
対象役職
閲覧範囲
主な権限
executive
代表・取締役・役員・統括
全社データ
全データ閲覧・設定変更・商材マスタ編集
manager
副統括・MGR・PMGR・SMGR
自組織データ
部下データ閲覧・KGI承認・★CSV取込（v4追加）
leader
TL・一般
個人データのみ
自分のデータ入力・閲覧・KGI提案


2. サイドバーメニュー構成
No.
メニュー名
アイコン
executive
manager
leader
備考
1
ホーム
Home
✓
✓
✓

2
日報管理
ClipboardList
✓
✓
✓

3
KPI管理
Target
✓
✓
✓
K-01〜K-07
4
進捗管理
TrendingUp
✓
✓
✓

5
改善管理
RefreshCw
✓
✓
✓

6
教育管理
BookOpen
✓
✓
—

7
AI分析
Brain
✓
✓
✓

8
レポート管理
FileText
✓
✓
—

9
管理設定
Settings
✓
—
—
S-01〜S-06


3. 全画面一覧（実際に開発する画面）
3.1 ホーム（1画面）
ID
画面名
URL
対象ロール
ロール別表示切替
H-01
▲ 総合ダッシュボード
/
全員
executive: 全社KPI概要＋商材別合計サマリー　manager: 自チーム概要＋商材構成　leader: 個人概要＋担当商材名
▲ v4変更：商材別の全社合計をdailyKpiSummaryから瞬時表示するウィジェットを追加
3.2 日報管理（5画面）
ID
画面名
URL
対象ロール
ロール別表示切替
D-01
日報ダッシュボード
/daily
全員
executive: 全社提出状況　manager: 自チーム　leader: 自分
D-02
日報入力
/daily/new
全員
全ロール共通の入力フォーム
D-03
日報履歴
/daily/history
全員
フィルター付き履歴
D-04
日報詳細
/daily/:id
全員
閲覧 + manager以上は確認ボタン
D-05
未提出・確認待ち
/daily/pending
manager以上
未提出一覧 + 確認待ちをタブ切替
3.3 KPI管理（7画面）　★v4でK-07を追加
ID
画面名
URL
対象ロール
v4変更内容
K-01
KPIダッシュボード
/kpi
全員
商材フィルター・商材別表示・全社合計表示
K-02
▲ KPI日次入力（手動）
/kpi/daily
全員
▲ メイン入力→バックアップ入力。日次合計のみモード追加
K-03
KGI月次設定
/kpi/targets
全員
商材別KGI・productMasters初期値・承認フロー
K-04
▲ KPI履歴・推移
/kpi/history
全員
▲ source（manual/csv_import）バッジ表示
K-05
KPI比較・着地予測
/kpi/analysis
全員
比較と着地予測をタブ切替
K-06
KPI詳細
/kpi/:userId
全員
商材変更タイムライン含む
★ K-07
★ CSV取込
/kpi/import
manager以上
★ 新規追加。商材別CSVを毎日アップロード
K-07 CSV取込画面 詳細仕様（v4新規）
項目
仕様
URL
/kpi/import
アクセス権限
manager以上（leader不可）
画面構成
① 商材選択（visit/web/replace/meo）　② ファイルアップロード領域　③ プレビューテーブル　④ バリデーション結果　⑤ 名寄せ確認　⑥ 確定保存ボタン　⑦ 取込履歴一覧
処理フロー
商材選択→アップロード→Cloud Functionsパース→プレビュー→確認→確定→dailyKpi + dailyKpiSummaryに一括保存
ファイル名検証
「時間別_{商材ID}_YYYYMMDD_YYYYMMDD.csv」形式と一致するか確認
合計行の扱い
CSVの「合計」行を抽出してdailyKpiSummaryに保存（商材別の全社合計）
K-07 画面フロー（5ステップ）
Step
画面状態
処理内容
1
商材選択 + ファイル選択
プルダウンで商材を選択（visit/web/replace/meo）→ CSVファイルをドラッグ&amp;ドロップ。ファイル名と選択商材の一致を検証
2
パース実行中
Cloud Functions（parseHourlyKpiCsv）を呼出。CP932デコード・2行ヘッダー解析を実行
3
プレビュー表示
パース結果を表形式で表示。メンバー名・各時間帯の数値・日次合計・全社合計を確認
4
名寄せ確認
CSV内の名前とusers.nameのマッチング結果を表示。一致しない名前は手動マッピングまたはスキップ
5
確定保存
「保存」ボタンでdailyKpi（個人別）+ dailyKpiSummary（全社合計）に一括書込。既存データがある場合は上書き確認モーダル表示
K-02 KPI日次入力（手動）詳細仕様（v4変更）
項目
仕様
用途
CSV取込できなかった日・修正が必要な日の補完入力
入力モード
2モードを切替可能。①日次合計のみ入力モード（高速）　②時間帯別詳細入力モード（CSV同等）
担当商材自動判定
ログイン日の担当商材をuserProductAssignmentsから自動判定して表示
source保存
dailyKpi.source = &quot;manual&quot; で保存（CSV取込と区別）
入力対象
leader: 自分のみ／manager: 自分＋部下のデータも入力可（CSV取込済みデータの修正含む）
3.4 進捗管理（4画面）
ID
画面名
URL
対象ロール
ロール別表示切替
P-01
進捗ダッシュボード
/progress
全員
executive: 全社　manager: 自チーム　leader: 自分
P-02
進捗詳細
/progress/:userId
全員
期間フィルターで週次/月次切替
P-03
進捗履歴
/progress/history
全員
期間・対象フィルター付き
P-04
比較分析
/progress/compare
manager以上
メンバー間・チーム間の比較
3.5 改善管理（5画面）
ID
画面名
URL
対象ロール
説明
I-01
改善ダッシュボード
/improve
全員
タスク状況サマリー
I-02
改善タスク一覧
/improve/tasks
全員
フィルター付き一覧
I-03
改善タスク詳細
/improve/tasks/:id
全員
タスク詳細・進捗更新
I-04
改善履歴
/improve/history
全員
過去のタスク一覧
I-05
改善効果分析
/improve/analysis
manager以上
改善前後の比較
3.6 教育管理（6画面）
ID
画面名
URL
対象ロール
説明
E-01
教育ダッシュボード
/education
manager以上
教育状況サマリー
E-02
教育メモ入力
/education/new
manager以上
部下を選択して教育記録
E-03
教育メモ履歴
/education/history
manager以上
フィルター付き履歴
E-04
部下別教育詳細
/education/:userId
manager以上
特定部下の教育履歴
E-05
教育テーマ別分析
/education/themes
manager以上
テーマ別の効果分析
E-06
AI育成提案
/education/ai
manager以上
AI個別育成提案（Phase 3）
3.7 AI分析（5画面）
ID
画面名
URL
対象ロール
説明
A-01
AI分析ダッシュボード
/ai
全員
分析サマリー
A-02
個人AI分析
/ai/personal
全員
自分のKPI予測（商材別基準値）
A-03
組織AI分析
/ai/team
manager以上
チーム分析（商材構成考慮）
A-04
改善提案履歴
/ai/suggestions
全員
過去のAI提案一覧
A-05
AI分析詳細
/ai/report/:id
全員
個別分析レポート
3.8 レポート管理（6画面）
ID
画面名
URL
対象ロール
説明
R-01
レポートダッシュボード
/reports
manager以上
提出状況サマリー
R-02
週次資料作成
/reports/weekly/new
manager以上
既存WeeklyForm 5ステップ
R-03
下書き一覧
/reports/drafts
manager以上
一時保存の下書き
R-04
提出履歴
/reports/history
manager以上
週次/月次フィルター
R-05
レポート詳細（閲覧）
/reports/:id
manager以上
全項目1ページ閲覧
R-06
承認管理
/reports/approval
manager以上
承認待ち一覧
3.9 管理設定（6画面）
ID
画面名
URL
対象ロール
説明
S-01
ユーザー管理
/settings/users
executive
アカウント作成・担当商材設定
S-02
組織管理
/settings/org
executive
チーム階層・商材変更履歴
S-03
権限管理
/settings/roles
executive
ロール割当
S-04
項目設定
/settings/fields
executive
入力項目カスタマイズ
S-05
AI分析設定
/settings/ai
executive
AI分析頻度・通知
S-06
商材マスタ管理
/settings/products
executive
商材・転換率基準値の管理
3.10 共通画面（3画面）
ID
画面名
URL
備考
C-01
ログイン
/login
メール/Google認証
C-02
プロフィール設定
/profile
名前・パスワード変更
C-03
通知一覧
/notifications
アラート・承認通知・CSV取込忘れ通知


4. 画面数サマリー（v4）
カテゴリ
画面数
v3→v4
備考
ホーム
1
機能追加
商材別合計ウィジェット追加
日報管理
5
変更なし

KPI管理
7
+1
K-07 CSV取込画面を追加
進捗管理
4
変更なし

改善管理
5
変更なし

教育管理
6
変更なし

AI分析
5
変更なし

レポート管理
6
変更なし

管理設定
6
変更なし

共通
3
変更なし

合計
49
v3比+1
CSV取込画面の追加


5. Firestoreデータ構造（v4更新版）
★=v3/v4新規追加　▲=v4変更
コレクション
主なフィールド
書込権限
説明
productMasters
productId, productName, kpiItems[], conversionRates{byRole}, validFrom, validTo, isActive
executive
商材マスタ
userProductAssignments
userId, productId, startDate, endDate, assignedBy
manager以上
商材割当履歴
users
uid, name, email, role, title, teamId, currentProductId, joinDate
executive
ユーザー情報
teams
teamId, name, leaderId, members[], parentTeamId, startDate, endDate
executive
チーム構成
▲ dailyKpi
userId, date, productId, source, csvFileName, importLogId, importedBy, hourlyData[14], totals{}
本人+manager(CSV)
▲ source・CSV関連フィールド追加
★ dailyKpiSummary
summaryId={productId}_{date}, productId, date, totals{}, memberCount, lastUpdated
manager以上
★ 商材別の全社日次合計
★ csvImportLogs
logId, fileName, productId, targetDate, importedBy, importedAt, totalMembers, successCount, status
manager以上
★ CSV取込履歴
kpiTargets
userId, period, productId, kgi{}, conversionRates{}, status, approvedBy
本人→承認
KGI月次設定
weeklyReports
userId, period, formData{}, status, approvedBy
本人
週次報告データ
educationRecords
userId, trainerId, date, theme, content, progress
manager
教育記録
improveTasks
userId, assignedBy, title, status, deadline, result
manager以上
改善タスク
aiAnalysis
userId, type, result, model, createdAt
システム
AI分析結果
notifications
userId, type, message, read, relatedId
システム
通知
alerts
userId, productId, alertType, threshold, actualValue, severity
システム
アラート


6. 共通UIパーツ仕様
パーツ名
仕様
パンくずリスト
全詳細ページに配置。各階層クリック遷移可能
フィルターバー
期間（日/週/月/四半期）、対象（個人/チーム/全社）、商材（全/visit/web/replace/meo）
ロール別表示制御
useAuth()のuser.roleを参照
商材表示制御
userProductAssignmentsを参照し当日の担当商材を判定。トップバーにバッジ表示
★ データ取得元バッジ
★ dailyKpi一覧で「CSV取込」「手動入力」を色分けバッジで表示
レスポンシブ
768px以下でハンバーガーメニュー・テーブル横スクロール
ローディング
Firestore読込中はスケルトンスクリーン
エラー表示
トースト通知・フィールド下に赤字


7. 画面遷移パターン
7.1 基本パターン
パターン1（一覧→詳細）：ダッシュボード→一覧→詳細
パターン2（入力→確認）：入力フォーム→確認→完了
パターン3（分析系）：ダッシュボード→フィルター→結果
7.2 商材・CSV関連の遷移パターン（v4追加分）
パターン
遷移フロー
KGI承認フロー
K-03（提案）→ 通知 → K-03（manager承認）→ 確定
商材変更フロー
S-02 → メンバー選択 → 商材変更タブ → 変更登録 → 通知
商材マスタ更新
S-06 → 商材選択 → 翌月基準値設定 → 保存
★ CSV取込フロー
★ K-07 → 商材選択 → ファイルアップロード → プレビュー → 名寄せ → 確定 → dailyKpi + dailyKpiSummary に一括保存 → 取込履歴に記録
★ CSV修正フロー
★ K-04（履歴）→ 修正対象を選択 → K-02（手動入力モード）→ 修正保存 → source: &quot;manual&quot; に変更

=== Rushup営業PF_簡易仕様書_v4.docx ===


Rushup 営業プラットフォーム
簡易システム仕様書
Version 4.0（CSV自動取込対応・商材別合計保存対応版）
最終更新：2026年5月18日
項目
内容
プロジェクト名
Rushup 営業活動一元管理プラットフォーム
対象企業
株式会社Rush up
利用人数
30〜50名
作成日
2026年5月14日
最終更新日
2026年5月18日（v4.0 / CSV対応）
ステータス
設計フェーズ完了・Phase 1実装準備中


v4.0 変更サマリー（v3.0からの差分）
CSVファイルからの自動取込が決定したことにより、以下の設計変更を反映しました。
No.
変更内容
影響範囲
1
★ KPI入力方式を「CSV自動取込（メイン）＋ 手動入力（バックアップ）」に変更
K-02位置づけ変更、K-07新規追加
2
★ CSV取込は商材ごとに別ファイルでアップロード（ファイル名に商材名）
CSVパーサー仕様、K-07画面、Cloud Functions
3
★ 商材ごとの全社合計をdailyKpiSummaryコレクションに保存
Firestore設計、ダッシュボード高速化
4
★ CSV取込権限はmanager以上に拡大（executive限定ではない）
セキュリティルール、K-07アクセス権限
5
★ 14時間帯対応に修正（v3の11時間帯 → 0:00〜23:59の14時間帯）
dailyKpi.hourlyData、KPI入力フォーム
6
★ 毎日CSV取込の運用。取込忘れアラートを追加
アラート設計、通知システム
7
★ CSV取込後の手動修正運用ルールを明文化
K-02・dailyKpi更新ルール


1. プロジェクト概要
1.1 背景と目的
営業部において、週次報告・KPI管理・教育進捗などが個別のExcelやツールで管理されており、情報が分散している。本プロジェクトでは、営業活動に関するあらゆるデータを一元管理し、AI分析による属人化の解消と、上司の教育時間確保を実現するWebアプリケーションを構築する。
1.2 解決すべき課題
営業データが分散しており、全体像の把握に時間がかかる
上司が部下の課題分析に多くの時間を費やしている
営業ノウハウが属人化しており、組織としての改善が困難
個人の改善点が数値として可視化されていない
稼働データの蓄積・活用ができていない
KPIがExcelで管理されており、リアルタイムな分析ができない
商材ごとにKPI項目・あるべき数値が異なるが、Excelでは個別管理が困難
メンバーが月単位で商材を変更した場合、過去データとの整合性が取れない
KPIの手入力作業が負担になっており、本来の営業活動の時間を圧迫している（v4新規）
1.3 ゴールイメージ
営業メンバーがアプリを開けば、自分の数字・課題・改善点が一目でわかる
上司がダッシュボードで部下全員の状況を瞬時に把握できる
AIが蓄積データをもとに自動でフィードバック・改善提案を生成する
会議資料（PowerPoint）がワンクリックで出力される
KPI基準値を商材×個人レベルで設定し、アラートで即座に異常を検知できる
時間帯別のパフォーマンス分析で、最も効率の良い行動パターンを特定できる
商材変更があっても、変更前後のデータがすべて正確に紐づいて閲覧できる
CSVをアップロードするだけで毎日のKPIデータが自動反映される（v4新規）
商材ごとの全社合計が瞬時に表示され、経営判断のスピードが上がる（v4新規）


2. 商材設計
2.1 商材一覧
商材ID
商材名
CSVファイル名識別子
特性
visit
HP（訪問）
visit
架電→アポ→訪問→受注の標準フロー
web
Web
web
Web経由の商談（受注率が異なる）
replace
リプレイス
replace
APO率・採用率が高め
meo
MEO
meo
採用率1.0・受注率0.20
2.2 商材ごとに別CSVファイルでアップロード（v4新仕様）
CSVファイルは商材ごとに別ファイルでアップロードする運用とします。ファイル名に商材識別子を含めることで、システムが自動で商材を判定します。
商材
ファイル名パターン
例（2026年5月18日分）
HP（訪問）
時間別_visit_{開始日}_{終了日}.csv
時間別_visit_20260518_20260518.csv
Web
時間別_web_{開始日}_{終了日}.csv
時間別_web_20260518_20260518.csv
リプレイス
時間別_replace_{開始日}_{終了日}.csv
時間別_replace_20260518_20260518.csv
MEO
時間別_meo_{開始日}_{終了日}.csv
時間別_meo_20260518_20260518.csv
2.3 商材別あるべき数値（転換率基準値）一覧
executiveがproductMastersコレクションで一元管理する。月次で変更可能。
転換率項目
HP（訪問）
Web
リプレイス
MEO
総コ→オーナ接触率
25%
25%
25%
25%
総コ→APO率
1.3%
2.0%
3.5〜4.0%
2.0%
APO→採用率
40%
50%
100%
100%
採用→行動率
100%
100%
100%
80%
行動→受注率
20%
15%
25%
20%


3. システム構成
3.1 技術スタック
カテゴリ
技術
用途
フロントエンド
React + Vite
SPA構築
UIライブラリ
Lucide React
アイコンコンポーネント
ルーティング
React Router DOM
ネストルーティング・認証ガード
ホスティング
Firebase Hosting
静的ファイル配信
データベース
Cloud Firestore
NoSQL DB
認証
Firebase Authentication
メール/Google認証・ロール管理
サーバーサイド
Cloud Functions
CSV取込・AI分析API
AI分析
Claude API / Gemini API
KPI分析・改善提案
帳票出力
pptxgenjs / papaparse
PowerPoint・CSV出力
★ CSV処理
iconv-lite + csv-parse
★ CP932デコード + CSV解析
外部連携
Microsoft Graph API
Teams連携
バージョン管理
GitHub
コード管理
3.2 ユーザーロール（3種）
ロール
対象役職
閲覧範囲
主な権限
executive
代表・取締役・役員・統括
全社データ
全データ閲覧・設定変更・商材マスタ編集
manager
副統括・MGR・PMGR・SMGR
自組織データ
部下データ閲覧・KGI承認・CSV取込（v4追加）
leader
TL・一般
個人データのみ
自分のデータ入力・閲覧・KGI提案


4. KPIデータ取得方式（v4新セクション）
KPIデータの取得方式を「CSV自動取込（メイン）」と「手動入力（バックアップ）」の2系統に整理する。
4.1 取得方式の概要
方式
用途
頻度
実行者
★ CSV自動取込（メイン）
毎日の通常運用。商材ごとに別ファイルでアップロード
毎日
manager以上
▲ 手動入力（バックアップ）
CSV不備・取込失敗・データ修正時の補完入力
週1〜2回
全員（本人）+ manager（部下分）
4.2 CSVフォーマット仕様
項目
仕様
文字コード
CP932（Shift-JIS拡張）
改行コード
CRLF（Windowsベース）
対象期間
1日分（ファイル名の開始日=終了日）
列構成
85列（名前1列 + 14時間帯×6項目=84列）
時間帯
14時間帯（0:00〜8:59、9:00〜20:00の12時間帯、21:00〜23:59）
6項目
総（total）・実（actual）・再（recall）・オ（owner）・見（prospect）・ア（appoint）
行構成
1行目=時間帯ラベル、2行目=項目名、3行目以降=メンバーデータ、最終行=合計
4.3 KGI（月次目標設定）
月初に個人ごと・商材ごとにKGIと転換率の基準値を設定する。productMastersの基準値を初期値として表示し、leaderが提案、managerが承認する。
項目
内容
粗利目標
月次の粗利目標金額
単価
1件あたりの平均単価
稼働日
その月の営業稼働日数
受注件数目標
目標受注件数（粗利÷単価）
総コール目標
月次の総コール目標数
各転換率
実コール率・再コール率・オーナ接触率・見込率・アポ率・採用率・訪問率・受注率


5. アラート設計
KGIと転換率の基準値を商材×個人レベルで設定し、6パターンのアラートで異常を検知する。
アラート種別
検知タイミング
検知内容
日次アラート
毎日リアルタイム / 終業時
日次KPI基準値を下回った場合
週次アラート
毎週月曜日
週次の傾向分析（前週比・基準値との乖離）
転換率アラート
日次 / 週次
転換率が商材別基準値から大きく乖離
月末着地予測
毎日更新
月末着地予測がKGI目標に対して不足
時間帯別分析
日次 / 週次
特定時間帯のパフォーマンス低下
★ CSV取込忘れアラート
毎日19:00時点
★ 当日のCSVが商材ごとに取込まれていない場合、manager以上に通知


6. データ設計（Firestoreコレクション）
★マーク=v3/v4新規追加　▲マーク=v4変更
コレクション
主なフィールド
書込権限
説明
productMasters
productId, productName, kpiItems[], conversionRates{byRole}, validFrom, validTo, isActive
executive
商材マスタ
userProductAssignments
userId, productId, startDate, endDate, assignedBy
manager以上
商材割当履歴
users
uid, name, email, role, title, teamId, currentProductId, joinDate
executive
ユーザー情報
teams
teamId, name, leaderId, members[], parentTeamId, startDate, endDate
executive
チーム構成
▲ dailyKpi
userId, date, productId, source, csvFileName, importLogId, importedBy, hourlyData[14], totals{}, createdAt
本人 + manager（CSV取込）
日次KPI（v4でsource等追加）
★ dailyKpiSummary
summaryId=productId_date, productId, date, totals{}, memberCount, lastUpdated
manager以上（CSV取込時）
★ 商材別の全社日次合計
★ csvImportLogs
logId, fileName, productId, targetDate, importedBy, importedAt, totalMembers, successCount, status
manager以上
★ CSV取込履歴
kpiTargets
userId, period, productId, kgi{}, conversionRates{}, status, approvedBy, comment
本人→承認
KGI月次設定
weeklyReports
userId, period, formData{}, status, approvedBy
本人
週次報告データ
educationRecords
userId, trainerId, date, theme, content, progress
manager
教育記録
improveTasks
userId, assignedBy, title, status, deadline, result
manager以上
改善タスク
aiAnalysis
userId, type, result, model, createdAt
システム
AI分析結果
notifications
userId, type, message, read, relatedId
システム
通知
alerts
userId, productId, alertType, threshold, actualValue, severity
システム
アラート発火履歴


7. 機能一覧
No.
機能名
概要
Phase
対象ロール
F-01
ログイン・認証
メール/Google認証・3ロール対応
Phase 1
全員
F-02
週次報告入力
5ステップ形式・一時保存対応
Phase 1
manager以上
F-03
マイヒストリー
過去報告履歴・編集・PPT/CSV出力
Phase 1
全員
F-04
商材マスタ管理
商材・転換率基準値・月次変更管理
Phase 1
executive
F-05
月次商材変更管理
メンバーの担当商材を月単位で変更
Phase 1
manager以上
★ F-06
CSV自動取込
★ 毎日商材別CSVをアップロード→パース→確定保存
Phase 2
manager以上
▲ F-07
KPI日次入力（手動）
▲ CSV不備時の補完入力。日次合計入力モード追加
Phase 2
全員
F-08
KGI月次設定
商材別KGI目標・転換率・承認フロー
Phase 2
全員
F-09
KPIダッシュボード
達成率・推移グラフ・商材別表示
Phase 2
全員
F-10
日報管理
日次活動報告
Phase 2
全員
F-11
教育進捗管理
教育記録・進捗管理
Phase 2
manager以上
F-12
管理者ダッシュボード
全メンバー状況・未提出アラート・商材別合計
Phase 1
manager以上
F-13
PowerPoint出力
テンプレート準拠の自動出力
Phase 1
全員
▲ F-14
アラート通知
▲ 6パターン（CSV取込忘れ追加）
Phase 2
全員
F-15
改善タスク管理
改善タスクCRUD・期限管理
Phase 2
全員
F-16
AI KPI分析
達成予測・ボトルネック分析
Phase 3
全員
F-17
AI行動分析
時間帯別パフォーマンス分析
Phase 3
全員
F-18
AI教育フィードバック
個別育成提案
Phase 3
manager以上
F-19
Teams連携
稼働報告自動取込
Phase 3
全員
F-20
組織管理
チーム階層・月次変更管理
Phase 1
executive
F-21
ユーザー管理
アカウント作成・ロール割当
Phase 1
executive


8. 開発フェーズ計画
Phase 1：土台構築（目安2週間）
Firebase Auth導入（3ロール・10役職対応）
Firestoreセキュリティルール（ロールベース）
商材マスタ管理画面（productMasters初期データ投入含む）
ユーザー管理画面（商材割当・月次変更管理）
組織管理画面（チーム階層・月次変更管理）
管理者ダッシュボード（ロール別表示切替）
週次報告の閲覧レイアウト
PPT/CSV出力のFirestore対応確認
スマホ対応（レスポンシブ）
Phase 2：機能拡張（目安3〜5週間、CSV取込で1週間追加）
★ Cloud Functions: parseHourlyKpiCsv（CSVパーサー）
★ Cloud Functions: commitCsvImport（一括保存）
★ K-07 CSV取込画面（5ステップフロー）
★ csvImportLogs / dailyKpiSummary コレクション
KPI日次入力（手動：バックアップ用）
KGI月次設定（商材別・承認フロー）
KPIダッシュボード（商材別・全社合計表示）
日報管理
教育進捗管理
改善タスク管理
アラート通知（6パターン・CSV取込忘れ含む）
通知一覧画面
プロフィール設定画面
Phase 3：AI分析・外部連携（目安1〜2ヶ月）
Cloud Functions構築（AI分析API基盤）
AI KPI分析（商材別の達成予測）
AI行動分析（時間帯別パフォーマンス）
AI教育フィードバック
Teams連携
外部データ取込
個人成長レポート


9. 既存実装状況
公開URL: https://rushup-weekly-report.web.app
GitHub: https://github.com/takahashi2412/sales-weekly-report
実装済み機能
状態
備考
週次報告入力フォーム
✅ 完了
5ステップ形式
マイヒストリー
✅ 完了
編集・上書き保存・削除
PowerPoint出力
✅ 完了
テンプレート準拠
CSV出力（既存）
✅ 完了
報告データのCSVダウンロード
Firestore移行
✅ 完了
localStorage→Firestore
Firebase Hosting
✅ 完了
SSLデプロイ済み
GitHub連携
✅ 完了
APIキーは.env管理
ログイン画面
⚠️ UIのみ
Firebase Auth連携は未実装
ダッシュボード
⚠️ UIのみ
モックデータ
教育進捗管理
⚠️ 一部実装
TrainingTracker.jsx
チーム管理
⚠️ 一部実装
TeamManagement.jsx
★ 商材マスタ管理
🆕 未実装
Phase 1で新規作成
★ CSV取込
🆕 未実装
Phase 2で新規作成


10. 非機能要件
項目
要件
対応デバイス
PC（Chrome, Edge）、スマホ（iOS Safari, Android Chrome）
同時利用者数
30〜50名
レスポンス目標
画面遷移 1秒以内、AI分析 10秒以内、CSV取込 30秒以内（v4追加）
データバックアップ
Firestoreの自動バックアップ（日次）
セキュリティ
Firebase Auth認証必須、ロールベースアクセス制御、HTTPS通信
可用性
Firebase標準SLA（99.95%）に準拠
データ保持期間
無期限（入社時からの全データを蓄積）
CSV取込頻度（v4）
毎日1回（19:00までの取込を推奨）


11. 開発体制
役割
担当
設計・相談役
Claude（このプロジェクト）
実装担当
Google Antigravity（Gemini 3.1 Pro High）
プロジェクト管理
K.t.（株式会社Rush up）