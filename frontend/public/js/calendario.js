/**
 * Calendario de Disponibilidad
 * Muestra disponible / reservado / mantenimiento
 * Permite selección de rango de fechas
 */

class CalendarioDisponibilidad {
  constructor(containerId, options = {}) {
    this.container   = document.getElementById(containerId);
    this.cabanaId    = options.cabanaId || null;
    this.onRangeSelect = options.onRangeSelect || null;
    this.blockedDates  = []; // { fecha_inicio, fecha_fin, tipo }
    this.selectedStart = null;
    this.selectedEnd   = null;
    this.currentDate   = new Date();
    this.currentDate.setDate(1);
    this.picking       = 'start'; // 'start' | 'end'
    this.minDate       = new Date(); // No se puede seleccionar fechas pasadas
    this.minDate.setDate(this.minDate.getDate() + 1);

    if (this.container) {
      this.render();
      if (this.cabanaId) this.loadDisponibilidad();
    }
  }

  async loadDisponibilidad() {
    try {
      const res = await fetch(`/api/cabanas/${this.cabanaId}/disponibilidad`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        this.blockedDates = data.data;
        this.renderDays();
      }
    } catch (err) {
      console.warn('Error cargando disponibilidad:', err);
    }
  }

  isBlocked(date) {
    const d = this.toDateStr(date);
    for (const block of this.blockedDates) {
      if (d >= block.fecha_inicio && d < block.fecha_fin) {
        return block.tipo;
      }
    }
    return null;
  }

  toDateStr(date) {
    return date.toISOString().split('T')[0];
  }

  isPast(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  isInRange(date) {
    if (!this.selectedStart || !this.selectedEnd) return false;
    return date > this.selectedStart && date < this.selectedEnd;
  }

  render() {
    this.container.innerHTML = `
      <div class="calendar-wrapper">
        <div class="calendar-header">
          <button class="calendar-nav" id="cal-prev-${this.container.id}">&#8249;</button>
          <h3 id="cal-title-${this.container.id}"></h3>
          <button class="calendar-nav" id="cal-next-${this.container.id}">&#8250;</button>
        </div>
        <div class="calendar-grid" id="cal-grid-${this.container.id}"></div>
        <div class="calendar-legend">
          <div class="legend-item"><div class="legend-dot" style="background:#27ae60"></div> Disponible</div>
          <div class="legend-item"><div class="legend-dot" style="background:#e74c3c"></div> Reservado</div>
          <div class="legend-item"><div class="legend-dot" style="background:#f39c12"></div> Mantenimiento</div>
        </div>
      </div>
    `;

    document.getElementById(`cal-prev-${this.container.id}`).addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.renderDays();
    });
    document.getElementById(`cal-next-${this.container.id}`).addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.renderDays();
    });

    this.renderDays();
  }

  renderDays() {
    const title  = document.getElementById(`cal-title-${this.container.id}`);
    const grid   = document.getElementById(`cal-grid-${this.container.id}`);

    const year   = this.currentDate.getFullYear();
    const month  = this.currentDate.getMonth();

    title.textContent = new Date(year, month, 1).toLocaleDateString('es-CR', {
      month: 'long', year: 'numeric'
    });

    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev  = new Date(year, month, 0).getDate();

    let html = dayNames.map(d => `<div class="calendar-day-header">${d}</div>`).join('');

    // Días del mes anterior
    for (let i = firstDay - 1; i >= 0; i--) {
      html += `<div class="calendar-day other-month">${daysInPrev - i}</div>`;
    }

    // Días del mes actual
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = this.toDateStr(date);
      const blocked = this.isBlocked(date);
      const isPast  = this.isPast(date) || date <= today;
      const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      const isStart = this.selectedStart && this.toDateStr(date) === this.toDateStr(this.selectedStart);
      const isEnd   = this.selectedEnd   && this.toDateStr(date) === this.toDateStr(this.selectedEnd);
      const inRange = this.isInRange(date);

      let cls = 'calendar-day';
      if (isPast)              cls += ' disabled';
      else if (blocked === 'reservado')    cls += ' reserved';
      else if (blocked === 'mantenimiento') cls += ' maintenance';
      else if (blocked === 'bloqueado')     cls += ' reserved';
      else                     cls += ' available';
      if (isToday)             cls += ' today';
      if (isStart || isEnd)    cls += ' selected';
      if (inRange)             cls += ' in-range';

      html += `<div class="${cls}" data-date="${dateStr}">${d}</div>`;
    }

    // Completar última fila
    const totalCells = firstDay + daysInMonth;
    const remaining  = 7 - (totalCells % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        html += `<div class="calendar-day other-month">${i}</div>`;
      }
    }

    grid.innerHTML = html;

    // Event listeners en días disponibles
    grid.querySelectorAll('.calendar-day.available').forEach(day => {
      day.addEventListener('click', () => this.handleDayClick(day.dataset.date));
    });
  }

  handleDayClick(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');

    if (this.picking === 'start') {
      this.selectedStart = date;
      this.selectedEnd   = null;
      this.picking = 'end';
    } else {
      if (date <= this.selectedStart) {
        this.selectedStart = date;
        this.selectedEnd   = null;
        this.picking = 'end';
      } else {
        // Verificar que no hay fechas bloqueadas en el rango
        const hasConflict = this.checkRangeConflict(this.selectedStart, date);
        if (hasConflict) {
          if (window.Toast) Toast.error('El rango seleccionado incluye fechas no disponibles');
          return;
        }
        this.selectedEnd = date;
        this.picking     = 'start';

        // Callback
        if (this.onRangeSelect) {
          const nights = Math.round((this.selectedEnd - this.selectedStart) / (1000 * 60 * 60 * 24));
          this.onRangeSelect({
            entrada: this.toDateStr(this.selectedStart),
            salida:  this.toDateStr(this.selectedEnd),
            noches:  nights
          });
        }
      }
    }
    this.renderDays();
  }

  checkRangeConflict(start, end) {
    for (const block of this.blockedDates) {
      const bStart = new Date(block.fecha_inicio + 'T00:00:00');
      const bEnd   = new Date(block.fecha_fin + 'T00:00:00');
      if (bStart < end && bEnd > start) return true;
    }
    return false;
  }

  getSelected() {
    if (!this.selectedStart || !this.selectedEnd) return null;
    const nights = Math.round((this.selectedEnd - this.selectedStart) / (1000 * 60 * 60 * 24));
    return {
      entrada: this.toDateStr(this.selectedStart),
      salida:  this.toDateStr(this.selectedEnd),
      noches:  nights
    };
  }

  reset() {
    this.selectedStart = null;
    this.selectedEnd   = null;
    this.picking       = 'start';
    this.renderDays();
  }
}

window.CalendarioDisponibilidad = CalendarioDisponibilidad;
