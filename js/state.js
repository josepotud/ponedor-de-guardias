// --- STATE & UTILS ---
window.appData = { startDate: '', endDate: '', holidays: [], staffing: {}, people: [], schedule: [], history: {}, importedFiles: [], manualBans: {}, defaultSlots: 1 };
window.viewDate = new Date();
window.modalMode = 'block';
window.currentPersonId = null;

// Helper: Local ISO Date
window.getISO = function (d) {
    const z = n => n < 10 ? '0' + n : n;
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

window.saveState = function () { localStorage.setItem('guardias', JSON.stringify(window.appData)); }
window.loadState = function () { const d = localStorage.getItem('guardias'); if (d) window.appData = { ...window.appData, ...JSON.parse(d) }; }
window.resetData = function () {
    Swal.fire({
        title: '¿Empezar de cero?',
        text: "Se borrarán todos los datos, personas y configuración actual. No podrás deshacer esto.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, borrar todo',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('guardias');
            location.reload();
        }
    });
}

window.saveStateInputs = function () {
    window.appData.startDate = document.getElementById('startDate').value;
    window.appData.endDate = document.getElementById('endDate').value;
    window.appData.defaultSlots = parseInt(document.getElementById('defaultSlots').value) || 1;
    saveState();
}

// History Check
window.updateHistoryBadge = function () {
    const count = Object.keys(window.appData.history || {}).length;
    const badge = document.getElementById('historyBadge');
    const btn = document.getElementById('viewHistoryBtn');

    if (count > 0) {
        if (badge) badge.classList.remove('hidden');
        if (btn) btn.classList.remove('hidden');
    } else {
        if (badge) badge.classList.add('hidden');
        if (btn) btn.classList.add('hidden');
    }
}

// Cookies
window.checkCookies = function () { if (!localStorage.getItem('okCookie')) document.getElementById('cookieBanner')?.classList.remove('hidden'); }
window.acceptCookies = function () { localStorage.setItem('okCookie', '1'); document.getElementById('cookieBanner').classList.add('hidden'); }
