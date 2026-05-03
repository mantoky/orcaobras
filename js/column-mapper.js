/**
 * OrçaObras - Column Mapper Module
 * =================================
 * Handles spreadsheet column mapping and template management
 * Allows users to model columns, titles, and data mappings
 * Supports multi-user data isolation
 */

class ColumnMapper {
    constructor() {
        this.currentFile = null;
        this.previewData = null;
        this.headers = [];
        this.columnMappings = {};
        this.customMappings = [];
        this.currentUserId = null;
        this.savedTemplates = this.loadTemplates();
        this.init();
    }

    init() {
        this.setCurrentUser();
        this.loadTemplates();
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

    getUserStorageKey() {
        // Returns user-specific storage key
        const userId = this.currentUserId || 'shared';
        return `${Config.STORAGE_KEYS.COLUMN_TEMPLATES}_${userId}`;
    }

    // ============ TEMPLATE MANAGEMENT ============

    loadTemplates() {
        try {
            const storageKey = this.getUserStorageKey();
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                this.savedTemplates = JSON.parse(stored);
            } else {
                this.savedTemplates = [];
            }
        } catch (e) {
            this.savedTemplates = [];
        }
        return this.savedTemplates;
    }

    saveTemplates() {
        const storageKey = this.getUserStorageKey();
        localStorage.setItem(storageKey, JSON.stringify(this.savedTemplates));
    }

    getTemplates() {
        return this.savedTemplates;
    }

    getTemplate(id) {
        return this.savedTemplates.find(t => t.id === id);
    }

    saveTemplate(name, mappings, customMappings, options = {}) {
        const template = {
            id: Date.now(),
            name: name,
            mappings: { ...mappings },
            customMappings: [...customMappings],
            options: {
                hasHeader: options.hasHeader !== false,
                separator: options.separator || ';'
            },
            createdAt: new Date().toISOString()
        };
        this.savedTemplates.push(template);
        this.saveTemplates();
        return template;
    }

    deleteTemplate(id) {
        this.savedTemplates = this.savedTemplates.filter(t => t.id !== id);
        this.saveTemplates();
    }

    updateTemplate(id, updates) {
        const index = this.savedTemplates.findIndex(t => t.id === id);
        if (index !== -1) {
            this.savedTemplates[index] = { ...this.savedTemplates[index], ...updates };
            this.saveTemplates();
            return this.savedTemplates[index];
        }
        return null;
    }

    // ============ FILE PROCESSING ============

    async loadFile(file, options = {}) {
        return new Promise((resolve, reject) => {
            this.currentFile = file;
            const extension = file.name.split('.').pop().toLowerCase();
            const hasHeader = options.hasHeader !== false;

            if (extension === 'csv') {
                this.loadCSV(file, hasHeader, options.separator)
                    .then(resolve)
                    .catch(reject);
            } else if (extension === 'xlsx' || extension === 'xls') {
                this.loadExcel(file, hasHeader)
                    .then(resolve)
                    .catch(reject);
            } else {
                reject(new Error('Formato de arquivo não suportado'));
            }
        });
    }

    loadCSV(file, hasHeader, separator = ';') {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                delimiter: separator,
                header: false,
                skipEmptyLines: true,
                complete: (results) => {
                    try {
                        this.processPreview(results.data, hasHeader);
                        resolve(this.previewData);
                    } catch (e) {
                        reject(e);
                    }
                },
                error: (error) => reject(error)
            });
        });
    }

    loadExcel(file, hasHeader) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

                    // Convert to array (no header)
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
                        header: 1,
                        defval: ''
                    });

                    this.processPreview(jsonData, hasHeader);
                    resolve(this.previewData);
                } catch (e) {
                    reject(e);
                }
            };
            reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
            reader.readAsArrayBuffer(file);
        });
    }

    processPreview(data, hasHeader) {
        if (!data || data.length === 0) {
            throw new Error('Nenhum dado encontrado');
        }

        // Get headers and data
        let headers = [];
        let rows = data;

        if (hasHeader && data.length > 0) {
            headers = data[0].map(h => String(h || '').trim());
            rows = data.slice(1);
        } else {
            // Generate column names
            const numCols = Math.max(...data.map(r => r.length));
            headers = Array.from({ length: numCols }, (_, i) => `Coluna ${i + 1}`);
        }

        // Get preview rows (first 5)
        const previewRows = rows.slice(0, 5).map((row, idx) => {
            const obj = { _rowIndex: idx + 1 };
            headers.forEach((h, i) => {
                obj[h] = row[i] !== undefined ? row[i] : '';
            });
            return obj;
        });

        this.headers = headers;
        this.previewData = {
            headers: headers,
            previewRows: previewRows,
            totalRows: rows.length,
            hasHeader: hasHeader
        };
    }

    // ============ COLUMN MAPPING ============

    getBasalColumns() {
        return Config.COLUMN_MAPPING.BASAL_COLUMNS;
    }

    getBasalColumnNames() {
        return Object.keys(Config.COLUMN_MAPPING.BASAL_COLUMNS);
    }

    getBasalColumnOptions(targetCol) {
        return Config.COLUMN_MAPPING.BASAL_COLUMNS[targetCol] || [];
    }

    isBasalColumn(header) {
        const normalized = this.normalizeHeader(header);
        return Object.values(Config.COLUMN_MAPPING.BASAL_COLUMNS)
            .flat()
            .some(name => this.normalizeHeader(name) === normalized);
    }

    autoMapColumns(headers) {
        const mapping = {};
        const normalizedHeaders = headers.map(h => this.normalizeHeader(h));

        Object.keys(Config.COLUMN_MAPPING.BASAL_COLUMNS).forEach(targetCol => {
            const possibleNames = Config.COLUMN_MAPPING.BASAL_COLUMNS[targetCol];
            const matchIndex = normalizedHeaders.findIndex(h =>
                possibleNames.some(name => this.normalizeHeader(name) === h)
            );
            if (matchIndex !== -1) {
                mapping[targetCol] = headers[matchIndex];
            }
        });

        return mapping;
    }

    findCustomColumns(headers, mappedColumns) {
        const mappedValues = Object.values(mappedColumns);
        return headers.filter(h => !mappedValues.includes(h));
    }

    // ============ DATA TRANSFORMATION ============

    transformData(rows, columnMappings, customColumns, options = {}) {
        if (!rows || rows.length === 0) return [];

        const hasHeader = options.hasHeader !== false;
        const headers = hasHeader && rows[0]._rowIndex === undefined
            ? Object.keys(rows[0]).filter(k => k !== '_rowIndex')
            : this.headers;

        return rows.map((row, index) => {
            const item = {
                id: Date.now() + index,
                item: index + 1
            };

            // Map basal columns
            Object.keys(columnMappings).forEach(targetCol => {
                const sourceCol = columnMappings[targetCol];
                const colIndex = headers.findIndex(h => h === sourceCol);
                if (colIndex !== -1) {
                    let value = row[sourceCol];
                    if (Config.COLUMN_MAPPING.COLUMN_TYPES.NUMERIC.includes(targetCol)) {
                        value = this.parseNumber(value);
                    }
                    item[targetCol] = value;
                }
            });

            // Map custom columns
            customColumns.forEach(col => {
                if (row[col] !== undefined) {
                    item[col] = row[col];
                }
            });

            return item;
        }).filter(item => item.codigo || item.descricao);
    }

    // ============ UTILITIES ============

    normalizeHeader(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '')
            .trim();
    }

    parseNumber(value) {
        if (typeof value === 'number') return value;
        let str = String(value || '').trim();
        str = str.replace(/[R$\s]/g, '');
        str = str.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    }

    // ============ PREVIEW RENDERING ============

    generatePreviewTableHTML(previewRows, headers, columnMappings) {
        if (!previewRows || previewRows.length === 0) {
            return '<p class="no-data">Nenhum dado para exibir</p>';
        }

        let html = '<table class="preview-table"><thead><tr><th>#</th>';
        headers.forEach(h => {
            const isMapped = Object.values(columnMappings).includes(h);
            const mappedTo = Object.keys(columnMappings).find(k => columnMappings[k] === h);
            html += `<th class="${isMapped ? 'mapped' : ''}">${h}${mappedTo ? `<span class="mapped-label">→ ${mappedTo}</span>` : ''}</th>`;
        });
        html += '</tr></thead><tbody>';

        previewRows.forEach((row, idx) => {
            html += `<tr><td>${idx + 1}</td>`;
            headers.forEach(h => {
                const value = row[h] !== undefined ? row[h] : '';
                html += `<td>${value}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    }

    generateMappingFormHTML(headers, currentMappings = {}, customColumns = []) {
        const basalCols = this.getBasalColumnNames();

        let html = '<div class="mapping-form"><div class="basal-mappings">';
        html += '<h4>Colunas Base</h4>';

        basalCols.forEach(col => {
            const options = this.getBasalColumnOptions(col);
            const currentValue = currentMappings[col] || '';
            html += `<div class="mapping-row">
                <label>${col}:</label>
                <select class="column-mapping-select" data-target="${col}">
                    <option value="">-- Ignorar --</option>`;
            headers.forEach(h => {
                const selected = h === currentValue ? 'selected' : '';
                html += `<option value="${h}" ${selected}>${h}</option>`;
            });
            html += `</select>
                <span class="mapping-hint">[${options.slice(0, 3).join(', ')}...]</span>
            </div>`;
        });

        html += '</div><div class="custom-mappings">';
        html += '<h4>Colunas Personalizadas</h4>';

        // Show existing custom columns
        if (customColumns.length > 0) {
            html += '<div class="custom-columns-list">';
            customColumns.forEach(col => {
                const checked = currentMappings.customColumns?.includes(col) ? 'checked' : '';
                html += `<label class="custom-column-check">
                    <input type="checkbox" value="${col}" ${checked}>
                    ${col}
                </label>`;
            });
            html += '</div>';
        }

        // Show unmapped columns
        const mappedValues = Object.values(currentMappings).filter(v => v);
        const unmappedCols = headers.filter(h => !mappedValues.includes(h));
        if (unmappedCols.length > 0) {
            html += '<p class="unmapped-hint">Colunas não mapeadas:</p>';
            html += '<div class="custom-columns-list">';
            unmappedCols.forEach(col => {
                html += `<label class="custom-column-check">
                    <input type="checkbox" value="${col}">
                    ${col}
                </label>`;
            });
            html += '</div>';
        }

        html += '</div></div>';
        return html;
    }

    generateTemplateSelectHTML(templates, selectedId = null) {
        let html = '<select id="template-select" class="template-select">';
        html += '<option value="">-- Selecionar template --</option>';
        templates.forEach(t => {
            const selected = t.id === selectedId ? 'selected' : '';
            html += `<option value="${t.id}" ${selected}>${t.name}</option>`;
        });
        html += '</select>';
        return html;
    }
}

// Create global instance
const columnMapper = new ColumnMapper();
