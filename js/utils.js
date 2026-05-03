/**
 * OrçaObras - Utilities Module
 * =============================
 * Common UI utilities: toasts, loading, dark mode, backup
 */

const Utils = {
    // ============ TOAST NOTIFICATIONS ============
    toast: {
        container: null,
        
        init() {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
            this.container = container;
        },
        
        show(message, type = 'info', duration = 3000) {
            if (!this.container) this.init();
            
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `
                <i class="fas fa-${this.getIcon(type)}"></i>
                <span>${message}</span>
            `;
            
            this.container.appendChild(toast);
            
            setTimeout(() => toast.classList.add('show'), 10);
            
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        },
        
        getIcon(type) {
            const icons = {
                success: 'check-circle',
                error: 'times-circle',
                warning: 'exclamation-triangle',
                info: 'info-circle'
            };
            return icons[type] || 'info-circle';
        },
        
        success(msg) { this.show(msg, 'success'); },
        error(msg) { this.show(msg, 'error', 5000); },
        warning(msg) { this.show(msg, 'warning', 4000); },
        info(msg) { this.show(msg, 'info'); }
    },
    
    // ============ LOADING STATES ============
    loading: {
        overlay: null,
        
        show(message = 'Carregando...') {
            if (!this.overlay) {
                this.overlay = document.createElement('div');
                this.overlay.id = 'loading-overlay';
                this.overlay.className = 'loading-overlay';
                this.overlay.innerHTML = `
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>${message}</span>
                    </div>
                `;
                document.body.appendChild(this.overlay);
            }
            this.overlay.querySelector('span').textContent = message;
            this.overlay.classList.add('show');
        },
        
        hide() {
            if (this.overlay) {
                this.overlay.classList.remove('show');
            }
        }
    },
    
    // ============ DARK MODE ============
    darkMode: {
        key: 'orcaobras_dark_mode',
        
        init() {
            const saved = localStorage.getItem(this.key);
            if (saved === 'true' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                this.enable();
            }
            this.createToggle();
        },
        
        enable() {
            document.body.classList.add('dark-mode');
            localStorage.setItem(this.key, 'true');
        },
        
        disable() {
            document.body.classList.remove('dark-mode');
            localStorage.setItem(this.key, 'false');
        },
        
        toggle() {
            if (document.body.classList.contains('dark-mode')) {
                this.disable();
            } else {
                this.enable();
            }
        },
        
        createToggle() {
            // Add toggle to header
            const headerActions = document.querySelector('.header-actions');
            if (headerActions) {
                const btn = document.createElement('button');
                btn.className = 'btn-icon';
                btn.id = 'dark-mode-toggle';
                btn.title = 'Modo Escuro';
                btn.innerHTML = '<i class="fas fa-moon"></i>';
                btn.onclick = () => this.toggle();
                headerActions.appendChild(btn);
            }
        }
    },
    
    // ============ KEYBOARD SHORTCUTS ============
    shortcuts: {
        init() {
            document.addEventListener('keydown', (e) => {
                // Ctrl/Cmd + key combinations
                if (e.ctrlKey || e.metaKey) {
                    switch(e.key) {
                        case 's':
                            e.preventDefault();
                            window.app?.saveDraft?.();
                            Utils.toast.info('Rascunho salvo!');
                            break;
                        case 'b':
                            e.preventDefault();
                            window.app?.navigateTo?.('budget');
                            break;
                        case 'd':
                            e.preventDefault();
                            window.app?.navigateTo?.('database');
                            break;
                        case 'u':
                            e.preventDefault();
                            window.app?.navigateTo?.('upload');
                            break;
                    }
                }
                
                // Escape to close modals
                if (e.key === 'Escape') {
                    window.app?.closeAllModals?.();
                }
            });
        }
    },
    
    // ============ BACKUP/RESTORE ============
    backup: {
        exportData() {
            const data = {
                budgets: JSON.parse(localStorage.getItem('orcaobras_budgets') || '[]'),
                database: JSON.parse(localStorage.getItem('orcaobras_data') || '[]'),
                users: JSON.parse(localStorage.getItem('orcaobras_users') || '[]'),
                settings: JSON.parse(localStorage.getItem('orcaobras_settings') || '{}'),
                exportedAt: new Date().toISOString(),
                version: Config.APP_VERSION
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `orcaobras-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            Utils.toast.success('Backup exportado com sucesso!');
        },
        
        importData(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        
                        if (data.budgets) localStorage.setItem('orcaobras_budgets', JSON.stringify(data.budgets));
                        if (data.database) localStorage.setItem('orcaobras_data', JSON.stringify(data.database));
                        if (data.users) localStorage.setItem('orcaobras_users', JSON.stringify(data.users));
                        if (data.settings) localStorage.setItem('orcaobras_settings', JSON.stringify(data.settings));
                        
                        Utils.toast.success('Dados restaurados com sucesso!');
                        resolve();
                    } catch (err) {
                        Utils.toast.error('Arquivo de backup inválido');
                        reject(err);
                    }
                };
                reader.readAsText(file);
            });
        },
        
        createRestoreButton() {
            const sidebarNav = document.querySelector('.sidebar-nav');
            if (sidebarNav) {
                const li = document.createElement('li');
                li.className = 'nav-item';
                li.dataset.page = 'backup';
                li.innerHTML = `
                    <a href="#">
                        <i class="fas fa-database"></i>
                        <span>Backup</span>
                    </a>
                `;
                sidebarNav.appendChild(li);
            }
        }
    },
    
    // ============ SKELETON LOADING ============
    skeleton: {
        show(tableId, rows = 5) {
            const tbody = document.getElementById(tableId);
            if (!tbody) return;
            
            tbody.innerHTML = '';
            for (let i = 0; i < rows; i++) {
                const tr = document.createElement('tr');
                tr.className = 'skeleton-row';
                tr.innerHTML = `
                    <td><div class="skeleton"></div></td>
                    <td><div class="skeleton"></div></td>
                    <td><div class="skeleton"></div></td>
                    <td><div class="skeleton"></div></td>
                    <td><div class="skeleton"></div></td>
                    <td><div class="skeleton"></div></td>
                    <td><div class="skeleton"></div></td>
                    <td><div class="skeleton"></div></td>
                `;
                tbody.appendChild(tr);
            }
        },
        
        hide() {
            document.querySelectorAll('.skeleton-row').forEach(el => el.remove());
        }
    }
};

// Initialize utilities
document.addEventListener('DOMContentLoaded', () => {
    Utils.toast.init();
    Utils.darkMode.init();
    Utils.shortcuts.init();
    Utils.backup.createRestoreButton();
});