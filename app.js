/* ═══════════════════════════════════════════════════════
   CaloriQ — Application Logic
   Client-side calorie tracker with localStorage persistence
   Security: No innerHTML — all DOM via createElement/textContent
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Constants ─────────────────────────────────────── */
  const STORAGE_KEY = 'calorieTrackerData';
  const THEME_KEY = 'calorieTrackerTheme';
  const DEFAULT_GOAL = 2000;
  const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * 85; // ~534.07
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MEAL_LABELS = {
    breakfast: '🌅 Breakfast',
    lunch: '☀️ Lunch',
    dinner: '🌙 Dinner',
    snack: '🍿 Snack',
  };

  /* ── DOM References ────────────────────────────────── */
  const $ = (id) => document.getElementById(id);

  const els = {
    progressRingFill: $('progress-ring-fill'),
    progressCalories: $('progress-calories'),
    goalDisplay: $('goal-display'),
    statConsumed: $('stat-consumed-value'),
    statRemaining: $('stat-remaining-value'),
    statAverage: $('stat-average-value'),
    mealForm: $('meal-form'),
    mealNameInput: $('meal-name-input'),
    mealCaloriesInput: $('meal-calories-input'),
    mealTypeSelect: $('meal-type-select'),
    formError: $('form-error'),
    mealsList: $('meals-list'),
    chartContainer: $('chart-container'),
    chartArea: $('chart-area'),
    goalModal: $('goal-modal'),
    goalInput: $('goal-input'),
    goalSaveBtn: $('goal-save-btn'),
    goalCancelBtn: $('goal-cancel-btn'),
    themeToggle: $('theme-toggle'),
    toastContainer: $('toast-container'),
  };

  /* ── Data Layer ────────────────────────────────────── */

  function getToday() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          goal: typeof parsed.goal === 'number' && parsed.goal > 0 ? parsed.goal : DEFAULT_GOAL,
          meals: Array.isArray(parsed.meals) ? parsed.meals : [],
        };
      }
    } catch {
      // Corrupted data — reset
    }
    return { goal: DEFAULT_GOAL, meals: [] };
  }

  function saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      showToast('Could not save data. Storage may be full.', 'error');
    }
  }

  let appData = loadData();

  /* ── Utility ───────────────────────────────────────── */

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function sanitizeText(str) {
    // Strip control characters, keep printable text
    return str.replace(/[\x00-\x1F\x7F]/g, '').trim();
  }

  function getTodayMeals() {
    const today = getToday();
    return appData.meals.filter((m) => m.date === today);
  }

  function getTodayTotal() {
    return getTodayMeals().reduce((sum, m) => sum + m.calories, 0);
  }

  function getDayTotal(dateStr) {
    return appData.meals
      .filter((m) => m.date === dateStr)
      .reduce((sum, m) => sum + m.calories, 0);
  }

  function getLast7Days() {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push({
        date: d.toISOString().slice(0, 10),
        dayName: DAY_NAMES[d.getDay()],
        isToday: i === 0,
      });
    }
    return days;
  }

  function get7DayAverage() {
    const days = getLast7Days();
    let total = 0;
    let count = 0;
    for (const day of days) {
      const dayTotal = getDayTotal(day.date);
      if (dayTotal > 0) {
        total += dayTotal;
        count++;
      }
    }
    return count > 0 ? Math.round(total / count) : 0;
  }

  /* ── Toast Notifications ───────────────────────────── */

  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.classList.add('toast', 'toast--' + (type === 'error' ? 'error' : 'success'));

    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = type === 'error' ? '⚠️' : '✅';

    const text = document.createElement('span');
    text.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(text);
    els.toastContainer.appendChild(toast);

    setTimeout(function () {
      toast.classList.add('toast-exit');
      toast.addEventListener('animationend', function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      });
    }, 2800);
  }

  /* ── Progress Ring ─────────────────────────────────── */

  function updateProgress() {
    const consumed = getTodayTotal();
    const goal = appData.goal;
    const pct = Math.min(consumed / goal, 1);
    const offset = PROGRESS_CIRCUMFERENCE * (1 - pct);

    els.progressRingFill.style.strokeDashoffset = offset;
    els.progressCalories.textContent = consumed.toLocaleString();
    els.goalDisplay.textContent = goal.toLocaleString() + ' kcal';

    // Color shift: green → warning → danger
    const root = document.documentElement;
    if (consumed > goal) {
      root.style.setProperty('--progress-color', 'var(--color-danger)');
      root.style.setProperty('--progress-glow', 'var(--color-danger-glow)');
    } else if (consumed > goal * 0.8) {
      root.style.setProperty('--progress-color', 'var(--color-warning)');
      root.style.setProperty('--progress-glow', 'var(--color-warning-glow)');
    } else {
      root.style.setProperty('--progress-color', 'var(--color-success)');
      root.style.setProperty('--progress-glow', 'var(--color-success-glow)');
    }
  }

  /* ── Stats ─────────────────────────────────────────── */

  function updateStats() {
    const consumed = getTodayTotal();
    const remaining = Math.max(appData.goal - consumed, 0);
    const avg = get7DayAverage();

    els.statConsumed.textContent = consumed.toLocaleString() + ' kcal';
    els.statRemaining.textContent = remaining.toLocaleString() + ' kcal';
    els.statAverage.textContent = avg.toLocaleString() + ' kcal';
  }

  /* ── Meal List ─────────────────────────────────────── */

  function renderMealItem(meal) {
    const item = document.createElement('div');
    item.classList.add('meal-item');
    item.setAttribute('role', 'listitem');
    item.setAttribute('data-meal-id', meal.id);

    // Type badge
    const badge = document.createElement('div');
    badge.classList.add('meal-type-badge', 'meal-type-badge--' + meal.type);
    badge.setAttribute('aria-hidden', 'true');

    // Info container
    const info = document.createElement('div');
    info.classList.add('meal-info');

    const name = document.createElement('div');
    name.classList.add('meal-name');
    name.textContent = meal.name;
    name.setAttribute('title', meal.name);

    const meta = document.createElement('div');
    meta.classList.add('meal-meta');
    meta.textContent = (MEAL_LABELS[meal.type] || meal.type) + ' · ' + formatTime(meal.timestamp);

    info.appendChild(name);
    info.appendChild(meta);

    // Calories
    const cal = document.createElement('div');
    cal.classList.add('meal-calories');
    cal.textContent = meal.calories + ' kcal';

    // Delete button
    const del = document.createElement('button');
    del.classList.add('meal-delete');
    del.setAttribute('type', 'button');
    del.setAttribute('aria-label', 'Delete ' + meal.name);
    del.textContent = '✕';
    del.addEventListener('click', function () {
      deleteMeal(meal.id, item);
    });

    item.appendChild(badge);
    item.appendChild(info);
    item.appendChild(cal);
    item.appendChild(del);

    return item;
  }

  function formatTime(timestamp) {
    try {
      const d = new Date(timestamp);
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function renderMealsList() {
    els.mealsList.replaceChildren();

    const todayMeals = getTodayMeals();

    if (todayMeals.length === 0) {
      const empty = document.createElement('div');
      empty.classList.add('meals-empty');

      const emptyIcon = document.createElement('div');
      emptyIcon.classList.add('empty-icon');
      emptyIcon.textContent = '🥗';

      const emptyText = document.createElement('p');
      emptyText.textContent = 'No meals logged today. Add your first meal above!';

      empty.appendChild(emptyIcon);
      empty.appendChild(emptyText);
      els.mealsList.appendChild(empty);
      return;
    }

    // Sort by timestamp descending (most recent first)
    const sorted = todayMeals.slice().sort((a, b) => b.timestamp - a.timestamp);
    for (const meal of sorted) {
      els.mealsList.appendChild(renderMealItem(meal));
    }
  }

  /* ── Meal CRUD ─────────────────────────────────────── */

  function addMeal(name, calories, type) {
    const meal = {
      id: generateId(),
      name: name,
      calories: calories,
      type: type,
      date: getToday(),
      timestamp: Date.now(),
    };
    appData.meals.push(meal);
    saveData(appData);
    refreshUI();
    showToast(name + ' added (' + calories + ' kcal)', 'success');
  }

  function deleteMeal(id, itemEl) {
    // Animate out
    if (itemEl) {
      itemEl.style.opacity = '0';
      itemEl.style.transform = 'translateX(30px)';
      itemEl.style.transition = 'opacity 0.25s, transform 0.25s';
    }

    setTimeout(function () {
      appData.meals = appData.meals.filter((m) => m.id !== id);
      saveData(appData);
      refreshUI();
      showToast('Meal removed', 'success');
    }, 250);
  }

  /* ── Form Validation ───────────────────────────────── */

  function showFormError(message) {
    els.formError.textContent = message;
    els.formError.classList.add('visible');
  }

  function hideFormError() {
    els.formError.textContent = '';
    els.formError.classList.remove('visible');
  }

  function validateAndSubmit() {
    hideFormError();
    els.mealNameInput.classList.remove('input-error');
    els.mealCaloriesInput.classList.remove('input-error');

    const rawName = els.mealNameInput.value;
    const name = sanitizeText(rawName);
    const caloriesStr = els.mealCaloriesInput.value;
    const type = els.mealTypeSelect.value;

    // Validate name
    if (!name || name.length === 0) {
      showFormError('Please enter a meal name.');
      els.mealNameInput.classList.add('input-error');
      els.mealNameInput.focus();
      return;
    }

    if (name.length > 100) {
      showFormError('Meal name must be 100 characters or fewer.');
      els.mealNameInput.classList.add('input-error');
      els.mealNameInput.focus();
      return;
    }

    // Validate calories
    const calories = parseInt(caloriesStr, 10);
    if (isNaN(calories) || calories < 1) {
      showFormError('Please enter a valid calorie count (minimum 1).');
      els.mealCaloriesInput.classList.add('input-error');
      els.mealCaloriesInput.focus();
      return;
    }

    if (calories > 10000) {
      showFormError('Calorie count cannot exceed 10,000.');
      els.mealCaloriesInput.classList.add('input-error');
      els.mealCaloriesInput.focus();
      return;
    }

    // Validate type
    const validTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    if (!validTypes.includes(type)) {
      showFormError('Please select a valid meal type.');
      return;
    }

    addMeal(name, calories, type);

    // Reset form
    els.mealNameInput.value = '';
    els.mealCaloriesInput.value = '';
    els.mealNameInput.focus();
  }

  /* ── Weekly Chart ──────────────────────────────────── */

  function renderChart() {
    els.chartContainer.replaceChildren();

    const days = getLast7Days();
    const goal = appData.goal;

    // Find max for scaling
    let maxCal = goal;
    for (const day of days) {
      const total = getDayTotal(day.date);
      if (total > maxCal) maxCal = total;
    }
    // Add headroom
    maxCal = Math.ceil(maxCal * 1.15);
    if (maxCal === 0) maxCal = goal;

    // Goal line position
    const goalPct = (goal / maxCal) * 100;

    // Remove old goal line if any
    const existingGoalLine = els.chartArea.querySelector('.chart-goal-line');
    if (existingGoalLine) {
      existingGoalLine.parentNode.removeChild(existingGoalLine);
    }

    // Add goal line
    const goalLine = document.createElement('div');
    goalLine.classList.add('chart-goal-line');
    goalLine.style.bottom = goalPct + '%';
    els.chartArea.appendChild(goalLine);

    for (const day of days) {
      const total = getDayTotal(day.date);
      const heightPct = maxCal > 0 ? (total / maxCal) * 100 : 0;

      const group = document.createElement('div');
      group.classList.add('chart-bar-group');

      const barWrapper = document.createElement('div');
      barWrapper.classList.add('chart-bar-wrapper');

      const bar = document.createElement('div');
      bar.classList.add('chart-bar');
      if (total > goal) bar.classList.add('chart-bar--over');
      if (day.isToday) bar.classList.add('chart-bar--today');
      bar.style.height = Math.max(heightPct, 2) + '%';
      bar.setAttribute('data-calories', total > 0 ? total.toLocaleString() + ' kcal' : '—');

      barWrapper.appendChild(bar);

      const label = document.createElement('div');
      label.classList.add('chart-day');
      if (day.isToday) label.classList.add('chart-day--today');
      label.textContent = day.dayName;

      group.appendChild(barWrapper);
      group.appendChild(label);
      els.chartContainer.appendChild(group);
    }
  }

  /* ── Goal Modal ────────────────────────────────────── */

  function openGoalModal() {
    els.goalInput.value = appData.goal;
    els.goalModal.classList.add('active');
    els.goalInput.focus();
  }

  function closeGoalModal() {
    els.goalModal.classList.remove('active');
  }

  function saveGoal() {
    const val = parseInt(els.goalInput.value, 10);
    if (isNaN(val) || val < 500 || val > 10000) {
      showToast('Goal must be between 500 and 10,000 kcal.', 'error');
      return;
    }
    appData.goal = val;
    saveData(appData);
    closeGoalModal();
    refreshUI();
    showToast('Daily goal set to ' + val.toLocaleString() + ' kcal', 'success');
  }

  /* ── Theme ─────────────────────────────────────────── */

  function loadTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') {
        document.documentElement.setAttribute('data-theme', saved);
      }
    } catch {
      // Ignore
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Ignore
    }
  }

  /* ── Refresh All UI ────────────────────────────────── */

  function refreshUI() {
    updateProgress();
    updateStats();
    renderMealsList();
    renderChart();
  }

  /* ── Event Listeners ───────────────────────────────── */

  function init() {
    loadTheme();

    // Form submit
    els.mealForm.addEventListener('submit', function (e) {
      e.preventDefault();
      validateAndSubmit();
    });

    // Goal modal
    els.goalDisplay.addEventListener('click', openGoalModal);
    els.goalDisplay.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openGoalModal();
      }
    });

    els.goalSaveBtn.addEventListener('click', saveGoal);
    els.goalCancelBtn.addEventListener('click', closeGoalModal);

    // Close modal on overlay click
    els.goalModal.addEventListener('click', function (e) {
      if (e.target === els.goalModal) {
        closeGoalModal();
      }
    });

    // Close modal on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && els.goalModal.classList.contains('active')) {
        closeGoalModal();
      }
    });

    // Goal modal Enter key
    els.goalInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveGoal();
      }
    });

    // Theme toggle
    els.themeToggle.addEventListener('click', toggleTheme);

    // Clear input error styles on focus
    els.mealNameInput.addEventListener('focus', function () {
      this.classList.remove('input-error');
      hideFormError();
    });
    els.mealCaloriesInput.addEventListener('focus', function () {
      this.classList.remove('input-error');
      hideFormError();
    });

    // Initial render
    refreshUI();
  }

  /* ── Boot ──────────────────────────────────────────── */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
