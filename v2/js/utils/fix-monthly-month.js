/**
 * 月次業務の month フィールド修復スクリプト
 * 
 * 目的:
 *   parseInt() バグにより year だけになってしまった月次業務の month を
 *   createdAt などから推測して YYYY-MM 形式に修復する。
 * 
 * 使い方:
 *   1. 管理者ログイン後、開発者ツールで実行
 *   2. まず fixMonthlyMonth({ dryRun: true }) でドライラン
 *   3. 問題なければ fixMonthlyMonth({ dryRun: false }) で実行
 */
(function () {
    'use strict';

    window.fixMonthlyMonth = async function (options = {}) {
        const opts = { dryRun: true, ...options };
        console.log(`🔧 月次業務 month 修復 (dryRun=${opts.dryRun})`);

        if (!window.database) {
            console.error('❌ Firebase database が初期化されていません');
            return;
        }

        const DATA_ROOT = window.DATA_ROOT || 'ceScheduleV2';
        const stats = { scanned: 0, needsFix: 0, fixed: 0, skipped: 0 };
        const updates = {};

        try {
            const snap = await window.database.ref(`${DATA_ROOT}/monthlyTasks`).once('value');
            const monthly = snap.val() || {};

            Object.keys(monthly).forEach(taskId => {
                const task = monthly[taskId];
                if (!task || typeof task !== 'object') return;

                stats.scanned++;
                const m = task.month;

                // 既に YYYY-MM 形式なら OK
                if (typeof m === 'string' && /^\d{4}-\d{2}$/.test(m)) {
                    stats.skipped++;
                    return;
                }

                // 数値（年だけ）の場合、createdAt から推測
                if (typeof m === 'number' && m >= 2000 && m < 3000) {
                    stats.needsFix++;

                    let inferredMonth = null;
                    if (task.createdAt) {
                        const d = new Date(task.createdAt);
                        if (!isNaN(d)) {
                            inferredMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        }
                    }

                    if (inferredMonth) {
                        updates[`${DATA_ROOT}/monthlyTasks/${taskId}/month`] = inferredMonth;
                        updates[`${DATA_ROOT}/monthlyTasks/${taskId}/monthFixed`] = true;
                        stats.fixed++;
                        console.log(`  修復対象: ${taskId} (${task.name}) → ${inferredMonth}`);
                    } else {
                        console.warn(`  修復不能: ${taskId} (${task.name}) - createdAtなし`);
                    }
                }
            });

            console.log(`📊 スキャン=${stats.scanned} / 要修復=${stats.needsFix} / 修復対象=${stats.fixed} / スキップ=${stats.skipped}`);

            if (opts.dryRun) {
                console.log('🔍 ドライランのため書き込みスキップ');
                return { stats, updates };
            }

            if (Object.keys(updates).length === 0) {
                console.log('✅ 修復対象なし');
                return { stats, updates };
            }

            await window.database.ref().update(updates);
            console.log(`✅ 完了: ${stats.fixed}件を修復しました`);

            if (window.auditLogger) {
                await window.auditLogger.log('fix_monthly_month', stats);
            }
        } catch (e) {
            console.error('❌ エラー:', e);
        }
    };

    console.log('✅ fixMonthlyMonth() が使えるようになりました');
    console.log('  ドライラン: fixMonthlyMonth({ dryRun: true })');
    console.log('  本実行:     fixMonthlyMonth({ dryRun: false })');
})();
