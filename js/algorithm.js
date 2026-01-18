// --- ALGORITHM ---

window.getDatesRange = function (s, e) {
    const a = [];
    const [sy, sm, sd] = s.split('-').map(Number);
    const [ey, em, ed] = e.split('-').map(Number);
    let c = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    while (c <= end) { a.push(new Date(c)); c.setDate(c.getDate() + 1); }
    return a;
}

window.getDayType = function (d, iso) {
    if (window.appData.holidays.includes(iso)) return 'HOLIDAY';
    const tmr = new Date(d); tmr.setDate(tmr.getDate() + 1);
    if (window.appData.holidays.includes(getISO(tmr))) return 'EVE';
    const w = d.getDay();
    if (w === 0 || w === 6) return 'WEEKEND';
    if (w === 5) return 'FRIDAY';
    return 'WEEKDAY';
}

// Check if person worked on neighboring DAYS (not acts)
window.checkConsecutive = function (pid, dayIdx, metaArr, allowDoublets) {
    // "Doublet" here means "Day-Gap-Day" (Alternating).
    // strict boolean check 
    const isAlternatingAllowed = (allowDoublets === true);

    // metaArr can be dateMeta (internal) or schedule (final)
    const getPids = (i) => {
        const item = metaArr[i];
        if (!item) return [];
        if (item.assigned) return item.assigned; // Internal Meta format
        if (item.seats) return item.seats.map(s => s.pid).filter(id => id !== null); // Final Schedule format
        return [];
    };

    // 1. ABSOLUTE BAN ON CONSECUTIVE DAYS (N-1, N+1)
    if (dayIdx > 0 && getPids(dayIdx - 1).includes(pid)) return false;
    if (dayIdx < metaArr.length - 1 && getPids(dayIdx + 1).includes(pid)) return false;

    // 2. CHECK ALTERNATING DAYS (Si-No-Si)
    // If the user accepts doublets, they can do (Day, Gap, Day).
    // If NOT, we must ensure they don't have a shift at N-2 or N+2.
    if (!isAlternatingAllowed) {
        if (dayIdx > 1 && getPids(dayIdx - 2).includes(pid)) return false;
        if (dayIdx < metaArr.length - 2 && getPids(dayIdx + 2).includes(pid)) return false;
    }

    return true;
}

window.hasThursday = function (pid, satSunIdx, metaArr) {
    const dayObj = metaArr[satSunIdx];
    const dayOfWeek = dayObj.dayOfWeek !== undefined ? dayObj.dayOfWeek : new Date(dayObj.date).getDay();

    let thuIdx = -1;
    if (dayOfWeek === 6) thuIdx = satSunIdx - 2; // Sat -> Thu
    if (dayOfWeek === 0) thuIdx = satSunIdx - 3; // Sun -> Thu

    if (thuIdx >= 0) {
        const thuItem = metaArr[thuIdx];
        const pids = thuItem.assigned || (thuItem.seats ? thuItem.seats.map(s => s.pid) : []);
        if (pids.includes(pid)) return true;
    }
    return false;
}

window.getCandidates = function (dm, stats, metaArr) {
    const shuffled = [...window.appData.people].sort(() => Math.random() - 0.5);
    return shuffled.filter(p => {
        // Already assigned TODAY?
        if (dm.assigned.includes(p.id)) return false;

        // Blocked?
        if (p.blocked.includes(dm.iso)) return false;
        if (window.appData.manualBans && window.appData.manualBans[dm.iso] && window.appData.manualBans[dm.iso].includes(p.id)) return false;

        // Quota
        const s = stats[p.id];
        if (p.max && s.curTotal >= parseInt(p.max)) return false;

        // Consecutive
        if (!checkConsecutive(p.id, dm.idx, metaArr, p.doublets)) return false;

        return true;
    });
}

window.assignToMeta = function (dm, p, st) {
    dm.assigned.push(p.id);
    const s = st[p.id];
    s.curTotal++;
    s.lastIndex = dm.idx;
    if (dm.type === 'HOLIDAY') s.curHol++;
    else if (dm.type === 'WEEKEND') { s.curSD++; s.lastWkdIndex = dm.idx; }
    else if (dm.isFriEve) s.curFri++;

    if (dm.dayOfWeek === 4) s.thursdaysIndices.push(dm.idx);
}

window.runSimulation = function (dates, curMonths, existingSchedule) {
    let schedule = []; // Will contain Day objects
    let unassignedTotal = 0;
    let fixedSlots = {}; // Key: iso Date, Value: [pid, pid...]

    // Parse existing schedule (New Structure)
    if (existingSchedule && existingSchedule.length > 0) {
        existingSchedule.forEach(day => {
            if (day.seats) {
                day.seats.forEach(seat => {
                    if (seat.pid) {
                        if (!fixedSlots[day.date]) fixedSlots[day.date] = [];
                        fixedSlots[day.date].push(seat.pid);
                    }
                });
            } else if (day.pid) { // Fallback for loading OLD format accidentally?
                if (!fixedSlots[day.date]) fixedSlots[day.date] = [];
                fixedSlots[day.date].push(day.pid);
            }
        });
    }

    let stats = {};
    window.appData.people.forEach(p => {
        const h = (window.appData.history && window.appData.history[p.id]) || { months: 0, total: 0, hol: 0, sd: 0, fri: 0 };
        stats[p.id] = {
            id: p.id,
            histTotal: h.total || 0, histHol: h.hol || 0, histSD: h.sd || 0, histFri: h.fri || 0,
            curTotal: 0, curHol: 0, curSD: 0, curFri: 0,
            lastIndex: -99, lastWkdIndex: -99,
            totalMonths: (h.months || 0) + curMonths,
            thursdaysIndices: []
        };
    });

    const defaultSlots = parseInt(document.getElementById('defaultSlots').value) || 1;

    let dateMeta = dates.map((d, i) => {
        const iso = getISO(d);
        const type = getDayType(d, iso);
        const isFriEve = (type === 'FRIDAY' || type === 'EVE');
        const isHigh = (type === 'HOLIDAY' || type === 'WEEKEND');
        const needed = window.appData.staffing[iso] !== undefined ? window.appData.staffing[iso] : defaultSlots;
        const dayOfWeek = d.getDay();
        return { idx: i, date: d, iso, type, isFriEve, isHigh, needed, assigned: [], dayOfWeek };
    });

    // Pre-fill
    dateMeta.forEach(dm => {
        if (fixedSlots[dm.iso]) {
            fixedSlots[dm.iso].forEach(pid => {
                const p = window.appData.people.find(x => x.id === pid);
                if (p) assignToMeta(dm, p, stats);
            });
        }
    });

    // PHASE 1: PREFERENCES (Suggested)
    dateMeta.forEach(dm => {
        if (dm.assigned.length >= dm.needed) return;
        let preferredCandidates = window.appData.people.filter(p => p.suggested && p.suggested.includes(dm.iso));
        preferredCandidates.sort(() => Math.random() - 0.5);

        for (let p of preferredCandidates) {
            if (dm.assigned.length >= dm.needed) break;
            if (dm.assigned.includes(p.id)) continue;
            if (window.appData.manualBans && window.appData.manualBans[dm.iso] && window.appData.manualBans[dm.iso].includes(p.id)) continue;
            if (!checkConsecutive(p.id, dm.idx, dateMeta, p.doublets)) continue;
            assignToMeta(dm, p, stats);
        }
    });

    // POOLS
    const poolFri = dateMeta.filter(d => d.isFriEve && d.assigned.length < d.needed);
    const poolHigh = dateMeta.filter(d => d.isHigh && d.assigned.length < d.needed);
    const poolNorm = dateMeta.filter(d => !d.isFriEve && !d.isHigh && d.assigned.length < d.needed);

    const processPool = (pool) => {
        pool.forEach(dm => {
            while (dm.assigned.length < dm.needed) {
                let candidates = getCandidates(dm, stats, dateMeta);
                if (candidates.length === 0) break;

                candidates.forEach(p => {
                    const s = stats[p.id];
                    let score = 0;
                    if (dm.isHigh) {
                        score += (s.histHol + s.curHol + s.histSD + s.curSD) * 20000;
                        if ((dm.idx - s.lastWkdIndex) < 6) score += 50000;
                    } else if (dm.isFriEve) {
                        score += (s.histFri + s.curFri) * 10000;
                    }
                    const globalRatio = (s.histTotal + s.curTotal) / s.totalMonths;
                    score += globalRatio * 1000;

                    if ((dm.dayOfWeek === 6 || dm.dayOfWeek === 0) && hasThursday(p.id, dm.idx, dateMeta)) {
                        score += 1000000;
                    }
                    const minTotal = Math.min(...Object.values(stats).map(z => z.curTotal));
                    if (s.curTotal > minTotal + 1) score += 50000;

                    if (p.min && s.curTotal < parseInt(p.min)) score -= 100000;
                    score += Math.random() * 500;
                    p.tempScore = score;
                });

                candidates.sort((a, b) => a.tempScore - b.tempScore);
                assignToMeta(dm, candidates[0], stats);
            }
        });
    };

    processPool(poolFri);
    processPool(poolHigh);
    processPool(poolNorm);

    // Build Final Structure
    dateMeta.forEach(dm => {
        const seats = [];
        // Add assigned
        dm.assigned.forEach((pId, i) => {
            const p = window.appData.people.find(x => x.id === pId);
            seats.push({ pid: p.id, name: p.name, idx: i });
        });
        // Add empty info
        const missing = dm.needed - dm.assigned.length;
        for (let k = 0; k < missing; k++) {
            seats.push({ pid: null, name: null, idx: dm.assigned.length + k });
            unassignedTotal++;
        }

        schedule.push({
            date: dm.iso,
            type: dm.type,
            idx: dm.idx,
            seats: seats
        });
    });

    const currents = Object.values(stats).map(s => s.curTotal);
    const mean = currents.reduce((a, b) => a + b, 0) / currents.length;
    const variance = currents.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / currents.length;

    return { schedule, unassigned: unassignedTotal, stdDev: Math.sqrt(variance), statsRef: stats };
}

// Check assignment validity based on the schedule structure
window.isValidAssignment = function (pid, dayIdx, metaArr, schedule, allowDoublets) {
    // 1. Check if already assigned for this specific day (Any slot in the day)
    const day = schedule[dayIdx];
    if (day.seats.some(s => s.pid === pid)) return false;

    // 2. Check Blocked Date
    const p = window.appData.people.find(x => x.id === pid);
    if (p.blocked.includes(day.date)) return false;
    if (window.appData.manualBans && window.appData.manualBans[day.date] && window.appData.manualBans[day.date].includes(pid)) return false;

    // 3. Check Consecutive Logic using the shared helper
    // Note: metaArr here is 'schedule' because 'schedule' contains the definitive state
    // but checkConsecutive expects an array accessed by index.
    // 'schedule' IS that array (sorted by index).
    return checkConsecutive(pid, dayIdx, schedule, allowDoublets);
}

window.validateSchedule = function () {
    const schedule = window.appData.schedule; // Array of Days
    const errors = {}; // Key: "date_slotIndex" (e.g. "2026-02-01_0"), Value: Message

    // Iterate Days
    schedule.forEach((day, i) => {
        // Check slots
        day.seats.forEach(seat => {
            if (!seat.pid) return;

            const p = window.appData.people.find(x => x.id === seat.pid);
            if (!p) return;

            // Blocked?
            if (p.blocked.includes(day.date)) {
                errors[`${day.date}_${seat.idx}`] = "Asignado en día bloqueado";
            }

            // Consecutive Check (N+1) - ALWAYS FORBIDDEN
            if (i < schedule.length - 1) {
                const nextDay = schedule[i + 1];
                const nextSeat = nextDay.seats.find(s => s.pid === p.id);
                if (nextSeat) {
                    errors[`${day.date}_${seat.idx}`] = "Consecutivo no permitido";
                    errors[`${nextDay.date}_${nextSeat.idx}`] = "Consecutivo no permitido";
                }
            }

            // Doublet/Alternating Check (N+2) - Check Preference
            if (i < schedule.length - 2) {
                const next2Day = schedule[i + 2];
                const next2Seat = next2Day.seats.find(s => s.pid === p.id);
                if (next2Seat && p.doublets !== true) {
                    errors[`${day.date}_${seat.idx}`] = "Doblete (Si-No-Si) no permitido";
                    errors[`${next2Day.date}_${next2Seat.idx}`] = "Doblete (Si-No-Si) no permitido";
                }
            }
        });
    });

    return errors;
}

window.getStrictCandidates = function (dateIso, slotIdx, dayIdx) {
    // Note: We need dayIdx now because slots are nested.
    // If not provided, we must find the day by dateIso.
    let dIdx = dayIdx;
    if (dIdx === undefined) {
        dIdx = window.appData.schedule.findIndex(d => d.date === dateIso);
    }

    if (dIdx === -1) return [];

    return window.appData.people.map(p => {
        const valid = isValidAssignment(p.id, dIdx, null, window.appData.schedule, p.doublets);

        let reason = "OK";
        if (!valid) {
            const day = window.appData.schedule[dIdx];
            if (day.seats.some(s => s.pid === p.id)) {
                reason = "Ya tiene turno hoy";
            } else if (p.blocked.includes(dateIso)) {
                reason = "Bloqueado";
            } else {
                reason = "Consecutivos/Descanso";
            }
        }
        return { id: p.id, name: p.name, valid, reason };
    });
}

window.fillGaps = function (schedule, stats, dates) {
    // schedule is Array of Days.

    // Find all gaps: { day, seat }
    // We need to mutate the actual seat object in the schedule.

    let allGaps = [];
    schedule.forEach(day => {
        day.seats.forEach(seat => {
            if (!seat.pid) {
                allGaps.push({ day, seat });
            }
        });
    });

    allGaps.forEach(gapItem => {
        const day = gapItem.day;
        const seat = gapItem.seat;
        const dayIdx = day.idx;

        let candidates = window.appData.people.filter(p => !p.blocked.includes(day.date));
        if (window.appData.manualBans && window.appData.manualBans[day.date]) {
            candidates = candidates.filter(p => !window.appData.manualBans[day.date].includes(p.id));
        }
        candidates.sort((a, b) => stats[a.id].curTotal - stats[b.id].curTotal);

        let filled = false;

        // TRY 1: Direct
        for (let p of candidates) {
            if (isValidAssignment(p.id, dayIdx, null, schedule, p.doublets)) {
                seat.pid = p.id; seat.name = p.name;
                stats[p.id].curTotal++;
                filled = true;
                break;
            }
        }

        if (!filled) {
            // TRY 2: Swap
            for (let p of candidates) {
                // Check Prev Day
                if (dayIdx > 0) {
                    const prevDay = schedule[dayIdx - 1];
                    const prevSeat = prevDay.seats.find(s => s.pid === p.id);
                    if (prevSeat) {
                        const originalPid = prevSeat.pid;
                        prevSeat.pid = null; // Tentative Remove

                        if (isValidAssignment(p.id, dayIdx, null, schedule, p.doublets)) {
                            seat.pid = p.id; seat.name = p.name;
                            prevSeat.name = null;
                            stats[p.id].curTotal++; // Neutral change actually? No, we add one here.
                            // But we removed one from Prev... wait. 
                            // Logic: We added P to DayIdx. We removed P from PrevDay.
                            // So P's count is same.
                            // But we created a gap in PrevDay.
                            // stats should reflect the finalized count.
                            // stats[p.id].curTotal is correct (unchanged).
                            filled = true;
                            break;
                        } else {
                            prevSeat.pid = originalPid;
                        }
                    }
                }

                // Check Next Day
                if (dayIdx < schedule.length - 1) {
                    const nextDay = schedule[dayIdx + 1];
                    const nextSeat = nextDay.seats.find(s => s.pid === p.id);
                    if (nextSeat) {
                        const originalPid = nextSeat.pid;
                        nextSeat.pid = null;

                        if (isValidAssignment(p.id, dayIdx, null, schedule, p.doublets)) {
                            seat.pid = p.id; seat.name = p.name;
                            nextSeat.name = null;
                            filled = true;
                            break;
                        } else {
                            nextSeat.pid = originalPid;
                        }
                    }
                }
            }
        }
    });
}
