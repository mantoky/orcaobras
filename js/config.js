/**
 * OrçaObras - Configuration and Constants
 * =========================================
 * Configurações globais do sistema
 */

const Config = {
    // App Info
    APP_NAME: 'OrçaObras',
    APP_VERSION: '1.0.0',
    APP_DESCRIPTION: 'Sistema de Orçamentos de Obras e Manutenção Industrial',

    // Storage Keys
    STORAGE_KEYS: {
        AUTH: 'orcaobras_auth',
        DATA: 'orcaobras_data',
        BUDGETS: 'orcaobras_budgets',
        SETTINGS: 'orcaobras_settings',
        USERS: 'orcaobras_users',
        COLUMN_TEMPLATES: 'orcaobras_column_templates',
        SAVED_BUDGETS: 'orcaobras_saved_budgets'
    },

    // Default Users (for localhost mode)
    DEFAULT_USERS: [
        {
            id: 1,
            username: 'Robson do Carmo',
            password: 'RC@2026',
            role: 'MASTER',
            name: 'Robson do Carmo',
            createdAt: '2026-01-01T00:00:00Z'
        }
    ],

    // Column Mapping (for dynamic Excel import)
    COLUMN_MAPPING: {
        // Basal columns that must exist
        BASAL_COLUMNS: {
            item: ['item', 'item_n', 'numero', '#', 'n'],
            codigo: ['codigo', 'code', 'código', 'cod'],
            descricao: ['descricao', 'descrição', 'description', 'desc', 'nome'],
            tipo: ['tipo', 'type', 'categoria', 'cat'],
            unidade: ['unidade', 'und', 'unit', 'un', 'unidade_medida'],
            quantidade: ['quantidade', 'quant', 'qty', 'qtd', 'quant', 'quant_'],
            valorUnit: ['valor_unit', 'valorunit', 'preco', 'preço', 'valor_unitario', 'vl_unit'],
            total: ['total', 'vl_total', 'valor_total']
        },
        // Column types for auto-detection
        COLUMN_TYPES: {
            NUMERIC: ['quantidade', 'valorUnit', 'total'],
            TEXT: ['item', 'codigo', 'descricao', 'tipo', 'unidade']
        }
    },

    // Pagination
    PAGINATION: {
        ITEMS_PER_PAGE: 25,
        MAX_VISIBLE_PAGES: 5
    },

    // Item Types
    ITEM_TYPES: [
        'Material',
        'Mão de Obra',
        'Serviço',
        'Equipamento'
    ],

    // Units
    UNITS: [
        'UN', 'KG', 'KGf', 'G', 'MG', 'T',
        'M', 'CM', 'MM', 'M2', 'M3', 'DM2',
        'L', 'ML', 'M3/h', 'M/h', 'h', 'HH',
        'DIA', 'MÊS', 'VB', 'JG', 'PAR', 'BAR',
        '%', 'KWH', 'KW', 'HP', 'CV', 'RPM'
    ],

    // Export Formats
    EXPORT_FORMATS: ['PDF', 'XLSX', 'CSV'],

    // Firebase Config
    FIREBASE: {
        apiKey: "AIzaSyBy1MBcRnUqdVlrlSesa_Hiz8QNMdRdlcM",
        authDomain: "orcaobras.firebaseapp.com",
        projectId: "orcaobras",
        storageBucket: "orcaobras.firebasestorage.app",
        messagingSenderId: "973615593171",
        appId: "1:973615593171:web:2fea73ebb07a3033cb0626"
    },

    // PWA Config
    PWA: {
        CACHE_NAME: 'orcaobras-v1',
        OFFLINE_URL: '/offline.html'
    }
};

// Freeze config to prevent modifications
Object.freeze(Config.STORAGE_KEYS);
Object.freeze(Config.COLUMN_MAPPING);
Object.freeze(Config.PAGINATION);
Object.freeze(Config.ITEM_TYPES);
Object.freeze(Config.UNITS);
Object.freeze(Config.EXPORT_FORMATS);
Object.freeze(Config.FIREBASE);
Object.freeze(Config.PWA);