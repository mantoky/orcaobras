/**
 * OrçaObras - Main Application
 * ============================
 * Orchestrates all modules and handles UI interactions
 */

class OrcaObrasApp {
    constructor() {
        this.auth = Auth;
        this.data = dataManager;
        this.budget = budgetBuilder;
        this.export = exportManager;
        this.mapper = columnMapper;
        this.currentPage = 'dashboard';
        this.dbPage = 1;
        this.dbItemsPerPage = Config.PAGINATION.ITEMS_PER_PAGE;
        this.pendingFile = null;
        this.currentMappings = {};
        this.currentCustomColumns = [];
        this.init();
    }

    init() {
        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.start());
        } else {
            this.start();
        }
    }

    start() {
        // Register service worker
        this.registerServiceWorker();

        // Check authentication
        if (this.auth.isAuthenticated) {
            this.showApp();
        } else {
            this.showLogin();
        }

        // Setup event listeners
        this.setupEventListeners();

        // Update UI with current date
        this.updateDate();
    }

    // ============ SERVICE WORKER ============

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js')
                .then(reg => console.log('SW registered'))
                .catch(err => console.log('SW registration failed:', err));
        }
    }

    // ============ AUTHENTICATION ============

    showLogin() {
        document.getElementById('login-modal').classList.add('active');
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('loading-screen').classList.add('hidden');

        // Clear previous form data
        document.getElementById('login-form').reset();
        document.getElementById('login-error').style.display = 'none';
    }

    showApp() {
        document.getElementById('login-modal').classList.remove('active');
        document.getElementById('app-container').style.display = 'flex';
        document.getElementById('loading-screen').classList.add('hidden');

        // Update user info in sidebar
        document.getElementById('current-user-name').textContent = this.auth.currentUser.name;
        document.getElementById('current-user-role').textContent = this.auth.currentUser.role;

        // Show/hide master features
        this.updateMasterFeatures();

        // Load dark mode preference
        try {
            const settings = JSON.parse(localStorage.getItem(Config.STORAGE_KEYS.SETTINGS) || '{}');
            if (settings.darkMode) {
                document.body.classList.add('dark-mode');
            }
        } catch (e) {}

        // Update dashboard stats
        this.updateDashboard();

        // Initialize export manager
        this.export.init();
    }

    setupEventListeners() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Toggle password visibility
        document.querySelector('.toggle-password').addEventListener('click', () => {
            const input = document.getElementById('password');
            const icon = document.querySelector('.toggle-password i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });

        // Logout button
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.auth.logout();
            this.showLogin();
        });

        // Sidebar toggle (mobile)
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });

        // File upload
        this.setupFileUpload();

        // Database search
        document.getElementById('db-search')?.addEventListener('input', (e) => {
            this.filterDatabase(e.target.value, document.getElementById('db-filter-type')?.value);
        });

        document.getElementById('db-filter-type')?.addEventListener('change', (e) => {
            this.filterDatabase(document.getElementById('db-search')?.value, e.target.value);
        });

        // Tax rate
        document.getElementById('tax-rate')?.addEventListener('input', (e) => {
            this.budget.setTaxRate(e.target.value);
        });

        // Item search
        document.getElementById('item-search')?.addEventListener('input', (e) => {
            this.searchItems(e.target.value);
        });

        // Add item button
        document.getElementById('add-item-btn')?.addEventListener('click', () => {
            this.showItemModal();
        });

        // Item form
        document.getElementById('item-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveItem();
        });

        // Logo uploads
        document.getElementById('logo-input-1')?.addEventListener('change', (e) => {
            if (e.target.files[0]) this.budget.setLogo(1, e.target.files[0]);
        });

        document.getElementById('logo-input-2')?.addEventListener('change', (e) => {
            if (e.target.files[0]) this.budget.setLogo(2, e.target.files[0]);
        });

        // Add user form
        document.getElementById('add-user-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addUser();
        });

        // Clear database button
        document.getElementById('clear-db-btn')?.addEventListener('click', () => {
            this.showConfirm('Tem certeza que deseja limpar todos os dados do banco?', () => {
                this.data.clearData();
                this.loadDatabase();
                this.updateDashboard();
            });
        });

        // Close modals on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closePreview();
                this.closeItemModal();
                this.closeConfirm();
                this.closeUsersModal();
                this.closeColumnMapModal();
                this.closeSaveTemplateModal();
                this.closeEventModal();
            }
        });

        // Close modals on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closePreview();
                    this.closeItemModal();
                    this.closeConfirm();
                    this.closeColumnMapModal();
                }
            });
        });

        // Setup column mapping events
        this.setupColumnMapEvents();
    }

    handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('login-error');

        Utils.loading.show('Entrando...');
        
        this.auth.login(username, password)
            .then(user => {
                Utils.loading.hide();
                Utils.toast.success('Bem-vindo, ' + user.name + '!');
                this.showApp();
            })
            .catch(error => {
                Utils.loading.hide();
                errorEl.style.display = 'flex';
                errorEl.querySelector('span').textContent = error.message;
                Utils.toast.error('Login falhou: ' + error.message);
            });
    }

    updateMasterFeatures() {
        const isMaster = this.auth.isMaster();
        const clearBtn = document.getElementById('clear-db-btn');
        if (clearBtn) clearBtn.style.display = isMaster ? 'inline-flex' : 'none';
    }

    // ============ NAVIGATION ============

    navigateTo(page) {
        // Update nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Update pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.toggle('active', p.id === `page-${page}`);
        });

        // Update page title
        const titles = {
            dashboard: 'Dashboard',
            upload: 'Importar Dados',
            database: 'Banco de Dados',
            budget: 'Novo Orçamento',
            reports: 'Relatórios',
            search: 'Pesquisas',
            agenda: 'Agenda',
            backup: 'Backup & Restore'
        };
        document.getElementById('page-title').textContent = titles[page] || page;

        // Load page-specific data
        switch (page) {
            case 'dashboard':
                this.updateDashboard();
                this.loadRecentBudgets();
                break;
            case 'database':
                this.loadDatabase();
                break;
            case 'budget':
                this.budget.recalculate();
                break;
            case 'agenda':
                agendaManager.renderCalendar();
                agendaManager.renderTimeline();
                break;
            case 'backup':
                this.renderBackupPage();
                break;
        }

        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');

        this.currentPage = page;
    }

    // ============ DASHBOARD ============

    updateDashboard() {
        const stats = this.data.getStats();

        document.getElementById('total-budgets').textContent =
            JSON.parse(localStorage.getItem(Config.STORAGE_KEYS.BUDGETS) || '[]').length || 0;

        document.getElementById('total-items').textContent = stats.items;
        document.getElementById('total-value').textContent = this.formatCurrency(stats.total);
        document.getElementById('total-users').textContent = this.auth.getUsers().length;
    }

    loadRecentBudgets() {
        const container = document.getElementById('recent-budgets-list');
        const budgets = JSON.parse(localStorage.getItem(Config.STORAGE_KEYS.BUDGETS) || '[]');

        if (budgets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-invoice-dollar"></i>
                    <p>Nenhum orçamento recente</p>
                    <span>Clique em "Novo Orçamento" para começar</span>
                </div>
            `;
            return;
        }

        container.innerHTML = budgets.slice(-5).reverse().map(b => `
            <div class="recent-item">
                <div class="recent-info">
                    <strong>${b.cliente || 'Sem nome'}</strong>
                    <span>${this.formatCurrency(b.total)} - ${new Date(b.savedAt).toLocaleDateString('pt-BR')}</span>
                </div>
            </div>
        `).join('');
    }

    // ============ FILE UPLOAD ============

    setupFileUpload() {
        const dropzone = document.getElementById('upload-dropzone');
        const fileInput = document.getElementById('file-input');
        const progress = document.getElementById('upload-progress');
        const result = document.getElementById('upload-result');

        // Click to select
        dropzone.addEventListener('click', () => fileInput.click());

        // Drag and drop
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) this.processFile(files[0]);
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.processFile(e.target.files[0]);
            }
        });
    }

    async processFile(file) {
        // Use new column mapping flow
        await this.processFileWithMapping(file);
    }

    viewImportedData() {
        this.navigateTo('database');
    }

    // ============ COLUMN MAPPING ============

    async processFileWithMapping(file) {
        const options = {
            hasHeader: document.getElementById('has-header')?.checked !== false,
            separator: document.getElementById('csv-separator')?.value || ';'
        };

        try {
            // Load file preview
            await this.mapper.loadFile(file, options);

            // Store file for later import
            this.pendingFile = file;
            this.currentMappings = {};
            this.currentCustomColumns = [];

            // Auto-map columns
            this.currentMappings = this.mapper.autoMapColumns(this.mapper.previewData.headers);
            this.currentCustomColumns = this.mapper.findCustomColumns(
                this.mapper.previewData.headers,
                this.currentMappings
            );

            // Show mapping modal
            this.openColumnMapModal();

        } catch (error) {
            console.error('Error loading file:', error);
            alert('Erro ao processar arquivo: ' + error.message);
        }
    }

    openColumnMapModal() {
        const modal = document.getElementById('column-map-modal');
        if (!modal) return;

        // Update file info
        document.getElementById('map-file-name').textContent = this.pendingFile?.name || '-';
        document.getElementById('map-file-info').textContent =
            `${this.mapper.previewData.totalRows} linhas | ${this.mapper.previewData.headers.length} colunas`;

        // Load saved templates
        this.populateTemplateSelect();

        // Render mapping form
        this.renderBasalMappings();

        // Render custom columns
        this.renderCustomColumns();

        // Render preview table
        this.renderMapPreviewTable();

        modal.classList.add('active');
    }

    closeColumnMapModal() {
        document.getElementById('column-map-modal').classList.remove('active');
        this.pendingFile = null;
        this.currentMappings = {};
        this.currentCustomColumns = [];
    }

    populateTemplateSelect() {
        const select = document.getElementById('saved-template-select');
        const templates = this.mapper.getTemplates();

        select.innerHTML = '<option value="">-- Selecionar template --</option>';
        templates.forEach(t => {
            select.innerHTML += `<option value="${t.id}">${t.name}</option>`;
        });
    }

    renderBasalMappings() {
        const container = document.getElementById('basal-columns-mapping');
        if (!container) return;

        const headers = this.mapper.previewData.headers;
        const basalCols = this.mapper.getBasalColumnNames();

        let html = '';
        basalCols.forEach(col => {
            const options = this.mapper.getBasalColumnOptions(col);
            const currentValue = this.currentMappings[col] || '';

            html += `
                <div class="mapping-row">
                    <label class="mapping-label">
                        <span class="col-name">${col}</span>
                        <span class="col-hint">[${options.slice(0, 2).join(', ')}...]</span>
                    </label>
                    <select class="mapping-select" data-target="${col}">
                        <option value="">-- Ignorar --</option>
                        ${headers.map(h => `
                            <option value="${h}" ${h === currentValue ? 'selected' : ''}>${h}</option>
                        `).join('')}
                    </select>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    renderCustomColumns() {
        const container = document.getElementById('custom-columns-list');
        if (!container) return;

        const headers = this.mapper.previewData.headers;
        const mappedValues = Object.values(this.currentMappings).filter(v => v);
        const unmappedCols = headers.filter(h => !mappedValues.includes(h));

        let html = '';
        if (unmappedCols.length === 0) {
            html = '<p class="no-custom">Todas as colunas já estão mapeadas</p>';
        } else {
            unmappedCols.forEach(col => {
                const checked = this.currentCustomColumns.includes(col) ? 'checked' : '';
                html += `
                    <label class="custom-col-check">
                        <input type="checkbox" value="${col}" ${checked}>
                        ${col}
                    </label>
                `;
            });
        }

        container.innerHTML = html;
    }

    renderMapPreviewTable() {
        const container = document.getElementById('map-preview-table');
        if (!container) return;

        const previewRows = this.mapper.previewData.previewRows;
        const headers = this.mapper.previewData.headers;

        let html = '<table class="preview-table"><thead><tr><th>#</th>';
        headers.forEach(h => {
            const isMapped = Object.values(this.currentMappings).includes(h);
            const mappedTo = Object.keys(this.currentMappings).find(k => this.currentMappings[k] === h);
            html += `<th class="${isMapped ? 'mapped' : ''}">${h}${mappedTo ? `<span class="map-badge">→ ${mappedTo}</span>` : ''}</th>`;
        });
        html += '</tr></thead><tbody>';

        previewRows.forEach((row, idx) => {
            html += '<tr><td>' + (idx + 1) + '</td>';
            headers.forEach(h => {
                const value = row[h] !== undefined ? row[h] : '';
                html += '<td>' + value + '</td>';
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    updateMapping(targetCol, sourceCol) {
        if (sourceCol) {
            this.currentMappings[targetCol] = sourceCol;
        } else {
            delete this.currentMappings[targetCol];
        }

        // Re-render custom columns (some may become mapped/unmapped)
        this.currentCustomColumns = this.currentCustomColumns.filter(c =>
            !Object.values(this.currentMappings).includes(c)
        );

        this.renderCustomColumns();
        this.renderMapPreviewTable();
    }

    updateCustomColumn(col, checked) {
        if (checked) {
            if (!this.currentCustomColumns.includes(col)) {
                this.currentCustomColumns.push(col);
            }
        } else {
            this.currentCustomColumns = this.currentCustomColumns.filter(c => c !== col);
        }
    }

    loadMappingTemplate() {
        const select = document.getElementById('saved-template-select');
        const templateId = parseInt(select.value);

        if (!templateId) {
            alert('Selecione um template para carregar');
            return;
        }

        const template = this.mapper.getTemplate(templateId);
        if (template) {
            this.currentMappings = { ...template.mappings };
            this.currentCustomColumns = [...template.customMappings];
            this.renderBasalMappings();
            this.renderCustomColumns();
            this.renderMapPreviewTable();
            Utils.toast.success('Template carregado com sucesso!');
        }
    }

    deleteMappingTemplate() {
        const select = document.getElementById('saved-template-select');
        const templateId = parseInt(select.value);

        if (!templateId) {
            alert('Selecione um template para excluir');
            return;
        }

        this.showConfirm('Tem certeza que deseja excluir este template?', () => {
            this.mapper.deleteTemplate(templateId);
            this.populateTemplateSelect();
            Utils.toast.success('Template excluído!');
        });
    }

    openSaveTemplateModal() {
        document.getElementById('save-template-modal').classList.add('active');
        document.getElementById('template-name').value = '';
    }

    closeSaveTemplateModal() {
        document.getElementById('save-template-modal').classList.remove('active');
    }

    saveMappingTemplate() {
        const name = document.getElementById('template-name').value.trim();
        if (!name) {
            alert('Digite um nome para o template');
            return;
        }

        this.mapper.saveTemplate(name, this.currentMappings, this.currentCustomColumns);
        this.populateTemplateSelect();
        this.closeSaveTemplateModal();
        Utils.toast.success('Template salvo com sucesso!');
    }

    async confirmMapping() {
        if (!this.pendingFile) {
            alert('Nenhum arquivo selecionado');
            return;
        }

        const options = {
            hasHeader: this.mapper.previewData.hasHeader,
            mappings: this.currentMappings,
            customColumns: this.currentCustomColumns
        };

        try {
            Utils.loading.show('Importando dados...');

            const processed = await this.data.importWithMapping(
                this.pendingFile,
                options
            );

            Utils.loading.hide();

            this.closeColumnMapModal();

            // Show result
            const dropzone = document.getElementById('upload-dropzone');
            const result = document.getElementById('upload-result');

            dropzone.style.display = 'none';
            result.style.display = 'block';

            document.getElementById('result-rows').textContent = processed.stats.rows;
            document.getElementById('result-columns').textContent = processed.stats.columns;

            this.updateDashboard();
            Utils.toast.success('Importação concluída com sucesso!');

        } catch (error) {
            Utils.loading.hide();
            console.error('Import error:', error);
            alert('Erro ao importar: ' + error.message);
        }
    }

    setupColumnMapEvents() {
        // Load template
        document.getElementById('load-template-btn')?.addEventListener('click', () => {
            this.loadMappingTemplate();
        });

        // Delete template
        document.getElementById('delete-template-btn')?.addEventListener('click', () => {
            this.deleteMappingTemplate();
        });

        // Mapping select change
        document.getElementById('basal-columns-mapping')?.addEventListener('change', (e) => {
            if (e.target.classList.contains('mapping-select')) {
                this.updateMapping(e.target.dataset.target, e.target.value);
            }
        });

        // Custom columns change
        document.getElementById('custom-columns-list')?.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                this.updateCustomColumn(e.target.value, e.target.checked);
            }
        });

        // Save template
        document.getElementById('save-template-btn')?.addEventListener('click', () => {
            this.openSaveTemplateModal();
        });

        document.getElementById('save-template-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveMappingTemplate();
        });

        // Confirm mapping
        document.getElementById('confirm-mapping-btn')?.addEventListener('click', () => {
            this.confirmMapping();
        });
    }

    // ============ DATABASE ============

    loadDatabase(page = 1) {
        this.dbPage = page;
        const allItems = this.data.getAllItems();

        // Filter
        const searchTerm = document.getElementById('db-search')?.value?.toLowerCase() || '';
        const typeFilter = document.getElementById('db-filter-type')?.value || '';

        let filteredItems = allItems;
        if (searchTerm) {
            filteredItems = filteredItems.filter(item =>
                (item.descricao && item.descricao.toLowerCase().includes(searchTerm)) ||
                (item.codigo && item.codigo.toString().toLowerCase().includes(searchTerm))
            );
        }
        if (typeFilter) {
            filteredItems = filteredItems.filter(item => item.tipo === typeFilter);
        }

        // Pagination
        const totalPages = Math.ceil(filteredItems.length / this.dbItemsPerPage);
        const start = (page - 1) * this.dbItemsPerPage;
        const pageItems = filteredItems.slice(start, start + this.dbItemsPerPage);

        // Update header
        document.getElementById('db-total-items').textContent = filteredItems.length;
        document.getElementById('db-total-value').textContent =
            this.formatCurrency(filteredItems.reduce((s, i) => s + (parseFloat(i.total) || 0), 0));

        // Generate custom column headers
        const tableHeader = document.getElementById('db-table-header');
        const customCols = this.data.customColumns;

        let headerHTML = '<th>Item</th><th>Código</th><th>Descrição</th><th>Tipo</th><th>Und.</th><th>Quant.</th><th>Valor Unit.</th><th>Total</th>';
        if (customCols.length > 0) {
            customCols.forEach(col => {
                headerHTML += `<th>${col}</th>`;
            });
        }
        tableHeader.innerHTML = headerHTML;

        // Generate rows
        const tbody = document.getElementById('database-tbody');
        if (pageItems.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted" style="padding: 40px;">
                        Nenhum item encontrado
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = pageItems.map(item => {
                let row = `
                    <tr>
                        <td>${item.item || '-'}</td>
                        <td>${item.codigo || '-'}</td>
                        <td>${item.descricao || '-'}</td>
                        <td><span class="type-badge">${item.tipo || '-'}</span></td>
                        <td>${item.unidade || '-'}</td>
                        <td class="text-right">${this.formatNumber(item.quantidade)}</td>
                        <td class="text-right">${this.formatCurrency(item.valorUnit)}</td>
                        <td class="text-right">${this.formatCurrency(item.total)}</td>
                `;

                // Custom columns
                if (customCols.length > 0) {
                    customCols.forEach(col => {
                        row += `<td>${item[col] || '-'}</td>`;
                    });
                }

                row += '</tr>';
                return row;
            }).join('');
        }

        // Pagination
        this.generatePagination(totalPages, page);
    }

    filterDatabase(search, type) {
        this.loadDatabase(1);
    }

    generatePagination(totalPages, currentPage) {
        const container = document.getElementById('db-pagination');
        if (!container || totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }

        let html = `
            <span class="pagination-info">Página ${currentPage} de ${totalPages}</span>
            <div class="pagination-buttons">
                <button ${currentPage === 1 ? 'disabled' : ''} onclick="app.loadDatabase(${currentPage - 1})">
                    <i class="fas fa-chevron-left"></i>
                </button>
        `;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                html += `<button class="${i === currentPage ? 'active' : ''}" onclick="app.loadDatabase(${i})">${i}</button>`;
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                html += '<button disabled>...</button>';
            }
        }

        html += `
                <button ${currentPage === totalPages ? 'disabled' : ''} onclick="app.loadDatabase(${currentPage + 1})">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;

        container.innerHTML = html;
    }

    exportDatabase() {
        const data = this.data.exportToExcel();
        this.export.downloadBlob(data, `Banco_Dados_OrcaObras_${this.getDateString()}.xlsx`);
    }

    // ============ BUDGET ============

    searchItems(query) {
        const resultsContainer = document.getElementById('item-search-results');
        if (!query || query.length < 2) {
            resultsContainer.classList.remove('active');
            resultsContainer.innerHTML = '';
            return;
        }

        const results = this.data.searchItems(query);

        if (results.length === 0) {
            resultsContainer.classList.add('active');
            resultsContainer.innerHTML = '<div class="empty-state"><p>Nenhum item encontrado</p></div>';
            return;
        }

        resultsContainer.classList.add('active');
        resultsContainer.innerHTML = results.slice(0, 10).map(item => `
            <div class="search-result-item" onclick="app.addItemToBudget(${item.id})">
                <div class="result-info">
                    <strong>${item.descricao}</strong>
                    <span>${item.codigo} | ${item.tipo} | ${item.unidade}</span>
                </div>
                <div class="result-price">${this.formatCurrency(item.valorUnit || item.total)}</div>
                <div class="result-action">
                    <button><i class="fas fa-plus"></i></button>
                </div>
            </div>
        `).join('');
    }

    addItemToBudget(itemId) {
        const item = this.data.getItem(itemId);
        if (item) {
            this.budget.addItem({
                codigo: item.codigo,
                descricao: item.descricao,
                tipo: item.tipo,
                unidade: item.unidade,
                quantidade: 1,
                valorUnit: item.valorUnit || item.total || 0
            });

            // Clear search
            document.getElementById('item-search').value = '';
            document.getElementById('item-search-results').classList.remove('active');
        }
    }

    showItemModal(index = null) {
        const modal = document.getElementById('item-modal');
        const form = document.getElementById('item-form');
        const title = document.getElementById('item-modal-title');

        if (index !== null) {
            const item = this.budget.items[index];
            title.innerHTML = '<i class="fas fa-edit"></i> Editar Item';
            document.getElementById('item-index').value = index;
            document.getElementById('item-code').value = item.codigo || '';
            document.getElementById('item-type').value = item.tipo || 'Material';
            document.getElementById('item-description').value = item.descricao || '';
            document.getElementById('item-unit').value = item.unidade || '';
            document.getElementById('item-quantity').value = item.quantidade || 1;
            document.getElementById('item-price').value = item.valorUnit || 0;
        } else {
            title.innerHTML = '<i class="fas fa-plus"></i> Adicionar Item';
            form.reset();
            document.getElementById('item-index').value = '';
        }

        modal.classList.add('active');
    }

    closeItemModal() {
        document.getElementById('item-modal').classList.remove('active');
    }

    closeEventModal() {
        agendaManager.closeEventModal();
    }

    openEventModal() {
        agendaManager.openEventModal();
    }

    deleteEvent() {
        agendaManager.deleteEvent();
    }

    exportAgenda() {
        agendaManager.exportAgenda();
    }

    // ============ IMPORT DATA BROWSER ============

    openImportModal() {
        const modal = document.getElementById('import-modal');
        const listContainer = document.getElementById('import-items-list');
        const searchInput = document.getElementById('import-search');

        // Load all imported data
        const allItems = this.data.getAllItems();

        // Update stats
        document.getElementById('import-total-items').textContent = allItems.length;

        // Render items
        this.renderImportItems(allItems);

        // Setup search
        searchInput.oninput = () => {
            const query = searchInput.value.toLowerCase();
            const filtered = allItems.filter(item =>
                (item.descricao && item.descricao.toLowerCase().includes(query)) ||
                (item.codigo && item.codigo.toString().toLowerCase().includes(query))
            );
            this.renderImportItems(filtered);
        };

        modal.classList.add('active');
    }

    renderImportItems(items) {
        const listContainer = document.getElementById('import-items-list');

        if (items.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state" style="padding: 40px; text-align: center;">
                    <i class="fas fa-database" style="font-size: 48px; color: var(--border-medium); margin-bottom: 16px;"></i>
                    <p style="color: var(--text-muted);">Nenhum item encontrado</p>
                    <span style="font-size: var(--font-size-sm); color: var(--text-muted);">
                        Importe planilhas para visualizar os dados aqui
                    </span>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = items.map(item => `
            <div class="import-item-row" data-id="${item.id}">
                <input type="checkbox" class="import-item-check">
                <div class="import-item-info">
                    <span class="import-item-code">${item.codigo || '-'}</span>
                    <span class="import-item-desc">${item.descricao || '-'}</span>
                    <span class="import-item-type"><span class="type-badge">${item.tipo || '-'}</span></span>
                    <span class="import-item-unit">${item.unidade || '-'}</span>
                    <span class="import-item-price">${this.formatCurrency(item.valorUnit || 0)}</span>
                </div>
            </div>
        `).join('');

        // Add click handlers
        listContainer.querySelectorAll('.import-item-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    const checkbox = row.querySelector('input[type="checkbox"]');
                    checkbox.checked = !checkbox.checked;
                    row.classList.toggle('selected', checkbox.checked);
                }
            });

            row.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
                row.classList.toggle('selected', e.target.checked);
            });
        });
    }

    addSelectedItemsToBudget() {
        const checkedItems = document.querySelectorAll('.import-item-row input[type="checkbox"]:checked');

        if (checkedItems.length === 0) {
            alert('Selecione pelo menos um item para adicionar ao orçamento.');
            return;
        }

        const selectedIds = Array.from(checkedItems).map(cb => {
            return parseInt(cb.closest('.import-item-row').dataset.id);
        });

        selectedIds.forEach(id => {
            const item = this.data.getItem(id);
            if (item) {
                this.budget.addItem({
                    codigo: item.codigo,
                    descricao: item.descricao,
                    tipo: item.tipo,
                    unidade: item.unidade,
                    quantidade: 1,
                    valorUnit: item.valorUnit || item.total || 0
                });
            }
        });

        alert(`${selectedIds.length} item(s) adicionado(s) ao orçamento!`);
        this.closeImportModal();

        // Navigate to budget page to show results
        this.navigateTo('budget');
    }

    closeImportModal() {
        document.getElementById('import-modal').classList.remove('active');
    }

    // ============ SETTINGS ============

    openSettingsModal() {
        const modal = document.getElementById('settings-modal');
        const moderatorSection = document.getElementById('moderator-settings');
        const darkModeToggle = document.getElementById('dark-mode-toggle');

        // Show/hide moderator settings based on user role
        if (moderatorSection) {
            moderatorSection.style.display = this.auth.isMaster() ? 'block' : 'none';
        }

        // Set dark mode toggle based on current state
        if (darkModeToggle) {
            darkModeToggle.checked = document.body.classList.contains('dark-mode');

            darkModeToggle.onchange = () => {
                document.body.classList.toggle('dark-mode', darkModeToggle.checked);
                localStorage.setItem(Config.STORAGE_KEYS.SETTINGS, JSON.stringify({
                    darkMode: darkModeToggle.checked
                }));
            };
        }

        modal.classList.add('active');
    }

    closeSettingsModal() {
        document.getElementById('settings-modal').classList.remove('active');
    }

    confirmClearDatabase() {
        this.closeSettingsModal();
        this.showConfirm('Tem certeza que deseja limpar TODOS os dados do banco? Esta ação não pode ser desfeita!', () => {
            this.data.clearData();
            this.loadDatabase();
            this.updateDashboard();
            alert('Banco de dados limpo com sucesso!');
        });
    }

    saveItem() {
        const index = document.getElementById('item-index').value;
        const itemData = {
            codigo: document.getElementById('item-code').value,
            tipo: document.getElementById('item-type').value,
            descricao: document.getElementById('item-description').value,
            unidade: document.getElementById('item-unit').value,
            quantidade: parseFloat(document.getElementById('item-quantity').value) || 0,
            valorUnit: parseFloat(document.getElementById('item-price').value) || 0
        };

        if (index) {
            this.budget.updateItem(parseFloat(index), itemData);
        } else {
            this.budget.addItem(itemData);
        }

        this.closeItemModal();
    }

    saveDraft() {
        this.budget.saveDraft();
        alert('Rascunho salvo com sucesso!');
    }

    // ============ PREVIEW & EXPORT ============

    previewBudget() {
        const modal = document.getElementById('preview-modal');
        const preview = document.getElementById('budget-preview');

        // Generate preview content
        const previewData = this.budget.getPreviewData();
        const table = document.getElementById('preview-table');

        table.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Código</th>
                        <th>Descrição</th>
                        <th>Und</th>
                        <th>Qtd</th>
                        <th>Valor Unit.</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${previewData.items.map((item, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td>${item.codigo || '-'}</td>
                            <td>${item.descricao || '-'}</td>
                            <td>${item.unidade || '-'}</td>
                            <td>${item.quantidade}</td>
                            <td>${this.formatCurrency(item.valorUnit)}</td>
                            <td><strong>${this.formatCurrency(item.total)}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        modal.classList.add('active');
        document.getElementById('export-options').style.display = 'flex';
    }

    closePreview() {
        document.getElementById('preview-modal').classList.remove('active');
        document.getElementById('export-options').style.display = 'none';
    }

    closeAllModals() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    printBudget() {
        window.print();
    }

    exportBudget() {
        const previewData = this.budget.getPreviewData();
        this.export.export(this.export.currentFormat, previewData);
    }

    // ============ REPORTS ============

    generateReport(type) {
        switch (type) {
            case 'type':
                this.generateTypeReport();
                break;
            case 'analytical':
                this.export.exportExcel(this.data.getAllItems().map((item, i) => ({
                    ...item,
                    item: i + 1
                })));
                break;
            case 'financial':
                this.generateFinancialSummary();
                break;
        }
    }

    generateTypeReport() {
        const stats = this.data.getStats();
        const data = Object.entries(stats.types).map(([type, count]) => ({
            type,
            count,
            items: this.data.getAllItems().filter(i => i.tipo === type)
        }));

        // Create a summary sheet
        const summary = data.map(d => ({
            'Tipo': d.type,
            'Quantidade de Itens': d.count,
            'Valor Total': this.formatCurrency(d.items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0))
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(summary);
        XLSX.utils.book_append_sheet(wb, ws, 'Por Tipo');
        XLSX.writeFile(wb, `Relatorio_Tipo_${this.getDateString()}.xlsx`);
    }

    generateFinancialSummary() {
        const stats = this.data.getStats();
        const total = stats.total;

        const data = [
            { 'Resumo': 'Total de Itens', 'Valor': stats.items },
            { 'Resumo': 'Valor Total', 'Valor': this.formatCurrency(total) },
            { 'Resumo': '', 'Valor': '' },
            { 'Resumo': 'Por Tipo:', 'Valor': '' },
            ...Object.entries(stats.types).map(([type, count]) => ({
                'Resumo': `  ${type}`,
                'Valor': `${count} itens`
            }))
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Resumo');
        XLSX.writeFile(wb, `Resumo_Financeiro_${this.getDateString()}.xlsx`);
    }

    // ============ SEARCH / WIDGETS ============

    searchWeb(type) {
        // Placeholder for search functionality
        console.log('Search requested for:', type);
    }

    // ============ BACKUP PAGE ============
    
    renderBackupPage() {
        const contentArea = document.querySelector('.content-area');
        const pageSearch = document.getElementById('page-search');
        
        if (!document.getElementById('page-backup')) {
            const backupPage = document.createElement('section');
            backupPage.id = 'page-backup';
            backupPage.className = 'page';
            backupPage.innerHTML = `
                <div class="page-header">
                    <h3><i class="fas fa-database"></i> Backup & Restore</h3>
                    <p>Gerencie seus dados: exporte backups e restaure informações</p>
                </div>
                
                <div class="backup-container">
                    <div class="backup-card">
                        <div class="backup-icon" style="background: linear-gradient(135deg, #4CAF50, #66BB6A);">
                            <i class="fas fa-download"></i>
                        </div>
                        <h4>Exportar Backup</h4>
                        <p>Baixe todos os seus dados (orçamentos, banco de dados, configurações) em um arquivo JSON</p>
                        <button class="btn-primary" onclick="Utils.backup.exportData()">
                            <i class="fas fa-download"></i> Exportar
                        </button>
                    </div>
                    
                    <div class="backup-card">
                        <div class="backup-icon" style="background: linear-gradient(135deg, #2196F3, #42A5F5);">
                            <i class="fas fa-upload"></i>
                        </div>
                        <h4>Importar Backup</h4>
                        <p>Restaure seus dados a partir de um arquivo de backup anterior</p>
                        <div class="backup-upload">
                            <input type="file" id="backup-input" accept=".json" hidden>
                            <button class="btn-secondary" onclick="document.getElementById('backup-input').click()">
                                <i class="fas fa-folder-open"></i> Selecionar Arquivo
                            </button>
                            <span id="backup-filename">Nenhum arquivo selecionado</span>
                        </div>
                    </div>
                </div>
                
                <div class="backup-info">
                    <h5><i class="fas fa-info-circle"></i> Informações</h5>
                    <ul>
                        <li>O backup inclui: orçamentos, banco de dados de preços, usuários e configurações</li>
                        <li>Ao importar, os dados atuais serão sobrescritos pelos dados do backup</li>
                        <li>Recomendamos exportar um backup regularmente</li>
                    </ul>
                </div>
            `;
            contentArea.appendChild(backupPage);
            
            document.getElementById('backup-input').addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    document.getElementById('backup-filename').textContent = file.name;
                    await Utils.backup.importData(file);
                    window.location.reload();
                }
            });
        }
        
        // Hide other pages, show backup
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-backup').classList.add('active');
    }

    // ============ USERS (MASTER) ============

    showUsersModal() {
        const modal = document.getElementById('users-modal');
        const list = document.getElementById('users-list');
        const users = this.auth.getUsers();

        list.innerHTML = users.map(user => `
            <div class="user-item">
                <div class="user-item-info">
                    <i class="fas fa-user-circle"></i>
                    <div>
                        <div class="user-item-name">${user.name}</div>
                        <div class="user-item-role">${user.role}</div>
                    </div>
                </div>
                <div class="user-item-actions">
                    ${user.id !== this.auth.currentUser.id ? `
                        <button class="btn-delete" onclick="app.removeUser(${user.id})">
                            <i class="fas fa-trash"></i> Remover
                        </button>
                    ` : '<span style="color: var(--text-muted); font-size: 12px;">(Você)</span>'}
                </div>
            </div>
        `).join('');

        modal.classList.add('active');
    }

    closeUsersModal() {
        document.getElementById('users-modal').classList.remove('active');
    }

    addUser() {
        const username = document.getElementById('new-username').value;
        const password = document.getElementById('new-password').value;
        const role = document.getElementById('new-role').value;

        this.auth.addUser(username, password, role)
            .then(() => {
                alert('Usuário adicionado com sucesso!');
                document.getElementById('add-user-form').reset();
                this.showUsersModal();
            })
            .catch(err => alert(err.message));
    }

    removeUser(userId) {
        this.showConfirm('Tem certeza que deseja remover este usuário?', () => {
            this.auth.removeUser(userId)
                .then(() => {
                    this.showUsersModal();
                    this.updateDashboard();
                })
                .catch(err => alert(err.message));
        });
    }

    // ============ CONFIRMATION ============

    showConfirm(message, onConfirm) {
        document.getElementById('confirm-message').textContent = message;
        document.getElementById('confirm-modal').classList.add('active');

        document.getElementById('confirm-btn-ok').onclick = () => {
            this.closeConfirm();
            onConfirm();
        };
    }

    closeConfirm() {
        document.getElementById('confirm-modal').classList.remove('active');
    }

    // ============ HELPERS ============

    updateDate() {
        const dateEl = document.getElementById('current-date');
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    }

    formatNumber(value) {
        return new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value || 0);
    }

    getDateString() {
        const now = new Date();
        return `${now.getDate().toString().padStart(2, '0')}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getFullYear()}`;
    }
}

// Create global instance
const app = new OrcaObrasApp();