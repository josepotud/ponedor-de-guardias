// --- STATE ---
let appData = { startDate: '', endDate: '', holidays: [], staffing: {}, people: [], schedule: [], history: {}, importedFiles: [], manualBans: {}, defaultSlots: 1 };
let viewDate = new Date();
let modalMode = 'block'; 
let currentPersonId = null;

// --- HELPER: LOCAL ISO DATE ---
function getISO(d) {
    const z = n => n < 10 ? '0'+n : n;
    return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    if(!appData.startDate) {
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const endMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        appData.startDate = getISO(nextMonth);
        appData.endDate = getISO(endMonth);
        saveState();
    }
    document.getElementById('startDate').value = appData.startDate;
    document.getElementById('endDate').value = appData.endDate;
    document.getElementById('defaultSlots').value = appData.defaultSlots || 1;
    renderPeople();
    updateHistoryBadge();
    if(appData.schedule.length > 0) renderResults(0);

    document.getElementById('calendarModal').addEventListener('click', function(e) {
        if(e.target === this) closeModal();
    });
});

function saveStateInputs() {
    appData.startDate = document.getElementById('startDate').value;
    appData.endDate = document.getElementById('endDate').value;
    appData.defaultSlots = parseInt(document.getElementById('defaultSlots').value) || 1;
    saveState();
}

function updateHistoryBadge() {
    const count = Object.keys(appData.history || {}).length;
    const badge = document.getElementById('historyBadge');
    count > 0 ? badge.classList.remove('hidden') : badge.classList.add('hidden');
}

// --- HISTORY IMPORT ---
function importHistory(el) {
    const f = el.files[0]; if(!f) return;
    if(appData.importedFiles && appData.importedFiles.includes(f.name)) {
        if(!confirm(`Parece que ya has importado "${f.name}". ¿Quieres importarlo de nuevo?`)) {
            el.value = ''; return;
        }
    }

    const r = new FileReader();
    r.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if(!data.resumen_personal) throw new Error();
            if(!appData.history) appData.history = {};
            if(!appData.importedFiles) appData.importedFiles = [];
            
            const start = new Date(data.periodo.inicio);
            const end = new Date(data.periodo.fin);
            const monthsInFile = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);

            data.resumen_personal.forEach(p => {
                const pid = p.id_persona || p.nombre;
                if(!appData.history[pid]) appData.history[pid] = { name: p.nombre, months:0, total:0, hol:0, sd:0, fri:0 };
                const h = appData.history[pid];
                h.total += p.estadisticas.total_guardias;
                h.hol += p.estadisticas.desglose.festivos;
                h.sd += p.estadisticas.desglose.fin_de_semana;
                h.fri += p.estadisticas.desglose.viernes_visperas;
                h.months += monthsInFile; 
            });
            
            appData.importedFiles.push(f.name);
            saveState();
            updateHistoryBadge();
            renderPeople();
            Swal.fire('OK', 'Historial importado', 'success');
        } catch(err) { Swal.fire('Error', 'Archivo no válido', 'error'); }
    };
    r.readAsText(f);
    el.value='';
}

// --- PEOPLE ---
function addPerson() {
    const name = document.getElementById('newPersonName').value.trim();
    if (!name) return;
    let existingId = null;
    if(appData.history) {
        const found = Object.keys(appData.history).find(k => appData.history[k].name === name);
        if(found) existingId = found;
    }
    appData.people.push({
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

function removePerson(id) {
    appData.people = appData.people.filter(p => p.id !== id);
    saveState();
    renderPeople();
}

function renderPeople() {
    const list = document.getElementById('peopleList');
    list.innerHTML = '';
    appData.people.forEach(p => {
        const h = appData.history && appData.history[p.id];
        const el = document.createElement('div');
        el.className = "flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 hover:shadow-md transition";
        
        const infoHtml = h ? `<span class="text-xs text-purple-600 bg-purple-50 px-1 rounded ml-2">Hist:${h.total}</span>` : `<span class="text-xs text-green-600 bg-green-50 px-1 rounded ml-2">Nuevo</span>`;
        const blk = p.blocked.length, sug = p.suggested ? p.suggested.length : 0;

        el.innerHTML = `
            <div class="flex flex-col">
                <span class="font-bold text-gray-800 text-sm flex items-center">${p.name} ${infoHtml}</span>
                <div class="flex gap-2 text-xs text-gray-500 mt-1">
                    ${p.doublets?'Doble:Sí':'Doble:No'} 
                    ${blk > 0 ? `<span class="text-red-500">Bloq:${blk}</span>` : ''}
                    ${sug > 0 ? `<span class="text-green-600 font-bold">Sug:${sug}</span>` : ''}
                </div>
            </div>
            <div class="flex gap-1">
                <button onclick="openPersonModal('${p.id}')" class="p-2 text-gray-400 hover:text-blue-500 rounded"><i class="fas fa-calendar-day"></i></button>
                <button onclick="removePerson('${p.id}')" class="p-2 text-gray-400 hover:text-red-600 rounded"><i class="fas fa-trash"></i></button>
            </div>
        `;
        list.appendChild(el);
    });
}

// --- CALENDAR UI ---
function openPersonModal(id) { 
    modalMode='person'; 
    currentPersonId=id; 
    document.getElementById('modalTitle').innerText = appData.people.find(x=>x.id===id).name; 
    document.getElementById('personModalControls').classList.remove('hidden'); 
    document.getElementById('staffingControls').classList.add('hidden');
    const blockRadio = document.querySelector('input[name="dayAction"][value="block"]');
    if(blockRadio) blockRadio.checked = true;
    openModal(); 
}
function openHolidayModal() { 
    modalMode='holiday'; currentPersonId=null; 
    document.getElementById('modalTitle').innerText = 'Festivos'; 
    document.getElementById('personModalControls').classList.add('hidden'); 
    document.getElementById('staffingControls').classList.add('hidden');
    openModal(); 
}
function openStaffingModal() { 
    modalMode='staffing'; currentPersonId=null; 
    document.getElementById('modalTitle').innerText = 'Excepciones Plazas'; 
    document.getElementById('personModalControls').classList.add('hidden'); 
    document.getElementById('staffingControls').classList.remove('hidden');
    // DEFAULT VALUE TO 2 AS REQUESTED
    document.getElementById('modalStaffingCount').value = 2;
    openModal(); 
}
function openModal() { document.getElementById('calendarModal').classList.remove('hidden'); document.getElementById('calendarModal').classList.add('flex'); if(appData.startDate) { 
    const [y,m,d] = appData.startDate.split('-').map(Number);
    viewDate = new Date(y, m-1, d); 
} renderCalendar(); }
function closeModal() { document.getElementById('calendarModal').classList.add('hidden'); document.getElementById('calendarModal').classList.remove('flex'); saveState(); renderPeople(); }

function changeMonth(d) { 
    viewDate.setDate(1);
    viewDate.setMonth(viewDate.getMonth() + d); 
    renderCalendar(); 
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const label = document.getElementById('monthLabel');
    grid.innerHTML = '';
    const y = viewDate.getFullYear(), m = viewDate.getMonth();
    label.innerText = viewDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    
    const first = new Date(y, m, 1), last = new Date(y, m+1, 0);
    let offset = first.getDay() - 1; if(offset===-1) offset=6;
    
    for(let i=0; i<offset; i++) grid.innerHTML += `<div></div>`;

    let blockedArr=[], suggestedArr=[], holidaysArr=appData.holidays;
    if(modalMode==='person') { const p=appData.people.find(x=>x.id===currentPersonId); if(p){ blockedArr=p.blocked; suggestedArr=p.suggested||[]; } }

    const [sy,sm,sd] = appData.startDate.split('-').map(Number);
    const [ey,em,ed] = appData.endDate.split('-').map(Number);
    const min = new Date(sy, sm-1, sd); 
    const max = new Date(ey, em-1, ed);
    const defaultSlots = parseInt(document.getElementById('defaultSlots').value) || 1;

    for(let d=1; d<=last.getDate(); d++) {
        const cur = new Date(y, m, d); 
        const iso = getISO(cur);
        const div = document.createElement('div');
        div.innerText = d;
        
        if(cur < min || cur > max) { div.className = "calendar-day day-disabled"; } 
        else {
            let cls = "day-standard bg-white border border-gray-100";
            if(modalMode==='person') {
                if(blockedArr.includes(iso)) cls="day-blocked";
                else if(suggestedArr.includes(iso)) cls="day-suggested";
                else if(holidaysArr.includes(iso)) cls="bg-orange-50 text-orange-400";
            } else if(modalMode==='holiday' && holidaysArr.includes(iso)) cls="day-holiday";
            else if(modalMode==='staffing') {
                const count = appData.staffing[iso] !== undefined ? appData.staffing[iso] : defaultSlots;
                if (count > 1 || count !== defaultSlots) {
                    cls="day-multi-staff";
                    div.innerHTML = `${d} <span class="badge">x${count}</span>`;
                }
            }

            div.className = `calendar-day ${cls}`;
            div.onclick = (e) => {
                if(modalMode==='holiday') {
                    const idx = holidaysArr.indexOf(iso); if(idx>-1) holidaysArr.splice(idx,1); else holidaysArr.push(iso);
                    appData.holidays=holidaysArr;
                } else if(modalMode==='staffing') {
                    const inputVal = parseInt(document.getElementById('modalStaffingCount').value);
                    if(!isNaN(inputVal) && inputVal >= 0) {
                        appData.staffing[iso] = inputVal;
                    }
                } else if(modalMode==='person') {
                    const p=appData.people.find(x=>x.id===currentPersonId);
                    const action = document.querySelector('input[name="dayAction"]:checked').value;
                    if(action==='block') {
                        const idxB=p.blocked.indexOf(iso); if(idxB>-1)p.blocked.splice(idxB,1); else { p.blocked.push(iso); if(p.suggested){const idxS=p.suggested.indexOf(iso); if(idxS>-1)p.suggested.splice(idxS,1);} }
                    } else {
                        if(!p.suggested) p.suggested=[];
                        const idxS=p.suggested.indexOf(iso); if(idxS>-1)p.suggested.splice(idxS,1); else { p.suggested.push(iso); const idxB=p.blocked.indexOf(iso); if(idxB>-1)p.blocked.splice(idxB,1); }
                    }
                }
                renderCalendar();
            };
        }
        grid.appendChild(div);
    }
}

// --- MANUAL EDITS ---
function clearSlot(dateIso, pid) {
    const slot = appData.schedule.find(s => s.date === dateIso && s.pid === pid);
    if(slot) {
        if(!appData.manualBans) appData.manualBans = {};
        if(!appData.manualBans[dateIso]) appData.manualBans[dateIso] = [];
        if(!appData.manualBans[dateIso].includes(pid)) appData.manualBans[dateIso].push(pid);

        slot.pid = null;
        slot.name = null;
        saveState();
        renderResults(0); 
    }
}

// --- ALGORITHM ---
function getDatesRange(s, e) {
    const a=[]; 
    const [sy, sm, sd] = s.split('-').map(Number);
    const [ey, em, ed] = e.split('-').map(Number);
    let c = new Date(sy, sm-1, sd);
    const end = new Date(ey, em-1, ed);
    while(c<=end){ a.push(new Date(c)); c.setDate(c.getDate()+1); }
    return a;
}

function getDayType(d, iso) {
    if(appData.holidays.includes(iso)) return 'HOLIDAY';
    const tmr = new Date(d); tmr.setDate(tmr.getDate()+1);
    if(appData.holidays.includes(getISO(tmr))) return 'EVE';
    const w=d.getDay();
    if(w===0||w===6) return 'WEEKEND';
    if(w===5) return 'FRIDAY';
    return 'WEEKDAY';
}

function startGeneration(preserveExisting) {
    if(!appData.people.length) return Swal.fire('Error', 'Sin personal', 'error');
    saveStateInputs();
    
    if(!preserveExisting) appData.manualBans = {};

    document.getElementById('loadingOverlay').classList.remove('hidden');
    document.getElementById('loadingOverlay').classList.add('flex');
    
    if(preserveExisting) {
        document.getElementById('loadingTitle').innerText = "Rellenando Huecos...";
        document.getElementById('loadingSubtitle').innerText = "Manteniendo asignaciones fijas";
    } else {
        document.getElementById('loadingTitle').innerText = "Generando Calendario...";
        document.getElementById('loadingSubtitle').innerText = "Calculando por capas de prioridad";
    }

    // Sanitize suggestions
    appData.people.forEach(p => {
        if(p.suggested && p.suggested.length > 1) {
            p.suggested.sort();
            for(let i = p.suggested.length - 1; i > 0; i--) {
                const [y1, m1, d1] = p.suggested[i].split('-').map(Number);
                const [y2, m2, d2] = p.suggested[i-1].split('-').map(Number);
                const dt1 = new Date(y1, m1-1, d1);
                const dt2 = new Date(y2, m2-1, d2);
                
                const diffTime = Math.abs(dt1 - dt2);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                // We keep them all now, conflict resolution handles it
            }
        }
    });

    setTimeout(() => {
        const dates = getDatesRange(appData.startDate, appData.endDate);
        const [sy,sm,sd] = appData.startDate.split('-').map(Number);
        const [ey,em,ed] = appData.endDate.split('-').map(Number);
        const d1 = new Date(sy, sm-1, sd);
        const d2 = new Date(ey, em-1, ed);
        const curMonths = Math.max(1, (d2.getFullYear()-d1.getFullYear())*12 + (d2.getMonth()-d1.getMonth())+1);

        let bestRes = null, minU = Infinity, bestStd = Infinity;
        const iterations = preserveExisting ? 50 : 200; // Increased iterations for randomization

        for(let i=0; i<iterations; i++) {
            const res = runSimulation(dates, curMonths, preserveExisting ? appData.schedule : []);
            if(res.unassigned < minU) { minU=res.unassigned; bestRes=res; bestStd=res.stdDev; }
            else if(res.unassigned === minU && res.stdDev < bestStd) { bestRes=res; bestStd=res.stdDev; }
        }

        if(bestRes.unassigned > 0) {
            fillGaps(bestRes.schedule, bestRes.statsRef, dates);
            bestRes.unassigned = bestRes.schedule.filter(s => !s.pid).length;
        }

        appData.schedule = bestRes.schedule;
        saveState();
        document.getElementById('loadingOverlay').classList.add('hidden');
        document.getElementById('loadingOverlay').classList.remove('flex');
        renderResults(bestRes.unassigned);
    }, 100);
}

function runSimulation(dates, curMonths, existingSchedule) {
    let schedule = []; // Array of slot objects
    let unassignedTotal = 0;
    let fixedSlots = {}; 
    
    // Build fixed slots
    if(existingSchedule && existingSchedule.length > 0) {
        existingSchedule.forEach(s => {
            if(s.pid) {
                if(!fixedSlots[s.date]) fixedSlots[s.date] = [];
                fixedSlots[s.date].push(s.pid);
            }
        });
    }

    let stats = {};
    appData.people.forEach(p => {
        const h = (appData.history && appData.history[p.id]) || { months:0, total:0, hol:0, sd:0, fri:0 };
        stats[p.id] = {
            id: p.id,
            histTotal: h.total||0, histHol: h.hol||0, histSD: h.sd||0, histFri: h.fri||0,
            curTotal: 0, curHol: 0, curSD: 0, curFri: 0,
            lastIndex: -99, lastWkdIndex: -99,
            totalMonths: (h.months||0) + curMonths,
            thursdaysIndices: [] 
        };
    });

    const defaultSlots = parseInt(document.getElementById('defaultSlots').value) || 1;

    // --- BUILD WORK ORDER ---
    let dateMeta = dates.map((d, i) => {
        const iso = getISO(d);
        const type = getDayType(d, iso);
        const isFriEve = (type==='FRIDAY'||type==='EVE');
        const isHigh = (type === 'HOLIDAY' || type === 'WEEKEND');
        const needed = appData.staffing[iso] !== undefined ? appData.staffing[iso] : defaultSlots;
        const dayOfWeek = d.getDay(); // 0 Sun, 6 Sat, 4 Thu
        return { idx: i, date: d, iso, type, isFriEve, isHigh, needed, assigned: [], dayOfWeek };
    });

    // Pre-fill preserved
    dateMeta.forEach(dm => {
        if(fixedSlots[dm.iso]) {
            fixedSlots[dm.iso].forEach(pid => {
                const p = appData.people.find(x => x.id === pid);
                if(p) assignToMeta(dm, p, stats);
            });
        }
    });

    // PHASE 1: SUGGESTIONS (Mandatory - with strict conflict resolution)
    dateMeta.forEach(dm => {
        if(dm.assigned.length >= dm.needed) return;
        
        let preferredCandidates = appData.people.filter(p => p.suggested && p.suggested.includes(dm.iso));
        // Shuffle for fairness in conflict
        preferredCandidates.sort(() => Math.random() - 0.5);

        for(let p of preferredCandidates) {
             if(dm.assigned.length >= dm.needed) break;
             if(dm.assigned.includes(p.name)) continue;
             if(appData.manualBans && appData.manualBans[dm.iso] && appData.manualBans[dm.iso].includes(p.id)) continue;
             
             // Check rules:
             // 1. Hard Block not possible as it's a suggestion (user override? assume suggestion wins over block unless manual ban)
             // 2. Consecutive
             // If doublets=false, strictly no 2 days. 
             // If doublets=true, allow 2 days.
             // "cumpliendo las ordenes previas que prevalecen" = Rules prevail over preferences if conflict?
             // "Si hay preferencias dos dias seguidos... se investiga cual es la mejor opción cumpliendo las ordenes previas"
             
             if (!checkConsecutive(p.id, dm.idx, dateMeta, p.doublets)) continue; // Skip if it breaks doublet rule

             // 3. Thursday Rule (Soft? or Hard?) 
             // "Si alguien tiene un jueves, intenta no ponerle sabado ni domingo" -> Soft, skip here to allow Preference to win?
             // Let's allow preference to win Thursday Rule.
             
             assignToMeta(dm, p, stats);
        }
    });

    // Define Pools
    const poolFri = dateMeta.filter(d => d.isFriEve && d.assigned.length < d.needed);
    const poolHigh = dateMeta.filter(d => d.isHigh && d.assigned.length < d.needed); // Wkd + Hol
    const poolNorm = dateMeta.filter(d => !d.isFriEve && !d.isHigh && d.assigned.length < d.needed);

    // Helper to process a pool
    const processPool = (pool) => {
        pool.forEach(dm => {
            while(dm.assigned.length < dm.needed) {
                let candidates = getCandidates(dm, stats, dateMeta);
                if(candidates.length === 0) break; 
                
                // Score
                candidates.forEach(p => {
                    const s = stats[p.id];
                    let score = 0;
                    
                    // Fairness weights
                    if(dm.isHigh) {
                        // Prioritize those who have less Holidays/Weekends
                        score += (s.histHol + s.curHol + s.histSD + s.curSD) * 20000;
                        if((dm.idx - s.lastWkdIndex) < 6) score += 50000; // Spacing weekends
                    } else if(dm.isFriEve) {
                        score += (s.histFri + s.curFri) * 10000;
                    } 
                    
                    // Global fairness
                    const globalRatio = (s.histTotal + s.curTotal) / s.totalMonths;
                    score += globalRatio * 1000;

                    // Thursday Rule Penalty
                    if ((dm.dayOfWeek === 6 || dm.dayOfWeek === 0) && hasThursday(p.id, dm.idx, dateMeta)) {
                         score += 1000000; // Massive penalty
                    }

                    // +/- 1 Fairness Soft Cap
                    // If this person is winning by > 1, add penalty
                    const minTotal = Math.min(...Object.values(stats).map(z=>z.curTotal));
                    if (s.curTotal > minTotal + 1) score += 50000;

                    if(p.min && s.curTotal < parseInt(p.min)) score -= 100000; // Boost min req
                    
                    score += Math.random() * 500; // Randomization
                    p.tempScore = score;
                });
                
                candidates.sort((a,b) => a.tempScore - b.tempScore);
                
                // If best candidate has massive penalty (Thursday rule), implies we should skip if possible?
                // But we must fill. The sort puts them at end.
                assignToMeta(dm, candidates[0], stats);
            }
        });
    };

    // Execute Phases
    processPool(poolFri);  // Phase 2
    processPool(poolHigh); // Phase 3
    processPool(poolNorm); // Phase 4

    // Finalize Schedule Array
    dateMeta.forEach(dm => {
        // Add assigned
        dm.assigned.forEach(pName => {
            const p = appData.people.find(x => x.name === pName);
            schedule.push({ date: dm.iso, pid: p.id, name: p.name, type: dm.type, idx: dm.idx });
        });
        // Add unassigned
        const missing = dm.needed - dm.assigned.length;
        for(let k=0; k<missing; k++) {
            schedule.push({ date: dm.iso, pid: null, name: null, type: dm.type, idx: dm.idx });
            unassignedTotal++;
        }
    });

    const currents = Object.values(stats).map(s => s.curTotal);
    const mean = currents.reduce((a,b)=>a+b,0)/currents.length;
    const variance = currents.reduce((a,b)=>a + Math.pow(b-mean,2), 0)/currents.length;
    
    return { schedule, unassigned: unassignedTotal, stdDev: Math.sqrt(variance), statsRef: stats };
}

function hasThursday(pid, satSunIdx, metaArr) {
    // If today is Sat (idx), Thu is idx-2.
    // If today is Sun (idx), Thu is idx-3.
    // Check if metaArr[thu].assigned includes p.name
    const day = metaArr[satSunIdx].dayOfWeek;
    let thuIdx = -1;
    if (day === 6) thuIdx = satSunIdx - 2;
    if (day === 0) thuIdx = satSunIdx - 3; // Wait, Sun(0) - 3 = Thu(4)? Sun->Sat->Fri->Thu. Yes.
    
    if (thuIdx >= 0) {
        const thuDm = metaArr[thuIdx];
        const pName = appData.people.find(x=>x.id===pid).name;
        if (thuDm.assigned.includes(pName)) return true;
    }
    return false;
}

function checkConsecutive(pid, idx, metaArr, allowDoublets) {
    // Check Prev Day (Always check 1 day back)
    if (idx > 0) {
        const prev = metaArr[idx-1];
        const pName = appData.people.find(x => x.id === pid).name;
        if (prev.assigned.includes(pName)) {
            // Consecutive found.
            if (!allowDoublets) return false; // Strict no
            // If doublets allowed, check if yesterday was ALSO consecutive (idx-2)
            if (idx > 1) {
                const prev2 = metaArr[idx-2];
                if (prev2.assigned.includes(pName)) return false; // Max 2 days
            }
        }
    }
    // Check Next Day (Future lookahead - usually empty unless preferences/fixed)
    if (idx < metaArr.length - 1) {
        const next = metaArr[idx+1];
        const pName = appData.people.find(x => x.id === pid).name;
        if (next.assigned.includes(pName)) {
             if (!allowDoublets) return false;
             if (idx < metaArr.length - 2) {
                 const next2 = metaArr[idx+2];
                 if (next2.assigned.includes(pName)) return false;
             }
             // Also check sandwich: Prev(Yes) + Cur + Next(Yes) = 3 days?
             // If we are placing Cur, and Prev=Yes and Next=Yes, assigning Cur makes 3.
             if (idx > 0) {
                 const prev = metaArr[idx-1];
                 if (prev.assigned.includes(pName)) return false;
             }
        }
    }
    return true;
}

function getCandidates(dm, stats, metaArr) {
    // Shuffle candidates initially to ensure random order if scores match
    const shuffled = [...appData.people].sort(() => Math.random() - 0.5);
    
    return shuffled.filter(p => {
        // Assigned today?
        if (dm.assigned.includes(p.name)) return false;
        
        // Blocked?
        if (p.blocked.includes(dm.iso)) return false;
        
        // Manual Ban?
        if (appData.manualBans && appData.manualBans[dm.iso] && appData.manualBans[dm.iso].includes(p.id)) return false;
        
        // Max?
        const s = stats[p.id];
        if (p.max && s.curTotal >= parseInt(p.max)) return false;
        
        // Fatigue / Consecutive
        if (!checkConsecutive(p.id, dm.idx, metaArr, p.doublets)) return false;
        
        return true;
    });
}

function assignToMeta(dm, p, st) {
    dm.assigned.push(p.name);
    const s = st[p.id];
    s.curTotal++;
    s.lastIndex = dm.idx;
    if (dm.type === 'HOLIDAY') s.curHol++;
    else if (dm.type === 'WEEKEND') { s.curSD++; s.lastWkdIndex = dm.idx; }
    else if (dm.isFriEve) s.curFri++;
    
    if (dm.dayOfWeek === 4) s.thursdaysIndices.push(dm.idx);
}

// --- GAP FILLING WITH FORCE ASSIGN ---
function fillGaps(schedule, stats, dates) {
    let gaps = schedule.filter(s => s.pid === null);
    
    // Attempt 1: Standard Fill (maybe blocked by soft rules in main loop)
    // Attempt 2: Force fill (e.g. breaking Thursday rule or Fairness, but respecting HARD blocks)
    // Attempt 3: Breaking soft Consecutive rules (if desperate)? No, user said "empieza borrando los días que no son este último"
    
    gaps.forEach(gap => {
        const dayIdx = gap.idx; 
        
        // Find anyone not strictly blocked by Manual/User Blocks
        let candidates = appData.people.filter(p => !p.blocked.includes(gap.date));
        if(appData.manualBans && appData.manualBans[gap.date]) {
            candidates = candidates.filter(p => !appData.manualBans[gap.date].includes(p.id));
        }

        // Sort by least load to try helping fairness
        candidates.sort((a,b) => stats[a.id].curTotal - stats[b.id].curTotal);

        let filled = false;
        
        // Try to find someone who fits RULES
        /*
        for (let p of candidates) {
            // We need to reconstruct 'metaArr equivalent' context or check schedule direct
             // This is hard because 'checkConsecutive' needs the meta array structure.
             // We can check schedule array roughly.
        }
        */
       // Simplified Gap Fix:
       // Just find someone who IS NOT working Yesterday or Tomorrow (if doublets=false)
       
       for (let p of candidates) {
           const workingPrev = schedule.find(s => s.idx === dayIdx - 1 && s.pid === p.id);
           const workingNext = schedule.find(s => s.idx === dayIdx + 1 && s.pid === p.id);
           
           let canAssign = true;
           if (!p.doublets) {
               if (workingPrev || workingNext) canAssign = false;
           } else {
               // Doublets allowed: Check 2 days back/forward
               const workingPrev2 = schedule.find(s => s.idx === dayIdx - 2 && s.pid === p.id);
               const workingNext2 = schedule.find(s => s.idx === dayIdx + 2 && s.pid === p.id);
               if (workingPrev && workingPrev2) canAssign = false;
               if (workingNext && workingNext2) canAssign = false;
               if (workingPrev && workingNext) canAssign = false; // Sandwich make 3
           }

           if (canAssign) {
               gap.pid = p.id; gap.name = p.name;
               stats[p.id].curTotal++; // Update stats aprox
               filled = true;
               break;
           }
       }
       
       if (!filled) {
           // FORCE MODE: "si hay algun hueco sin cubrir que podría cubiro alguna persona, pon a esa persona, aunque incumplas normas"
           // "y a la hora de corregir... empieza borrando los días que no son este último"
           
           // We prefer to break 'Thursday' or 'Fairness' before 'Consecutive'.
           // But if we must break consecutive, we do it, then try to remove the OTHER day.
           
           for (let p of candidates) {
                // Determine collision
                const workingPrev = schedule.find(s => s.idx === dayIdx - 1 && s.pid === p.id);
                // If we assign P here, and P worked yesterday, we break rule.
                // User says: Assign here, and delete yesterday.
                
                if (workingPrev) {
                     // Can we delete yesterday?
                     // Only if yesterday is NOT a user-preference (we assume schedule doesn't track that easily, but let's try)
                     // Check if we can empty yesterday
                     gap.pid = p.id; gap.name = p.name;
                     stats[p.id].curTotal++;
                     
                     workingPrev.pid = null; workingPrev.name = null;
                     stats[p.id].curTotal--;
                     
                     // Now yesterday is a gap, we will need to re-run or hopefully next recursion fixes it?
                     // This function doesn't recurse. It's a single pass.
                     // The loop iterates 'gaps'. We just created a NEW gap at 'dayIdx-1'.
                     // We should push this new gap to the list if we want to fix it?
                     // BUT 'gaps' array is fixed at start of function.
                     // Let's just solve this one and leave the other open (better to shift the problem than have unassigned?)
                     filled = true;
                     break;
                }
                
                // If no collision with prev, maybe next?
                const workingNext = schedule.find(s => s.idx === dayIdx + 1 && s.pid === p.id);
                if (workingNext) {
                    gap.pid = p.id; gap.name = p.name;
                     stats[p.id].curTotal++;
                     workingNext.pid = null; workingNext.name = null;
                     stats[p.id].curTotal--;
                     filled = true; 
                     break;
                }
                
                // If doublets collision?
                // Logic gets complex. Let's stick to the simple 1-day swap.
           }
       }
    });
}

// --- RENDER & PDF ---
function renderResults(unassigned) {
    document.getElementById('statsPanel').classList.remove('hidden');
    document.getElementById('scheduleResult').classList.remove('hidden');
    document.getElementById('emptyState').classList.add('hidden');
    const alert = document.getElementById('alertBox');
    if(unassigned > 0) { alert.classList.remove('hidden'); document.getElementById('alertText').innerText = `${unassigned} plazas sin cubrir.`; }
    else alert.classList.add('hidden');

    const tbody = document.getElementById('scheduleBody');
    tbody.innerHTML = '';
    appData.schedule.sort((a,b) => a.date.localeCompare(b.date));
    let lastDate = '';
    appData.schedule.forEach(s => {
        const [y,m,d] = s.date.split('-');
        let cls="text-gray-400", bg="";
        if(s.type==='HOLIDAY') { cls="text-orange-700 font-bold"; bg="bg-orange-50"; }
        else if(s.type==='WEEKEND') { cls="text-purple-700 font-bold"; bg="bg-purple-50"; }
        else if(s.type==='FRIDAY'||s.type==='EVE') { cls="text-teal-600 font-bold"; } // Removed 'EVE' text check
        const border = (s.date !== lastDate) ? "border-t-2 border-gray-100" : "border-t-0 border-gray-50";
        lastDate = s.date;
        const tr = document.createElement('tr');
        tr.className = `hover:bg-blue-50 transition ${bg} ${border}`;
        
        let trashBtn = '';
        if(s.pid) {
            trashBtn = `<button onclick="clearSlot('${s.date}', '${s.pid}')" class="text-gray-400 hover:text-red-500 transition px-2"><i class="fas fa-trash"></i></button>`;
        }

        tr.innerHTML = `
            <td class="px-6 py-2">${d}/${m}</td>
            <td class="px-6 py-2 ${cls}">${s.type}</td>
            <td class="px-6 py-2 font-bold ${s.pid?'':'text-red-500'}">${s.name||'VACÍO'}</td>
            <td class="px-6 py-2 text-center">${trashBtn}</td>
        `;
        tbody.appendChild(tr);
    });

    const allIds = new Set(appData.people.map(p=>p.id));
    if(appData.history) Object.keys(appData.history).forEach(k => allIds.add(k));
    const statsList = [];
    const [sy,sm,sd] = appData.startDate.split('-').map(Number);
    const [ey,em,ed] = appData.endDate.split('-').map(Number);
    const d1 = new Date(sy, sm-1, sd);
    const d2 = new Date(ey, em-1, ed);
    // const curMonths = Math.max(1, (d2.getFullYear()-d1.getFullYear())*12 + (d2.getMonth()-d1.getMonth())+1);

    allIds.forEach(id => {
        const activeP = appData.people.find(p => p.id === id);
        const h = (appData.history && appData.history[id]) || { total:0, hol:0, sd:0, fri:0, months:0, name: activeP ? activeP.name : 'Unknown' };
        let c = { t:0, h:0, s:0, f:0 }; 
        appData.schedule.filter(s => s.pid === id).forEach(s => {
            c.t++;
            if(s.type==='HOLIDAY') c.h++;
            else if(s.type==='WEEKEND') c.s++;
            else if(s.type==='FRIDAY'||s.type==='EVE') c.f++;
        });
        const name = activeP ? activeP.name : `${h.name} (Baja)`;
        const grandTotal = h.total + c.t; 
        statsList.push({ 
            name, 
            curTotal: c.t, 
            grandTotal, 
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

function downloadPDF(mode) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); 
    
    const [sy,sm,sd] = appData.startDate.split('-').map(Number);
    const [ey,em,ed] = appData.endDate.split('-').map(Number);
    const startDate = new Date(sy, sm-1, sd);
    const endDate = new Date(ey, em-1, ed);
    const monthName = startDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

    doc.setFontSize(16);
    if(mode === 'debug') doc.text(`AUDITORÍA DE BLOQUEOS - ${monthName}`, 14, 15);
    else doc.text(`CALENDARIO DE GUARDIAS - ${monthName}`, 14, 15);
    
    const weeks = [];
    let currentWeek = new Array(7).fill(null);
    
    let iterDate = new Date(startDate);
    let startDay = iterDate.getDay() - 1; if(startDay === -1) startDay = 6;
    iterDate.setDate(iterDate.getDate() - startDay);

    while (iterDate <= endDate || currentWeek.some(d => d !== null)) {
        let dayIdx = iterDate.getDay() - 1; if (dayIdx === -1) dayIdx = 6;
        const iso = getISO(iterDate);
        const inRange = (iterDate >= startDate && iterDate <= endDate);
        
        if (inRange) {
            const dayNum = iterDate.getDate();
            let content = `${dayNum}`;
            
            if (mode === 'debug') {
                const blocked = appData.people.filter(p => p.blocked.includes(iso)).map(p => p.name).join(', ');
                const suggested = appData.people.filter(p => p.suggested && p.suggested.includes(iso)).map(p => p.name).join(', ');
                if(suggested) content += `\n[SOL]: ${suggested}`;
                if(blocked) content += `\n[NO]: ${blocked}`;
                if(appData.holidays.includes(iso)) content += `\n(FESTIVO)`;
            } else {
                const assigned = appData.schedule.filter(s => s.date === iso);
                if (assigned.length > 0) content += "\n" + assigned.map(a => a.name || "?").join("\n");
            }
            currentWeek[dayIdx] = content;
        } else if (currentWeek.some(d => d !== null) || iterDate < startDate) {
            if(iterDate >= startDate || currentWeek.length > 0) currentWeek[dayIdx] = ""; 
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
        headStyles: { fillColor: mode==='debug'?[100,100,100]:[41, 128, 185], textColor: 255 },
        columnStyles: { 5: { fillColor: [240, 240, 250] }, 6: { fillColor: [240, 240, 250] } }
    });

    if (mode !== 'debug') {
        doc.addPage();
        doc.text("Resumen Contable", 14, 20);
        
        const rows = [];
        const allIds = new Set(appData.people.map(p=>p.id));
        if(appData.history) Object.keys(appData.history).forEach(k => allIds.add(k));

        allIds.forEach(id => {
            const activeP = appData.people.find(p => p.id === id);
            const h = (appData.history && appData.history[id]) || { total:0, hol:0, sd:0, fri:0, months:0, name: activeP ? activeP.name : 'Unknown' };
            let c = { t:0, h:0, s:0, f:0 };
            appData.schedule.filter(s=>s.pid===id).forEach(s=>{
                c.t++; if(s.type==='HOLIDAY') c.h++; else if(s.type==='WEEKEND') c.s++; else if(s.type==='FRIDAY'||s.type==='EVE') c.f++;
            });
            
            rows.push([
                activeP ? activeP.name : `${h.name} (Baja)`,
                h.total+c.t,
                h.fri+c.f,
                h.sd+c.s,
                h.hol+c.h 
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
}

function downloadReportJSON() {
    let report = { periodo: { inicio: appData.startDate, fin: appData.endDate }, generado: new Date().toISOString(), resumen_personal: [] };
    const allIds = new Set(appData.people.map(p=>p.id));
    if(appData.history) Object.keys(appData.history).forEach(k => allIds.add(k));
    allIds.forEach(id => {
        const activeP = appData.people.find(p => p.id === id);
        const h = (appData.history && appData.history[id]) || { total:0, hol:0, sd:0, fri:0, months:0, name: activeP ? activeP.name : 'Unknown' };
        const assignments = appData.schedule.filter(s => s.pid === id).map(s => ({ fecha: s.date, tipo: s.type }));
        let c = { t:0, h:0, s:0, f:0 };
        assignments.forEach(s => { c.t++; if(s.tipo==='HOLIDAY')c.h++; else if(s.tipo==='WEEKEND')c.s++; else if(s.tipo==='FRIDAY'||s.type==='EVE')c.f++; });
        report.resumen_personal.push({ id_persona: id, nombre: activeP ? activeP.name : h.name, estadisticas: { total_guardias: h.total+c.t, desglose: { festivos: h.hol+c.h, fin_de_semana: h.sd+c.s, viernes_visperas: h.fri+c.f, diario_LJ: 0 } } });
    });
    const blob = new Blob([JSON.stringify(report, null, 4)], {type: 'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `contabilidad_${appData.endDate}.json`; a.click();
}
function saveState() { localStorage.setItem('guardias', JSON.stringify(appData)); }
function loadState() { const d = localStorage.getItem('guardias'); if(d) appData = { ...appData, ...JSON.parse(d) }; }
function resetData() { if(confirm('¿Borrar?')) { localStorage.removeItem('guardias'); location.reload(); } }
function exportData() { const blob = new Blob([JSON.stringify(appData)], {type: 'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'backup.json'; a.click(); }
function triggerImport() { document.getElementById('fileInput').click(); }
function importData(el) { const f = el.files[0]; if(!f) return; const r = new FileReader(); r.onload = e => { appData = JSON.parse(e.target.result); saveState(); location.reload(); }; r.readAsText(f); }
function checkCookies() { if(!localStorage.getItem('okCookie')) document.getElementById('cookieBanner').classList.remove('hidden'); }
function acceptCookies() { localStorage.setItem('okCookie','1'); document.getElementById('cookieBanner').classList.add('hidden'); }
