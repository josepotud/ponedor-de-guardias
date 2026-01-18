// --- MAIN ---
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    if (!window.appData.startDate) {
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const endMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        window.appData.startDate = getISO(nextMonth);
        window.appData.endDate = getISO(endMonth);
        saveState();
    }
    const startEl = document.getElementById('startDate');
    const endEl = document.getElementById('endDate');
    const slotsEl = document.getElementById('defaultSlots');

    if (startEl) startEl.value = window.appData.startDate;
    if (endEl) endEl.value = window.appData.endDate;
    if (slotsEl) slotsEl.value = window.appData.defaultSlots || 1;

    renderPeople();
    updateHistoryBadge();
    if (window.appData.schedule && window.appData.schedule.length > 0) renderResults(0);

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
window.clearSlot = function (dateIso, seatIdx) {
    // Find the day by date
    const day = window.appData.schedule.find(s => s.date === dateIso);
    if (day && day.seats[seatIdx]) {
        const slot = day.seats[seatIdx];
        const pid = slot.pid;

        if (pid) {
            const p = window.appData.people.find(x => x.id === pid);
            if (p && !p.blocked.includes(dateIso)) {
                p.blocked.push(dateIso);
                if (p.suggested) p.suggested = p.suggested.filter(d => d !== dateIso);
            }

            slot.pid = null;
            slot.name = null;
            saveState();
            renderResults(0);
            renderPeople();
            const dateStr = dateIso.split('-').reverse().join('/');
            showToast(`Guardia borrada: ${p.name} bloqueado el ${dateStr}`, 'warning');
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
    saveState();
    renderResults(0);
    showToast(`Asignado: ${p.name} -> ${day.date}`, 'success');
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
            const start = new Date(data.periodo.inicio);
            const end = new Date(data.periodo.fin);
            const monthsInFile = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
            data.resumen_personal.forEach(p => {
                const pid = p.id_persona || p.nombre;
                if (!window.appData.history[pid]) window.appData.history[pid] = { name: p.nombre, months: 0, total: 0, hol: 0, sd: 0, fri: 0 };
                const h = window.appData.history[pid];
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
        } catch (err) { showToast('Error: Archivo no válido', 'error'); }
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
        const monthName = startDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

        doc.setFontSize(16);
        if (mode === 'debug') doc.text(`AUDITORÍA DE BLOQUEOS - ${monthName}`, 14, 15);
        else doc.text(`CALENDARIO DE GUARDIAS - ${monthName}`, 14, 15);

        const weeks = [];
        let currentWeek = new Array(7).fill(null);

        let iterDate = new Date(startDate);
        let startDay = iterDate.getDay() - 1; if (startDay === -1) startDay = 6;
        iterDate.setDate(iterDate.getDate() - startDay);

        while (iterDate <= endDate || currentWeek.some(d => d !== null)) {
            let dayIdx = iterDate.getDay() - 1; if (dayIdx === -1) dayIdx = 6;
            const iso = getISO(iterDate);
            const inRange = (iterDate >= startDate && iterDate <= endDate);

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
            } else if (currentWeek.some(d => d !== null) || iterDate < startDate) {
                if (iterDate >= startDate || currentWeek.length > 0) currentWeek[dayIdx] = "";
            }

            if (dayIdx === 6) {
                weeks.push(currentWeek);
                currentWeek = new Array(7).fill(null);
                if (iterDate > endDate) break;
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

        if (mode !== 'debug') {
            doc.addPage();
            doc.text("Resumen Contable", 14, 20);

            const rows = [];
            const allIds = new Set(window.appData.people.map(p => p.id));
            if (window.appData.history) Object.keys(window.appData.history).forEach(k => allIds.add(k));

            allIds.forEach(id => {
                const activeP = window.appData.people.find(p => p.id === id);
                const h = (window.appData.history && window.appData.history[id]) || { total: 0, hol: 0, sd: 0, fri: 0, months: 0, name: activeP ? activeP.name : 'Unknown' };
                let c = { t: 0, h: 0, s: 0, f: 0 };

                // Aggregate new structure
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
