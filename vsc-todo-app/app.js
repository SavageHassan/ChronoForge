/* ============================================================
   CHRONOFORGE — APP.JS
   Core Logic: State, Auth, Persistence, Clock, Notifications
   ============================================================ */

// === GLOBAL STATE ===
let currentAuthSessionEmail = localStorage.getItem('global_active_auth_email') || "";
let currentProfileKey = "";
let userBirthEpoch = null;
let userHeightCm = null;
let activeTab = "tasks";
let activeMediaFilter = "All";
let activeGoalFilter = "Daily";
let forceWeightMode = false;
let currentAuthMode = "login";

let db = { tasks: [], goals: [], media: [], workout: [], rations: [], stats: {}, history: [], journal: {} };
let fitnessEvolutionChartInstance = null;
let waterHydrationAlertIntervalInstance = null;

let firedAlarmsRegistry = new Set();
let firedWarningsRegistry = new Set();

// === PASSWORD HASHING (A1) ===
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'chronoforge-salt-v1');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// === NOTIFICATIONS ===
function requestSystemNotificationPermissions() {
    if ("Notification" in window) {
        Notification.requestPermission();
    }
}

function dispatchNotification(title, content, priority = "Medium") {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    let options = {
        body: content,
        tag: "chrono-forge-alerts",
        requireInteraction: priority === "High"
    };

    new Notification(priority === "High" ? `🚨 ${title}` : `⚡ ${title}`, options);
}

function startHydrationReminderTicker() {
    if (waterHydrationAlertIntervalInstance) clearInterval(waterHydrationAlertIntervalInstance);

    waterHydrationAlertIntervalInstance = setInterval(() => {
        dispatchNotification("Hydration Reminder", "40 minutes passed. Drink a glass of water to stay hydrated.", "High");
    }, 40 * 60 * 1000);
}

// === ALARM SYSTEM ===
function executeAlarmLoop() {
    if (!currentProfileKey || db.tasks.length === 0) return;

    const now = new Date();
    const currentEpoch = now.getTime();

    db.tasks.forEach(item => {
        if (!item.alarmTime || item.completed) return;

        const [targetHours, targetMinutes] = item.alarmTime.split(":");
        const alarmDate = new Date();
        alarmDate.setHours(parseInt(targetHours), parseInt(targetMinutes), 0, 0);

        const alarmEpoch = alarmDate.getTime();
        const delta = alarmEpoch - currentEpoch;

        if (delta <= 0 && delta > -60000) {
            if (!firedAlarmsRegistry.has(item.id)) {
                firedAlarmsRegistry.add(item.id);
                dispatchNotification("ALARM", `Time for: ${item.text}`, "High");

                try {
                    let ctx = new (window.AudioContext || window.webkitAudioContext)();
                    let osc = ctx.createOscillator();
                    osc.type = "sawtooth";
                    osc.frequency.setValueAtTime(880, ctx.currentTime);
                    osc.connect(ctx.destination);
                    osc.start();
                    osc.stop(ctx.currentTime + 1.5);
                } catch (e) { /* audio may not be available */ }
            }
        } else if (delta > 0 && delta <= 1800000) {
            if (!firedWarningsRegistry.has(item.id)) {
                firedWarningsRegistry.add(item.id);
                let mins = Math.ceil(delta / 60000);
                dispatchNotification("Upcoming Task", `"${item.text}" in ${mins} minutes.`, "Medium");
            }
        }
    });
}
setInterval(executeAlarmLoop, 2000);

// === AUTH SYSTEM ===
function toggleAuthenticationStateView() {
    const container = document.getElementById('authFormFieldsContainer');
    const actionBtn = document.getElementById('authSubmitActionButton');
    const toggleLink = document.getElementById('authToggleStateLink');
    const errorBlock = document.getElementById('authValidationFeedback');

    errorBlock.style.display = 'none';
    container.innerHTML = "";

    if (currentAuthMode === "login") {
        currentAuthMode = "signup";
        actionBtn.innerText = "Forge New Account";
        toggleLink.innerText = "Already registered? Access Login Portal";

        container.innerHTML = `
            <label class="input-label">Profile Handle Name:</label>
            <input type="text" id="authNameField" placeholder="e.g. Mubeen" />
            <label class="input-label">Email Address:</label>
            <input type="email" id="authEmailField" placeholder="name@example.com" />
            <label class="input-label">Password Key:</label>
            <input type="password" id="authPasswordField" placeholder="••••••••" />
            <div class="grid-2col">
                <div>
                    <label class="input-label" style="display:block; margin-top:5px;">Height (cm):</label>
                    <input type="number" id="authHeightField" placeholder="e.g. 178" style="width:100%; box-sizing:border-box;" />
                </div>
                <div>
                    <label class="input-label" style="display:block; margin-top:5px;">Weight (kg):</label>
                    <input type="number" step="0.1" id="authWeightField" placeholder="e.g. 70" style="width:100%; box-sizing:border-box;" />
                </div>
            </div>
            <label class="input-label" style="margin-top:5px;">Your Birth Date:</label>
            <input type="date" id="authBirthField" />
        `;
    } else {
        currentAuthMode = "login";
        actionBtn.innerText = "Login to Console";
        toggleLink.innerText = "Need a new tracking footprint? Sign Up";

        container.innerHTML = `
            <label class="input-label">Account Email Address:</label>
            <input type="email" id="authEmailField" placeholder="name@example.com" />
            <label class="input-label">Security Password:</label>
            <input type="password" id="authPasswordField" placeholder="••••••••" />
        `;
    }
}

async function executeAuthenticationAction() {
    const errorBlock = document.getElementById('authValidationFeedback');
    errorBlock.style.display = 'none';

    const emailInput = document.getElementById('authEmailField').value.trim().toLowerCase();
    const passwordInput = document.getElementById('authPasswordField').value.trim();

    if (!emailInput || !passwordInput) {
        showAuthError("All credential fields must be filled.");
        return;
    }

    const cleanKeyBase = btoa(emailInput).replace(/=/g, "");
    const hashedPassword = await hashPassword(passwordInput);

    if (currentAuthMode === "signup") {
        const nameInput = document.getElementById('authNameField').value.trim();
        const heightInput = document.getElementById('authHeightField').value.trim();
        const weightInput = document.getElementById('authWeightField').value.trim();
        const birthInput = document.getElementById('authBirthField').value;

        if (!nameInput || !heightInput || !weightInput || !birthInput) {
            showAuthError("Complete all profile fields to forge your account.");
            return;
        }

        if (localStorage.getItem(`usr_pass_${cleanKeyBase}`)) {
            showAuthError("This email footprint already exists.");
            return;
        }

        localStorage.setItem(`usr_pass_${cleanKeyBase}`, hashedPassword);
        localStorage.setItem(`usr_name_${cleanKeyBase}`, nameInput);
        localStorage.setItem(`usr_dob_${cleanKeyBase}`, birthInput);
        localStorage.setItem(`usr_height_${cleanKeyBase}`, heightInput);

        localStorage.setItem(`db_${cleanKeyBase}_stats`, JSON.stringify({
            pushups: 0, cardio: 0, water: 0, weight: parseFloat(weightInput), burned: 0, consumed: 0, jogging: 0
        }));

        currentAuthSessionEmail = emailInput;
        localStorage.setItem('global_active_auth_email', emailInput);
        loadDashboardWorkspace(cleanKeyBase);
        requestSystemNotificationPermissions();

    } else {
        const storedPass = localStorage.getItem(`usr_pass_${cleanKeyBase}`);
        if (!storedPass) {
            showAuthError("No account found with this email.");
            return;
        }

        // Support hashed and legacy plain-text passwords (migration)
        if (storedPass === hashedPassword) {
            // Already hashed — direct match
        } else if (storedPass === passwordInput) {
            // Legacy plain-text — migrate to hashed
            localStorage.setItem(`usr_pass_${cleanKeyBase}`, hashedPassword);
        } else {
            showAuthError("Invalid email or password combination.");
            return;
        }

        currentAuthSessionEmail = emailInput;
        localStorage.setItem('global_active_auth_email', emailInput);
        loadDashboardWorkspace(cleanKeyBase);
        requestSystemNotificationPermissions();
    }
}

function showAuthError(msg) {
    const errorBlock = document.getElementById('authValidationFeedback');
    errorBlock.innerText = msg;
    errorBlock.style.display = 'block';
}

function verifyStickyProfileRouter() {
    if (currentAuthSessionEmail) {
        const cleanKeyBase = btoa(currentAuthSessionEmail).replace(/=/g, "");
        if (localStorage.getItem(`usr_pass_${cleanKeyBase}`)) {
            loadDashboardWorkspace(cleanKeyBase);
            return;
        }
    }
    document.getElementById('authPortalScreen').classList.add('active');
}

function loadDashboardWorkspace(userKey) {
    currentProfileKey = userKey;
    userBirthEpoch = new Date(localStorage.getItem(`usr_dob_${userKey}`)).getTime();
    userHeightCm = parseFloat(localStorage.getItem(`usr_height_${userKey}`));

    db.tasks = JSON.parse(localStorage.getItem(`db_${userKey}_tasks`)) || [];
    db.goals = JSON.parse(localStorage.getItem(`db_${userKey}_goals`)) || [];
    db.media = JSON.parse(localStorage.getItem(`db_${userKey}_media`)) || [];
    db.workout = JSON.parse(localStorage.getItem(`db_${userKey}_workout`)) || [];
    db.rations = JSON.parse(localStorage.getItem(`db_${userKey}_rations`)) || [];
    db.stats = JSON.parse(localStorage.getItem(`db_${userKey}_stats`)) || {
        pushups: 0, cardio: 0, water: 0, weight: null, burned: 0, consumed: 0, jogging: 0
    };
    db.history = JSON.parse(localStorage.getItem(`db_${userKey}_history`)) || [];
    db.journal = JSON.parse(localStorage.getItem(`db_${userKey}_journal`)) || {};

    // Schema migration for older profiles
    if (db.stats.jogging === undefined) db.stats.jogging = 0;

    document.getElementById('authPortalScreen').classList.remove('active');
    document.getElementById('appRuntimeLayout').style.display = 'flex';
    document.getElementById('globalActionFab').classList.add('active');
    document.getElementById('mainContainerBlock').classList.add('active');

    const profileName = localStorage.getItem(`usr_name_${userKey}`) || "User";
    document.getElementById('navTabLabelTasks').innerText = `${profileName}'s Tasks`;

    // Check for daily reset (B4)
    checkDailyReset();

    renderTabLists();
    initFitnessProgressGraph();
    startHydrationReminderTicker();
}

// === CLOCK & AGE TRACKER (A3 bug fix applied) ===
function updateChronoClock() {
    const now = new Date();
    let hours = String(now.getHours()).padStart(2, '0');
    let minutes = String(now.getMinutes()).padStart(2, '0');
    let seconds = String(now.getSeconds()).padStart(2, '0');

    document.getElementById('giantSystemClock').innerText = `${hours}:${minutes}:${seconds}`;

    document.getElementById('giantSystemDate').innerText = now.toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'
    });

    if (userBirthEpoch) {
        const birthDate = new Date(userBirthEpoch);
        let years = now.getFullYear() - birthDate.getFullYear();
        let months = now.getMonth() - birthDate.getMonth();
        let days = now.getDate() - birthDate.getDate();
        let displayHours = now.getHours();
        let displayMinutes = now.getMinutes();
        let displaySeconds = now.getSeconds();

        // Proper cascading subtraction for age calculation (A3 fix)
        if (displaySeconds < birthDate.getSeconds()) {
            displaySeconds += 60;
            displayMinutes--;
        }
        if (displayMinutes < birthDate.getMinutes()) {
            displayMinutes += 60;
            displayHours--;
        }
        if (displayHours < birthDate.getHours()) {
            displayHours += 24;
            days--;
        }
        if (days < 0) {
            days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
            months--;
        }
        if (months < 0) {
            months += 12;
            years--;
        }

        const displayName = localStorage.getItem(`usr_name_${currentProfileKey}`) || "USER";
        document.getElementById('chronoBanner').innerHTML =
            `<span style="color:var(--anime-neon); font-weight:bold; margin-right:5px;">${displayName.toUpperCase()}'S AGE:</span>` +
            `${years}Y — ${months}M — ${days}D — ${String(displayHours).padStart(2, '0')}H — ${String(displayMinutes).padStart(2, '0')}M — ${String(displaySeconds).padStart(2, '0')}S`;
    }

    if (activeTab === 'goals') renderGoalsCountdownEngine();
}
setInterval(updateChronoClock, 1000);

// === TAB & FILTER SWITCHING ===
function switchTab(targetTab) {
    activeTab = targetTab;
    document.querySelectorAll('.top-nav .nav-item').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');

    document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('active'));
    document.getElementById(`panel-${targetTab}`).classList.add('active');

    // Hide FAB on chronicle tab (no "add" action there)
    const fab = document.getElementById('globalActionFab');
    if (targetTab === 'chronicle') {
        fab.classList.remove('active');
    } else {
        fab.classList.add('active');
    }

    renderTabLists();
    if (targetTab === 'workout') {
        setTimeout(initFitnessProgressGraph, 50);
    }
}

function switchMediaFilter(type) {
    activeMediaFilter = type;
    document.querySelectorAll('#panel-media .filter-chip').forEach(el => el.classList.remove('active'));
    document.getElementById(`chip-${type}`).classList.add('active');
    renderTabLists();
}

function switchGoalFilter(type) {
    activeGoalFilter = type;
    document.querySelectorAll('#panel-goals .filter-chip').forEach(el => el.classList.remove('active'));
    document.getElementById(`goalChip-${type}`).classList.add('active');
    renderTabLists();
}

// === DATA MANAGEMENT ===
function adjustStat(field, val) {
    db.stats[field] = Math.max(0, (db.stats[field] || 0) + val);
    localStorage.setItem(`db_${currentProfileKey}_stats`, JSON.stringify(db.stats));
    syncStatDisplays();
    updateChartMetricsEngine();
}

function adjustJoggingMetricDuration(minutes) {
    db.stats.jogging = Math.max(0, (db.stats.jogging || 0) + minutes);
    let extraBurned = Math.round(minutes * 11.4);
    db.stats.burned = Math.max(0, (db.stats.burned || 0) + extraBurned);

    localStorage.setItem(`db_${currentProfileKey}_stats`, JSON.stringify(db.stats));
    syncStatDisplays();
    updateChartMetricsEngine();
    dispatchNotification("Track Logged", `${minutes} min jogging recorded. +${extraBurned} kcal burned.`, "Low");
}

function resetMetricsArc(mode) {
    if (mode === 'workout') {
        db.stats.burned = 0; db.stats.pushups = 0; db.stats.cardio = 0; db.stats.jogging = 0;
    } else {
        db.stats.consumed = 0; db.stats.water = 0;
    }
    localStorage.setItem(`db_${currentProfileKey}_stats`, JSON.stringify(db.stats));
    syncStatDisplays();
    updateChartMetricsEngine();
}

function toggleTaskCompletion(id) {
    const task = db.tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    localStorage.setItem(`db_${currentProfileKey}_tasks`, JSON.stringify(db.tasks));
    renderTabLists();
}

function toggleGoalCompletion(id) {
    const goal = db.goals.find(g => g.id === id);
    if (!goal) return;
    goal.completed = !goal.completed;
    localStorage.setItem(`db_${currentProfileKey}_goals`, JSON.stringify(db.goals));

    if (goal.completed && goal.type === 'Legendary') {
        triggerConfetti();
    }

    renderTabLists();
}

function updateMediaProgress(id, delta) {
    const item = db.media.find(m => m.id === id);
    if (!item) return;
    item.currentEp = Math.max(0, Math.min((item.currentEp || 0) + delta, item.totalEp || 9999));
    localStorage.setItem(`db_${currentProfileKey}_media`, JSON.stringify(db.media));
    renderTabLists();
}

function deleteItem(id, targetBucket) {
    db[targetBucket] = db[targetBucket].filter(item => item.id !== id);
    localStorage.setItem(`db_${currentProfileKey}_${targetBucket}`, JSON.stringify(db[targetBucket]));
    firedAlarmsRegistry.delete(id);
    firedWarningsRegistry.delete(id);
    renderTabLists();
}

// === DRAWER ===
function openWeightModal() { forceWeightMode = true; openDrawer(); }

function openDrawer() {
    const container = document.getElementById('inputContainer');
    const title = document.getElementById('drawerTitle');
    container.innerHTML = "";

    if (forceWeightMode) {
        title.innerText = "Log Weight Progress";
        container.innerHTML = `<input type="number" step="0.1" id="weightInput" placeholder="Weight value (kg)..." value="${db.stats.weight || ''}" />`;
    } else if (activeTab === 'tasks') {
        title.innerText = "Add New Task";
        container.innerHTML = `
            <input type="text" id="taskTitle" placeholder="Task description..." />
            <select id="taskPriority"><option value="Low">Low</option><option value="Medium" selected>Medium</option><option value="High">High</option></select>
            <label class="input-label">Set Alarm Time:</label>
            <input type="time" id="taskAlarmTimeField" />
        `;
    } else if (activeTab === 'goals') {
        title.innerText = "Launch New Goal";
        container.innerHTML = `
            <select id="goalScopeField" onchange="toggleGoalInputFields(this.value)">
                <option value="Daily" ${activeGoalFilter === 'Daily' ? 'selected' : ''}>Daily Target</option>
                <option value="Legendary" ${activeGoalFilter === 'Legendary' ? 'selected' : ''}>Long-Term Arc</option>
            </select>
            <input type="text" id="goalTitle" placeholder="Enter objective milestone..." />
            <div id="goalTimeInputWrapper" style="display:${activeGoalFilter === 'Daily' ? 'none' : 'block'}; flex-direction:column; gap:4px;">
                <label class="input-label">Target Deadline:</label>
                <input type="datetime-local" id="goalTargetTime" />
            </div>
        `;
    } else if (activeTab === 'media') {
        title.innerText = "Log Media Entry";
        container.innerHTML = `
            <input type="text" id="mediaTitle" placeholder="Media name..." />
            <select id="mediaType"><option value="Anime">Anime</option><option value="Seasons">Seasons</option><option value="Movies">Movies</option><option value="Cartoons">Cartoons</option></select>
            <input type="text" id="mediaDetails" placeholder="Details (e.g. Currently airing)" />
            <div class="grid-2col">
                <div>
                    <label class="input-label" style="display:block; margin-top:5px;">Current Episode:</label>
                    <input type="number" id="mediaCurrentEp" placeholder="e.g. 12" min="0" style="width:100%; box-sizing:border-box;" />
                </div>
                <div>
                    <label class="input-label" style="display:block; margin-top:5px;">Total Episodes:</label>
                    <input type="number" id="mediaTotalEp" placeholder="e.g. 24" min="0" style="width:100%; box-sizing:border-box;" />
                </div>
            </div>
        `;
    } else if (activeTab === 'workout') {
        title.innerText = "Add Exercise Entry";
        container.innerHTML = `<input type="text" id="workoutTitle" placeholder="e.g. Bench Press 3x10..." />`;
    } else if (activeTab === 'rations') {
        title.innerText = "Add Meal Entry";
        container.innerHTML = `<input type="text" id="rationTitle" placeholder="e.g. Protein Shake..." />`;
    }

    document.getElementById('actionDrawer').classList.add('open');
}

function toggleGoalInputFields(val) {
    document.getElementById('goalTimeInputWrapper').style.display = (val === 'Daily') ? 'none' : 'block';
}

function closeDrawer() {
    document.getElementById('actionDrawer').classList.remove('open');
    forceWeightMode = false;
}
function closeDrawerOutside(e) { if (e.target.id === 'actionDrawer') closeDrawer(); }

function commitEntryData() {
    const timestampID = Date.now();

    if (forceWeightMode) {
        const wVal = parseFloat(document.getElementById('weightInput').value);
        if (wVal > 0) db.stats.weight = wVal;
        localStorage.setItem(`db_${currentProfileKey}_stats`, JSON.stringify(db.stats));
        syncStatDisplays();
        updateChartMetricsEngine();
    } else if (activeTab === 'tasks') {
        const txt = document.getElementById('taskTitle').value.trim();
        const pVal = document.getElementById('taskPriority').value;
        const alarmTime = document.getElementById('taskAlarmTimeField').value;
        if (!txt) return;
        db.tasks.push({
            id: timestampID, text: txt, priority: pVal,
            alarmTime: alarmTime || null, completed: false
        });
    } else if (activeTab === 'goals') {
        const txt = document.getElementById('goalTitle').value.trim();
        const scope = document.getElementById('goalScopeField').value;
        if (!txt) return;

        if (scope === "Daily") {
            db.goals.push({ id: timestampID, text: txt, type: "Daily", targetEpoch: null, completed: false });
        } else {
            const dLine = document.getElementById('goalTargetTime').value;
            if (!dLine) return;
            db.goals.push({ id: timestampID, text: txt, type: "Legendary", targetEpoch: new Date(dLine).getTime(), completed: false });
        }
    } else if (activeTab === 'media') {
        const txt = document.getElementById('mediaTitle').value.trim();
        const tVal = document.getElementById('mediaType').value;
        const det = document.getElementById('mediaDetails').value.trim() || "Added";
        const currentEp = parseInt(document.getElementById('mediaCurrentEp').value) || 0;
        const totalEp = parseInt(document.getElementById('mediaTotalEp').value) || 0;
        if (!txt) return;
        db.media.push({ id: timestampID, text: txt, type: tVal, details: det, currentEp, totalEp });
    } else if (activeTab === 'workout') {
        const txt = document.getElementById('workoutTitle').value.trim();
        if (!txt) return;
        db.workout.push({ id: timestampID, text: txt });
    } else if (activeTab === 'rations') {
        const txt = document.getElementById('rationTitle').value.trim();
        if (!txt) return;
        db.rations.push({ id: timestampID, text: txt });
    }

    localStorage.setItem(`db_${currentProfileKey}_${activeTab}`, JSON.stringify(db[activeTab]));
    closeDrawer();
    renderTabLists();
}

// === PROFILE MODAL ===
function openProfileIdentityDrawer() {
    if (!currentProfileKey) return;

    const handleName = localStorage.getItem(`usr_name_${currentProfileKey}`) || "N/A";
    const height = userHeightCm ? userHeightCm + " cm" : "N/A";

    let bmiVal = "--";
    if (userHeightCm && db.stats.weight) {
        bmiVal = (db.stats.weight / ((userHeightCm / 100) * (userHeightCm / 100))).toFixed(1);
    }

    document.getElementById('modalDisplayHandle').innerText = handleName;
    document.getElementById('modalDisplayEmail').innerText = currentAuthSessionEmail;
    document.getElementById('modalDisplayHeight').innerText = height;
    document.getElementById('modalDisplayBMI').innerText = bmiVal;

    document.getElementById('profileIdentityModal').classList.add('open');
}

function closeProfileIdentityDrawer() {
    document.getElementById('profileIdentityModal').classList.remove('open');
}

function closeProfileDrawerOutside(e) {
    if (e.target.id === 'profileIdentityModal') closeProfileIdentityDrawer();
}

function exitActiveSession() {
    closeProfileIdentityDrawer();
    if (waterHydrationAlertIntervalInstance) clearInterval(waterHydrationAlertIntervalInstance);

    localStorage.removeItem('global_active_auth_email');
    currentAuthSessionEmail = "";
    currentProfileKey = "";
    userBirthEpoch = null;
    userHeightCm = null;
    currentAuthMode = "login";
    firedAlarmsRegistry.clear();
    firedWarningsRegistry.clear();

    if (fitnessEvolutionChartInstance) { fitnessEvolutionChartInstance.destroy(); fitnessEvolutionChartInstance = null; }

    document.getElementById('appRuntimeLayout').style.display = 'none';
    document.getElementById('globalActionFab').classList.remove('active');
    document.getElementById('mainContainerBlock').classList.remove('active');

    document.getElementById('authPortalScreen').classList.add('active');
    toggleAuthenticationStateView();
}

// === DATA EXPORT / IMPORT (A2) ===
function exportAllData() {
    const data = {
        exportedAt: new Date().toISOString(),
        version: "1.0",
        profile: {
            name: localStorage.getItem(`usr_name_${currentProfileKey}`),
            dob: localStorage.getItem(`usr_dob_${currentProfileKey}`),
            height: localStorage.getItem(`usr_height_${currentProfileKey}`)
        },
        tasks: db.tasks,
        goals: db.goals,
        media: db.media,
        workout: db.workout,
        rations: db.rations,
        stats: db.stats,
        history: db.history,
        journal: db.journal
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronoforge-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function triggerImportDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                importData(data);
            } catch (err) {
                alert("Failed to parse backup file. Make sure it's a valid ChronoForge export.");
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function importData(data) {
    if (!currentProfileKey || !data) return;

    if (data.profile) {
        if (data.profile.name) localStorage.setItem(`usr_name_${currentProfileKey}`, data.profile.name);
        if (data.profile.dob) localStorage.setItem(`usr_dob_${currentProfileKey}`, data.profile.dob);
        if (data.profile.height) localStorage.setItem(`usr_height_${currentProfileKey}`, data.profile.height);
    }

    if (data.tasks) { db.tasks = data.tasks; localStorage.setItem(`db_${currentProfileKey}_tasks`, JSON.stringify(db.tasks)); }
    if (data.goals) { db.goals = data.goals; localStorage.setItem(`db_${currentProfileKey}_goals`, JSON.stringify(db.goals)); }
    if (data.media) { db.media = data.media; localStorage.setItem(`db_${currentProfileKey}_media`, JSON.stringify(db.media)); }
    if (data.workout) { db.workout = data.workout; localStorage.setItem(`db_${currentProfileKey}_workout`, JSON.stringify(db.workout)); }
    if (data.rations) { db.rations = data.rations; localStorage.setItem(`db_${currentProfileKey}_rations`, JSON.stringify(db.rations)); }
    if (data.stats) { db.stats = data.stats; localStorage.setItem(`db_${currentProfileKey}_stats`, JSON.stringify(db.stats)); }
    if (data.history) { db.history = data.history; localStorage.setItem(`db_${currentProfileKey}_history`, JSON.stringify(db.history)); }
    if (data.journal) { db.journal = data.journal; localStorage.setItem(`db_${currentProfileKey}_journal`, JSON.stringify(db.journal)); }

    // Reload dashboard
    userBirthEpoch = new Date(localStorage.getItem(`usr_dob_${currentProfileKey}`)).getTime();
    userHeightCm = parseFloat(localStorage.getItem(`usr_height_${currentProfileKey}`));
    renderTabLists();
    syncStatDisplays();
    updateChartMetricsEngine();
    closeProfileIdentityDrawer();

    dispatchNotification("Data Restored", "Backup imported successfully.", "Medium");
}

// === DAILY RESET & HISTORY ARCHIVING (B2, B4) ===
function checkDailyReset() {
    if (!currentProfileKey) return;

    const today = new Date().toISOString().split('T')[0];
    const lastDate = localStorage.getItem(`db_${currentProfileKey}_lastDate`);

    if (lastDate && lastDate !== today) {
        // Archive previous day's data
        archiveDayStats(lastDate);

        // Reset daily stats
        db.stats.pushups = 0;
        db.stats.cardio = 0;
        db.stats.burned = 0;
        db.stats.consumed = 0;
        db.stats.water = 0;
        db.stats.jogging = 0;
        localStorage.setItem(`db_${currentProfileKey}_stats`, JSON.stringify(db.stats));

        // Clear completed tasks
        db.tasks = db.tasks.filter(t => !t.completed);
        localStorage.setItem(`db_${currentProfileKey}_tasks`, JSON.stringify(db.tasks));

        // Clear completed daily goals
        db.goals = db.goals.filter(g => !(g.type === 'Daily' && g.completed));
        localStorage.setItem(`db_${currentProfileKey}_goals`, JSON.stringify(db.goals));

        // Reset alarm registries for new day
        firedAlarmsRegistry.clear();
        firedWarningsRegistry.clear();
    }

    localStorage.setItem(`db_${currentProfileKey}_lastDate`, today);
}

function archiveDayStats(dateStr) {
    const waterTarget = db.stats.weight ? Math.round(db.stats.weight * 35) : 2500;
    const completedTasks = db.tasks.filter(t => t.completed).length;

    db.history.push({
        date: dateStr,
        stats: { ...db.stats },
        tasksCompleted: completedTasks,
        tasksTotal: db.tasks.length,
        waterTarget: waterTarget,
        hitWaterGoal: (db.stats.water || 0) >= waterTarget,
        didWorkout: (db.stats.pushups > 0 || db.stats.cardio > 0 || db.stats.jogging > 0)
    });

    // Keep last 90 days
    if (db.history.length > 90) db.history = db.history.slice(-90);

    localStorage.setItem(`db_${currentProfileKey}_history`, JSON.stringify(db.history));
}

function calculateStreaks() {
    if (!db.history || db.history.length === 0) return { water: 0, workout: 0, tasks: 0 };

    let waterStreak = 0, workoutStreak = 0, taskStreak = 0;

    for (let i = db.history.length - 1; i >= 0; i--) {
        if (db.history[i].hitWaterGoal) waterStreak++; else break;
    }
    for (let i = db.history.length - 1; i >= 0; i--) {
        if (db.history[i].didWorkout) workoutStreak++; else break;
    }
    for (let i = db.history.length - 1; i >= 0; i--) {
        if (db.history[i].tasksCompleted > 0) taskStreak++; else break;
    }

    return { water: waterStreak, workout: workoutStreak, tasks: taskStreak };
}

// === JOURNAL (B3) ===
let journalSaveTimeout = null;

function saveJournalEntry() {
    const textarea = document.getElementById('journalTextarea');
    if (!textarea || !currentProfileKey) return;

    const today = new Date().toISOString().split('T')[0];
    db.journal[today] = textarea.value;
    localStorage.setItem(`db_${currentProfileKey}_journal`, JSON.stringify(db.journal));

    // Show save indicator
    const indicator = document.getElementById('journalSaveIndicator');
    if (indicator) {
        indicator.classList.add('visible');
        if (journalSaveTimeout) clearTimeout(journalSaveTimeout);
        journalSaveTimeout = setTimeout(() => indicator.classList.remove('visible'), 2000);
    }
}

function getJournalEntry() {
    const today = new Date().toISOString().split('T')[0];
    return (db.journal && db.journal[today]) || '';
}

// === THEME TOGGLE (C2) ===
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('chronoforge-theme', next);

    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.innerText = next === 'dark' ? '☀️' : '🌙';
}

function loadSavedTheme() {
    const saved = localStorage.getItem('chronoforge-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.innerText = saved === 'dark' ? '☀️' : '🌙';
}

// === PWA SERVICE WORKER ===
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => { /* SW not critical */ });
    });
}

// === INITIALIZATION ===
loadSavedTheme();
verifyStickyProfileRouter();
