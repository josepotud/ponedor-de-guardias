
// --- UTILS & PERSISTENCE ---
window.getISO = function (d) { return d.toISOString().split('T')[0]; };
window.getDatesRange = function (start, end) {
    const arr = [];
    let dt = new Date(start);
    const last = new Date(end);
    while (dt <= last) {
        arr.push(getISO(dt));
        dt.setDate(dt.getDate() + 1);
    }
    return arr;
};

// State
window.saveState = function () {
    localStorage.setItem('guardiasState_v2', JSON.stringify(window.appData));
    localStorage.setItem('guardiasInputs', JSON.stringify({
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        defaultSlots: document.getElementById('defaultSlots').value
    }));
};
window.loadState = function () {
    try {
        const saved = localStorage.getItem('guardiasState_v2');
        if (saved) {
            window.appData = JSON.parse(saved);
            // Re-hydrate dates if needed? JSON parses strings. Dates are strings in ISO.
            // Check legacy structure updates if any.
        }
        const inputs = JSON.parse(localStorage.getItem('guardiasInputs'));
        if (inputs) {
            if (inputs.startDate) window.appData.startDate = inputs.startDate;
            if (inputs.endDate) window.appData.endDate = inputs.endDate;
            if (inputs.defaultSlots) window.appData.defaultSlots = parseInt(inputs.defaultSlots);
        }
    } catch (e) { console.error("Error loading state", e); }
};
window.saveStateInputs = function () {
    window.appData.startDate = document.getElementById('startDate').value;
    window.appData.endDate = document.getElementById('endDate').value;
    window.appData.defaultSlots = parseInt(document.getElementById('defaultSlots').value);
    saveState();
};
window.resetState = function () {
    if (confirm('¿Seguro que quieres borrar todo el estado guardado?')) {
        localStorage.removeItem('guardiasState_v2');
        localStorage.removeItem('guardiasInputs');
        location.reload();
    }
};

// Cookie Warning Logic
if (!localStorage.getItem('cookiesAccepted')) {
    const div = document.createElement('div');
    div.id = 'cookieBanner';
    div.className = 'fixed bottom-0 left-0 right-0 bg-gray-800 text-white p-4 text-center z-50 flex justify-center items-center gap-4';
    div.innerHTML = `
        <span class="text-sm">Uso cookies para guardar tu trabajo en este navegador. Todo se queda en tu PC.</span>
        <button onclick="acceptCookies()" class="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded text-xs font-bold">Vale</button>
    `;
    document.body.appendChild(div);
}
window.acceptCookies = function () {
    localStorage.setItem('cookiesAccepted', 'true');
    const b = document.getElementById('cookieBanner');
    if (b) b.remove();
};
