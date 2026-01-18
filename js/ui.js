// --- UI ---

window.addPerson = function () {
    const name = document.getElementById('newPersonName').value.trim();
    if (!name) return;
    let existingId = null;
    if (window.appData.history) {
        const found = Object.keys(window.appData.history).find(k => window.appData.history[k].name === name);
        if (found) existingId = found;
    }
    window.appData.people.push({
        id: existingId || Date.now().toString(),
        name,
        min: document.getElementById('newPersonMin').value,
        max: document.getElementById('newPersonMax').value,
        doublets: document.getElementById('newPersonDoublets').checked,
        blocked: [],
        suggested: []
    });
    // Cleanup
    document.getElementById('newPersonName').value = '';
    document.getElementById('newPersonMin').value = '';
    document.getElementById('newPersonMax').value = '';
    document.getElementById('newPersonDoublets').checked = false;
    document.getElementById('newPersonName').focus();

    saveState();
    renderPeople();
}

window.removePerson = function (id) {
    window.appData.people = window.appData.people.filter(p => p.id !== id);
    saveState();
    renderPeople();
}

window.renderPeople = function () {
    const list = document.getElementById('peopleList');
    list.innerHTML = '';
    window.appData.people.forEach(p => {
        const h = window.appData.history && window.appData.history[p.id];
        const el = document.createElement('div');
        el.className = "flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 hover:shadow-md transition";

        const infoHtml = h ? `<span class="text-xs text-purple-600 bg-purple-50 px-1 rounded ml-2">Hist:${h.total}</span>` : `<span class="text-xs text-green-600 bg-green-50 px-1 rounded ml-2">Nuevo</span>`;
        const blk = p.blocked.length, sug = p.suggested ? p.suggested.length : 0;

        el.innerHTML = `
            <div class="flex flex-col">
                <span class="font-bold text-gray-800 text-sm flex items-center">${p.name} ${infoHtml}</span>
                <div class="flex gap-2 text-xs text-gray-500 mt-1">
                    ${p.doublets ? 'Doble:Sí' : 'Doble:No'} 
                    ${blk > 0 ? `<span class="text-red-500">Bloq:${blk}</span>` : ''}
                    ${sug > 0 ? `<span class="text-green-600 font-bold">Sug:${sug}</span>` : ''}
                </div>
            </div>
            <div class="flex gap-1">
                <button onclick="openEditPersonModal('${p.id}')" class="p-2 text-gray-400 hover:text-green-500 rounded"><i class="fas fa-pen"></i></button>
                <button onclick="openPersonModal('${p.id}')" class="p-2 text-gray-400 hover:text-blue-500 rounded"><i class="fas fa-calendar-day"></i></button>
                <button onclick="removePerson('${p.id}')" class="p-2 text-gray-400 hover:text-red-600 rounded"><i class="fas fa-trash"></i></button>
            </div>
        `;
        list.appendChild(el);
    });
}

// Calendar UI
window.openPersonModal = function (id) {
    modalMode = 'person';
    currentPersonId = id;
    document.getElementById('modalTitle').innerText = window.appData.people.find(x => x.id === id).name;
    document.getElementById('personModalControls').classList.remove('hidden');
    document.getElementById('staffingControls').classList.add('hidden');
    const blockRadio = document.querySelector('input[name="dayAction"][value="block"]');
    if (blockRadio) blockRadio.checked = true;
    openModal();
}
window.openHolidayModal = function () {
    modalMode = 'holiday'; currentPersonId = null;
    document.getElementById('modalTitle').innerText = 'Festivos';
    document.getElementById('personModalControls').classList.add('hidden');
    document.getElementById('staffingControls').classList.add('hidden');
    openModal();
}
window.openStaffingModal = function () {
    modalMode = 'staffing'; currentPersonId = null;
    document.getElementById('modalTitle').innerText = 'Excepciones Plazas';
    document.getElementById('personModalControls').classList.add('hidden');
    document.getElementById('staffingControls').classList.remove('hidden');
    document.getElementById('modalStaffingCount').value = 2;
    openModal();
}
window.openModal = function () {
    document.getElementById('calendarModal').classList.remove('hidden'); document.getElementById('calendarModal').classList.add('flex'); if (window.appData.startDate) {
        const [y, m, d] = window.appData.startDate.split('-').map(Number);
        viewDate = new Date(y, m - 1, d);
    } renderCalendar();
}
window.closeModal = function () { document.getElementById('calendarModal').classList.add('hidden'); document.getElementById('calendarModal').classList.remove('flex'); saveState(); renderPeople(); }

window.changeMonth = function (d) {
    viewDate.setDate(1);
    viewDate.setMonth(viewDate.getMonth() + d);
    renderCalendar();
}

window.renderCalendar = function () {
    const grid = document.getElementById('calendarGrid');
    const label = document.getElementById('monthLabel');
    grid.innerHTML = '';
    const y = viewDate.getFullYear(), m = viewDate.getMonth();
    label.innerText = viewDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

    const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
    let offset = first.getDay() - 1; if (offset === -1) offset = 6;

    for (let i = 0; i < offset; i++) grid.innerHTML += `<div></div>`;

    let blockedArr = [], suggestedArr = [], holidaysArr = window.appData.holidays;
    if (modalMode === 'person') { const p = window.appData.people.find(x => x.id === currentPersonId); if (p) { blockedArr = p.blocked; suggestedArr = p.suggested || []; } }

    const [sy, sm, sd] = window.appData.startDate.split('-').map(Number);
    const [ey, em, ed] = window.appData.endDate.split('-').map(Number);
    const min = new Date(sy, sm - 1, sd);
    const max = new Date(ey, em - 1, ed);
    const defaultSlots = parseInt(document.getElementById('defaultSlots').value) || 1;

    for (let d = 1; d <= last.getDate(); d++) {
        const cur = new Date(y, m, d);
        const iso = getISO(cur);
        const div = document.createElement('div');
        div.innerText = d;

        if (cur < min || cur > max) { div.className = "calendar-day day-disabled"; }
        else {
            let cls = "day-standard bg-white border border-gray-100";
            if (modalMode === 'person') {
                if (blockedArr.includes(iso)) cls = "day-blocked";
                else if (suggestedArr.includes(iso)) cls = "day-suggested";
                else if (holidaysArr.includes(iso)) cls = "bg-orange-50 text-orange-400";
            } else if (modalMode === 'holiday' && holidaysArr.includes(iso)) cls = "day-holiday";
            else if (modalMode === 'staffing') {
                const count = window.appData.staffing[iso] !== undefined ? window.appData.staffing[iso] : defaultSlots;
                if (count > 1 || count !== defaultSlots) {
                    cls = "day-multi-staff";
                    div.innerHTML = `${d} <span class="badge">x${count}</span>`;
                }
            }

            div.className = `calendar-day ${cls}`;
            div.onclick = (e) => {
                if (modalMode === 'holiday') {
                    const idx = holidaysArr.indexOf(iso); if (idx > -1) holidaysArr.splice(idx, 1); else holidaysArr.push(iso);
                    window.appData.holidays = holidaysArr;
                } else if (modalMode === 'staffing') {
                    const inputVal = parseInt(document.getElementById('modalStaffingCount').value);
                    if (!isNaN(inputVal) && inputVal >= 0) {
                        window.appData.staffing[iso] = inputVal;
                    }
                } else if (modalMode === 'person') {
                    const p = window.appData.people.find(x => x.id === currentPersonId);
                    const action = document.querySelector('input[name="dayAction"]:checked').value;
                    if (action === 'block') {
                        const idxB = p.blocked.indexOf(iso); if (idxB > -1) p.blocked.splice(idxB, 1); else { p.blocked.push(iso); if (p.suggested) { const idxS = p.suggested.indexOf(iso); if (idxS > -1) p.suggested.splice(idxS, 1); } }
                    } else {
                        if (!p.suggested) p.suggested = [];
                        const idxS = p.suggested.indexOf(iso); if (idxS > -1) p.suggested.splice(idxS, 1); else { p.suggested.push(iso); const idxB = p.blocked.indexOf(iso); if (idxB > -1) p.blocked.splice(idxB, 1); }
                    }
                }
                renderCalendar();
            };
        }
        grid.appendChild(div);
    }
}

window.renderResults = function (unassigned) {
    document.getElementById('statsPanel').classList.remove('hidden');
    document.getElementById('scheduleResult').classList.remove('hidden');
    document.getElementById('emptyState').classList.add('hidden');
    const alert = document.getElementById('alertBox');
    if (unassigned > 0) { alert.classList.remove('hidden'); document.getElementById('alertText').innerText = `${unassigned} plazas sin cubrir.`; }
    else alert.classList.add('hidden');

    const tbody = document.getElementById('scheduleBody');
    tbody.innerHTML = '';
    // Schedule is already sorted by date construction
    // window.appData.schedule.sort((a, b) => a.date.localeCompare(b.date)); // It's an array of days now, constructed in order.

    // Calculate errors once
    const errors = window.validateSchedule ? window.validateSchedule() : {};

    let lastMonth = '';
    window.appData.schedule.forEach((day, dayIndex) => {
        const [y, m, d] = day.date.split('-');
        let cls = "text-gray-400", bg = "";
        if (day.type === 'HOLIDAY') { cls = "text-orange-700 font-bold"; bg = "bg-orange-50"; }
        else if (day.type === 'WEEKEND') { cls = "text-purple-700 font-bold"; bg = "bg-purple-50"; }
        else if (day.type === 'FRIDAY' || day.type === 'EVE') { cls = "text-teal-600 font-bold"; }

        // Month separator visual (optional, but nice)
        // const border = (m !== lastMonth) ? "border-t-4 border-gray-200" : "border-t border-gray-50";
        // lastMonth = m;

        // Render one row per SEAT
        day.seats.forEach((seat, seatIdx) => {
            const tr = document.createElement('tr');
            // Add top border only on the first seat of the day to group them
            const border = (seatIdx === 0) ? "border-t border-gray-200" : "border-none";
            tr.className = `hover:bg-blue-50 transition ${bg} ${border}`;

            let trashBtn = '';
            if (seat.pid) {
                // Pass seatIdx to verify we delete the right one if needed, though pid is usually enough. 
                // But current implementation of clearSlot uses date+pid. 
                // We should update clearSlot to use (date, seatIdx) to be precise?
                // Let's stick to (date, seatIdx) for robustness if we update main.js.
                // Or keep (date, pid) if clearSlot finds by pid.
                // Recommending: clearSlot(date, seatIdx)
                trashBtn = `<button onclick="clearSlot('${day.date}', ${seat.idx})" class="text-gray-400 hover:text-red-500 transition px-2"><i class="fas fa-trash"></i></button>`;
            }

            const assignClass = seat.pid ? '' : 'cursor-pointer hover:bg-gray-100 text-blue-500 underline decoration-dashed';
            // pass dayIndex (global schedule index) or date? 
            // openManualAssign needs to know the Day and the Seat.
            // Let's pass (dayIndex, seatIdx).
            const assignClick = seat.pid ? '' : `onclick="openManualAssign(${dayIndex}, ${seat.idx})"`;

            const dateObj = new Date(day.date);
            const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
            const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

            // Only show Date/Type on the first seat row to avoid clutter?
            // OR show on all. User request implied "List of days". 
            // If we have 2 seats, showing date twice is fine, or merging.
            // Let's show date on first seat, empty on others for visual grouping?
            const showDate = (seatIdx === 0);

            // Validation Check
            let errorHtml = '';
            let errorClass = '';
            const errKey = `${day.date}_${seat.idx}`;
            if (errors[errKey]) {
                errorClass = 'bg-red-100 border-l-4 border-red-500';
                errorHtml = `<div class="text-xs text-red-600 font-bold mt-1"><i class="fas fa-exclamation-triangle"></i> ${errors[errKey]}</div>`;
            }

            tr.innerHTML = `
                <td class="px-6 py-2 ${showDate ? '' : 'text-transparent select-none'}">${d}/${m}</td>
                <td class="px-6 py-2 ${cls} ${showDate ? '' : 'text-transparent select-none'}">${capitalizedDay}</td>
                <td class="px-6 py-2 ${errorClass}">
                    <div class="font-bold ${seat.pid ? '' : 'text-red-500'} ${assignClass}" ${assignClick}>
                        ${seat.name || 'VACÍO (Click to Add)'}
                    </div>
                    ${errorHtml}
                </td>
                <td class="px-6 py-2 text-center">${trashBtn}</td>
            `;
            tbody.appendChild(tr);
        });
    });

    const allIds = new Set(window.appData.people.map(p => p.id));
    if (window.appData.history) Object.keys(window.appData.history).forEach(k => allIds.add(k));
    const statsList = [];

    allIds.forEach(id => {
        const activeP = window.appData.people.find(p => p.id === id);
        const h = (window.appData.history && window.appData.history[id]) || { total: 0, hol: 0, sd: 0, fri: 0, months: 0, name: activeP ? activeP.name : 'Unknown' };
        let c = { t: 0, h: 0, s: 0, f: 0 };

        // Iterate new schedule structure
        window.appData.schedule.forEach(day => {
            day.seats.forEach(seat => {
                if (seat.pid === id) {
                    c.t++;
                    if (day.type === 'HOLIDAY') c.h++;
                    else if (day.type === 'WEEKEND') c.s++;
                    else if (day.type === 'FRIDAY' || day.type === 'EVE') c.f++;
                }
            });
        });

        statsList.push({
            name: activeP ? activeP.name : `${h.name} (Baja)`,
            grandTotal: h.total + c.t,
            fri: h.fri + c.f,
            sd: h.sd + c.s,
            hol: h.hol + c.h,
            isLeaver: !activeP
        });
    });

    document.getElementById('statsBody').innerHTML = statsList.map(s => `
        <tr class="border-b ${s.isLeaver ? 'bg-gray-100 text-gray-500 italic' : ''}">
            <td class="px-4 py-3 font-medium">${s.name}</td>
            <td class="px-4 py-3 text-center font-bold bg-gray-100">${s.grandTotal}</td>
            <td class="px-4 py-3 text-center text-teal-600">${s.fri}</td>
            <td class="px-4 py-3 text-center text-purple-600">${s.sd}</td>
            <td class="px-4 py-3 text-center text-orange-600 font-bold border-l border-gray-200">${s.hol}</td>
        </tr>
    `).join('');
}

window.openHistoryModal = function () {
    document.getElementById('historyModal').classList.remove('hidden');
    document.getElementById('historyModal').classList.add('flex');
    renderHistoryTable();
}

// Global Toast Helper (Moved to bottom)
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

window.closeHistoryModal = function () {
    document.getElementById('historyModal').classList.add('hidden');
    document.getElementById('historyModal').classList.remove('flex');
}

window.renderHistoryTable = function () {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';
    const filesDiv = document.getElementById('historyFiles');

    if (window.appData.importedFiles && window.appData.importedFiles.length > 0) {
        filesDiv.innerHTML = `< strong > Archivos cargados:</strong > ${window.appData.importedFiles.join(', ')}`;
    } else {
        filesDiv.innerHTML = `< em > No hay archivos importados.</em > `;
        tbody.innerHTML = `< tr > <td colspan="6" class="px-4 py-8 text-center text-gray-400">Sin datos históricos</td></tr > `;
        return;
    }

    if (!window.appData.history) return;

    Object.values(window.appData.history).forEach(h => {
        tbody.innerHTML += `
    < tr class= "bg-white border-b hover:bg-gray-50" >
                <td class="px-4 py-3 font-medium text-gray-900">${h.name}</td>
                <td class="px-4 py-3 text-center">${h.months || '?'}</td>
                <td class="px-4 py-3 text-center font-bold">${h.total}</td>
                <td class="px-4 py-3 text-center text-teal-600">${h.fri}</td>
                <td class="px-4 py-3 text-center text-purple-600">${h.sd}</td>
                <td class="px-4 py-3 text-center text-orange-600 font-bold">${h.hol}</td>
            </tr >
        `;
    });
}

window.openEditPersonModal = function (id) {
    const p = window.appData.people.find(x => x.id === id);
    if (!p) return;
    document.getElementById('editPersonId').value = p.id;
    document.getElementById('editPersonName').value = p.name;
    document.getElementById('editPersonMin').value = p.min || '';
    document.getElementById('editPersonMax').value = p.max || '';
    document.getElementById('editPersonDoublets').checked = !!p.doublets;

    document.getElementById('editPersonModal').classList.remove('hidden');
    document.getElementById('editPersonModal').classList.add('flex');
}

window.closeEditPersonModal = function () {
    document.getElementById('editPersonModal').classList.add('hidden');
    document.getElementById('editPersonModal').classList.remove('flex');
}

window.saveEditPerson = function () {
    const id = document.getElementById('editPersonId').value;
    const p = window.appData.people.find(x => x.id === id);
    if (p) {
        p.name = document.getElementById('editPersonName').value.trim();
        p.min = document.getElementById('editPersonMin').value;
        p.max = document.getElementById('editPersonMax').value;
        // Strict boolean
        p.doublets = (document.getElementById('editPersonDoublets').checked === true);
        saveState();
        renderPeople();
        window.showToast('Persona actualizada', 'success');

        // Refresh schedule view immediately to reflect potential validation changes
        if (window.appData.schedule && window.appData.schedule.length > 0) renderResults(0);
    }
    closeEditPersonModal();
}
