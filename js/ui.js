/* UI Management for Ponedor de Guardias */

let currentPersonId = null;
let modalMode = 'person'; // 'person', 'holiday', 'draft'

// --- People Management ---
window.renderPeople = function () {
    const list = document.getElementById('peopleList');
    list.innerHTML = '';
    window.appData.people.forEach(p => {
        const div = document.createElement('div');
        div.className = "flex items-center justify-between p-3 bg-gray-50 rounded mb-2 shadow-sm";
        div.innerHTML = `
            <div>
                <p class="font-bold text-gray-800">${p.name}</p>
                <p class="text-xs text-gray-500">Min: ${p.min} | Max: ${p.max} | Dobletes: ${p.doublets ? 'Si' : 'No'}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="openEditPersonModal('${p.id}')" class="text-gray-500 hover:text-gray-700 transition" title="Editar"><i class="fas fa-edit"></i></button>
                <button onclick="openPersonModal('${p.id}')" class="text-blue-500 hover:text-blue-700 transition" title="Configurar calendario"><i class="fas fa-calendar-alt"></i></button>
                <button onclick="removePerson('${p.id}')" class="text-red-400 hover:text-red-600 transition" title="Eliminar"><i class="fas fa-trash"></i></button>
            </div>
        `;
        list.appendChild(div);
    });
}

window.addPerson = function () {
    const nameInput = document.getElementById('newPersonName');
    const minInput = document.getElementById('newPersonMin');
    const maxInput = document.getElementById('newPersonMax');
    const doubletsInput = document.getElementById('newPersonDoublets');

    const name = nameInput.value.trim();
    if (!name) return;

    // Check duplication (restore from history if exists?)
    let existingId = null;
    if (window.appData.history) {
        const found = Object.keys(window.appData.history).find(k => window.appData.history[k].name === name);
        if (found) existingId = found;
    }
    const newId = existingId || Date.now().toString();

    // Create with Draft Data if available
    const draft = window.draftPerson || { blocked: [], suggested: [] };

    window.appData.people.push({
        id: newId,
        name,
        min: parseInt(minInput.value) || 1,
        max: parseInt(maxInput.value) || 5,
        doublets: doubletsInput.checked,
        blocked: [...draft.blocked],
        suggested: [...draft.suggested]
    });

    // Cleanup Draft
    window.draftPerson = { blocked: [], suggested: [] };

    // Cleanup Inputs
    nameInput.value = '';
    minInput.value = ''; // Or keep defaults?
    maxInput.value = '';
    doubletsInput.checked = false;
    nameInput.focus();

    saveState();
    renderPeople();

    // If we just added someone, maybe show toast?
    showToast(`Persona añadida: ${name}`, 'success');
}

window.removePerson = function (id) {
    if (!confirm('¿Eliminar a esta persona? Se guardará como Baja y aparecerá en el historial.')) return;

    // Mark as deleted to prevent auto-import
    if (!window.appData.deletedIds) window.appData.deletedIds = [];
    if (!window.appData.deletedIds.includes(id)) window.appData.deletedIds.push(id);

    window.appData.people = window.appData.people.filter(p => p.id !== id);
    saveState();
    renderPeople();

    // Re-render stats to show as Baja
    if (window.appData.schedule && window.appData.schedule.length > 0) renderResults(0);
}

// --- Modal & Calendar Logic ---

window.openPersonModal = function (id) {
    modalMode = 'person';
    currentPersonId = id;
    const p = window.appData.people.find(x => x.id === id);
    if (!p) return;
    document.getElementById('modalTitle').innerText = `Calendario: ${p.name}`;
    document.getElementById('personModalControls').classList.remove('hidden');
    document.getElementById('staffingControls').classList.add('hidden');

    // Init radio
    const blockRadio = document.querySelector('input[name="dayAction"][value="block"]');
    if (blockRadio) blockRadio.checked = true;

    if (!document.getElementById('calendarModal')) return; // Safety
    openModal();
}

window.openDraftModal = function () {
    modalMode = 'draft';
    currentPersonId = null;
    document.getElementById('modalTitle').innerText = "Configurar Nuevo (Borrador)";
    document.getElementById('personModalControls').classList.remove('hidden');
    document.getElementById('staffingControls').classList.add('hidden');

    const blockRadio = document.querySelector('input[name="dayAction"][value="block"]');
    if (blockRadio) blockRadio.checked = true;
    openModal();
}

// Reuse modal for holidays? Yes, if supported
window.openHolidaysModal = function () {
    modalMode = 'holiday';
    currentPersonId = null;
    document.getElementById('modalTitle').innerText = "Configurar Festivos";
    document.getElementById('personModalControls').classList.add('hidden');
    document.getElementById('staffingControls').classList.add('hidden'); // Or maybe specialized controls
    openModal();
}

function openModal() {
    const m = document.getElementById('calendarModal');
    m.classList.remove('hidden');
    m.classList.add('flex');
    renderCalendar();
}

window.closeModal = function () {
    const m = document.getElementById('calendarModal');
    m.classList.add('hidden');
    m.classList.remove('flex');
    saveState(); // Save changes made in modal
    if (modalMode === 'person') renderPeople();
    // If draft, we don't save to people list, but draft state is in window.draftPerson
}

// --- Edit Person Modal ---

window.openEditPersonModal = function (id) {
    const p = window.appData.people.find(x => x.id === id);
    if (!p) return;
    document.getElementById('editPersonId').value = p.id;
    document.getElementById('editPersonName').value = p.name;
    document.getElementById('editPersonMin').value = p.min;
    document.getElementById('editPersonMax').value = p.max;
    document.getElementById('editPersonDoublets').checked = p.doublets;

    document.getElementById('editPersonModal').classList.remove('hidden');
    document.getElementById('editPersonModal').classList.add('flex');
}

window.closeEditPersonModal = function () {
    document.getElementById('editPersonModal').classList.add('hidden');
    document.getElementById('editPersonModal').classList.remove('flex');
}

window.saveEditPerson = function () {
    const id = document.getElementById('editPersonId').value;
    const name = document.getElementById('editPersonName').value;
    const min = document.getElementById('editPersonMin').value;
    const max = document.getElementById('editPersonMax').value;
    const doublets = document.getElementById('editPersonDoublets').checked;

    const p = window.appData.people.find(x => x.id === id);
    if (p) {
        p.name = name;
        p.min = parseInt(min) || 0;
        p.max = parseInt(max) || 0;
        p.doublets = doublets;
        saveState();
        renderPeople();
        showToast('Cambios guardados', 'success');
        closeEditPersonModal();
    }
}

window.openHolidayModal = function () {
    modalMode = 'holiday';
    document.getElementById('modalTitle').innerText = 'Gestor de Festivos';
    document.getElementById('personModalControls').classList.add('hidden');
    document.getElementById('staffingControls').classList.add('hidden');

    document.getElementById('calendarModal').classList.remove('hidden');
    document.getElementById('calendarModal').classList.add('flex');
    renderCalendar();
}

window.openStaffingModal = function () {
    modalMode = 'staffing';
    document.getElementById('modalTitle').innerText = 'Excepciones de Plazas';
    document.getElementById('personModalControls').classList.add('hidden');
    document.getElementById('staffingControls').classList.remove('hidden');

    document.getElementById('calendarModal').classList.remove('hidden');
    document.getElementById('calendarModal').classList.add('flex');
    renderCalendar();
}

window.renderCalendar = function () {
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    const start = new Date(window.appData.startDate);
    const end = new Date(window.appData.endDate);
    if (isNaN(start) || isNaN(end)) {
        grid.innerHTML = '<p class="text-red-500">Fechas inválidas</p>';
        return;
    }

    // Determine target data
    let blockedArr = [], suggestedArr = [], holidaysArr = window.appData.holidays;
    if (modalMode === 'person' && currentPersonId) {
        const p = window.appData.people.find(x => x.id === currentPersonId);
        if (p) { blockedArr = p.blocked; suggestedArr = p.suggested; }
    } else if (modalMode === 'draft') {
        if (!window.draftPerson) window.draftPerson = { blocked: [], suggested: [] };
        blockedArr = window.draftPerson.blocked;
        suggestedArr = window.draftPerson.suggested;
    }

    // Use local helper for strings
    const days = getStringDatesRange(window.appData.startDate, window.appData.endDate);

    days.forEach(iso => {
        const d = new Date(iso);
        const dayDiv = document.createElement('div');

        // Styles
        let cls = "bg-white border border-gray-100 text-gray-700 hover:bg-gray-50 cursor-pointer";
        let label = d.getDate();

        // Visual Override Priorities
        if (modalMode === 'holiday') {
            if (holidaysArr.includes(iso)) cls = "bg-orange-100 border-orange-300 text-orange-800 font-bold";
        } else if (modalMode === 'staffing') {
            const custom = window.appData.staffing[iso];
            if (custom !== undefined) {
                cls = "bg-blue-100 border-blue-300 text-blue-800 font-bold";
                label += ` [${custom}]`;
            }
        } else {
            // Person/Draft Mode
            if (holidaysArr.includes(iso)) cls = "bg-orange-50 text-orange-400"; // Background holiday indicator

            if (blockedArr.includes(iso)) cls = "bg-red-100 border-red-300 text-red-800 font-bold";
            else if (suggestedArr.includes(iso)) cls = "bg-green-100 border-green-300 text-green-800 font-bold";
        }

        // Weekend styling (subtle)
        if (d.getDay() === 0 || d.getDay() === 6) {
            if (!cls.includes('bg-')) cls += " bg-gray-50";
        }

        dayDiv.className = `p-2 rounded text-center text-sm transition select-none ${cls}`;
        dayDiv.innerText = label;

        dayDiv.onclick = () => {
            if (modalMode === 'holiday') {
                toggleHoliday(iso);
            } else if (modalMode === 'staffing') {
                const count = parseInt(document.getElementById('modalStaffingCount').value) || 0;
                window.appData.staffing[iso] = count;
                renderCalendar();
            } else {
                // Toggle Block/Suggest
                const action = document.querySelector('input[name="dayAction"]:checked').value || 'block';
                // Helpers to modify arrays
                const modifyState = (targetObj) => {
                    const blk = targetObj.blocked;
                    const sug = targetObj.suggested;

                    if (action === 'block') {
                        if (blk.includes(iso)) blk.splice(blk.indexOf(iso), 1);
                        else {
                            if (sug.includes(iso)) sug.splice(sug.indexOf(iso), 1);
                            blk.push(iso);
                        }
                    } else { // suggest
                        if (sug.includes(iso)) sug.splice(sug.indexOf(iso), 1);
                        else {
                            if (blk.includes(iso)) blk.splice(blk.indexOf(iso), 1);
                            sug.push(iso);
                        }
                    }
                };

                if (modalMode === 'person' && currentPersonId) {
                    const p = window.appData.people.find(x => x.id === currentPersonId);
                    if (p) modifyState(p);
                } else if (modalMode === 'draft') {
                    if (!window.draftPerson) window.draftPerson = { blocked: [], suggested: [] };
                    modifyState(window.draftPerson);
                }
            }
            renderCalendar();
        };

        grid.appendChild(dayDiv);
    });
}

function toggleHoliday(iso) {
    const h = window.appData.holidays;
    if (h.includes(iso)) h.splice(h.indexOf(iso), 1);
    else h.push(iso);
    renderCalendar();
}

function getStringDatesRange(start, end) {
    const dates = [];
    let cur = new Date(start);
    const e = new Date(end);
    while (cur <= e) {
        dates.push(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
}

// --- Results & Stats Implementation ---

window.renderResults = function (unassigned) {
    document.getElementById('statsPanel').classList.remove('hidden');
    document.getElementById('scheduleResult').classList.remove('hidden');
    document.getElementById('emptyState').classList.add('hidden');

    // Alert logic
    const alert = document.getElementById('alertBox');
    if (unassigned > 0) {
        alert.classList.remove('hidden');
        document.getElementById('alertText').innerText = `${unassigned} plazas sin cubrir.`;
    } else {
        alert.classList.add('hidden');
    }

    const tbody = document.getElementById('scheduleBody');
    tbody.innerHTML = '';

    const errors = window.validateSchedule ? window.validateSchedule() : {};

    window.appData.schedule.forEach((day, dayIndex) => {
        const [y, m, d] = day.date.split('-');
        let cls = "text-gray-400", bg = "";
        if (day.type === 'HOLIDAY') { cls = "text-orange-700 font-bold"; bg = "bg-orange-50"; }
        else if (day.type === 'WEEKEND') { cls = "text-purple-700 font-bold"; bg = "bg-purple-50"; }
        else if (day.type === 'FRIDAY' || day.type === 'EVE') { cls = "text-teal-600 font-bold"; }

        day.seats.forEach((seat, seatIdx) => {
            const tr = document.createElement('tr');
            const border = (seatIdx === 0) ? "border-t border-gray-200" : "border-none";
            tr.className = `hover:bg-blue-50 transition ${bg} ${border}`;

            let trashBtn = '';
            // Use clearSlot(date, idx) which should correspond to main.js implementation
            if (seat.pid) {
                trashBtn = `<button onclick="clearSlot('${day.date}', ${seat.idx})" class="text-gray-400 hover:text-red-500 transition px-2"><i class="fas fa-trash"></i></button>`;
            } else {
                // openManualAssign needs dayIndex for schedule access? Or just date?
                // The view said: openManualAssign(dayIndex, seatIdx).
                trashBtn = `<button onclick="openManualAssign(${dayIndex}, ${seatIdx})" class="text-blue-400 hover:text-blue-600 transition px-2" title="Asignar manualmente"><i class="fas fa-plus-circle"></i></button>`;
            }

            let warnIcon = '';
            if (seat.pid && errors[seat.pid] && errors[seat.pid][day.date]) {
                warnIcon = `<i class="fas fa-exclamation-triangle text-red-500 ml-2" title="${errors[seat.pid][day.date]}"></i>`;
            }

            const assignClass = seat.pid ? '' : 'cursor-pointer hover:bg-gray-100 text-blue-500 underline decoration-dashed';
            const assignClick = seat.pid ? '' : `onclick="openManualAssign(${dayIndex}, ${seat.idx})"`;
            const showDate = (seatIdx === 0);

            let errorHtml = '';
            let errorClass = 'px-6 py-2';
            const errKey = `${day.date}_${seat.idx}`;
            if (errors[errKey]) {
                errorClass += ' bg-red-100 border-l-4 border-red-500';
                errorHtml = `<div class="text-xs text-red-600 font-bold mt-1"><i class="fas fa-exclamation-triangle"></i> ${errors[errKey]}</div>`;
            }

            tr.innerHTML = `
                <td class="px-6 py-2 ${showDate ? '' : 'text-transparent select-none'}">${d}/${m}</td>
                <td class="px-6 py-2 ${cls} ${showDate ? '' : 'text-transparent select-none'}">${getDayName(day.date)}</td>
                <td class="${errorClass}">
                     <div class="font-bold ${seat.pid ? '' : 'text-red-500'} ${assignClass}" ${assignClick}>
                        ${seat.name || 'VACÍO (Click to Add)'}
                    </div>
                    ${seat.locked ? '<i class="fas fa-lock text-xs text-gray-400 ml-2" title="Manual / Bloqueado"></i>' : ''}
                    ${warnIcon}
                    ${errorHtml}
                </td>
                <td class="px-6 py-3 whitespace-nowrap text-right text-sm font-medium">
                    ${trashBtn}
                </td>
            `;
            tbody.appendChild(tr);
        });
    });

    // --- Stats Table ---
    const statsBody = document.getElementById('statsBody');
    statsBody.innerHTML = '';

    // Combine IDs
    const allIds = new Set(window.appData.people.map(p => p.id));
    if (window.appData.history) Object.keys(window.appData.history).forEach(k => allIds.add(k));

    allIds.forEach(id => {
        const p = window.appData.people.find(x => x.id === id);
        const name = p ? p.name : (window.appData.history[id]?.name || 'Desconocido');
        const isBaja = !p;
        const displayName = isBaja ? `${name} (Baja)` : name;
        const nameClass = isBaja ? 'text-gray-400 italic' : 'text-gray-900 font-medium';

        // Use getCombinedStats helper
        const s = window.getCombinedStats ? window.getCombinedStats(id) : { total: 0, fri: 0, sd: 0, hol: 0 };

        statsBody.innerHTML += `
            <tr class="hover:bg-gray-50 border-b last:border-0 border-gray-100">
                <td class="px-4 py-3 ${nameClass}">${displayName}</td>
                <td class="px-4 py-3 text-center font-bold bg-gray-50 text-blue-900">${s.total}</td>
                <td class="px-4 py-3 text-center text-teal-600">${s.fri}</td>
                <td class="px-4 py-3 text-center text-purple-600">${s.sd}</td>
                <td class="px-4 py-3 text-center text-orange-600 font-bold border-l border-gray-200">${s.hol}</td>
                <td class="px-4 py-3 text-center">
                     <button onclick="openStatsModal('${id}')" class="text-blue-500 hover:text-blue-700 transition" title="Ver detalle">
                        <i class="fas fa-search-plus"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

function getDayName(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { weekday: 'long' });
}

// --- Stats Modal (Spyglass) ---

window.openStatsModal = function (id) {
    const p = window.appData.people.find(x => x.id === id);
    const hName = window.appData.history && window.appData.history[id] ? window.appData.history[id].name : 'Desconocido';
    const name = p ? p.name : hName;

    const titleEl = document.getElementById('statsModalTitle');
    if (titleEl) titleEl.innerText = name;

    const s = window.getCombinedStats(id);
    const list = document.getElementById('statsList');
    if (!list) return; // Should exist if HTML updated
    list.innerHTML = '';

    const sorted = s.assignments.sort((a, b) => a.date.localeCompare(b.date));

    if (sorted.length === 0) {
        list.innerHTML = '<li class="text-gray-500 italic">Sin guardias asignadas.</li>';
    } else {
        let months = {};
        sorted.forEach(a => {
            const m = a.date.substring(0, 7);
            if (!months[m]) months[m] = { t: 0, f: 0, s: 0, h: 0, days: [] };
            months[m].t++;
            if (a.type === 'HOLIDAY') months[m].h++;
            else if (a.type === 'WEEKEND') months[m].s++;
            else if (a.type === 'FRIDAY' || a.type === 'EVE') months[m].f++;
            months[m].days.push(a);
        });

        Object.keys(months).sort().forEach(mKey => {
            const mData = months[mKey];
            const monthName = new Date(mKey + '-01').toLocaleString('es-ES', { month: 'long', year: 'numeric' });

            const daysHtml = mData.days.map(d => {
                let color = 'bg-gray-50 text-gray-600 border border-gray-200';
                if (d.type === 'HOLIDAY') color = 'bg-orange-100 text-orange-800 border-orange-200';
                else if (d.type === 'WEEKEND') color = 'bg-purple-100 text-purple-800 border-purple-200';
                else if (d.type === 'FRIDAY' || d.type === 'EVE') color = 'bg-teal-100 text-teal-800 border-teal-200';
                return `<span class="px-2 py-1 rounded text-xs font-mono font-bold ${color}">${d.date.split('-')[2]}</span>`;
            }).join('');

            list.innerHTML += `
               <li class="mb-4">
                   <div class="font-bold text-gray-800 bg-gray-100 px-2 py-1 flex justify-between rounded">
                       <span class="capitalize">${monthName}</span>
                       <span class="text-xs text-gray-600 font-normal">Tot: ${mData.t} (V:${mData.f} SD:${mData.s} F:${mData.h})</span>
                   </div>
                   <div class="flex flex-wrap gap-2 mt-2 px-2">
                       ${daysHtml}
                   </div>
               </li>
           `;
        });

        const numMonths = Object.keys(months).length || 1;
        const avgPanel = document.getElementById('statsAverages');
        if (avgPanel) {
            avgPanel.innerHTML = `
                <div class="grid grid-cols-4 gap-2 text-center text-sm">
                    <div class="bg-gray-50 p-2 rounded"><div class="font-bold text-gray-500 text-xs uppercase">Tot/Mes</div><div class="font-bold text-lg">${(s.total / numMonths).toFixed(1)}</div></div>
                    <div class="bg-teal-50 p-2 rounded"><div class="font-bold text-teal-600 text-xs uppercase">Vier/Mes</div><div class="font-bold text-lg">${(s.fri / numMonths).toFixed(1)}</div></div>
                    <div class="bg-purple-50 p-2 rounded"><div class="font-bold text-purple-600 text-xs uppercase">Sáb/Dom</div><div class="font-bold text-lg">${(s.sd / numMonths).toFixed(1)}</div></div>
                    <div class="bg-orange-50 p-2 rounded"><div class="font-bold text-orange-600 text-xs uppercase">Festivos</div><div class="font-bold text-lg">${(s.hol / numMonths).toFixed(1)}</div></div>
                </div>
           `;
        }
    }

    document.getElementById('statsModal').classList.remove('hidden');
    document.getElementById('statsModal').classList.add('flex');
}

window.closeStatsModal = function () {
    document.getElementById('statsModal').classList.add('hidden');
    document.getElementById('statsModal').classList.remove('flex');
}

// --- History Table (Fixed) ---

window.openHistoryModal = function () {
    document.getElementById('historyModal').classList.remove('hidden');
    document.getElementById('historyModal').classList.add('flex');
    renderHistoryTable();
}

window.closeHistoryModal = function () {
    document.getElementById('historyModal').classList.add('hidden');
    document.getElementById('historyModal').classList.remove('flex');
}

window.renderHistoryTable = function () {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';
    const filesDiv = document.getElementById('historyFiles');

    if (window.appData.importedFiles && window.appData.importedFiles.length > 0) {
        filesDiv.innerHTML = `<strong>Archivos cargados:</strong> ${window.appData.importedFiles.join(', ')}`;
    } else {
        filesDiv.innerHTML = `<em>No hay archivos importados.</em>`;
        tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">Sin datos históricos</td></tr>`;
        return;
    }

    if (!window.appData.history) return;

    Object.values(window.appData.history).forEach(h => {
        tbody.innerHTML += `
            <tr class="bg-white border-b hover:bg-gray-50">
                <td class="px-4 py-3 font-medium text-gray-900">${h.name}</td>
                <td class="px-4 py-3 text-center">${h.months || '?'}</td>
                <td class="px-4 py-3 text-center font-bold">${h.total}</td>
                <td class="px-4 py-3 text-center text-teal-600">${h.fri}</td>
                <td class="px-4 py-3 text-center text-purple-600">${h.sd}</td>
                <td class="px-4 py-3 text-center text-orange-600">${h.hol}</td>
            </tr>
        `;
    });
}

// --- Utilities ---

window.showToast = function (message, type = 'info', timer = 3000) {
    const icons = {
        success: 'success',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            toast: true, position: 'bottom-end', showConfirmButton: false,
            timer: timer, timerProgressBar: true, icon: icons[type] || 'info', title: message
        });
    } else {
        console.log(`Toast [${type}]: ${message}`);
    }
}
