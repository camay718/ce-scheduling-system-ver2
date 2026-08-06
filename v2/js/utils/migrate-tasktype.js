/**
 * taskType 移行スクリプト
 *
 * 目的:
 *   既存の events/byDate/*, monthlyTasks/* に taskType フィールドを一括付与する。
 *
 * 使い方:
 *   1. 管理者アカウントでシステムにログイン
 *   2. 任意の画面（例: home.html）を開き、開発者ツール(F12) → Console を開く
 *   3. このファイルの内容を全てコピペして実行
 *   4. まず migrateTaskType({ dryRun: true }) を実行 → ログで対象件数を確認
 *   5. 問題なければ migrateTaskType({ dryRun: false }) を実行 → 実際に書き込み
 *
 * 判定ルール:
 *   - events/byDate/<date>/<id>       → taskType: "shared"（既存フィールドがあれば維持）
 *   - monthlyTasks/<yyyy-mm>/<id>     → taskType: "monthly"
 *   - 既に taskType が付与されているレコードはスキップ
 *
 * 補足:
 *   - 「個人業務」への変更は移行後にUI（イベント編集モーダル）から個別に行う
 *   - 元データは Firebase に保持されるため、更新前にエクスポート推奨
 */
(function () {
    'use strict';

    window.migrateTaskType = async function (options = {}) {
        const opts = {
            dryRun: true,
            targetEvents: true,
            targetMonthly: true,
            ...options
        };

        console.log('===================================================');
        console.log(`🔧 taskType 移行スクリプト実行 (dryRun=${opts.dryRun})`);
        console.log('===================================================');

        if (!window.database) {
            console.error('❌ Firebase database が初期化されていません');
            return;
        }

        const DATA_ROOT = window.DATA_ROOT || 'v2';
        const stats = {
            eventsScanned: 0,
            eventsUpdated: 0,
            eventsSkipped: 0,
            monthlyScanned: 0,
            monthlyUpdated: 0,
            monthlySkipped: 0,
            errors: 0
        };

        const updates = {};

        // ---------- 1. events/byDate ----------
        if (opts.targetEvents) {
            console.log('📅 events/byDate をスキャン中...');
            try {
                const snap = await window.database.ref(`${DATA_ROOT}/events/byDate`).once('value');
                const byDate = snap.val() || {};

                Object.keys(byDate).forEach(dateKey => {
                    const events = byDate[dateKey] || {};
                    Object.keys(events).forEach(eventId => {
                        const ev = events[eventId];
                        if (!ev || typeof ev !== 'object') return;

                        stats.eventsScanned++;

                        if (ev.taskType) {
                            stats.eventsSkipped++;
                            return;
                        }

                        const path = `${DATA_ROOT}/events/byDate/${dateKey}/${eventId}/taskType`;
                        updates[path] = 'shared';
                        stats.eventsUpdated++;
                    });
                });
                console.log(`  → スキャン: ${stats.eventsScanned}件 / 更新対象: ${stats.eventsUpdated}件 / スキップ: ${stats.eventsSkipped}件`);
            } catch (e) {
                console.error('❌ events/byDate 読み込みエラー:', e);
                stats.errors++;
            }
        }

        // ---------- 2. monthlyTasks ----------
        if (opts.targetMonthly) {
            console.log('📆 monthlyTasks をスキャン中...');
            try {
                const snap = await window.database.ref(`${DATA_ROOT}/monthlyTasks`).once('value');
                const monthly = snap.val() || {};

                // monthlyTasks の階層は環境により (a) flat: {id: {...}} と (b) nested: {yyyy-mm: {id: {...}}} がある
                // 両対応
                Object.keys(monthly).forEach(topKey => {
                    const node = monthly[topKey];
                    if (!node || typeof node !== 'object') return;

                    // ネスト判定: 直下に "title" などのイベントプロパティがあれば flat
                    const looksLikeTask = ('title' in node) || ('name' in node) || ('taskType' in node);

                    if (looksLikeTask) {
                        // flat 構造
                        stats.monthlyScanned++;
                        if (node.taskType) {
                            stats.monthlySkipped++;
                        } else {
                            updates[`${DATA_ROOT}/monthlyTasks/${topKey}/taskType`] = 'monthly';
                            stats.monthlyUpdated++;
                        }
                    } else {
                        // nested 構造 (yyyy-mm/<id>)
                        Object.keys(node).forEach(taskId => {
                            const task = node[taskId];
                            if (!task || typeof task !== 'object') return;

                            stats.monthlyScanned++;
                            if (task.taskType) {
                                stats.monthlySkipped++;
                                return;
                            }
                            updates[`${DATA_ROOT}/monthlyTasks/${topKey}/${taskId}/taskType`] = 'monthly';
                            stats.monthlyUpdated++;
                        });
                    }
                });
                console.log(`  → スキャン: ${stats.monthlyScanned}件 / 更新対象: ${stats.monthlyUpdated}件 / スキップ: ${stats.monthlySkipped}件`);
            } catch (e) {
                console.error('❌ monthlyTasks 読み込みエラー:', e);
                stats.errors++;
            }
        }

        // ---------- 3. 書き込み ----------
        const totalUpdates = Object.keys(updates).length;
        console.log('---------------------------------------------------');
        console.log(`📊 集計: 合計更新パス数 = ${totalUpdates}`);
        console.log('  events: ', stats.eventsUpdated, ' / monthly: ', stats.monthlyUpdated);
        console.log('---------------------------------------------------');

        if (opts.dryRun) {
            console.log('🔍 ドライランのため書き込みはスキップします');
            console.log('  実行するには: migrateTaskType({ dryRun: false })');
            return { stats, updates };
        }

        if (totalUpdates === 0) {
            console.log('✅ 更新対象なし。処理を終了します');
            return { stats, updates };
        }

        try {
            console.log('⏳ Firebase に一括書き込み中...');
            await window.database.ref().update(updates);
            console.log(`✅ 完了: ${totalUpdates}件のパスに taskType を付与しました`);

            // 監査ログ
            if (window.auditLogger) {
                await window.auditLogger.log('migrate_tasktype', {
                    eventsUpdated: stats.eventsUpdated,
                    monthlyUpdated: stats.monthlyUpdated,
                    totalUpdates
                });
            }
        } catch (e) {
            console.error('❌ 書き込みエラー:', e);
            stats.errors++;
        }

        return { stats, updates };
    };

    console.log('✅ migrateTaskType() が使えるようになりました');
    console.log('  ドライラン: migrateTaskType({ dryRun: true })');
    console.log('  本実行:     migrateTaskType({ dryRun: false })');
})();
