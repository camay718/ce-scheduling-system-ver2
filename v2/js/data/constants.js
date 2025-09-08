/**
 * CEスケジュール管理システム V2 - 定数とデータ統合版
 */

// ========= V1互換CE一覧 =========
const CE_LIST_INITIAL = [
    { name: '安孫子', workType: 'OPE', status: {}, department: '手術・麻酔' },
    { name: '八鍬', workType: 'ME', status: {}, department: '機器管理・人工呼吸' },
    { name: '杉山', workType: 'HD', status: {}, department: '血液浄化' },
    { name: '中村', workType: 'OPE', status: {}, department: '手術・麻酔' },
    { name: '石山', workType: 'ME', status: {}, department: '機器管理・人工呼吸' },
    { name: '亀井', workType: 'OPE', status: {}, department: '手術・麻酔' },
    { name: '丸藤', workType: 'OPE', status: {}, department: '手術・麻酔' },
    { name: '三春', workType: 'ME', status: {}, department: '機器管理・人工呼吸' },
    { name: '斎藤', workType: 'FLEX', status: {}, department: null },
    { name: '田中', workType: 'ME', status: {}, department: '機器管理・人工呼吸' },
    { name: '宇井', workType: 'OPE', status: {}, department: '手術・麻酔' },
    { name: '宇野沢', workType: 'OPE', status: {}, department: '手術・麻酔' },
    { name: '佐藤将志', workType: 'OPE', status: {}, department: '手術・麻酔' },
    { name: '庄司', workType: 'HD', status: {}, department: '血液浄化' },
    { name: '小沼', workType: 'OPE', status: {}, department: '手術・麻酔' },
    { name: '設樂', workType: 'OPE', status: {}, department: '手術・麻酔' },
    { name: '武田', workType: 'ME', status: {}, department: '機器管理・人工呼吸' },
    { name: '伊藤大晟', workType: 'ME', status: {}, department: '機器管理・人工呼吸' },
    { name: '上松野', workType: 'ME', status: {}, department: '機器管理・人工呼吸' },
    { name: '笹生', workType: 'ME', status: {}, department: '機器管理・人工呼吸' },
    { name: '和田', workType: 'OPE', status: {}, department: '手術・麻酔' },
    { name: '伊藤大稀', workType: 'OPE', status: {}, department: '手術・麻酔' },
    { name: '佐藤千優', workType: 'ME', status: {}, department: '機器管理・人工呼吸' },
    { name: '桑島', workType: 'OPE', status: {}, department: '手術・麻酔' },
    { name: '村田', workType: 'ME', status: {}, department: '機器管理・人工呼吸' },
    { name: '小林', workType: 'OPE', status: {}, department: '手術・麻酔' },
    { name: '寒河江', workType: 'ME', status: {}, department: '機器管理・人工呼吸' }
];

// ========= V1互換認証情報 =========
const AUTH_CREDENTIALS = {
    'スタッフ': { type: 'name', role: 'viewer', department: null },
    '手術・麻酔': { code: 'secure_SurgAnest_6917_ce_system', role: 'editor', department: '手術・麻酔' },
    'MEセンター': { code: 'secure_MEcenter_6994_ce_system', role: 'editor', department: '機器管理・人工呼吸' },
    '血液浄化': { code: 'secure_Hemodialysis_6735_ce_system', role: 'editor', department: '血液浄化' },
    '不整脈': { code: 'secure_Arrhythm_6551_ce_system', role: 'editor', department: '不整脈' },
    '人工心肺・補助循環': { code: 'secure_CpbEcmo_6288_ce_system', role: 'editor', department: '人工心肺・補助循環' },
    '心・カテーテル': { code: 'secure_CardCath_6925_ce_system', role: 'editor', department: '心・カテーテル' },
    'モニター': { code: 'secure_CEmonitor_1122_ce_system', role: 'monitor', department: null },
    '管理者': { code: 'secure_CEadmin_5711_ce_system', role: 'admin', department: null }
};

// ========= 部門情報 =========
const DEPARTMENTS = [
    '機器管理・人工呼吸',
    '血液浄化',
    '不整脈',
    '心・カテーテル',
    '人工心肺・補助循環',
    '手術・麻酔'
];

// 部門カラー
function getDepartmentColor(department) {
    const colors = {
        '血液浄化': '#FFB6C1',
        '人工心肺・補助循環': '#4169E1',
        '心・カテーテル': '#32CD32',
        '手術・麻酔': '#87CEEB',
        '不整脈': '#9370DB',
        '機器管理・人工呼吸': '#90EE90'
    };
    return colors[department] || '#cccccc';
}

// 部門アイコン
function getDepartmentIcon(department) {
    const icons = {
        '血液浄化': 'tint',
        '人工心肺・補助循環': 'procedures',
        '心・カテーテル': 'heart',
        '手術・麻酔': 'user-md',
        '不整脈': 'heartbeat',
        '機器管理・人工呼吸': 'lungs'
    };
    return icons[department] || 'cog';
}

// ========= V1→V2データ移行ヘルパー =========
function migrateV1DataToV2(v1Data) {
    console.log('🔄 V1データ移行開始');
    
    const v2Events = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    // 基準日設定（今週の月曜日）
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    
    days.forEach((day, index) => {
        const currentDate = new Date(monday);
        currentDate.setDate(monday.getDate() + index);
        const dateKey = currentDate.toISOString().slice(0, 10);
        
        const dayTasks = v1Data.tasks[day] || [];
        const dayAssignments = v1Data.assignments[day] || {};
        
        v2Events[dateKey] = dayTasks.map((task, taskIndex) => ({
            id: `migrated_${dateKey}_${taskIndex}`,
            name: task.name,
            department: task.department,
            startTime: task.startTime,
            endTime: task.endTime,
            count: task.count || 1,
            requiredPeople: task.requiredPeople || 1,
            assignments: dayAssignments[taskIndex] || [],
            migrated: true,
            originalDay: day
        }));
    });
    
    console.log('✅ V1データ移行完了:', Object.keys(v2Events).length, '日分のデータ');
    return v2Events;
}

// ========= グローバル公開 =========
window.Constants = {
    CE_LIST_INITIAL,
    AUTH_CREDENTIALS,
    DEPARTMENTS,
    getDepartmentColor,
    getDepartmentIcon,
    migrateV1DataToV2
};

// 後方互換性のための個別公開
window.CE_LIST_INITIAL = CE_LIST_INITIAL;
window.AUTH_CREDENTIALS = AUTH_CREDENTIALS;
window.DEPARTMENTS = DEPARTMENTS;
window.getDepartmentColor = getDepartmentColor;
window.getDepartmentIcon = getDepartmentIcon;

console.log('📊 定数・データファイル読み込み完了（V2統合版）');
