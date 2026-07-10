/* ============================================================
   CHRONOFORGE — UI.JS
   Rendering, Stats Display, Chart, Confetti, Swipe Gestures
   ============================================================ */

// === MOTIVATIONAL QUOTES (C5) ===
const FORGE_QUOTES = [
    "The forge is silent. Strike the anvil.",
    "Every legend was once a nobody with a checklist.",
    "Discipline is the bridge between goals and achievement.",
    "Your future self is watching. Make them proud.",
    "Small daily improvements lead to stunning results.",
    "The grind doesn't stop because you're tired.",
    "You are one task away from momentum.",
    "Level up. One objective at a time.",
    "Consistency beats intensity. Show up daily.",
    "Champions aren't made in gyms. They're made from the desire within.",
    "The clock is ticking. What will you forge today?",
    "Yesterday's completed tasks are tomorrow's foundation."
];

function getRandomQuote() {
    return FORGE_QUOTES[Math.floor(Math.random() * FORGE_QUOTES.length)];
}

// === MAIN RENDER DISPATCHER ===
function renderTabLists() {
    if (!currentProfileKey) return;

    // Hide all empty states by default
    const tasksEmpty = document.getElementById('tasks-empty');
    const goalsEmpty = document.getElementById('goals-empty');
    if (tasksEmpty) tasksEmpty.style.display = 'none';
    if (goalsEmpty) goalsEmpty.style.display = 'none';

    if (activeTab === 'tasks') renderTasks();
    else if (activeTab === 'goals') renderGoalsCountdownEngine();
    else if (activeTab === 'media') renderMedia();
    else if (activeTab === 'workout') renderWorkout();
    else if (activeTab === 'rations') renderRations();
    else if (activeTab === 'chronicle') renderChronicle();
}

// === TASKS RENDERING (B1 - completion toggle) ===
function renderTasks() {
    const container = document.getElementById('tasks-active-list');
    container.innerHTML = "";

    if (db.tasks.length === 0) {
        document.getElementById('tasks-empty').style.display = 'flex';
        document.getElementById('tasks-empty').querySelector('.motivational-quote').innerText = getRandomQuote();
        return;
    }

    // Show completion count
    const completed = db.tasks.filter(t => t.completed).length;
    if (completed > 0 || db.tasks.length > 0) {
        const countEl = document.createElement('div');
        countEl.className = 'task-completion-count';
        countEl.innerText = `✅ ${completed}/${db.tasks.length} completed`;
        container.appendChild(countEl);
    }

    // Sort: incomplete first, then completed
    const sorted = [...db.tasks].sort((a, b) => (a.completed === b.completed) ? 0 : a.completed ? 1 : -1);

    sorted.forEach(item => {
        const wrapper = document.createElement('div');
        wrapper.className = 'swipe-container';

        // Swipe background actions
        const swipeBg = document.createElement('div');
        swipeBg.className = 'swipe-actions-bg';
        swipeBg.innerHTML = `<button class="swipe-action-btn swipe-action-delete" onclick="deleteItem(${item.id}, 'tasks')">Delete</button>`;
        wrapper.appendChild(swipeBg);

        const card = document.createElement('div');
        card.className = `task-card${item.completed ? ' completed' : ''}`;

        let alarmTag = "";
        if (item.alarmTime) {
            alarmTag = `<span class="alarm-indicator-tag">⏰ ${item.alarmTime}</span>`;
        }

        card.innerHTML = `
            <div class="task-checkbox ${item.completed ? 'checked' : ''}" onclick="toggleTaskCompletion(${item.id})">
                ${item.completed ? '✓' : ''}
            </div>
            <div class="task-content-block">
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <span class="task-title-text">${item.text}</span>
                    <span class="priority-indicator priority-${item.priority}">${item.priority}</span>
                    ${alarmTag}
                </div>
            </div>
            <span class="task-delete-btn" onclick="deleteItem(${item.id}, 'tasks')">✕</span>
        `;

        wrapper.appendChild(card);
        container.appendChild(wrapper);
        initSwipeGestures(card, () => deleteItem(item.id, 'tasks'));
    });
}

// === GOALS RENDERING (C4 - confetti on completion) ===
function renderGoalsCountdownEngine() {
    const container = document.getElementById('goals-active-list');
    if (!container) return;
    container.innerHTML = "";

    let filteredGoals = db.goals.filter(item => {
        if (activeGoalFilter === "Daily") return item.type === "Daily" || !item.type;
        return item.type === "Legendary";
    });

    if (filteredGoals.length === 0) {
        document.getElementById('goals-empty').style.display = 'flex';
        document.getElementById('goals-empty').querySelector('.motivational-quote').innerText = getRandomQuote();
        return;
    }

    const now = Date.now();

    // Sort: incomplete first
    const sorted = [...filteredGoals].sort((a, b) => (a.completed === b.completed) ? 0 : a.completed ? 1 : -1);

    sorted.forEach(item => {
        const wrapper = document.createElement('div');
        wrapper.className = 'swipe-container';

        const swipeBg = document.createElement('div');
        swipeBg.className = 'swipe-actions-bg';
        swipeBg.innerHTML = `<button class="swipe-action-btn swipe-action-delete" onclick="deleteItem(${item.id}, 'goals')">Delete</button>`;
        wrapper.appendChild(swipeBg);

        const card = document.createElement('div');
        card.className = `task-card${item.completed ? ' completed' : ''}`;

        let countdownText = "";
        if (item.type === "Legendary" && item.targetEpoch) {
            let diff = item.targetEpoch - now;
            if (item.completed) {
                countdownText = `<span class="goal-countdown" style="background:rgba(0,255,204,0.1); color:var(--anime-neon);">🏆 ACHIEVED</span>`;
            } else if (diff <= 0) {
                countdownText = `<span class="goal-countdown" style="background:rgba(255,51,102,0.1); color:var(--anime-pink);">⚠️ OVERDUE</span>`;
            } else {
                let d = Math.floor(diff / (1000 * 60 * 60 * 24));
                let h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                let m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                countdownText = `<span class="goal-countdown">⏳ ${d}d ${h}h ${m}m remaining</span>`;
            }
        } else {
            if (item.completed) {
                countdownText = `<span class="goal-countdown" style="background:rgba(0,255,204,0.1); color:var(--anime-neon);">✅ Done for today</span>`;
            } else {
                countdownText = `<span class="goal-countdown" style="background:rgba(0,255,204,0.1); color:var(--anime-neon);">⚡ Focus Objective</span>`;
            }
        }

        card.innerHTML = `
            <div class="task-checkbox ${item.completed ? 'checked' : ''}" onclick="toggleGoalCompletion(${item.id})">
                ${item.completed ? '✓' : ''}
            </div>
            <div class="task-content-block">
                <span class="task-title-text" style="font-weight:600;">${item.text}</span>
                <div style="margin-top:4px;">${countdownText}</div>
            </div>
            <span class="task-delete-btn" onclick="deleteItem(${item.id}, 'goals')">✕</span>
        `;

        wrapper.appendChild(card);
        container.appendChild(wrapper);
        initSwipeGestures(card, () => deleteItem(item.id, 'goals'));
    });
}

// === MEDIA RENDERING (with episode tracking) ===
function renderMedia() {
    const container = document.getElementById('media-active-list');
    container.innerHTML = "";
    let filtered = db.media.filter(item => activeMediaFilter === 'All' || item.type === activeMediaFilter);

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-illustration">🎬</div>
                <h2>No media tracked yet</h2>
                <p class="motivational-quote">${getRandomQuote()}</p>
            </div>
        `;
        return;
    }

    filtered.forEach(item => {
        const wrapper = document.createElement('div');
        wrapper.className = 'swipe-container';

        const swipeBg = document.createElement('div');
        swipeBg.className = 'swipe-actions-bg';
        swipeBg.innerHTML = `<button class="swipe-action-btn swipe-action-delete" onclick="deleteItem(${item.id}, 'media')">Delete</button>`;
        wrapper.appendChild(swipeBg);

        const card = document.createElement('div');
        card.className = 'task-card';

        // Episode progress bar
        let progressHTML = "";
        if (item.totalEp && item.totalEp > 0) {
            const percent = Math.min(100, ((item.currentEp || 0) / item.totalEp) * 100);
            const isComplete = (item.currentEp || 0) >= item.totalEp;
            progressHTML = `
                <div class="media-progress-row">
                    <span class="media-ep-text">${isComplete ? '🏆' : '📺'} ${item.currentEp || 0}/${item.totalEp}</span>
                    <div class="media-progress-bar">
                        <div class="media-progress-fill" style="width:${percent}%"></div>
                    </div>
                    <button class="media-ep-btn" onclick="updateMediaProgress(${item.id}, 1)">+1</button>
                    <button class="media-ep-btn" onclick="updateMediaProgress(${item.id}, -1)">-1</button>
                </div>
            `;
        } else if (item.currentEp && item.currentEp > 0) {
            progressHTML = `
                <div class="media-progress-row">
                    <span class="media-ep-text">📺 Ep ${item.currentEp}</span>
                    <button class="media-ep-btn" onclick="updateMediaProgress(${item.id}, 1)">+1</button>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="task-content-block">
                <span class="task-title-text" style="font-weight:500;">${item.text}</span>
                <div style="display:flex; gap:8px; margin-top:4px;">
                    <span class="anime-tag">${item.type}</span>
                    <span class="anime-tag" style="background:rgba(255,51,102,0.1); color:var(--anime-pink);">${item.details}</span>
                </div>
                ${progressHTML}
            </div>
            <span class="task-delete-btn" onclick="deleteItem(${item.id}, 'media')">✕</span>
        `;

        wrapper.appendChild(card);
        container.appendChild(wrapper);
        initSwipeGestures(card, () => deleteItem(item.id, 'media'));
    });
}

// === WORKOUT RENDERING ===
function renderWorkout() {
    const container = document.getElementById('workout-active-list');
    container.innerHTML = "";
    db.workout.forEach(item => {
        const wrapper = document.createElement('div');
        wrapper.className = 'swipe-container';

        const swipeBg = document.createElement('div');
        swipeBg.className = 'swipe-actions-bg';
        swipeBg.innerHTML = `<button class="swipe-action-btn swipe-action-delete" onclick="deleteItem(${item.id}, 'workout')">Delete</button>`;
        wrapper.appendChild(swipeBg);

        const card = document.createElement('div');
        card.className = 'task-card';
        card.innerHTML = `
            <div class="task-content-block"><span class="task-title-text">${item.text}</span></div>
            <span class="task-delete-btn" onclick="deleteItem(${item.id}, 'workout')">✕</span>
        `;

        wrapper.appendChild(card);
        container.appendChild(wrapper);
        initSwipeGestures(card, () => deleteItem(item.id, 'workout'));
    });
    syncStatDisplays();
}

// === RATIONS RENDERING ===
function renderRations() {
    const container = document.getElementById('rations-active-list');
    container.innerHTML = "";
    db.rations.forEach(item => {
        const wrapper = document.createElement('div');
        wrapper.className = 'swipe-container';

        const swipeBg = document.createElement('div');
        swipeBg.className = 'swipe-actions-bg';
        swipeBg.innerHTML = `<button class="swipe-action-btn swipe-action-delete" onclick="deleteItem(${item.id}, 'rations')">Delete</button>`;
        wrapper.appendChild(swipeBg);

        const card = document.createElement('div');
        card.className = 'task-card';
        card.innerHTML = `
            <div class="task-content-block"><span class="task-title-text">${item.text}</span></div>
            <span class="task-delete-btn" onclick="deleteItem(${item.id}, 'rations')">✕</span>
        `;

        wrapper.appendChild(card);
        container.appendChild(wrapper);
        initSwipeGestures(card, () => deleteItem(item.id, 'rations'));
    });
    syncStatDisplays();
}

// === CHRONICLE RENDERING (B2, B3, B4) ===
function renderChronicle() {
    const container = document.getElementById('chronicle-content');
    if (!container) return;
    container.innerHTML = "";

    // 1. JOURNAL SECTION (B3)
    const journalSection = document.createElement('div');
    journalSection.className = 'chronicle-section';
    const todayStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    journalSection.innerHTML = `
        <div class="chronicle-section-title">📝 Captain's Log — ${todayStr}</div>
        <textarea class="journal-textarea" id="journalTextarea" 
            placeholder="What's on your mind today? Wins, reflections, notes..."
            oninput="saveJournalEntry()">${getJournalEntry()}</textarea>
        <div class="journal-save-indicator" id="journalSaveIndicator">✓ Saved</div>
    `;
    container.appendChild(journalSection);

    // 2. STREAK BADGES (B4)
    const streaks = calculateStreaks();
    const streakSection = document.createElement('div');
    streakSection.className = 'chronicle-section';
    streakSection.innerHTML = `
        <div class="chronicle-section-title">🔥 Active Streaks</div>
        <div class="streak-row">
            <div class="streak-badge ${streaks.water > 0 ? 'active' : ''}">
                <div class="streak-fire">💧</div>
                <div class="streak-count">${streaks.water}</div>
                <div class="streak-label">Hydration</div>
            </div>
            <div class="streak-badge ${streaks.workout > 0 ? 'active' : ''}">
                <div class="streak-fire">💪</div>
                <div class="streak-count">${streaks.workout}</div>
                <div class="streak-label">Training</div>
            </div>
            <div class="streak-badge ${streaks.tasks > 0 ? 'active' : ''}">
                <div class="streak-fire">✅</div>
                <div class="streak-count">${streaks.tasks}</div>
                <div class="streak-label">Productive</div>
            </div>
        </div>
    `;
    container.appendChild(streakSection);

    // 3. HISTORY (B2)
    if (db.history.length > 0) {
        const historySection = document.createElement('div');
        historySection.className = 'chronicle-section';
        historySection.innerHTML = `<div class="chronicle-section-title">📊 Past Days Archive</div>`;

        // Show most recent first
        const recentHistory = [...db.history].reverse().slice(0, 30);

        recentHistory.forEach(day => {
            const dayCard = document.createElement('div');
            dayCard.className = 'history-day-card';

            const dateObj = new Date(day.date + 'T00:00:00');
            const dateLabel = dateObj.toLocaleDateString(undefined, {
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
            });

            const badges = [];
            if (day.hitWaterGoal) badges.push('💧');
            if (day.didWorkout) badges.push('💪');
            if (day.tasksCompleted > 0) badges.push('✅');

            dayCard.innerHTML = `
                <div class="history-date-label">${dateLabel} ${badges.join(' ')}</div>
                <div class="history-stats-grid">
                    <div class="history-stat-item">
                        <div class="history-stat-value">${day.stats.water || 0} ml</div>
                        <div class="history-stat-label">Water</div>
                    </div>
                    <div class="history-stat-item">
                        <div class="history-stat-value">${day.stats.burned || 0} kcal</div>
                        <div class="history-stat-label">Burned</div>
                    </div>
                    <div class="history-stat-item">
                        <div class="history-stat-value">${day.tasksCompleted || 0}/${day.tasksTotal || 0}</div>
                        <div class="history-stat-label">Tasks</div>
                    </div>
                    <div class="history-stat-item">
                        <div class="history-stat-value">${day.stats.pushups || 0}</div>
                        <div class="history-stat-label">Pushups</div>
                    </div>
                    <div class="history-stat-item">
                        <div class="history-stat-value">${day.stats.jogging || 0}m</div>
                        <div class="history-stat-label">Jogging</div>
                    </div>
                    <div class="history-stat-item">
                        <div class="history-stat-value">${day.stats.consumed || 0} kcal</div>
                        <div class="history-stat-label">Eaten</div>
                    </div>
                </div>
            `;
            historySection.appendChild(dayCard);
        });

        container.appendChild(historySection);
    } else {
        const emptyHistory = document.createElement('div');
        emptyHistory.className = 'chronicle-section';
        emptyHistory.innerHTML = `
            <div class="chronicle-section-title">📊 Past Days Archive</div>
            <div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;">
                <p>No history yet. Your daily stats will be archived here each morning.</p>
                <p class="motivational-quote" style="margin-top:8px;">${getRandomQuote()}</p>
            </div>
        `;
        container.appendChild(emptyHistory);
    }
}

// === STATS DISPLAY SYNC ===
function syncStatDisplays() {
    const el = (id) => document.getElementById(id);

    if (el('pushupsCount')) el('pushupsCount').innerText = db.stats.pushups || 0;
    if (el('cardioCount')) el('cardioCount').innerText = (db.stats.cardio || 0) + "m";
    if (el('waterCount')) el('waterCount').innerText = (db.stats.water || 0) + " ml";
    if (el('weightDisplay')) el('weightDisplay').innerText = (db.stats.weight ? db.stats.weight + " kg" : "-- kg");
    if (el('burnedDisplay')) el('burnedDisplay').innerText = (db.stats.burned || 0) + " kcal";
    if (el('consumedDisplay')) el('consumedDisplay').innerText = (db.stats.consumed || 0) + " kcal";
    if (el('joggingCountDisplay')) el('joggingCountDisplay').innerText = `${db.stats.jogging || 0} mins`;

    let ageYears = 25;
    if (userBirthEpoch) {
        ageYears = new Date().getFullYear() - new Date(userBirthEpoch).getFullYear();
    }

    const waterTarget = db.stats.weight ? Math.round(db.stats.weight * 35) : 2500;
    const calorieTarget = db.stats.weight && userHeightCm
        ? Math.round((10 * db.stats.weight) + (6.25 * userHeightCm) - (5 * ageYears) + 5)
        : 2000;

    if (el('waterTargetLimitLabel')) {
        el('waterTargetLimitLabel').innerText = `Water / ${waterTarget} ml`;
        let waterPercent = Math.min(100, ((db.stats.water || 0) / waterTarget) * 100);
        el('waterProgressBarFill').style.width = `${waterPercent}%`;
    }

    if (el('caloriesTargetLimitLabel')) {
        el('caloriesTargetLimitLabel').innerText = `Consumed / ${calorieTarget} kcal`;
        let calPercent = Math.min(100, ((db.stats.consumed || 0) / calorieTarget) * 100);
        el('caloriesProgressBarFill').style.width = `${calPercent}%`;
    }

    if (userHeightCm && db.stats.weight) {
        let heightM = userHeightCm / 100;
        let bmi = (db.stats.weight / (heightM * heightM)).toFixed(1);
        el('bmiOutputDisplay').innerText = bmi;

        let label = "Normal weight", color = "var(--anime-neon)";
        if (bmi < 18.5) { label = "Underweight"; color = "var(--anime-gold)"; }
        else if (bmi >= 25 && bmi < 30) { label = "Overweight"; color = "var(--anime-gold)"; }
        else if (bmi >= 30) { label = "Obese"; color = "var(--anime-pink)"; }

        el('bmiLabelStatus').innerHTML = `<span style="color:${color}; font-weight:600;">${label}</span>`;
    } else {
        el('bmiOutputDisplay').innerText = "--";
        el('bmiLabelStatus').innerText = "Log weight to calculate BMI";
    }
}

// === CHART ===
function initFitnessProgressGraph() {
    const chartCanvas = document.getElementById('metricsEvolutionChart');
    if (!chartCanvas) return;

    if (fitnessEvolutionChartInstance) fitnessEvolutionChartInstance.destroy();

    fitnessEvolutionChartInstance = new Chart(chartCanvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: ['Pushups', 'Cardio (m)', 'Burned (×10)', 'Weight (kg)', 'Jogging (m)'],
            datasets: [{
                label: 'Session',
                data: [
                    db.stats.pushups || 0,
                    db.stats.cardio || 0,
                    (db.stats.burned || 0) / 10,
                    db.stats.weight || 0,
                    db.stats.jogging || 0
                ],
                borderColor: '#1a73e8',
                backgroundColor: 'rgba(26, 115, 232, 0.1)',
                borderWidth: 2,
                tension: 0.35,
                pointBackgroundColor: '#00ffcc',
                pointBorderColor: '#1e1f22',
                pointHoverBackgroundColor: '#ffffff',
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    grid: { color: '#2f3136' },
                    ticks: { color: '#9aa0a6', font: { family: 'JetBrains Mono, monospace', size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#e3e3e3', font: { size: 10 } }
                }
            }
        }
    });
}

function updateChartMetricsEngine() {
    if (!fitnessEvolutionChartInstance) return;
    fitnessEvolutionChartInstance.data.datasets[0].data = [
        db.stats.pushups || 0,
        db.stats.cardio || 0,
        (db.stats.burned || 0) / 10,
        db.stats.weight || 0,
        db.stats.jogging || 0
    ];
    fitnessEvolutionChartInstance.update();
}

// === CONFETTI (C4) ===
function triggerConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';

    const particles = [];
    const colors = ['#ff3366', '#00ffcc', '#ffcc00', '#1a73e8', '#ffffff', '#ff6b9d', '#00d4aa'];

    for (let i = 0; i < 120; i++) {
        particles.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 100,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 16,
            vy: (Math.random() - 0.5) * 16 - 8,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 7 + 2,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 12,
            life: 1
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.35;
            p.rotation += p.rotationSpeed;
            p.life -= 0.012;

            if (p.life > 0) {
                alive = true;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation * Math.PI / 180);
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                ctx.restore();
            }
        });

        ctx.globalAlpha = 1;
        if (alive) requestAnimationFrame(animate);
        else canvas.style.display = 'none';
    }
    animate();
}

// === SWIPE-TO-DELETE (C1) ===
function initSwipeGestures(card, onSwipeLeft) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    card.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        currentX = startX;
        isDragging = true;
        card.style.transition = 'none';
    }, { passive: true });

    card.addEventListener('touchmove', e => {
        if (!isDragging) return;
        currentX = e.touches[0].clientX;
        let diff = currentX - startX;
        if (diff < 0) {
            card.style.transform = `translateX(${Math.max(diff, -120)}px)`;
        }
    }, { passive: true });

    card.addEventListener('touchend', () => {
        isDragging = false;
        let diff = currentX - startX;
        card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';

        if (diff < -90) {
            card.style.transform = 'translateX(-100%)';
            card.style.opacity = '0';
            setTimeout(() => onSwipeLeft(), 300);
        } else {
            card.style.transform = 'translateX(0)';
        }
        currentX = 0;
    });
}
