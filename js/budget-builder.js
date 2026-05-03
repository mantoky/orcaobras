/**
 * OrçaObras - Budget Builder Module
 * ===================================
 * Handles budget creation and management
 * Supports multi-user data isolation
 */

class BudgetBuilder {
    constructor() {
        this.items = [];
        this.taxRate = 0;
        this.currentUserId = null;
        this.init();
    }

    init() {
        this.setCurrentUser();
        this.loadDraft();
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
        return `${Config.STORAGE_KEYS.BUDGETS}_${userId}`;
    }

    // ============ DRAFT MANAGEMENT ============

    loadDraft() {
        try {
            const storageKey = this.getUserStorageKey();
            const draft = localStorage.getItem(storageKey);
            if (draft) {
                const data = JSON.parse(draft);
                this.items = data.items || [];
                this.taxRate = data.taxRate || 0;
            }
        } catch (e) {
            console.error('Error loading draft:', e);
        }
    }

    saveDraft() {
        const storageKey = this.getUserStorageKey();
        localStorage.setItem(storageKey, JSON.stringify({
            items: this.items,
            taxRate: this.taxRate,
            savedAt: new Date().toISOString(),
            userId: this.currentUserId
        }));
    }

    clearDraft() {
        this.items = [];
        this.taxRate = 0;
        const storageKey = this.getUserStorageKey();
        localStorage.removeItem(storageKey);
    }

    // ============ ITEM MANAGEMENT ============

    addItem(item) {
        const newItem = {
            id: Date.now() + Math.random(),
            item: this.items.length + 1,
            ...item,
            total: (parseFloat(item.quantidade) || 0) * (parseFloat(item.valorUnit) || 0)
        };
        this.items.push(newItem);
        this.recalculate();
        this.saveDraft();
        return newItem;
    }

    addItemsFromDatabase(items) {
        items.forEach(item => {
            this.addItem({
                codigo: item.codigo,
                descricao: item.descricao,
                tipo: item.tipo,
                unidade: item.unidade,
                quantidade: 1,
                valorUnit: item.valorUnit || item.total || 0
            });
        });
    }

    updateItem(id, updates) {
        const index = this.items.findIndex(i => i.id === id);
        if (index !== -1) {
            this.items[index] = { ...this.items[index], ...updates };

            // Recalculate total for this item
            const qty = parseFloat(this.items[index].quantidade) || 0;
            const price = parseFloat(this.items[index].valorUnit) || 0;
            this.items[index].total = qty * price;

            this.recalculate();
            this.saveDraft();
            return this.items[index];
        }
        return null;
    }

    removeItem(id) {
        this.items = this.items.filter(i => i.id !== id);
        this.reorderItems();
        this.recalculate();
        this.saveDraft();
    }

    reorderItems() {
        this.items = this.items.map((item, index) => ({
            ...item,
            item: index + 1
        }));
    }

    // ============ CALCULATIONS ============

    recalculate() {
        this.updateTable();
        this.updateSummary();
    }

    updateTable() {
        const tbody = document.getElementById('budget-tbody');
        if (!tbody) return;

        tbody.innerHTML = this.items.map((item, index) => `
            <tr data-id="${item.id}">
                <td class="col-num">${item.item}</td>
                <td class="col-code">${item.codigo || '-'}</td>
                <td class="col-desc">${item.descricao || '-'}</td>
                <td class="col-type">${item.tipo || '-'}</td>
                <td class="col-und">${item.unidade || '-'}</td>
                <td class="col-qty">
                    <input type="number" value="${item.quantidade}"
                        onchange="app.budget.updateItemQuantity(${item.id}, this.value)"
                        min="0" step="0.01">
                </td>
                <td class="col-price">
                    <input type="number" value="${item.valorUnit}"
                        onchange="app.budget.updateItemPrice(${item.id}, this.value)"
                        min="0" step="0.01">
                </td>
                <td class="col-total">${this.formatCurrency(item.total)}</td>
                <td class="col-actions">
                    <button class="btn-remove-item" onclick="app.budget.removeItem(${item.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Show/hide empty state
        const emptyState = document.getElementById('budget-empty-state');
        if (emptyState) {
            emptyState.style.display = this.items.length === 0 ? 'block' : 'none';
        }
    }

    updateSummary() {
        const subtotal = this.getSubtotal();
        const taxValue = subtotal * (this.taxRate / 100);
        const total = subtotal + taxValue;

        // Update summary elements
        const subtotalEl = document.getElementById('budget-subtotal');
        const taxValueEl = document.getElementById('tax-value');
        const totalEl = document.getElementById('budget-total');

        if (subtotalEl) subtotalEl.textContent = this.formatCurrency(subtotal);
        if (taxValueEl) taxValueEl.textContent = this.formatCurrency(taxValue);
        if (totalEl) totalEl.textContent = this.formatCurrency(total);

        // Update table header total column
        const totalHeader = document.querySelector('.budget-table th.col-total');
        if (totalHeader) {
            totalHeader.textContent = `Total (${this.items.length})`;
        }
    }

    getSubtotal() {
        return this.items.reduce((sum, item) => sum + (item.total || 0), 0);
    }

    getTotal() {
        const subtotal = this.getSubtotal();
        return subtotal + (subtotal * (this.taxRate / 100));
    }

    setTaxRate(rate) {
        this.taxRate = parseFloat(rate) || 0;
        this.recalculate();
        this.saveDraft();
    }

    updateItemQuantity(id, value) {
        this.updateItem(id, { quantidade: parseFloat(value) || 0 });
    }

    updateItemPrice(id, value) {
        this.updateItem(id, { valorUnit: parseFloat(value) || 0 });
    }

    // ============ FORMATTING ============

    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    }

    // ============ PREVIEW DATA ============

    getPreviewData() {
        const today = new Date();
        const validityDate = new Date(today);
        validityDate.setDate(validityDate.getDate() + 30);

        return {
            title: document.querySelector('[data-field="titulo"]')?.textContent || 'ORÇAMENTO DE OBRA',
            cliente: document.querySelector('[data-field="cliente"]')?.textContent || '',
            obra: document.querySelector('[data-field="obra"]')?.textContent || '',
            data: document.querySelector('[data-field="data"]')?.textContent ||
                `Data: ${today.toLocaleDateString('pt-BR')}`,
            validade: document.querySelector('[data-field="validade"]')?.textContent ||
                `Validade: ${validityDate.toLocaleDateString('pt-BR')} (30 dias)`,
            observacoes: document.querySelector('[data-field="obs"]')?.textContent || '',
            items: this.items,
            subtotal: this.getSubtotal(),
            taxRate: this.taxRate,
            taxValue: this.getSubtotal() * (this.taxRate / 100),
            total: this.getTotal(),
            logos: {
                empresa: this.getLogoData(1),
                cliente: this.getLogoData(2)
            }
        };
    }

    // ============ SAVED BUDGETS MANAGEMENT ============

    getSavedBudgetsStorageKey() {
        const userId = this.currentUserId || 'shared';
        return `${Config.STORAGE_KEYS.SAVED_BUDGETS}_${userId}`;
    }

    getAllSavedBudgets() {
        try {
            const storageKey = this.getSavedBudgetsStorageKey();
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.error('Error loading saved budgets:', e);
        }
        return [];
    }

    saveBudget(name = null) {
        if (this.items.length === 0) {
            return { success: false, message: 'Nenhum item para salvar.' };
        }

        const budgetName = name || `Rascunho ${new Date().toLocaleString('pt-BR')}`;
        const today = new Date();
        const validityDate = new Date(today);
        validityDate.setDate(validityDate.getDate() + 30);

        const budgetData = {
            id: Date.now(),
            name: budgetName,
            items: this.items.map(item => ({ ...item })),
            taxRate: this.taxRate,
            cliente: document.querySelector('[data-field="cliente"]')?.textContent || '',
            obra: document.querySelector('[data-field="obra"]')?.textContent || '',
            data: today.toLocaleDateString('pt-BR'),
            validade: validityDate.toLocaleDateString('pt-BR'),
            savedAt: today.toISOString(),
            userId: this.currentUserId
        };

        const budgets = this.getAllSavedBudgets();
        budgets.unshift(budgetData); // Add to beginning

        const storageKey = this.getSavedBudgetsStorageKey();
        localStorage.setItem(storageKey, JSON.stringify(budgets));

        return { success: true, message: 'Orçamento salvo com sucesso!', budget: budgetData };
    }

    loadSavedBudget(budgetId) {
        const budgets = this.getAllSavedBudgets();
        const budget = budgets.find(b => b.id === budgetId);

        if (budget) {
            this.items = budget.items.map(item => ({ ...item }));
            this.taxRate = budget.taxRate || 0;
            this.recalculate();
            return { success: true, message: 'Orçamento carregado!', budget };
        }

        return { success: false, message: 'Orçamento não encontrado.' };
    }

    deleteSavedBudget(budgetId) {
        let budgets = this.getAllSavedBudgets();
        budgets = budgets.filter(b => b.id !== budgetId);

        const storageKey = this.getSavedBudgetsStorageKey();
        localStorage.setItem(storageKey, JSON.stringify(budgets));

        return { success: true, message: 'Rascunho excluído!' };
    }

    hasSavedDraft() {
        return this.items.length > 0;
    }

    getLogoData(logoNumber) {
        const logoUpload = document.getElementById(`logo-upload-${logoNumber}`);
        if (!logoUpload) return null;

        const img = logoUpload.querySelector('img');
        if (img) {
            return img.src;
        }
        return null;
    }

    setLogo(logoNumber, file) {
        const reader = new FileReader();
        const logoUpload = document.getElementById(`logo-upload-${logoNumber}`);

        reader.onload = (e) => {
            const existingImg = logoUpload.querySelector('img');
            if (existingImg) {
                existingImg.src = e.target.result;
            } else {
                const img = document.createElement('img');
                img.src = e.target.result;
                logoUpload.innerHTML = '';
                logoUpload.appendChild(img);

                // Re-add file input
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.className = 'logo-input';
                input.id = `logo-input-${logoNumber}`;
                input.onchange = (evt) => this.setLogo(logoNumber, evt.target.files[0]);
                logoUpload.appendChild(input);
            }
        };

        reader.readAsDataURL(file);
    }

    // ============ GET DATA FOR EXPORT ============

    getExportData() {
        return {
            items: this.items,
            summary: {
                subtotal: this.getSubtotal(),
                taxRate: this.taxRate,
                taxValue: this.getSubtotal() * (this.taxRate / 100),
                total: this.getTotal()
            },
            previewData: this.getPreviewData()
        };
    }
}

// Create global instance
const budgetBuilder = new BudgetBuilder();