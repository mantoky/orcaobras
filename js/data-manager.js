/**
 * OrçaObras - Data Manager Module
 * ================================
 * Handles database operations and Excel/CSV import
 * Supports multi-user data isolation
 */

class DataManager {
    constructor() {
        this.data = [];
        this.customColumns = [];
        this.currentUserId = null;
        this.init();
    }

    init() {
        this.setCurrentUser();
        this.loadData();
    }

    // ============ USER ISOLATION ============

    setCurrentUser() {
        const auth = localStorage.getItem(Config.STORAGE_KEYS.AUTH);
        if (auth) {
            try {
                const authData = JSON.parse(auth);
                this.currentUserId = authData.user?.id || null;
            } catch (e) {
                this.currentUserId = null;
            }
        }
        return this.currentUserId;
    }

    getUserStorageKey(baseKey) {
        // Returns user-specific storage key
        const userId = this.currentUserId || 'shared';
        return `${baseKey}_${userId}`;
    }

    // ============ STORAGE METHODS ============

    loadData() {
        try {
            const storageKey = this.getUserStorageKey(Config.STORAGE_KEYS.DATA);
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.data = parsed.data || [];
                this.customColumns = parsed.customColumns || [];
            } else {
                this.data = [];
                this.customColumns = [];
            }
        } catch (e) {
            console.error('Error loading data:', e);
            this.data = [];
            this.customColumns = [];
        }
    }

    saveData() {
        const storageKey = this.getUserStorageKey(Config.STORAGE_KEYS.DATA);
        localStorage.setItem(storageKey, JSON.stringify({
            data: this.data,
            customColumns: this.customColumns,
            lastUpdated: new Date().toISOString(),
            userId: this.currentUserId
        }));
    }

    // ============ IMPORT METHODS ============

    /**
     * Import data from Excel/CSV file
     * Supports dynamic column mapping
     */
    async importFile(file, options = {}) {
        return new Promise((resolve, reject) => {
            const extension = file.name.split('.').pop().toLowerCase();
            const hasHeader = options.hasHeader !== false;

            if (extension === 'csv') {
                this.importCSV(file, hasHeader, options.separator)
                    .then(resolve)
                    .catch(reject);
            } else if (extension === 'xlsx' || extension === 'xls') {
                this.importExcel(file, hasHeader)
                    .then(resolve)
                    .catch(reject);
            } else {
                reject(new Error('Formato de arquivo não suportado'));
            }
        });
    }

    importCSV(file, hasHeader, separator = ';') {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                delimiter: separator,
                header: hasHeader,
                skipEmptyLines: true,
                complete: (results) => {
                    try {
                        const processedData = this.processImportedData(results.data, results.meta.fields || []);
                        resolve(processedData);
                    } catch (e) {
                        reject(e);
                    }
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    }

    importExcel(file, hasHeader) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

                    // Convert to JSON
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
                        header: hasHeader ? 1 : undefined,
                        defval: ''
                    });

                    // Get headers
                    let headers = [];
                    let rows = jsonData;

                    if (hasHeader && jsonData.length > 0) {
                        headers = jsonData[0];
                        rows = jsonData.slice(1);
                    }

                    const processedData = this.processImportedData(rows, headers);
                    resolve(processedData);
                } catch (e) {
                    reject(e);
                }
            };

            reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Process imported data with dynamic column mapping
     */
    processImportedData(rows, headers) {
        if (!rows || rows.length === 0) {
            throw new Error('Nenhum dado encontrado no arquivo');
        }

        // Detect if first row is header
        const firstRow = rows[0];
        const isHeaderRow = headers.length > 0 && this.isHeaderRow(firstRow, headers);

        const dataRows = isHeaderRow ? rows : rows;
        const columnNames = isHeaderRow ? headers : this.generateColumnNames(rows[0]);

        // Map columns
        const columnMap = this.mapColumns(columnNames);
        const customCols = this.findCustomColumns(columnNames, columnMap);

        // Convert rows to objects
        const processedData = dataRows.map((row, index) => {
            const item = {
                id: Date.now() + index,
                item: index + 1
            };

            // Map known columns
            Object.keys(columnMap).forEach(targetCol => {
                const sourceCol = columnMap[targetCol];
                const colIndex = columnNames.findIndex(h =>
                    this.normalizeHeader(h) === sourceCol
                );

                if (colIndex !== -1) {
                    let value = row[colIndex];

                    // Type conversion
                    if (Config.COLUMN_MAPPING.COLUMN_TYPES.NUMERIC.includes(targetCol)) {
                        value = this.parseNumber(value);
                    }

                    item[targetCol] = value;
                }
            });

            // Add custom columns
            customCols.forEach(col => {
                const colIndex = columnNames.findIndex(h =>
                    this.normalizeHeader(h) === this.normalizeHeader(col)
                );
                if (colIndex !== -1) {
                    item[col] = row[colIndex];
                }
            });

            return item;
        }).filter(item => item.codigo || item.descricao); // Filter out empty rows

        // Update custom columns list
        this.customColumns = customCols;

        return {
            data: processedData,
            customColumns: customCols,
            stats: {
                rows: processedData.length,
                columns: Object.keys(columnMap).length + customCols.length
            }
        };
    }

    /**
     * Map source columns to target columns based on fuzzy matching
     */
    mapColumns(headers) {
        const mapping = {};
        const normalizedHeaders = headers.map(h => this.normalizeHeader(h));

        // Map each basal column
        Object.keys(Config.COLUMN_MAPPING.BASAL_COLUMNS).forEach(targetCol => {
            const possibleNames = Config.COLUMN_MAPPING.BASAL_COLUMNS[targetCol];

            const matchIndex = normalizedHeaders.findIndex(h =>
                possibleNames.some(name => h.includes(name) || name.includes(h))
            );

            if (matchIndex !== -1) {
                mapping[targetCol] = headers[matchIndex];
            }
        });

        return mapping;
    }

    /**
     * Find columns that are not in the basal set
     */
    findCustomColumns(headers, mappedColumns) {
        const mappedValues = Object.values(mappedColumns);
        return headers.filter(h =>
            !mappedValues.includes(h) &&
            this.normalizeHeader(h) !== 'unnamed'
        );
    }

    /**
     * Check if a row looks like a header row
     */
    isHeaderRow(row, headers) {
        // Check if any cell contains text that matches header patterns
        return row.some(cell => {
            const normalized = this.normalizeHeader(String(cell));
            return Object.values(Config.COLUMN_MAPPING.BASAL_COLUMNS)
                .flat()
                .some(name => normalized.includes(name));
        });
    }

    /**
     * Generate column names for files without headers
     */
    generateColumnNames(row) {
        return row.map((_, index) => `Coluna ${index + 1}`);
    }

    /**
     * Normalize header text for comparison
     */
    normalizeHeader(text) {
        return String(text)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '')
            .trim();
    }

    /**
     * Parse number from various formats
     */
    parseNumber(value) {
        if (typeof value === 'number') return value;

        let str = String(value || '').trim();

        // Remove currency symbols and thousands separator
        str = str.replace(/[R$\s]/g, '');
        str = str.replace(/\./g, '').replace(',', '.');

        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    }

    /**
     * Import data with custom column mapping
     */
    async importWithMapping(file, options = {}) {
        return new Promise((resolve, reject) => {
            const extension = file.name.split('.').pop().toLowerCase();
            const hasHeader = options.hasHeader !== false;

            if (extension === 'csv') {
                this.importCSVWithMapping(file, hasHeader, options.separator, options)
                    .then(resolve)
                    .catch(reject);
            } else if (extension === 'xlsx' || extension === 'xls') {
                this.importExcelWithMapping(file, hasHeader, options)
                    .then(resolve)
                    .catch(reject);
            } else {
                reject(new Error('Formato de arquivo não suportado'));
            }
        });
    }

    importCSVWithMapping(file, hasHeader, separator, options) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                delimiter: separator,
                header: false,
                skipEmptyLines: true,
                complete: (results) => {
                    try {
                        const processedData = this.processImportedDataWithMapping(
                            results.data,
                            results.meta.fields || [],
                            hasHeader,
                            options.mappings,
                            options.customColumns
                        );
                        resolve(processedData);
                    } catch (e) {
                        reject(e);
                    }
                },
                error: (error) => reject(error)
            });
        });
    }

    importExcelWithMapping(file, hasHeader, options) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
                        header: 1,
                        defval: ''
                    });

                    const processedData = this.processImportedDataWithMapping(
                        jsonData,
                        hasHeader && jsonData.length > 0 ? jsonData[0] : [],
                        hasHeader,
                        options.mappings,
                        options.customColumns
                    );
                    resolve(processedData);
                } catch (e) {
                    reject(e);
                }
            };

            reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
            reader.readAsArrayBuffer(file);
        });
    }

    processImportedDataWithMapping(rows, headers, hasHeader, mappings, customColumns = []) {
        if (!rows || rows.length === 0) {
            throw new Error('Nenhum dado encontrado no arquivo');
        }

        let actualHeaders = headers;
        let dataRows = rows;

        if (hasHeader && rows.length > 0) {
            actualHeaders = rows[0].map(h => String(h || '').trim());
            dataRows = rows.slice(1);
        } else if (!hasHeader) {
            const numCols = Math.max(...rows.map(r => r.length));
            actualHeaders = Array.from({ length: numCols }, (_, i) => `Coluna ${i + 1}`);
        }

        const processedData = dataRows.map((row, index) => {
            const item = {
                id: Date.now() + index,
                item: index + 1
            };

            // Create row object with headers
            const rowObj = {};
            actualHeaders.forEach((h, i) => {
                rowObj[h] = row[i] !== undefined ? row[i] : '';
            });

            // Map basal columns
            Object.keys(mappings).forEach(targetCol => {
                const sourceCol = mappings[targetCol];
                const colIndex = actualHeaders.findIndex(h => h === sourceCol);

                if (colIndex !== -1) {
                    let value = row[colIndex];

                    if (Config.COLUMN_MAPPING.COLUMN_TYPES.NUMERIC.includes(targetCol)) {
                        value = this.parseNumber(value);
                    }

                    item[targetCol] = value;
                }
            });

            // Add custom columns
            customColumns.forEach(col => {
                const colIndex = actualHeaders.findIndex(h => h === col);
                if (colIndex !== -1) {
                    item[col] = row[colIndex];
                }
            });

            return item;
        }).filter(item => item.codigo || item.descricao);

        // Merge with existing data
        this.mergeData(processedData);

        // Update custom columns list
        this.customColumns = [...new Set([...this.customColumns, ...customColumns])];

        return {
            data: processedData,
            customColumns: this.customColumns,
            stats: {
                rows: processedData.length,
                columns: Object.keys(mappings).length + customColumns.length
            }
        };
    }

    // ============ DATA METHODS ============

    addItem(item) {
        const newItem = {
            id: Date.now(),
            ...item
        };
        this.data.push(newItem);
        this.saveData();
        return newItem;
    }

    updateItem(id, updates) {
        const index = this.data.findIndex(i => i.id === id);
        if (index !== -1) {
            this.data[index] = { ...this.data[index], ...updates };
            this.saveData();
            return this.data[index];
        }
        return null;
    }

    removeItem(id) {
        this.data = this.data.filter(i => i.id !== id);
        this.saveData();
    }

    getItem(id) {
        return this.data.find(i => i.id === id);
    }

    getAllItems() {
        return [...this.data];
    }

    searchItems(query, filters = {}) {
        let results = this.data;

        // Text search
        if (query) {
            const q = query.toLowerCase();
            results = results.filter(item =>
                (item.descricao && item.descricao.toLowerCase().includes(q)) ||
                (item.codigo && item.codigo.toString().toLowerCase().includes(q))
            );
        }

        // Type filter
        if (filters.type) {
            results = results.filter(item => item.tipo === filters.type);
        }

        return results;
    }

    clearData() {
        this.data = [];
        this.customColumns = [];
        this.saveData();
    }

    // ============ STATISTICS ============

    getStats() {
        const total = this.data.reduce((sum, item) => {
            return sum + (parseFloat(item.total) || 0);
        }, 0);

        return {
            items: this.data.length,
            total: total,
            types: this.getTypeDistribution()
        };
    }

    getTypeDistribution() {
        const dist = {};
        this.data.forEach(item => {
            const type = item.tipo || 'Outros';
            dist[type] = (dist[type] || 0) + 1;
        });
        return dist;
    }

    // ============ EXPORT METHODS ============

    exportToExcel() {
        const ws = XLSX.utils.json_to_sheet(this.data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Dados');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    exportToCSV() {
        const csv = Papa.unparse(this.data);
        return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    }

    // ============ MERGE DATA ============

    mergeData(newData) {
        // Add new items without duplicates (by code)
        const existingCodes = new Set(this.data.map(i => i.codigo));

        newData.forEach(item => {
            if (!existingCodes.has(item.codigo)) {
                this.data.push({
                    id: Date.now() + Math.random(),
                    ...item
                });
            }
        });

        this.saveData();
    }
}

// Create global instance
const dataManager = new DataManager();