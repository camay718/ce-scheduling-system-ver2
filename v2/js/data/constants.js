/**
 * CEスケジュール管理システム V2 - 定数定義
 */

// Firebaseのデータルート
window.DATA_ROOT = 'ceScheduleV2';

// 部門リスト（9部門・3x3レイアウト対応）
window.DEPARTMENTS = [
    '機器管理・人工呼吸',
    '血液浄化', 
    '不整脈',
    '心・カテーテル',
    '人工心肺・補助循環',
    '手術・麻酔',
    '会議・ミーティング・勉強会・打ち合わせ',
    '出張・研修内容',
    'その他・連絡'
];

// 部門アイコンマップ
window.DEPARTMENT_ICONS = {
    '機器管理・人工呼吸': 'lungs',
    '血液浄化': 'tint',
    '不整脈': 'heartbeat',
    '心・カテーテル': 'heart',
    '人工心肺・補助循環': 'procedures',
    '手術・麻酔': 'user-md',
    '会議・ミーティング・勉強会・打ち合わせ': 'comments',
    '出張・研修内容': 'plane',
    'その他・連絡': 'info-circle'
};

// 部門カラーマップ
window.DEPARTMENT_COLORS = {
    '機器管理・人工呼吸': '#90EE90',
    '血液浄化': '#FFB6C1',
    '不整脈': '#9370DB',
    '心・カテーテル': '#32CD32',
    '人工心肺・補助循環': '#4169E1',
    '手術・麻酔': '#87CEEB',
    '会議・ミーティング・勉強会・打ち合わせ': '#9E9E9E',
    '出張・研修内容': '#9E9E9E',
    'その他・連絡': '#9E9E9E'
};

// CE勤務区分
window.WORK_TYPES = ['ME', 'OPE', 'HD', 'FLEX'];

// CEステータス
window.CE_STATUS_OPTIONS = [
    { value: '', label: '通常' },
    { value: '早', label: '早出' },
    { value: '当', label: '当直' },
    { value: '非', label: '非番' },
    { value: '休', label: '休み' },
    { value: '出', label: '出張' }
];

// 監査ログアクションの表示名
window.AUDIT_ACTION_MAP = {
    'login': 'ログイン',
    'logout': 'ログアウト',
    'ce_add': 'CE追加',
    'ce_delete': 'CE削除',
    'ce_reorder': 'CE並び替え',
    'ce_sort': 'CE並び替え（自動）',
    'ce_status_update': '勤務状態更新',
    'event_add': '業務追加',
    'event_edit': '業務編集',
    'event_delete': '業務削除',
    'event_assign': '業務にCE割当',
    'event_unassign': '業務からCE解除',
    'monthly_task_add': '月次業務追加',
    'monthly_task_edit': '月次業務編集',
    'monthly_task_delete': '月次業務削除',
    'monthly_task_execute': '月次業務実施',
    'monthly_task_assign': '月次業務にCE割当',
    'monthly_task_unassign': '月次業務からCE解除',
    'bulk_event_add': '期間一括業務追加'
};

// 初期CEリスト（システム初期化用）
window.CE_LIST_INITIAL = [
    { name: '田中', workType: 'ME' },
    { name: '佐藤', workType: 'OPE' },
    { name: '鈴木', workType: 'HD' },
    { name: '高橋', workType: 'FLEX' },
    { name: '渡辺', workType: 'ME' }
];
