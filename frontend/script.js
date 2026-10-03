/* =========================================================
   StudyFlow - Student Productivity Dashboard
   Flow: user action -> fetch() -> Spring Boot REST API -> PostgreSQL
   ========================================================= */

const API = 'http://localhost:8080/api';

// All data the page currently holds in memory
const state = {
    user: null,
    tasks: [],
    subjects: [],
    view: 'dashboard',
    calendarDate: new Date(),
    deadlineTab: 'today',
    openSubjectId: null,
    charts: {}
};

const TITLES = {
    dashboard: 'Dashboard', tasks: 'My Tasks', subjects: 'Subjects',
    calendar: 'Calendar', analytics: 'Productivity Analytics', profile: 'Profile'
};

/* ---------------------------------------------------------
   1. Small helper functions
   --------------------------------------------------------- */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// Escape text before putting it in HTML (prevents HTML injection)
function esc(text) {
    return String(text ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Date as YYYY-MM-DD using the LOCAL timezone
function toISO(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}
const todayISO = () => toISO(new Date());
function tomorrowISO() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toISO(d);
}
function parseISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
}
function formatDate(iso) {
    if (!iso) return 'No deadline';
    return parseISO(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
function shortDate(iso) {
    return parseISO(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
function initials(name) {
    return (name || 'U').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
const statusLabel = s => ({ PENDING: 'Pending', IN_PROGRESS: 'In progress', COMPLETED: 'Completed' }[s]);

// Deadline tracking: Overdue / Due today / Due tomorrow / Upcoming
function deadlineInfo(task) {
    if (task.status === 'COMPLETED') return { label: 'Completed', cls: 'done' };
    if (!task.deadline) return { label: 'No deadline', cls: 'none' };
    const today = todayISO();
    if (task.deadline < today) return { label: 'Overdue', cls: 'overdue' };
    if (task.deadline === today) return { label: 'Due today', cls: 'today' };
    if (task.deadline === tomorrowISO()) return { label: 'Due tomorrow', cls: 'tomorrow' };
    return { label: 'Upcoming', cls: 'upcoming' };
}

let toastTimer;
function toast(message, type = 'success') {
    const el = $('#toast');
    el.textContent = message;
    el.className = `toast show ${type === 'error' ? 'error' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

function openModal(id) { $(`#${id}`).classList.remove('hidden'); }
function closeModal(id) { $(`#${id}`).classList.add('hidden'); }

/* ---------------------------------------------------------
   2. Talking to the backend
   Every request sends the logged-in user's id in a header,
   so the server only returns THAT user's data.
   --------------------------------------------------------- */
async function api(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.user) headers['X-User-Id'] = String(state.user.id);

    let res;
    try {
        res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch {
        throw new Error('Cannot reach the server. Is the Spring Boot backend running on port 8080?');
    }

    if (!res.ok) {
        let message = 'Something went wrong';
        try {
            const data = await res.json();
            if (data.message) message = data.message;
        } catch { /* response had no JSON body */ }
        throw new Error(message);
    }
    return res.status === 204 ? null : res.json();
}

// Runs a change (create/update/delete), shows a message, then reloads the data
async function run(action, successMessage) {
    try {
        await action();
        if (successMessage) toast(successMessage);
        await refreshAll();
    } catch (err) {
        toast(err.message, 'error');
    }
}

/* ---------------------------------------------------------
   3. Login / Register / Logout
   --------------------------------------------------------- */
function saveSession(user) {
    state.user = user;
    localStorage.setItem('studyflow_user', JSON.stringify(user));
}
function loadSession() {
    try { return JSON.parse(localStorage.getItem('studyflow_user')); } catch { return null; }
}
function setAuthError(msg) { $('#auth-error').textContent = msg; }

$$('[data-auth]').forEach(btn => btn.addEventListener('click', () => {
    $$('[data-auth]').forEach(b => b.classList.toggle('active', b === btn));
    $('#login-form').classList.toggle('hidden', btn.dataset.auth !== 'login');
    $('#register-form').classList.toggle('hidden', btn.dataset.auth !== 'register');
    setAuthError('');
}));

$('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    setAuthError('');
    try {
        const user = await api('/users/login', {
            method: 'POST',
            body: { email: $('#login-email').value, password: $('#login-password').value }
        });
        saveSession(user);
        $('#login-form').reset();
        startApp();
    } catch (err) { setAuthError(err.message); }
});

$('#register-form').addEventListener('submit', async e => {
    e.preventDefault();
    setAuthError('');
    try {
        const user = await api('/users/register', {
            method: 'POST',
            body: { name: $('#reg-name').value, email: $('#reg-email').value, password: $('#reg-password').value }
        });
        saveSession(user);
        $('#register-form').reset();
        startApp();
    } catch (err) { setAuthError(err.message); }
});

function logout() {
    localStorage.removeItem('studyflow_user');
    state.user = null;
    state.tasks = [];
    state.subjects = [];
    $('#app').classList.add('hidden');
    $('#auth-screen').classList.remove('hidden');
}
$('#logout-btn').addEventListener('click', logout);

async function startApp() {
    try {
        // Make sure the saved user still exists in the database
        saveSession(await api(`/users/${state.user.id}`));
    } catch (err) {
        logout();
        setAuthError(err.message);
        return;
    }
    $('#auth-screen').classList.add('hidden');
    $('#app').classList.remove('hidden');
    updateSidebarUser();
    $('#quick-deadline').value = todayISO();
    try {
        await refreshAll();
    } catch (err) { toast(err.message, 'error'); }
    showView('dashboard');
}

function updateSidebarUser() {
    $('#sidebar-name').textContent = state.user.name;
    $('#sidebar-avatar').textContent = initials(state.user.name);
}

/* ---------------------------------------------------------
   4. Navigation and loading data
   --------------------------------------------------------- */
$$('.nav-btn').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));

function showView(name) {
    state.view = name;
    $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    $('#page-title').textContent = TITLES[name];
    renderView();
}

async function renderView() {
    try {
        switch (state.view) {
            case 'dashboard': await renderDashboard(); break;
            case 'tasks': await renderTasks(); break;
            case 'subjects': await renderSubjects(); break;
            case 'calendar': await renderCalendar(); break;
            case 'analytics': await renderAnalytics(); break;
            case 'profile': renderProfile(); break;
        }
    } catch (err) { toast(err.message, 'error'); }
}

// Reload all tasks + subjects from the backend, then redraw the current page
async function refreshAll() {
    const [tasks, subjects] = await Promise.all([api('/tasks'), api('/subjects')]);
    state.tasks = tasks;
    state.subjects = subjects;
    fillSubjectSelects();
    await renderView();
}

function setOptions(selector, html) {
    const el = $(selector);
    const previous = el.value;
    el.innerHTML = html;
    if ([...el.options].some(o => o.value === previous)) el.value = previous;
}

function fillSubjectSelects() {
    const options = state.subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    setOptions('#quick-subject', `<option value="">No subject</option>${options}`);
    setOptions('#task-subject', `<option value="">No subject</option>${options}`);
    setOptions('#f-subject', `<option value="">All subjects</option>${options}`);
}

/* ---------------------------------------------------------
   5. Reusable HTML pieces
   --------------------------------------------------------- */
function emptyState(icon, text) {
    return `<div class="empty"><i class="fa-regular ${icon}"></i>${esc(text)}</div>`;
}

function taskItem(t) {
    const d = deadlineInfo(t);
    const done = t.status === 'COMPLETED';
    return `
    <div class="task-item ${done ? 'completed' : ''}">
        <button class="check-btn" data-action="toggle" data-id="${t.id}"
                title="${done ? 'Mark as pending' : 'Mark as completed'}"><i class="fa-solid fa-check"></i></button>
        <div class="task-main">
            <div class="task-title">${esc(t.title)}</div>
            ${t.description ? `<div class="task-desc">${esc(t.description)}</div>` : ''}
            <div class="task-meta">
                ${t.subjectName ? `<span class="chip" style="--c:${esc(t.subjectColor)}">${esc(t.subjectName)}</span>` : ''}
                <span class="badge prio-${t.priority.toLowerCase()}">${t.priority}</span>
                <span class="badge st-${t.status.toLowerCase()}">${statusLabel(t.status)}</span>
                <span class="badge dl-${d.cls}"><i class="fa-regular fa-calendar"></i> ${formatDate(t.deadline)} &middot; ${d.label}</span>
            </div>
        </div>
        <div class="task-actions">
            <button class="icon-btn" data-action="edit-task" data-id="${t.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button class="icon-btn danger" data-action="delete-task" data-id="${t.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
    </div>`;
}

function miniItem(t) {
    const d = deadlineInfo(t);
    return `
    <div class="mini-item" data-action="edit-task" data-id="${t.id}">
        <span class="dot" style="background:${esc(t.subjectColor || '#94a3b8')}"></span>
        <div class="mini-main">
            <strong>${esc(t.title)}</strong>
            <small>${esc(t.subjectName || 'No subject')} &middot; ${formatDate(t.deadline)}</small>
        </div>
        <span class="badge dl-${d.cls}">${d.label}</span>
    </div>`;
}

function taskPayload(t, status) {
    return { title: t.title, description: t.description, priority: t.priority,
             status, deadline: t.deadline, subjectId: t.subjectId };
}

/* ---------------------------------------------------------
   6. Dashboard
   --------------------------------------------------------- */
async function renderDashboard() {
    const summary = await api('/analytics/summary');
    $('#stat-today').textContent = summary.todayTasks;
    $('#stat-completed').textContent = summary.completed;
    $('#stat-pending').textContent = summary.pending;
    $('#stat-productivity').textContent = `${summary.productivity}%`;

    const todays = state.tasks.filter(t => t.deadline === todayISO());
    $('#today-list').innerHTML = todays.length
        ? todays.map(taskItem).join('')
        : emptyState('fa-face-smile', 'Nothing due today. Enjoy!');

    $('#subject-progress').innerHTML = state.subjects.length
        ? state.subjects.map(s => `
            <div class="sp-row">
                <div class="sp-row-head"><span>${esc(s.name)}</span>
                    <span class="muted">${s.completedTasks}/${s.totalTasks} &middot; ${s.percentage}%</span></div>
                <div class="progress"><div class="progress-bar" style="width:${s.percentage}%;background:${esc(s.color)}"></div></div>
            </div>`).join('')
        : emptyState('fa-folder-open', 'No subjects yet. Add one in the Subjects page.');

    await loadDeadlineTab();
}

// Uses GET /api/tasks/deadlines/{today|tomorrow|upcoming|overdue}
async function loadDeadlineTab() {
    $$('#deadline-tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.dl === state.deadlineTab));
    const list = await api(`/tasks/deadlines/${state.deadlineTab}`);
    $('#deadline-list').innerHTML = list.length
        ? list.map(miniItem).join('')
        : emptyState('fa-circle-check', `No ${state.deadlineTab} tasks`);
}

$('#deadline-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-dl]');
    if (!btn) return;
    state.deadlineTab = btn.dataset.dl;
    loadDeadlineTab().catch(err => toast(err.message, 'error'));
});

$('#quick-form').addEventListener('submit', e => {
    e.preventDefault();
    const body = {
        title: $('#quick-title').value,
        priority: $('#quick-priority').value,
        status: 'PENDING',
        deadline: $('#quick-deadline').value || null,
        subjectId: $('#quick-subject').value ? Number($('#quick-subject').value) : null
    };
    run(async () => {
        await api('/tasks', { method: 'POST', body });
        $('#quick-title').value = '';
    }, 'Task added');
});

/* ---------------------------------------------------------
   7. Tasks page: search, filter, sort (done by the backend)
   --------------------------------------------------------- */
async function renderTasks() {
    const params = new URLSearchParams();
    const search = $('#f-search').value.trim();
    if (search) params.set('search', search);
    if ($('#f-subject').value) params.set('subjectId', $('#f-subject').value);
    if ($('#f-priority').value) params.set('priority', $('#f-priority').value);
    if ($('#f-status').value) params.set('status', $('#f-status').value);
    params.set('sort', $('#f-sort').value);

    const tasks = await api(`/tasks?${params}`);
    $('#task-count').textContent = `${tasks.length} task${tasks.length === 1 ? '' : 's'}`;
    $('#task-list').innerHTML = tasks.length
        ? tasks.map(taskItem).join('')
        : emptyState('fa-clipboard', 'No tasks match your filters.');
}

let searchTimer;
$('#f-search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderView, 300);   // wait until the user stops typing
});
['#f-subject', '#f-priority', '#f-status', '#f-sort'].forEach(sel =>
    $(sel).addEventListener('change', renderView));

/* ---------------------------------------------------------
   8. Task add / edit modal
   --------------------------------------------------------- */
function openTaskModal(id = null) {
    const t = id ? state.tasks.find(x => x.id === id) : null;
    $('#task-modal-title').textContent = t ? 'Edit task' : 'New task';
    $('#task-id').value = t ? t.id : '';
    $('#task-title').value = t?.title ?? '';
    $('#task-desc').value = t?.description ?? '';
    $('#task-subject').value = t?.subjectId ?? '';
    $('#task-priority').value = t?.priority ?? 'MEDIUM';
    $('#task-status').value = t?.status ?? 'PENDING';
    $('#task-deadline').value = t ? (t.deadline ?? '') : todayISO();
    openModal('task-modal');
}

$('#new-task-btn').addEventListener('click', () => openTaskModal());

$('#task-form').addEventListener('submit', e => {
    e.preventDefault();
    const id = $('#task-id').value;
    const body = {
        title: $('#task-title').value,
        description: $('#task-desc').value,
        priority: $('#task-priority').value,
        status: $('#task-status').value,
        deadline: $('#task-deadline').value || null,
        subjectId: $('#task-subject').value ? Number($('#task-subject').value) : null
    };
    run(async () => {
        await api(id ? `/tasks/${id}` : '/tasks', { method: id ? 'PUT' : 'POST', body });
        closeModal('task-modal');
    }, id ? 'Task updated' : 'Task created');
});

/* ---------------------------------------------------------
   9. Subjects page
   --------------------------------------------------------- */
async function renderSubjects() {
    $('#subject-grid').innerHTML = state.subjects.length
        ? state.subjects.map(s => `
            <div class="subject-card" style="--c:${esc(s.color)}">
                <div class="subject-head">
                    <h3>${esc(s.name)}</h3>
                    <div>
                        <button class="icon-btn" data-action="edit-subject" data-id="${s.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="icon-btn danger" data-action="delete-subject" data-id="${s.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <div class="progress"><div class="progress-bar" style="width:${s.percentage}%"></div></div>
                <p>${s.completedTasks} of ${s.totalTasks} tasks completed &middot; <strong>${s.percentage}%</strong></p>
                <button class="btn btn-ghost" data-action="view-subject" data-id="${s.id}">View tasks</button>
            </div>`).join('')
        : emptyState('fa-folder-open', 'No subjects yet. Click "New subject" to add one.');

    // Keep the "subject tasks" panel up to date if it is open
    const panel = $('#subject-tasks-panel');
    const subject = state.subjects.find(s => s.id === state.openSubjectId);
    if (subject) {
        const tasks = await api(`/subjects/${subject.id}/tasks`);
        $('#subject-tasks-title').textContent = `Tasks in ${subject.name}`;
        $('#subject-tasks-list').innerHTML = tasks.length
            ? tasks.map(taskItem).join('')
            : emptyState('fa-clipboard', 'No tasks in this subject yet.');
        panel.classList.remove('hidden');
    } else {
        state.openSubjectId = null;
        panel.classList.add('hidden');
    }
}

function openSubjectModal(id = null) {
    const s = id ? state.subjects.find(x => x.id === id) : null;
    $('#subject-modal-title').textContent = s ? 'Edit subject' : 'New subject';
    $('#subject-id').value = s ? s.id : '';
    $('#subject-name').value = s?.name ?? '';
    $('#subject-color').value = s?.color ?? '#6366f1';
    openModal('subject-modal');
}

$('#new-subject-btn').addEventListener('click', () => openSubjectModal());

$('#subject-form').addEventListener('submit', e => {
    e.preventDefault();
    const id = $('#subject-id').value;
    const body = { name: $('#subject-name').value, color: $('#subject-color').value };
    run(async () => {
        await api(id ? `/subjects/${id}` : '/subjects', { method: id ? 'PUT' : 'POST', body });
        closeModal('subject-modal');
    }, id ? 'Subject updated' : 'Subject created');
});

/* ---------------------------------------------------------
   10. Calendar
   --------------------------------------------------------- */
async function renderCalendar() {
    const date = state.calendarDate;
    const year = date.getFullYear();
    const month = date.getMonth();
    $('#cal-title').textContent = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;   // week starts on Monday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = todayISO();

    let html = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        .map(n => `<div class="cal-dow">${n}</div>`).join('');
    for (let i = 0; i < startOffset; i++) html += '<div class="cal-cell empty"></div>';

    for (let day = 1; day <= daysInMonth; day++) {
        const iso = toISO(new Date(year, month, day));
        const dayTasks = state.tasks.filter(t => t.deadline === iso);
        const chips = dayTasks.slice(0, 3).map(t => {
            const info = deadlineInfo(t);
            const cls = info.cls === 'overdue' ? 'overdue' : (info.cls === 'done' ? 'done' : '');
            return `<div class="cal-task ${cls}" style="--c:${esc(t.subjectColor || '#4f46e5')}"
                         data-action="edit-task" data-id="${t.id}" title="${esc(t.title)}">${esc(t.title)}</div>`;
        }).join('');
        const more = dayTasks.length > 3 ? `<div class="cal-more">+${dayTasks.length - 3} more</div>` : '';
        html += `<div class="cal-cell ${iso === today ? 'today' : ''}">
                    <div class="cal-day">${day}</div>${chips}${more}</div>`;
    }
    $('#cal-grid').innerHTML = html;

    const [upcoming, overdue] = await Promise.all([
        api('/tasks/deadlines/upcoming'), api('/tasks/deadlines/overdue')
    ]);
    $('#cal-upcoming').innerHTML = upcoming.length
        ? upcoming.slice(0, 8).map(miniItem).join('') : emptyState('fa-calendar-check', 'No upcoming deadlines');
    $('#cal-overdue').innerHTML = overdue.length
        ? overdue.map(miniItem).join('') : emptyState('fa-face-smile', 'Nothing overdue. Great job!');
}

$('#cal-prev').addEventListener('click', () => {
    state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() - 1, 1);
    renderView();
});
$('#cal-next').addEventListener('click', () => {
    state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 1);
    renderView();
});
$('#cal-today').addEventListener('click', () => { state.calendarDate = new Date(); renderView(); });

/* ---------------------------------------------------------
   11. Analytics (Chart.js)
   --------------------------------------------------------- */
function drawChart(key, canvasId, config) {
    if (state.charts[key]) state.charts[key].destroy();   // remove the old chart before redrawing
    state.charts[key] = new Chart($(`#${canvasId}`), config);
}

async function renderAnalytics() {
    const [daily, weekly, subjects, trends, summary] = await Promise.all([
        api('/analytics/daily'), api('/analytics/weekly'), api('/analytics/subjects'),
        api('/analytics/trends'), api('/analytics/summary')
    ]);

    Chart.defaults.font.family = "'Inter', sans-serif";
    const baseOptions = { responsive: true, maintainAspectRatio: false };
    const yAxis = { beginAtZero: true, ticks: { precision: 0 } };

    drawChart('daily', 'chart-daily', {
        type: 'bar',
        data: {
            labels: daily.map(p => shortDate(p.label)),
            datasets: [{ label: 'Completed tasks', data: daily.map(p => p.value),
                         backgroundColor: '#6366f1', borderRadius: 6 }]
        },
        options: { ...baseOptions, plugins: { legend: { display: false } }, scales: { y: yAxis } }
    });

    drawChart('weekly', 'chart-weekly', {
        type: 'bar',
        data: {
            labels: weekly.map(p => 'Week of ' + shortDate(p.label)),
            datasets: [
                { label: 'Created', data: weekly.map(p => p.created), backgroundColor: '#c7d2fe', borderRadius: 6 },
                { label: 'Completed', data: weekly.map(p => p.completed), backgroundColor: '#16a34a', borderRadius: 6 }
            ]
        },
        options: { ...baseOptions, scales: { y: yAxis } }
    });

    drawChart('subjects', 'chart-subjects', {
        type: 'bar',
        data: {
            labels: subjects.map(s => s.name),
            datasets: [{ label: 'Completion %', data: subjects.map(s => s.percentage),
                         backgroundColor: subjects.map(s => s.color), borderRadius: 6 }]
        },
        options: { ...baseOptions, indexAxis: 'y', plugins: { legend: { display: false } },
                   scales: { x: { beginAtZero: true, max: 100 } } }
    });

    drawChart('completion', 'chart-completion', {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Pending'],
            datasets: [{ data: [summary.completed, summary.pending], backgroundColor: ['#16a34a', '#fbbf24'] }]
        },
        options: { ...baseOptions, cutout: '65%',
                   plugins: { title: { display: true, text: `${summary.productivity}% completed` } } }
    });

    drawChart('trends', 'chart-trends', {
        type: 'line',
        data: {
            labels: trends.map(p => shortDate(p.label)),
            datasets: [{ label: 'Tasks completed', data: trends.map(p => p.value), borderColor: '#4f46e5',
                         backgroundColor: 'rgba(79,70,229,.12)', fill: true, tension: 0.35, pointRadius: 2 }]
        },
        options: { ...baseOptions, plugins: { legend: { display: false } }, scales: { y: yAxis } }
    });
}

/* ---------------------------------------------------------
   12. Profile
   --------------------------------------------------------- */
function renderProfile() {
    const u = state.user;
    $('#profile-avatar').textContent = initials(u.name);
    $('#profile-name').textContent = u.name;
    $('#profile-email').textContent = u.email;
    $('#profile-since').textContent = `Member since ${formatDate(u.createdAt.slice(0, 10))}`;
    $('#profile-total').textContent = state.tasks.length;
    $('#profile-done').textContent = state.tasks.filter(t => t.status === 'COMPLETED').length;
    $('#profile-subjects').textContent = state.subjects.length;
    $('#profile-name-input').value = u.name;
    $('#profile-password').value = '';
}

$('#profile-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
        const updated = await api(`/users/${state.user.id}`, {
            method: 'PUT',
            body: { name: $('#profile-name-input').value, newPassword: $('#profile-password').value }
        });
        saveSession(updated);
        updateSidebarUser();
        renderProfile();
        toast('Profile updated');
    } catch (err) { toast(err.message, 'error'); }
});

/* ---------------------------------------------------------
   13. One click handler for every button with data-action
   --------------------------------------------------------- */
document.addEventListener('click', e => {
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) { closeModal(closeBtn.dataset.close); return; }
    if (e.target.classList.contains('modal')) { e.target.classList.add('hidden'); return; }   // click on dark backdrop

    const el = e.target.closest('[data-action]');
    if (!el) return;
    const id = Number(el.dataset.id);

    switch (el.dataset.action) {
        case 'toggle': {
            const t = state.tasks.find(x => x.id === id);
            if (!t) return;
            run(() => t.status === 'COMPLETED'
                ? api(`/tasks/${id}`, { method: 'PUT', body: taskPayload(t, 'PENDING') })
                : api(`/tasks/${id}/complete`, { method: 'PATCH' }));
            break;
        }
        case 'edit-task': openTaskModal(id); break;
        case 'delete-task':
            if (confirm('Delete this task?')) run(() => api(`/tasks/${id}`, { method: 'DELETE' }), 'Task deleted');
            break;
        case 'edit-subject': openSubjectModal(id); break;
        case 'delete-subject':
            if (confirm('Delete this subject AND all of its tasks?')) {
                if (state.openSubjectId === id) state.openSubjectId = null;
                run(() => api(`/subjects/${id}`, { method: 'DELETE' }), 'Subject deleted');
            }
            break;
        case 'view-subject':
            state.openSubjectId = id;
            renderView();
            setTimeout(() => $('#subject-tasks-panel').scrollIntoView({ behavior: 'smooth' }), 100);
            break;
    }
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $$('.modal').forEach(m => m.classList.add('hidden'));
});

/* ---------------------------------------------------------
   14. Start: if the user is already logged in, open the app
   --------------------------------------------------------- */
const savedUser = loadSession();
if (savedUser) {
    state.user = savedUser;
    startApp();
}
