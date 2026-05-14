import Papa from 'papaparse';
import pptxgen from 'pptxgenjs';

/**
 * フォームデータをCSVとしてエクスポート
 */
export const exportToCSV = (formData) => {
  // メンバーやロープレなどネストされた配列データをカンマ区切り文字列にフラット化する
  const flattenedData = { ...formData };
  
  if (flattenedData.members) {
    flattenedData.members = flattenedData.members.map(m => `${m.name}(${m.kpi})`).join(' | ');
  }
  if (flattenedData.roleplays) {
    flattenedData.roleplays = flattenedData.roleplays.map(r => `${r.date} ${r.target}`).join(' | ');
  }

  const csvString = Papa.unparse([flattenedData], { header: true });
  
  // 文字化け防止のためBOMを付与
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, csvString], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `週次報告_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * フォームデータをPowerPoint(PPTX)としてエクスポート
 */
export const exportToPPTX = (formData) => {
  let pptx = new pptxgen();
  const THEME_COLOR = "FF0642"; // Vibrant Red from original PPTX
  const SUB_THEME_COLOR = "F87171"; // Light Red from original
  const TEXT_COLOR = "1A1A1A"; // Black from original
  const TEXT_GRAY = "555555"; // Dark Gray from original
  const BG_GRAY = "F7F7F7"; // Light Gray from original
  const BG_PINK = "FFE4EA"; // Pale Pink from original
  const BORDER_COLOR = "DDDDDD";
  const FONT_FACE = "游ゴシック"; // Yu Gothic from original

  // Set default presentation options
  pptx.layout = 'LAYOUT_16x9';

  pptx.defineSlideMaster({
    title: "MASTER_SLIDE",
    background: { color: "FFFFFF" },
    objects: [
      { rect: { x: 0, y: 0, w: "100%", h: 0.6, fill: { color: THEME_COLOR } } },
      { image: { path: "/logo.png", x: 0.2, y: 0.05, w: 1.5, h: 0.5, sizing: { type: "contain" } } },
      { rect: { x: 0, y: "94%", w: "100%", h: 0.4, fill: { color: BG_GRAY } } },
      { text: { text: `対象週: ${formData.startDate || "未設定"}〜 (第${formData.weekOfMonth || 1}週目)`, options: { x: 0.5, y: "95%", w: "40%", h: 0.2, color: TEXT_GRAY, fontFace: FONT_FACE, fontSize: 10, align: "left" } } },
      { text: { text: "週次報告", options: { x: "75%", y: "95%", w: "20%", h: 0.2, color: TEXT_GRAY, fontFace: FONT_FACE, fontSize: 10, align: "right" } } }
    ]
  });

  const addHeader = (slide, title, subtitle = "") => {
    slide.addText(title, { x: 0.5, y: 0.8, w: 8, h: 0.5, fontSize: 24, bold: true, color: THEME_COLOR, fontFace: FONT_FACE });
    if (subtitle) {
      slide.addText(subtitle, { x: 0.5, y: 1.3, w: 8, h: 0.3, fontSize: 12, color: TEXT_GRAY, fontFace: FONT_FACE });
    }
  };

  const addSectionTitle = (slide, text, x, y, w) => {
    slide.addShape(pptx.ShapeType.rect, { x, y, w, h: 0.35, fill: { color: THEME_COLOR } });
    slide.addText(text, { x: x + 0.1, y, w: w - 0.2, h: 0.35, fontSize: 12, bold: true, color: "FFFFFF", fontFace: FONT_FACE, valign: "middle" });
  };

  // ========== Slide 0: 自己点検 ==========
  let slide0 = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  addHeader(slide0, "責任者 自己点検チェックシート", "経営者として自分の組織を語れているか確認する");
  
  const selfChecks = [
    [{ text: "項目", options: { fill: BG_GRAY, bold: true } }, { text: "評価", options: { fill: BG_GRAY, bold: true } }],
    ["1. 数字の因果分析：先週の行動が今週の数字にどう影響したか説明できる", formData.selfCheck1],
    ["2. 問題定義の質：「症状」ではなく「真の原因」を自分の言葉で語れる", formData.selfCheck2],
    ["3. 行動設計の具体性：誰が・何を・いつ・何回 が明確に決まっている", formData.selfCheck3],
    ["4. PDCA完結：前週の「実行結果と再現性」をすべて記入・検証できている", formData.selfCheck4],
    ["5. 予算・コスト意識：週間ROIと1受注あたりの人件費コストを数字で語れる", formData.selfCheck5],
    ["6. 組織全体観：部下個人の管理だけでなく組織全体の課題を語れている", formData.selfCheck6],
    ["7. 主体的意思決定：代表に「どうすれば？」を求めず、自分で決断できている", formData.selfCheck7]
  ];
  slide0.addTable(selfChecks, { x: 0.5, y: 1.8, w: 9.0, rowH: 0.4, colW: [8.0, 1.0], border: { pt: 1, color: BORDER_COLOR }, fontSize: 12, color: TEXT_COLOR, fontFace: FONT_FACE, valign: "middle" });

  // ========== Slide 1: 組織KPI ==========
  let slide1 = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  addHeader(slide1, "組織KPI ダッシュボード", "月間・週間の数字を責任者として把握する");
  const kpiTableHeaders = [
    [{ text: "指標", options: { fill: BG_GRAY, color: TEXT_COLOR, bold: true } }, { text: "目標", options: { fill: BG_GRAY, color: TEXT_COLOR, bold: true } }, { text: "現状", options: { fill: BG_GRAY, color: TEXT_COLOR, bold: true } }, { text: "進捗(%)", options: { fill: BG_GRAY, color: TEXT_COLOR, bold: true } }]
  ];
  const calcProg = (cur, tgt) => (tgt && cur) ? Math.round((cur / tgt) * 100) : 0;
  
  const mRows = [
    ["粗利（P）", formData.kpiMonthly_grossTarget, formData.kpiMonthly_grossCurrent, `${calcProg(formData.kpiMonthly_grossCurrent, formData.kpiMonthly_grossTarget)}%`],
    ["受注件数", formData.kpiMonthly_orderTarget, formData.kpiMonthly_orderCurrent, `${calcProg(formData.kpiMonthly_orderCurrent, formData.kpiMonthly_orderTarget)}%`],
    ["アポ件数", formData.kpiMonthly_apptTarget, formData.kpiMonthly_apptCurrent, `${calcProg(formData.kpiMonthly_apptCurrent, formData.kpiMonthly_apptTarget)}%`],
    ["行動件数", formData.kpiMonthly_actionTarget, formData.kpiMonthly_actionCurrent, `${calcProg(formData.kpiMonthly_actionCurrent, formData.kpiMonthly_actionTarget)}%`]
  ];
  addSectionTitle(slide1, "月間進捗", 0.5, 1.8, 4.2);
  slide1.addTable([...kpiTableHeaders, ...mRows], { x: 0.5, y: 2.15, w: 4.2, colW: [1.2, 1, 1, 1], border: { type: "solid", pt: 1, color: BORDER_COLOR }, fontSize: 12, fontFace: FONT_FACE, valign: "middle" });

  const wRows = [
    ["粗利（P）", formData.kpiWeekly_grossTarget, formData.kpiWeekly_grossCurrent, `${calcProg(formData.kpiWeekly_grossCurrent, formData.kpiWeekly_grossTarget)}%`],
    ["受注件数", formData.kpiWeekly_orderTarget, formData.kpiWeekly_orderCurrent, `${calcProg(formData.kpiWeekly_orderCurrent, formData.kpiWeekly_orderTarget)}%`],
    ["アポ件数", formData.kpiWeekly_apptTarget, formData.kpiWeekly_apptCurrent, `${calcProg(formData.kpiWeekly_apptCurrent, formData.kpiWeekly_apptTarget)}%`],
    ["行動件数", formData.kpiWeekly_actionTarget, formData.kpiWeekly_actionCurrent, `${calcProg(formData.kpiWeekly_actionCurrent, formData.kpiWeekly_actionTarget)}%`]
  ];
  addSectionTitle(slide1, "今週結果", 5.0, 1.8, 4.2);
  slide1.addTable([...kpiTableHeaders, ...wRows], { x: 5.0, y: 2.15, w: 4.2, colW: [1.2, 1, 1, 1], border: { type: "solid", pt: 1, color: BORDER_COLOR }, fontSize: 12, fontFace: FONT_FACE, valign: "middle" });

  // ========== Slide 2: 予算採算シート ==========
  let slide2 = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  addHeader(slide2, "予算・採算シート", "目的（粗利−コスト）から手段（件数）を逆算する");
  const monthlyCost = Number(formData.orgMembers) * Number(formData.monthlyCostPerMember);
  const mDays = Number(formData.monthlyWorkingDays) || 1;
  const wDays = Number(formData.weeklyWorkingDays) || 0;
  const weeklyCost = monthlyCost ? Math.floor(monthlyCost * (wDays / mDays)) : 0;
  const requiredOrders = (formData.avgUnitPrice && weeklyCost) ? Math.ceil(weeklyCost / formData.avgUnitPrice) : 0;
  const costPerOrder = (weeklyCost > 0 && formData.weeklyOrders) ? Math.floor(weeklyCost / formData.weeklyOrders) : 0;
  const roi = (weeklyCost > 0 && formData.weeklyGrossProfit) ? (formData.weeklyGrossProfit / weeklyCost).toFixed(2) : 0;
  
  slide2.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.8, w: 4.2, h: 1.5, fill: { color: BG_GRAY }, line: { color: BORDER_COLOR, pt: 1 } });
  addSectionTitle(slide2, "組織コスト（固定）", 0.5, 1.8, 4.2);
  slide2.addText(`${formData.orgMembers}名 × ${formData.monthlyCostPerMember}万円 ＝ 月間 ${monthlyCost}万円\n今月の稼働: ${mDays}日 / 今週の稼働: ${wDays}日\n→ 週間コスト: ${weeklyCost}P`, { x: 0.6, y: 2.2, w: 4, h: 1, fontSize: 12, color: TEXT_COLOR, fontFace: FONT_FACE, bold: true });

  slide2.addShape(pptx.ShapeType.rect, { x: 5.0, y: 1.8, w: 4.5, h: 1.5, fill: { color: BG_PINK }, line: { color: THEME_COLOR, pt: 1 } });
  addSectionTitle(slide2, "目的から手段へ 逆算する", 5.0, 1.8, 4.5);
  slide2.addText(`組織への貢献目標: ${formData.targetContribution}P\n必要な週間粗利: ${weeklyCost}P\n必要な受注件数: 約${requiredOrders}件/週 (平均単価${formData.avgUnitPrice})`, { x: 5.1, y: 2.2, w: 4.3, h: 1, fontSize: 14, color: TEXT_COLOR, fontFace: FONT_FACE, bold: true });

  slide2.addShape(pptx.ShapeType.rect, { x: 0.5, y: 3.6, w: 9.0, h: 1.5, fill: { color: "FFFFFF" }, line: { color: BORDER_COLOR, pt: 1 } });
  addSectionTitle(slide2, "今週の結果", 0.5, 3.6, 9.0);
  slide2.addText(`今週の粗利: ${formData.weeklyGrossProfit}P  |  今週の受注件数: ${formData.weeklyOrders}件\n1受注あたりの人件費コスト: ${costPerOrder}P  |  週間ROI: ${roi}倍`, { x: 0.7, y: 4.0, w: 8.6, h: 1.0, fontSize: 16, bold: true, color: TEXT_COLOR, fontFace: FONT_FACE });

  // ========== Slide 3: 責任者PDCA ==========
  let slide3 = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  addHeader(slide3, "責任者 PDCA（自分自身の振り返り）", "部下の管理だけでなく、リーダーとしての自分を経営する");
  
  const boxOpts = { fill: { color: BG_GRAY }, line: { color: BORDER_COLOR, pt: 1 }, fontFace: FONT_FACE, color: TEXT_COLOR, fontSize: 11, valign: "top", align: "left" };
  const labelOpts = { bold: true, color: THEME_COLOR, breakLine: true, fontFace: FONT_FACE };

  slide3.addText([{ text: "1. 数字把握\n", options: labelOpts }, { text: formData.pdca1_numbers || "-" }], { x: 0.5, y: 1.8, w: 4.3, h: 0.6, ...boxOpts });
  slide3.addText([{ text: "2. 問題定義\n", options: labelOpts }, { text: formData.pdca2_problem || "-" }], { x: 0.5, y: 2.5, w: 4.3, h: 0.6, ...boxOpts });
  slide3.addText([{ text: "3. 行動設計\n", options: labelOpts }, { text: formData.pdca3_action || "-" }], { x: 0.5, y: 3.2, w: 4.3, h: 0.6, ...boxOpts });
  slide3.addText([{ text: "4. 実行結果と検証\n", options: labelOpts }, { text: formData.pdca4_result || "-" }, { text: `\n再現性: ${formData.pdca4_reproducible} ${formData.pdca4_reproducible === 'なし' ? '(理由: '+formData.pdca4_reason+')' : ''}`, options: { breakLine: true } }], { x: 0.5, y: 3.9, w: 4.3, h: 0.9, ...boxOpts });

  slide3.addText([{ text: "5. リーダーシップ行動の振り返り\n", options: labelOpts }, { text: formData.pdca5_leadership_reflection || "-" }], { x: 5.0, y: 1.8, w: 4.5, h: 0.8, ...boxOpts });
  slide3.addText([{ text: "6. 組織全体の課題認識\n", options: labelOpts }, { text: `課題: ${formData.pdca6_orgIssue}\nすべきだった行動: ${formData.pdca6_leaderAction}` }], { x: 5.0, y: 2.7, w: 4.5, h: 0.8, ...boxOpts });
  slide3.addText([{ text: "7. コスト・採算自己評価\n", options: labelOpts }, { text: formData.pdca7_roiEval || "-" }], { x: 5.0, y: 3.6, w: 4.5, h: 0.6, ...boxOpts });

  addSectionTitle(slide3, "今週 責任者として 最も重要な意思決定", 5.0, 4.3, 4.5);
  slide3.addText(formData.pdca_main_decision || "未記入", { x: 5.0, y: 4.65, w: 4.5, h: 0.5, ...boxOpts, fill: {color: "FFFFFF"}, line: {color: THEME_COLOR, pt: 1} });

  // ========== Slide 4: メンバーPDCA (1 Slide per Member) ==========
  (formData.members || []).forEach((member, idx) => {
    let sm = pptx.addSlide({ masterName: "MASTER_SLIDE" });
    addHeader(sm, `メンバー PDCA`, `担当者名: ${member.name}  |  担当項目: ${member.item}  |  育成ステージ: ${member.stage}`);
    
    sm.addText([{ text: "1. 今週の数字\n", options: labelOpts }, { text: member.kpi || "-" }], { x: 0.5, y: 1.8, w: 4.3, h: 0.6, ...boxOpts });
    sm.addText([{ text: "2. 最大の問題\n", options: labelOpts }, { text: member.problem || "-" }], { x: 0.5, y: 2.5, w: 4.3, h: 0.6, ...boxOpts });
    sm.addText([{ text: "3. 原因分析\n", options: labelOpts }, { text: member.cause || "-" }], { x: 0.5, y: 3.2, w: 4.3, h: 0.6, ...boxOpts });
    sm.addText([{ text: "4. 行動設計\n", options: labelOpts }, { text: member.action || "-" }], { x: 0.5, y: 3.9, w: 4.3, h: 0.9, ...boxOpts });

    sm.addText([{ text: "5. 実行結果と検証\n", options: labelOpts }, { text: member.result || "-" }], { x: 5.0, y: 1.8, w: 4.5, h: 0.8, ...boxOpts });
    sm.addText([{ text: "6. 再現性の検証\n", options: labelOpts }, { text: `${member.reproducible} ${member.reproducible === 'なし' ? '(理由: '+member.noReproReason+')' : ''}` }], { x: 5.0, y: 2.7, w: 4.5, h: 0.8, ...boxOpts });
    sm.addText([{ text: "8. 責任者からの評価とフィードバック\n", options: labelOpts }, { text: `良い点: ${member.feedbackGood}\n改善点: ${member.feedbackBad}\n合意事項: ${member.feedbackAgreed}` }], { x: 5.0, y: 3.6, w: 4.5, h: 1.2, ...boxOpts });
  });

  // ========== Slide 5: 育成記録 ==========
  let slide5 = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  addHeader(slide5, "ロープレ・育成記録", "ロープレは「やった回数」ではなく「何を改善したか」で評価する");
  
  const rpHeaders = [[{ text: "実施日時", options: { fill: BG_GRAY, bold: true } }, { text: "対象者", options: { fill: BG_GRAY, bold: true } }, { text: "テーマ", options: { fill: BG_GRAY, bold: true } }, { text: "結果", options: { fill: BG_GRAY, bold: true } }, { text: "再現性", options: { fill: BG_GRAY, bold: true } }]];
  const rpRows = (formData.roleplays || []).map(rp => [rp.date, rp.target, rp.theme, rp.result, rp.reproducible]);
  
  addSectionTitle(slide5, "ロープレ実施記録（今週）", 0.5, 1.8, 9.0);
  if (rpRows.length > 0) {
    slide5.addTable([...rpHeaders, ...rpRows], { x: 0.5, y: 2.15, w: 9.0, colW: [1.5, 1.5, 3.5, 1.5, 1.0], border: { pt: 1, color: BORDER_COLOR }, fontSize: 11, fontFace: FONT_FACE, valign: "middle" });
  } else {
    slide5.addText("記録なし", { x: 0.5, y: 2.15, w: 9.0, h: 0.5, fontSize: 12, color: "999999", align: "center", fontFace: FONT_FACE });
  }

  addSectionTitle(slide5, "育成の進捗サマリー（責任者視点）", 0.5, 3.8, 9.0);
  slide5.addText(`今週最も成長したメンバー: ${formData.bestGrower}\n最も重点的に育てるべき課題: ${formData.focusIssue}\n来週の育成施策: ${formData.nextWeekMeasure}`, { x: 0.5, y: 4.15, w: 9, h: 1.0, fontSize: 12, fill: BG_GRAY, color: TEXT_COLOR, fontFace: FONT_FACE });

  // ========== Slide 6: リスト分析 ==========
  let slide6 = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  addHeader(slide6, "リスト分析", "数字の背景にある「かけ先の質」を責任者として管理する");
  
  const listData = [
    [{ text: "企業アタック率", options: { fill: BG_GRAY, bold: true } }, `${formData.attackRate}%`, { text: "有料リスト比率", options: { fill: BG_GRAY, bold: true } }, `${formData.paidListRate}%`],
    [{ text: "接触率", options: { fill: BG_GRAY, bold: true } }, `${formData.contactRate}%`, { text: "見込み比率", options: { fill: BG_GRAY, bold: true } }, `${formData.prospectRate}%`],
    [{ text: "アポ率", options: { fill: BG_GRAY, bold: true } }, `${formData.apptRate}%`, { text: "-", options: { fill: BG_GRAY, bold: true } }, "-"]
  ];
  addSectionTitle(slide6, "組織リスト状況（今週）", 0.5, 1.8, 9.0);
  slide6.addTable(listData, { x: 0.5, y: 2.15, w: 9.0, border: { pt: 1, color: BORDER_COLOR }, fontSize: 12, color: TEXT_COLOR, fontFace: FONT_FACE });

  addSectionTitle(slide6, "来週のアプローチ方針", 0.5, 3.2, 9.0);
  slide6.addText(`捨てるリスト: ${formData.dropListReason}\n追いかけるリスト: ${formData.pursueListReason}\n新規で抜くリスト: ${formData.newListSource}`, { x: 0.5, y: 3.55, w: 9, h: 0.8, fontSize: 12, fill: BG_GRAY, color: TEXT_COLOR, fontFace: FONT_FACE });

  addSectionTitle(slide6, "来週のかけ先の優先順位", 0.5, 4.5, 9.0);
  slide6.addText(formData.priority, { x: 0.5, y: 4.85, w: 9, h: 0.5, fontSize: 12, fontFace: FONT_FACE, fill: BG_GRAY });

  // ========== Slide 7: コミット宣言 ==========
  let slide7 = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  addHeader(slide7, "来週 コミット宣言", "代表に「どうすれば？」を求めず、責任者として自分で決断し、宣言する");

  addSectionTitle(slide7, "01 組織目標（週間）", 0.5, 1.8, 9.0);
  slide7.addText(`受注: ${formData.targetOrders}件  /  粗利: ${formData.targetGross}P  /  アポ: ${formData.targetAppts}件  /  行動: ${formData.targetActions}件`, { x: 0.5, y: 2.15, w: 9, h: 0.5, fontSize: 14, fill: BG_GRAY, fontFace: FONT_FACE, bold: true });

  addSectionTitle(slide7, "02 自分自身の最優先行動", 0.5, 2.8, 9.0);
  slide7.addText(formData.commitPriorityAction, { x: 0.5, y: 3.15, w: 9, h: 0.5, fontSize: 12, fontFace: FONT_FACE });

  addSectionTitle(slide7, "03 育成の最重点", 0.5, 3.8, 9.0);
  slide7.addText(`メンバー名: ${formData.commitTrainName}  |  課題: ${formData.commitTrainIssue}  |  施策: ${formData.commitTrainMeasure}`, { x: 0.5, y: 4.15, w: 9, h: 0.4, fontSize: 12, fill: BG_GRAY, fontFace: FONT_FACE });

  addSectionTitle(slide7, "04 先週と変えること", 0.5, 4.7, 9.0);
  slide7.addText(formData.commitChanges, { x: 0.5, y: 5.05, w: 9, h: 0.5, fontSize: 12, fontFace: FONT_FACE });

  // ファイル名を指定して保存
  const fileName = `週次報告_${new Date().toISOString().split('T')[0]}.pptx`;
  pptx.writeFile({ fileName: fileName });
};
