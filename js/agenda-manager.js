/**
 * OrçaObras - Agenda Manager Module
 * ==================================
 * Handles internal scheduling and event management
 * Supports multi-user data isolation
 */

class AgendaManager {
    constructor() {
        this.events = [];
        this.currentUserId = null;
        this.currentDate = new Date();
        this.currentMonth = this.currentDate.getMonth();
        this.currentYear = this.currentDate.getFullYear();
        this.selectedDate = null;
        this.filters = {
            importante: true,
            reuniao: true,
            visita: true,
            prazo: true
        };
        this.init();
    }

    init() {
        this.setCurrentUser();
        this.loadEvents();
        this.setupEventListeners();
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
        const userId = this.currentUserId || 'shared';
        return `orcaobras_agenda_${userId}`;
    }

    // ============ EVENT STORAGE ============

    loadEvents() {
        try {
            const storageKey = this.getUserStorageKey();
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                this.events = JSON.parse(stored);
            } else {
                this.events = [];
            }
        } catch (e) {
            console.error('Error loading events:', e);
            this.events = [];
        }
        return this.events;
    }

    saveEvents() {
        const storageKey = this.getUserStorageKey();
        localStorage.setItem(storageKey, JSON.stringify(this.events));
    }

    // ============ EVENT CRUD ============

    addEvent(eventData) {
        const event = {
            id: Date.now(),
            title: eventData.title,
            date: eventData.date,
            time: eventData.time || '00:00',
            location: eventData.location || '',
            type: eventData.type || 'importante',
            description: eventData.description || '',
            createdAt: new Date().toISOString(),
            userId: this.currentUserId
        };
        this.events.push(event);
        this.saveEvents();
        return event;
    }

    updateEvent(id, updates) {
        const index = this.events.findIndex(e => e.id === id);
        if (index !== -1) {
            this.events[index] = { ...this.events[index], ...updates };
            this.saveEvents();
            return this.events[index];
        }
        return null;
    }

    deleteEvent(id) {
        this.events = this.events.filter(e => e.id !== id);
        this.saveEvents();
    }

    getEvent(id) {
        return this.events.find(e => e.id === id);
    }

    getEventsByDate(dateStr) {
        return this.events.filter(e => e.date === dateStr)
            .filter(e => this.filters[e.type])
            .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    }

    getEventsByMonth(month, year) {
        return this.events.filter(e => {
            const eventDate = new Date(e.date);
            return eventDate.getMonth() === month && eventDate.getFullYear() === year;
        });
    }

    // ============ CALENDAR RENDERING ============

    renderCalendar() {
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

        const monthYearEl = document.getElementById('current-month-year');
        if (monthYearEl) {
            monthYearEl.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;
        }

        const calendarDays = document.getElementById('calendar-days');
        if (!calendarDays) return;

        calendarDays.innerHTML = '';

        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
        const startDayOfWeek = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        const today = new Date();
        const todayStr = this.formatDateISO(today);

        // Empty cells before first day
        for (let i = 0; i < startDayOfWeek; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            calendarDays.appendChild(emptyCell);
        }

        // Days of month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(this.currentYear, this.currentMonth, day);
            const dateStr = this.formatDateISO(dateObj);
            const dayEvents = this.getEventsByDate(dateStr);
            const hasEvents = dayEvents.length > 0;
            const isToday = dateStr === todayStr;
            const isSelected = this.selectedDate === dateStr;

            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            if (isToday) dayEl.classList.add('today');
            if (isSelected) dayEl.classList.add('selected');
            if (hasEvents) dayEl.classList.add('has-events');

            dayEl.innerHTML = `
                <span class="day-number">${day}</span>
                ${hasEvents ? `<span class="event-indicator" style="background: ${this.getTypeColor(dayEvents[0].type)};"></span>` : ''}
            `;

            dayEl.addEventListener('click', () => this.selectDate(dateStr));
            calendarDays.appendChild(dayEl);
        }
    }

    selectDate(dateStr) {
        this.selectedDate = dateStr;
        this.renderCalendar();
        this.renderTimeline();
    }

    changeMonth(delta) {
        this.currentMonth += delta;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        } else if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        this.renderCalendar();
    }

    // ============ TIMELINE RENDERING ============

    renderTimeline() {
        const timeline = document.getElementById('agenda-timeline');
        const emptyState = document.getElementById('agenda-empty');
        if (!timeline) return;

        // Get date to show
        const dateToShow = this.selectedDate || this.formatDateISO(this.currentDate);

        // Get events for the date
        const dayEvents = this.getEventsByDate(dateToShow);

        if (dayEvents.length === 0) {
            timeline.innerHTML = `
                <div class="agenda-empty">
                    <i class="fas fa-calendar-times"></i>
                    <p>Nenhum evento para esta data</p>
                    <span>Clique em "Novo Evento" para adicionar</span>
                </div>
            `;
            return;
        }

        // Format date for display
        const dateObj = new Date(dateToShow + 'T00:00:00');
        const dateDisplay = dateObj.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        let html = `<div class="timeline-header">
            <h4><i class="fas fa-calendar-day"></i> ${this.capitalizeFirst(dateDisplay)}</h4>
            <span class="event-count">${dayEvents.length} evento${dayEvents.length > 1 ? 's' : ''}</span>
        </div>`;

        html += '<div class="timeline-events">';
        dayEvents.forEach(event => {
            html += this.generateEventCard(event);
        });
        html += '</div>';

        timeline.innerHTML = html;

        // Add click listeners to event cards
        timeline.querySelectorAll('.event-card').forEach(card => {
            card.addEventListener('click', () => {
                const eventId = parseInt(card.dataset.id);
                this.editEvent(eventId);
            });
        });
    }

    generateEventCard(event) {
        const typeLabels = {
            importante: 'Importante',
            reuniao: 'Reunião',
            visita: 'Visita Técnica',
            prazo: 'Prazo'
        };

        return `
            <div class="event-card" data-id="${event.id}" style="border-left-color: ${this.getTypeColor(event.type)};">
                <div class="event-time">${event.time || '--:--'}</div>
                <div class="event-content">
                    <div class="event-header">
                        <span class="event-type-badge" style="background: ${this.getTypeColor(event.type)};">${typeLabels[event.type]}</span>
                    </div>
                    <h5 class="event-title">${event.title}</h5>
                    ${event.location ? `<p class="event-location"><i class="fas fa-map-marker-alt"></i> ${event.location}</p>` : ''}
                    ${event.description ? `<p class="event-description">${event.description}</p>` : ''}
                </div>
                <div class="event-actions">
                    <button class="btn-icon btn-edit" onclick="agendaManager.editEvent(${event.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="agendaManager.deleteEventConfirmed(${event.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // ============ FORM HANDLING ============

    openEventModal(eventId = null) {
        const modal = document.getElementById('event-modal');
        const form = document.getElementById('event-form');
        const title = document.getElementById('event-modal-title');
        const deleteBtn = document.getElementById('delete-event-btn');
        const dateInput = document.getElementById('event-date');
        const timeInput = document.getElementById('event-time');

        form.reset();
        document.getElementById('event-id').value = '';

        if (eventId) {
            const event = this.getEvent(eventId);
            if (event) {
                title.innerHTML = '<i class="fas fa-calendar-edit"></i> Editar Evento';
                document.getElementById('event-id').value = event.id;
                document.getElementById('event-title').value = event.title;
                document.getElementById('event-date').value = event.date;
                document.getElementById('event-time').value = event.time || '';
                document.getElementById('event-location').value = event.location || '';
                document.getElementById('event-type').value = event.type;
                document.getElementById('event-description').value = event.description || '';
                deleteBtn.style.display = 'block';
            }
        } else {
            title.innerHTML = '<i class="fas fa-calendar-plus"></i> Novo Evento';
            deleteBtn.style.display = 'none';

            // Pre-fill date if a date is selected
            if (this.selectedDate) {
                dateInput.value = this.selectedDate;
            } else {
                dateInput.value = this.formatDateISO(new Date());
            }
            timeInput.value = this.formatTime(new Date());
        }

        if (modal) {
            modal.classList.add('active');
        }
    }

    closeEventModal() {
        const modal = document.getElementById('event-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    saveEventFromForm() {
        const eventData = {
            title: document.getElementById('event-title').value,
            date: document.getElementById('event-date').value,
            time: document.getElementById('event-time').value,
            location: document.getElementById('event-location').value,
            type: document.getElementById('event-type').value,
            description: document.getElementById('event-description').value
        };

        const eventId = document.getElementById('event-id').value;

        if (eventId) {
            this.updateEvent(parseInt(eventId), eventData);
        } else {
            this.addEvent(eventData);
        }

        this.closeEventModal();
        this.renderCalendar();
        this.renderTimeline();
    }

    editEvent(eventId) {
        this.openEventModal(eventId);
    }

    deleteEventConfirmed(eventId) {
        if (confirm('Tem certeza que deseja excluir este evento?')) {
            this.deleteEvent(eventId);
            this.renderCalendar();
            this.renderTimeline();
        }
    }

    deleteEvent() {
        const eventId = document.getElementById('event-id').value;
        if (eventId) {
            this.deleteEventConfirmed(parseInt(eventId));
            this.closeEventModal();
        }
    }

    // ============ FILTERS ============

    updateFilters() {
        this.filters.importante = document.getElementById('filter-importante')?.checked ?? true;
        this.filters.reuniao = document.getElementById('filter-reuniao')?.checked ?? true;
        this.filters.visita = document.getElementById('filter-visita')?.checked ?? true;
        this.filters.prazo = document.getElementById('filter-prazo')?.checked ?? true;
        this.renderCalendar();
        this.renderTimeline();
    }

    // ============ EXPORT ============

    exportAgenda() {
        const eventsToExport = this.selectedDate
            ? this.getEventsByDate(this.selectedDate)
            : this.events;

        if (eventsToExport.length === 0) {
            alert('Nenhum evento para exportar.');
            return;
        }

        const data = eventsToExport.map(e => ({
            Data: e.date,
            Hora: e.time || '',
            Título: e.title,
            Local: e.location || '',
            Tipo: this.getTypeLabel(e.type),
            Descrição: e.description || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Agenda');

        const filename = `agenda_${this.formatDateISO(new Date())}.xlsx`;
        XLSX.writeFile(wb, filename);
    }

    // ============ EVENT LISTENERS ============

    setupEventListeners() {
        // Calendar navigation
        document.getElementById('prev-month')?.addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('next-month')?.addEventListener('click', () => this.changeMonth(1));

        // Filter checkboxes
        document.getElementById('filter-importante')?.addEventListener('change', () => this.updateFilters());
        document.getElementById('filter-reuniao')?.addEventListener('change', () => this.updateFilters());
        document.getElementById('filter-visita')?.addEventListener('change', () => this.updateFilters());
        document.getElementById('filter-prazo')?.addEventListener('change', () => this.updateFilters());

        // Event form
        document.getElementById('event-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEventFromForm();
        });
    }

    // ============ UTILITIES ============

    formatDateISO(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatTime(date) {
        const d = new Date(date);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    getTypeColor(type) {
        const colors = {
            importante: '#e74c3c',
            reuniao: '#3498db',
            visita: '#2ecc71',
            prazo: '#f39c12'
        };
        return colors[type] || '#95a5a6';
    }

    getTypeLabel(type) {
        const labels = {
            importante: 'Importante',
            reuniao: 'Reunião',
            visita: 'Visita Técnica',
            prazo: 'Prazo'
        };
        return labels[type] || type;
    }

    capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

// Create global instance
const agendaManager = new AgendaManager();
