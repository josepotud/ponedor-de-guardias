// --- MAIN ---
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    if (!window.appData.startDate) {
        const today = new Date();
        // Defaults: Entire NEXT month
        const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        window.appData.startDate = getISO(nextMonthStart);
        window.appData.endDate = getISO(nextMonthEnd);
        saveState();
    }
    const startEl = document.getElementById('startDate');
    const endEl = document.getElementById('endDate');
    const slotsEl = document.getElementById('defaultSlots');

    // Date Validation & Auto-Init Logic
    if (startEl && endEl) {
        startEl.addEventListener('change', () => {
            if (startEl.value > endEl.value && endEl.value) {
                endEl.value = startEl.value;
            }
            saveStateInputs();
            if (!window.appData.schedule || window.appData.schedule.length === 0 || confirm("¿Cambiar fechas y reiniciar calendario?")) {
                window.appData.startDate = startEl.value;
                window.appData.endDate = endEl.value;
                initializeEmptySchedule();
            }
        });
        endEl.addEventListener('change', () => {
            if (endEl.value < startEl.value && startEl.value) {
                startEl.value = endEl.value;
            }
            saveStateInputs();
            if (!window.appData.schedule || window.appData.schedule.length === 0 || confirm("¿Cambiar fechas y reiniciar calendario?")) {
                window.appData.startDate = startEl.value;
                window.appData.endDate = endEl.value;
                initializeEmptySchedule();
            }
        });
    }

    if (startEl) startEl.value = window.appData.startDate;
    if (endEl) endEl.value = window.appData.endDate;
    if (slotsEl) slotsEl.value = window.appData.defaultSlots || 1;

    // UX: Enter key to add person
    const inputs = ['newPersonName', 'newPersonMin', 'newPersonMax'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') window.addPerson();
            });
        }
    });

    renderPeople();
    updateHistoryBadge();

    // Check loaded schedule for alerts OR Init empty
    if (window.appData.schedule && window.appData.schedule.length > 0) {
        let unassignedCount = 0;
        window.appData.schedule.forEach(day => {
            day.seats.forEach(s => { if (!s.pid) unassignedCount++; });
        });
        renderResults(unassignedCount);
    } else {
        // Init empty on load if nothing exists
        initializeEmptySchedule();
    }

    document.getElementById('calendarModal').addEventListener('click', function (e) {
        if (e.target === this) closeModal();
    });
});

window.startGeneration = function (preserveExisting) {
    if (!window.appData.people.length) return Swal.fire('Error', 'Sin personal', 'error');
    saveStateInputs();

    if (!preserveExisting) window.appData.manualBans = {};

    document.getElementById('loadingOverlay').classList.remove('hidden');
    document.getElementById('loadingOverlay').classList.add('flex');

    if (preserveExisting) {
        document.getElementById('loadingTitle').innerText = "Rellenando Huecos...";
        document.getElementById('loadingSubtitle').innerText = "Manteniendo asignaciones fijas";
    } else {
        document.getElementById('loadingTitle').innerText = "Generando Calendario...";
        document.getElementById('loadingSubtitle').innerText = "Calculando por capas de prioridad";
    }

    // Sanitize suggestions and enforce boolean types
    window.appData.people.forEach(p => {
        if (p.suggested && p.suggested.length > 1) {
            p.suggested.sort();
        }
        // Strict Boolean Conversion for Doublets
        // If it's the string "true", make it boolean true. Otherwise false (unless it's already boolean true).
        if (typeof p.doublets === 'string') {
            p.doublets = (p.doublets === 'true');
        } else {
            p.doublets = !!p.doublets;
        }
    });

    setTimeout(() => {
        const dates = getDatesRange(window.appData.startDate, window.appData.endDate);
        const [sy, sm, sd] = window.appData.startDate.split('-').map(Number);
        const [ey, em, ed] = window.appData.endDate.split('-').map(Number);
        const d1 = new Date(sy, sm - 1, sd);
        const d2 = new Date(ey, em - 1, ed);
        const curMonths = Math.max(1, (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + 1);

        let bestRes = null, minU = Infinity, bestStd = Infinity;
        const iterations = preserveExisting ? 50 : 200;

        for (let i = 0; i < iterations; i++) {
            const res = runSimulation(dates, curMonths, preserveExisting ? window.appData.schedule : []);
            if (res.unassigned < minU) { minU = res.unassigned; bestRes = res; bestStd = res.stdDev; }
            else if (res.unassigned === minU && res.stdDev < bestStd) { bestRes = res; bestStd = res.stdDev; }
        }

        if (bestRes.unassigned > 0) {
            fillGaps(bestRes.schedule, bestRes.statsRef, dates);
            // Recount unassigned
            bestRes.unassigned = 0;
            bestRes.schedule.forEach(day => {
                day.seats.forEach(s => { if (!s.pid) bestRes.unassigned++; });
            });
        }

        window.appData.schedule = bestRes.schedule;
        saveState();
        document.getElementById('loadingOverlay').classList.add('hidden');
        document.getElementById('loadingOverlay').classList.remove('flex');
        renderResults(bestRes.unassigned);
    }, 100);
}

// Updated signature: identifies seat by DayIndex + SeatIndex (most robust)
// Updated signature: identifies seat by DayIndex + SeatIndex (most robust)
window.clearSlot = function (dateIso, seatIdx) {
    // Find the day by date
    const day = window.appData.schedule.find(s => s.date === dateIso);
    if (day && day.seats[seatIdx]) {
        const slot = day.seats[seatIdx];
        const pid = slot.pid;

        if (pid) {
            const p = window.appData.people.find(x => x.id === pid);
            if (p) {
                // Restore auto-block on removal (User Request)
                if (!p.blocked.includes(dateIso)) {
                    p.blocked.push(dateIso);
                    if (p.suggested) p.suggested = p.suggested.filter(d => d !== dateIso);
                }
            }

            slot.pid = null;
            slot.name = null;
            slot.locked = false; // Ensure padlock is removed from empty slot
            saveState();
            renderResults(0);
            renderPeople(); // Re-render people to show new blocked status count?
            const dateStr = dateIso.split('-').reverse().join('/');
            showToast(`Guardia borrada y día bloqueado para ${p.name}`, 'warning');
        }
    }
}

window.openManualAssign = function (dayIdx, seatIdx) {
    const day = window.appData.schedule[dayIdx];
    if (!day) return;
    const dateIso = day.date;

    // getStrictCandidates expects (dateIso, slotIdx/dayIdx) but we updated algorithm.js to treat slotIdx as dayIdx if simple.
    // However, algorithm.js was calling window.appData.schedule[slotIdx].
    // So passing dayIdx is correct.
    const candidates = window.getStrictCandidates(dateIso, dayIdx);

    // Build options HTML
    const options = candidates.sort((a, b) => {
        if (a.valid === b.valid) return a.name.localeCompare(b.name);
        return a.valid ? -1 : 1;
    }).map(c => {
        const color = c.valid ? 'text-green-600' : 'text-gray-400';
        const disabled = c.valid ? '' : 'disabled style="color:#aaa"';
        const label = c.valid ? c.name : `${c.name} (${c.reason})`;
        return `<option value="${c.id}" ${disabled} class="${color}">${label}</option>`;
    }).join('');

    Swal.fire({
        title: `Asignar Guardia: ${dateIso}`,
        html: `
            <p class="text-sm text-gray-500 mb-2">Selecciona un candidato</p>
            <select id="manualAssignSelect" class="w-full p-2 border rounded">
                <option value="">Seleccionar...</option>
                ${options}
            </select>
        `,
        showCancelButton: true,
        confirmButtonText: 'Asignar',
        preConfirm: () => {
            const pid = document.getElementById('manualAssignSelect').value;
            if (!pid) Swal.showValidationMessage('Debes seleccionar a alguien');
            return pid;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            applyManualAssign(dayIdx, seatIdx, result.value);
        }
    });
}

window.applyManualAssign = function (dayIdx, seatIdx, pid) {
    const day = window.appData.schedule[dayIdx];
    if (!day || !day.seats[seatIdx]) {
        console.error("Slot not found");
        return;
    }
    const targetToken = day.seats[seatIdx];

    const p = window.appData.people.find(x => x.id === pid);

    // Re-verify strict validation just in case
    const valid = window.isValidAssignment(pid, dayIdx, null, window.appData.schedule, p.doublets);
    // Note: isValidAssignment checks the whole day. If we manually override, we usually want to force it?
    // But the candidate list already filtered by validation. User selected from Valid list (or forced via disabled attrib hack).
    // Let's allow force if user really wants? The UI disabled invalid ones.
    // If invalid, warn but maybe allow? No, prompt says "Debes seleccionar...".
    // If using <select> with disabled options, user can't select them usually.
    // But let's check basic conflicts.

    if (!valid) {
        // Redundant check if UI works, but safe.
        let reason = "Incumple normas";
        // simplified reason guesstimate
        if (p.blocked.includes(day.date)) reason = "Día bloqueado";
        else reason = "Consecutivos / Dobletes";
        showToast(`No recomendado: ${reason}`, 'error');
        // We BLOCK for now to be safe and strict
        return;
    }

    targetToken.pid = p.id;
    targetToken.name = p.name;
    // Lock it so fillGaps doesn't move it
    targetToken.locked = true;
    saveState();
    renderResults(0);
    showToast(`Asignado: ${p.name} -> ${day.date}`, 'success');
}

window.initializeEmptySchedule = function () {
    // Only if no schedule or confirm? For now, we do it if empty.
    // Or if dates change, we effectively reset.
    // Let's generate the structure without assigning.
    const dates = getDatesRange(window.appData.startDate, window.appData.endDate);
    const slotsPerDay = parseInt(document.getElementById('defaultSlots').value) || 2;
    // Keep existing manual assignments if possible? Too complex for first iteration.
    // User requested "appears empty".

    // We strictly rebuild structure.
    window.appData.schedule = dates.map(iso => {
        const d = new Date(iso);
        let type = 'NORMAL';
        if (window.appData.holidays.includes(iso)) type = 'HOLIDAY';
        else if (d.getDay() === 0 || d.getDay() === 6) type = 'WEEKEND';
        else if (d.getDay() === 5) type = 'FRIDAY'; // Simple check, EVE logic is in simulation. 
        // We can't know EVE without full holiday check, but simple is fine for manual UI.

        const seats = [];
        for (let i = 0; i < slotsPerDay; i++) {
            seats.push({ idx: i, pid: null, name: null, locked: false });
        }
        return { date: iso, type, seats };
    });
    renderResults(0); // This draws the empty table
}

window.getCombinedStats = function (pid) {
    // 1. Get History Assignments
    const h = (window.appData.history && window.appData.history[pid]) || { assignments: [], total: 0, hol: 0, sd: 0, fri: 0 };
    const historyAssignments = h.assignments || []; // Should be array of {date, type}

    // 2. Filter History: Exclude dates in current range
    const start = window.appData.startDate;
    const end = window.appData.endDate;
    const validHistory = historyAssignments.filter(a => a.date < start || a.date > end);
    // Note: This logic assumes simple string comparison works for ISO dates (it does).

    // 3. Get Current Schedule Assignments
    const currentAssignments = [];
    if (window.appData.schedule) {
        window.appData.schedule.forEach(day => {
            day.seats.forEach(s => {
                if (s.pid === pid) {
                    currentAssignments.push({ date: day.date, type: day.type });
                }
            });
        });
    }

    // 4. Merge
    const merged = [...validHistory, ...currentAssignments];

    // 5. Recalculate Stats for Combined
    // Only rely on the list to ensure consistency (ignore h.total accumulator if we have list)
    // If we have detailed assignments, recalculate from scratch. If not (legacy history), use accumulators.
    let stats = { total: 0, hol: 0, sd: 0, fri: 0, assignments: merged };

    if (historyAssignments.length > 0) {
        // We have detail, recount everything from merged
        merged.forEach(a => {
            stats.total++;
            if (a.type === 'HOLIDAY') stats.hol++;
            else if (a.type === 'WEEKEND') stats.sd++;
            else if (a.type === 'FRIDAY' || a.type === 'EVE') stats.fri++;
        });
    } else {
        // Fallback for legacy history without details: Use h.accumulators (but we can't deduct overlap!)
        // If legacy history has NO details, we can't deduce valid range.
        // We assume legacy history does not overlap or we accept double counting.
        // But the prompt implies we WILL have details from new export.
        stats.total = h.total + currentAssignments.length;
        // ... simple sum
    }

    // If we recalculated from detail, use that.
    if (historyAssignments.length > 0) {
        return stats;
    }

    // Fallback simple addition (recalling logic implies we want detail, but safety first)
    let c = { t: 0, h: 0, s: 0, f: 0 };
    currentAssignments.forEach(s => {
        c.t++;
        if (s.type === 'HOLIDAY') c.h++;
        else if (s.type === 'WEEKEND') c.s++;
        else if (s.type === 'FRIDAY' || s.type === 'EVE') c.f++;
    });
    return {
        total: h.total + c.t,
        hol: h.hol + c.h,
        sd: h.sd + c.s,
        fri: h.fri + c.f,
        assignments: currentAssignments // Legacy fallback doesn't have history details
    };
}

window.importHistory = function (el) {
    const f = el.files[0]; if (!f) return;
    if (window.appData.importedFiles && window.appData.importedFiles.includes(f.name)) {
        if (!confirm(`Parece que ya has importado "${f.name}". ¿Quieres importarlo de nuevo?`)) { el.value = ''; return; }
    }
    const r = new FileReader();
    r.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.resumen_personal) throw new Error();
            if (!window.appData.history) window.appData.history = {};
            if (!window.appData.importedFiles) window.appData.importedFiles = [];
            if (!window.appData.deletedIds) window.appData.deletedIds = [];

            const start = new Date(data.periodo.inicio);
            const end = new Date(data.periodo.fin);
            const monthsInFile = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);

            data.resumen_personal.forEach(p => {
                const pid = p.id_persona || p.nombre;

                // Smart Import: Add to active list if new and not deleted
                const exists = window.appData.people.find(ap => ap.id === pid);
                if (!exists && !window.appData.deletedIds.includes(pid)) {
                    // Add new person without default limits
                    window.appData.people.push({
                        id: pid,
                        name: p.nombre,
                        min: '', max: '', doublets: false, blocked: [], suggested: []
                    });
                }

                // Initialize history entry
                if (!window.appData.history[pid]) {
                    window.appData.history[pid] = {
                        name: p.nombre,
                        months: 0, total: 0, hol: 0, sd: 0, fri: 0,
                        assignments: []
                    };
                }
                const h = window.appData.history[pid];

                // Store detailed assignments for deduplication
                if (p.detalle_periodo) {
                    if (!h.assignments) h.assignments = [];
                    // Merge avoiding exact duplicates in history itself (if file re-imported?)
                    p.detalle_periodo.forEach(newA => {
                        // detail format: { fecha: "2026-01-01", tipo: "HOLIDAY" }
                        // Map to internal: { date, type }
                        const internalA = { date: newA.fecha, type: newA.tipo };
                        if (!h.assignments.find(x => x.date === internalA.date)) {
                            h.assignments.push(internalA);
                        }
                    });
                }

                // Legacy accumulators (keep updating just in case)
                h.total += p.estadisticas.total_guardias;
                h.hol += p.estadisticas.desglose.festivos;
                h.sd += p.estadisticas.desglose.fin_de_semana;
                h.fri += p.estadisticas.desglose.viernes_visperas;
                h.months += monthsInFile;
            });

            window.appData.importedFiles.push(f.name);
            saveState();
            updateHistoryBadge();
            renderPeople();
            showToast('Historial importado correctamente', 'success');
        } catch (err) { console.error(err); showToast('Error: Archivo no válido', 'error'); }
    };
    r.readAsText(f);
    el.value = '';
}

window.exportData = function () {
    const blob = new Blob([JSON.stringify(window.appData)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
window.triggerImport = function () { document.getElementById('fileInput').click(); }
window.importData = function (el) { const f = el.files[0]; if (!f) return; const r = new FileReader(); r.onload = e => { window.appData = JSON.parse(e.target.result); saveState(); location.reload(); }; r.readAsText(f); }

window.downloadReportJSON = function () {
    const runDownload = () => {
        let report = { periodo: { inicio: window.appData.startDate, fin: window.appData.endDate }, generado: new Date().toISOString(), resumen_personal: [] };
        const allIds = new Set(window.appData.people.map(p => p.id));
        if (window.appData.history) Object.keys(window.appData.history).forEach(k => allIds.add(k));

        allIds.forEach(id => {
            const activeP = window.appData.people.find(p => p.id === id);
            const h = (window.appData.history && window.appData.history[id]) || { total: 0, hol: 0, sd: 0, fri: 0, months: 0, name: activeP ? activeP.name : 'Unknown' };

            // Flatten schedule for this person
            const assignments = [];
            window.appData.schedule.forEach(day => {
                day.seats.forEach(seat => {
                    if (seat.pid === id) {
                        assignments.push({ fecha: day.date, tipo: day.type });
                    }
                });
            });

            let c = { t: 0, h: 0, s: 0, f: 0 };
            assignments.forEach(s => { c.t++; if (s.tipo === 'HOLIDAY') c.h++; else if (s.tipo === 'WEEKEND') c.s++; else if (s.tipo === 'FRIDAY' || s.type === 'EVE') c.f++; });

            report.resumen_personal.push({
                id_persona: id,
                nombre: activeP ? activeP.name : h.name,
                estadisticas: {
                    total_guardias: h.total + c.t,
                    desglose: { festivos: h.hol + c.h, fin_de_semana: h.sd + c.s, viernes_visperas: h.fri + c.f, diario_LJ: 0 }
                },
                detalle_periodo: assignments
            });
        });

        const blob = new Blob([JSON.stringify(report, null, 4)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `contabilidad_${window.appData.endDate}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const errors = window.validateSchedule ? window.validateSchedule() : {};
    if (Object.keys(errors).length > 0) {
        Swal.fire({
            title: 'Conflictos detectados',
            text: 'El calendario contiene errores o reglas incumplidas (marcadas en rojo). ¿Quieres descargar el reporte de todos modos?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, descargar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) runDownload();
        });
    } else {
        runDownload();
    }
}

window.downloadPDF = function (mode) {
    const runDownload = () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4');

        const [sy, sm, sd] = window.appData.startDate.split('-').map(Number);
        const [ey, em, ed] = window.appData.endDate.split('-').map(Number);
        const startDate = new Date(sy, sm - 1, sd);
        const endDate = new Date(ey, em - 1, ed);

        // Calculate months
        let currentMonthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const finalMonthStart = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

        let isFirstPage = true;

        while (currentMonthStart <= finalMonthStart) {
            if (!isFirstPage) doc.addPage();
            isFirstPage = false;

            const year = currentMonthStart.getFullYear();
            const month = currentMonthStart.getMonth();
            const monthName = currentMonthStart.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

            // Define month range for this page
            const monthEnd = new Date(year, month + 1, 0); // Last day of month

            // Loop range for this page: Max(GlobalStart, MonthStart) -> Min(GlobalEnd, MonthEnd)
            let iterDate = new Date(Math.max(startDate, currentMonthStart));

            // Grid Alignment: Backtrack to Monday
            let startDay = iterDate.getDay() - 1; if (startDay === -1) startDay = 6;
            iterDate.setDate(iterDate.getDate() - startDay);

            // We loop until we pass the end of this month segment AND finish the week
            const loopEnd = new Date(Math.min(endDate, monthEnd));

            doc.setFontSize(16);
            if (mode === 'debug') doc.text(`AUDITORÍA - ${monthName}`, 14, 15);
            else doc.text(`CALENDARIO - ${monthName}`, 14, 15);

            const weeks = [];
            let currentWeek = new Array(7).fill(null);
            let working = true;

            while (working) {
                let dayIdx = iterDate.getDay() - 1; if (dayIdx === -1) dayIdx = 6;
                const iso = getISO(iterDate);
                // Check if this specific day is inside the desired range AND belongs to the current paginated month
                const inRange = (iterDate >= startDate && iterDate <= endDate && iterDate.getMonth() === month);

                if (inRange) {
                    const dayNum = iterDate.getDate();
                    let content = `${dayNum}`;

                    if (mode === 'debug') {
                        const blocked = window.appData.people.filter(p => p.blocked.includes(iso)).map(p => p.name).join(', ');
                        const suggested = window.appData.people.filter(p => p.suggested && p.suggested.includes(iso)).map(p => p.name).join(', ');
                        if (suggested) content += `\n[SOL]: ${suggested}`;
                        if (blocked) content += `\n[NO]: ${blocked}`;
                        if (window.appData.holidays.includes(iso)) content += `\n(FESTIVO)`;
                    } else {
                        const dayData = window.appData.schedule.find(s => s.date === iso);
                        if (dayData && dayData.seats) {
                            const assignedNames = dayData.seats.filter(s => s.pid).map(s => s.name || "?").join("\n");
                            if (assignedNames) content += "\n" + assignedNames;
                        }
                    }
                    currentWeek[dayIdx] = content;
                }

                if (dayIdx === 6) {
                    weeks.push(currentWeek);
                    currentWeek = new Array(7).fill(null);
                    if (iterDate >= loopEnd) working = false;
                }
                iterDate.setDate(iterDate.getDate() + 1);
            }

            doc.autoTable({
                startY: 20,
                head: [['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']],
                body: weeks,
                theme: 'grid',
                styles: { minCellHeight: 25, fontSize: 8, valign: 'top', halign: 'center', lineWidth: 0.1 },
                headStyles: { fillColor: mode === 'debug' ? [100, 100, 100] : [41, 128, 185], textColor: 255 },
                columnStyles: { 5: { fillColor: [240, 240, 250] }, 6: { fillColor: [240, 240, 250] } }
            });

            // Move to next month
            currentMonthStart.setMonth(currentMonthStart.getMonth() + 1);
        }

        // Summary Page
        if (mode !== 'debug') {
            doc.addPage();
            doc.text("Resumen Contable Total", 14, 20);

            const rows = [];
            const allIds = new Set(window.appData.people.map(p => p.id));
            if (window.appData.history) Object.keys(window.appData.history).forEach(k => allIds.add(k));

            allIds.forEach(id => {
                const activeP = window.appData.people.find(p => p.id === id);
                const h = (window.appData.history && window.appData.history[id]) || { total: 0, hol: 0, sd: 0, fri: 0, months: 0, name: activeP ? activeP.name : 'Unknown' };
                let c = { t: 0, h: 0, s: 0, f: 0 };

                // Aggregate
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

                rows.push([
                    activeP ? activeP.name : `${h.name} (Baja)`,
                    h.total + c.t,
                    h.fri + c.f,
                    h.sd + c.s,
                    h.hol + c.h
                ]);
            });

            doc.autoTable({
                startY: 25,
                head: [['Nombre', 'Total Acum', 'Vier+Vís', 'Sáb+Dom', 'Fest']],
                body: rows,
                theme: 'striped'
            });
        }

        const filename = mode === 'debug' ? 'auditoria_bloqueos.pdf' : 'calendario_guardias.pdf';
        doc.save(filename);
    } // End runDownload

    // Confirm blocks before download
    if (mode !== 'debug') {
        const errors = window.validateSchedule ? window.validateSchedule() : {};
        if (Object.keys(errors).length > 0) {
            Swal.fire({
                title: 'Conflictos detectados',
                text: 'El calendario contiene errores o reglas incumplidas. ¿Descargar de todos modos?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, descargar',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) runDownload();
            });
        } else {
            runDownload();
        }
    } else {
        runDownload();
    }
}
