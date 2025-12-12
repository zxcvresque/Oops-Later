var App = (function() {
    var tasks = [];
    var trashedTasks = [];
    var activeView = 'board';
    var selectedTask = null;
    var currentTagFilters = [];
    var lastAction = null;
    var selectedTaskIds = new Set();
    var isSelectMode = false;
    var draggedTaskId = null;

    function init() {
        loadTheme();
        loadTasks();
        loadTrash();
        migrateTasks();
        setupEventListeners();
        setupKeyboardShortcuts();
        setupGlobalSearch();
        renderView();
        renderNowSlot();
        checkWelcome();
        requestNotificationPermission();
        startAlarmChecker();
        setupEnergyMode();
    }

    function migrateTasks() {
        var needsSave = false;
        tasks = tasks.map(function(task) {
            if (task.estimateMin === undefined) {
                task.estimateMin = 15;
                needsSave = true;
            }
            if (task.effort === undefined) {
                task.effort = 2;
                needsSave = true;
            }
            if (task.activeNow === undefined) {
                task.activeNow = false;
                needsSave = true;
            }
            return task;
        });
        if (needsSave) saveTasks();
    }

    function setupEnergyMode() {
        var energyBtn = document.getElementById('energyModeBtn');
        var energyModal = document.getElementById('energyModal');
        var energyCloseBtn = document.getElementById('energyCloseBtn');
        var energyModalClose = document.getElementById('energyModalClose');
        var suggestBtn = document.getElementById('suggestTasksBtn');
        var defaultTitle = 'Pick your energy and time — I\'ll match tasks to your battery level.';

        function resetEnergyModal() {
            var titleEl = document.getElementById('energyModalTitle');
            if (titleEl) titleEl.textContent = defaultTitle;
            document.getElementById('energySuggestions').innerHTML = '';
        }

        if (energyBtn) {
            energyBtn.addEventListener('click', function() {
                resetEnergyModal();
                energyModal.classList.add('show');
            });
        }

        function closeEnergyModal() {
            energyModal.classList.remove('show');
            resetEnergyModal();
        }

        if (energyCloseBtn) energyCloseBtn.addEventListener('click', closeEnergyModal);
        if (energyModalClose) energyModalClose.addEventListener('click', closeEnergyModal);

        energyModal.addEventListener('click', function(e) {
            if (e.target === energyModal) closeEnergyModal();
        });

        document.querySelectorAll('#timeButtons .energy-option-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('#timeButtons .energy-option-btn').forEach(function(b) { b.classList.remove('selected'); });
                this.classList.add('selected');
            });
        });

        document.querySelectorAll('#energyButtons .energy-option-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('#energyButtons .energy-option-btn').forEach(function(b) { b.classList.remove('selected'); });
                this.classList.add('selected');
            });
        });

        if (suggestBtn) {
            suggestBtn.addEventListener('click', function() {
                var timeBtn = document.querySelector('#timeButtons .energy-option-btn.selected');
                var energyLevelBtn = document.querySelector('#energyButtons .energy-option-btn.selected');
                var time = timeBtn ? parseInt(timeBtn.getAttribute('data-time')) : 30;
                var energy = energyLevelBtn ? parseInt(energyLevelBtn.getAttribute('data-energy')) : 2;
                updateEnergyModalTitle(time, energy);
                showEnergySuggestions(time, energy, false);
            });
        }
    }
    
    function updateEnergyModalTitle(time, energy) {
        var energyLabels = { 1: 'Low energy', 2: 'Steady energy', 3: 'High energy' };
        var energyEmojis = { 1: '🔋', 2: '⚡', 3: '🔥' };
        var energyLabel = energyLabels[energy] || 'Steady energy';
        var emoji = energyEmojis[energy] || '⚡';
        var durationLabel = time === 999 ? 'unlimited time' : (time === 61 ? '60+ min' : time + ' min');
        
        var sentences = {
            1: "Let's find easy wins you can handle.",
            2: "Let's make solid progress.",
            3: "Time to tackle the big stuff!"
        };
        
        var sentence = sentences[energy] || sentences[2];
        var titleEl = document.getElementById('energyModalTitle');
        if (titleEl) {
            titleEl.textContent = emoji + ' ' + energyLabel + ' · ' + durationLabel + ' — ' + sentence;
        }
    }

    function getEnergyTagline(time, energy) {
        var energyLabels = {
            1: 'Low energy',
            2: 'Steady energy',
            3: 'High energy'
        };
        var energyLabel = energyLabels[energy] || 'Steady energy';
        var durationLabel = time === 999 ? 'Unlimited' : (time === 61 ? '60+' : time) + ' min';
        
        var sentences = {
            1: {
                15: "Tiny, low-effort tasks you can finish quickly.",
                30: "Easy wins only, we'll chip away without burning out.",
                60: "Slow & steady: a calm hour of simple tasks.",
                61: "Take your time with easy, relaxed tasks.",
                999: "Easy, low-effort tasks only."
            },
            2: {
                15: "Quick tasks to make the most of a short burst.",
                30: "A good block for a few meaningful tasks.",
                60: "Plenty of time for steady, focused progress.",
                61: "A solid mix of small and medium tasks.",
                999: "A realistic mix of tasks."
            },
            3: {
                15: "Short sprint: one sharp, high-impact task.",
                30: "Great window for deep-ish, focused work.",
                60: "Full focus session: time to attack the big stuff.",
                61: "Perfect time to tackle the chunky, high-impact tasks.",
                999: "Let's focus on your most impactful work."
            }
        };
        
        var sentence = sentences[energy] && sentences[energy][time] ? 
            sentences[energy][time] : sentences[energy][999];
        
        return '<div class="energy-tagline"><strong>' + energyLabel + '</strong> · ' + durationLabel + ' — ' + sentence + '</div>';
    }

    function showEnergySuggestions(time, energy, shuffle) {
        var candidates = getEnergyCandidates(time, energy);
        if (shuffle && candidates.length > 3) {
            candidates = shuffleArray(candidates).slice(0, 3);
        } else {
            candidates = candidates.slice(0, 3);
        }

        var container = document.getElementById('energySuggestions');
        var taglineHtml = getEnergyTagline(time, energy);
        
        if (candidates.length === 0) {
            container.innerHTML = taglineHtml + '<p style="text-align:center;color:var(--muted-foreground);margin-top:16px;">No tasks match your criteria. Try increasing time or energy level.</p>';
            return;
        }

        var html = taglineHtml + candidates.map(function(task) {
            var tagsHtml = task.tags.slice(0, 2).map(function(tag) {
                return '<span class="badge tag">#' + tag + '</span>';
            }).join('');
            return '<div class="energy-suggestion-card">' +
                '<div class="energy-suggestion-info">' +
                '<div class="energy-suggestion-title">' + escapeHtml(task.title) + '</div>' +
                '<div class="energy-suggestion-meta">' +
                '<span class="badge">' + (task.estimateMin !== undefined ? task.estimateMin + ' min' : 'No estimate') + '</span>' +
                tagsHtml +
                '</div></div>' +
                '<button class="energy-start-btn" data-task-id="' + task.id + '">Start</button>' +
                '</div>';
        }).join('');

        html += '<button class="btn btn-outline energy-shuffle-btn" id="shuffleBtn">🔀 Shuffle</button>';
        container.innerHTML = html;
        
        updateEnergyModalTitle(time, energy);

        container.querySelectorAll('.energy-start-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var taskId = this.getAttribute('data-task-id');
                startNowTask(taskId);
                document.getElementById('energyModal').classList.remove('show');
                container.innerHTML = '';
            });
        });

        var shuffleBtn = document.getElementById('shuffleBtn');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', function() {
                var timeBtn = document.querySelector('#timeButtons .energy-option-btn.selected');
                var energyLevelBtn = document.querySelector('#energyButtons .energy-option-btn.selected');
                var t = timeBtn ? parseInt(timeBtn.getAttribute('data-time')) : 30;
                var e = energyLevelBtn ? parseInt(energyLevelBtn.getAttribute('data-energy')) : 2;
                showEnergySuggestions(t, e, true);
            });
        }
    }

    function getEnergyCandidates(time, energy) {
        var isSuperEnergised = (time === 999);
        var is60Plus = (time === 61);
        
        var candidates = tasks.filter(function(t) {
            if (t.status === 'done' || t.completed) return false;
            var est = t.estimateMin;
            var eff = t.effort || 2;
            
            if (isSuperEnergised) {
                return eff <= energy;
            }
            if (is60Plus) {
                return (est === undefined || est >= 60) && eff <= energy;
            }
            if (est === undefined) {
                if (energy >= 2) return eff <= energy;
                return false;
            }
            return est <= time && eff <= energy;
        });

        if (candidates.length < 3 && !isSuperEnergised) {
            var relaxedEffort = tasks.filter(function(t) {
                if (t.status === 'done' || t.completed) return false;
                var est = t.estimateMin;
                var eff = t.effort || 2;
                if (is60Plus) {
                    return (est === undefined || est >= 60) && eff <= Math.min(energy + 1, 3);
                }
                if (est === undefined) return eff <= Math.min(energy + 1, 3);
                return est <= time && eff <= Math.min(energy + 1, 3);
            });
            candidates = relaxedEffort;
        }

        if (candidates.length < 3 && !isSuperEnergised && !is60Plus) {
            var relaxedTime = tasks.filter(function(t) {
                if (t.status === 'done' || t.completed) return false;
                var est = t.estimateMin;
                var eff = t.effort || 2;
                if (est === undefined) return eff <= Math.min(energy + 1, 3);
                return est <= (time + 15) && eff <= Math.min(energy + 1, 3);
            });
            candidates = relaxedTime;
        }

        candidates.sort(function(a, b) {
            var effA = a.effort || 2;
            var effB = b.effort || 2;
            if (effA !== effB) return effA - effB;
            
            if (a.dueDate && b.dueDate) {
                return new Date(a.dueDate) - new Date(b.dueDate);
            }
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;
            var priorityOrder = { high: 0, medium: 1, low: 2 };
            return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
        });

        return candidates.slice(0, 10);
    }

    function shuffleArray(arr) {
        var shuffled = arr.slice();
        for (var i = shuffled.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = temp;
        }
        return shuffled;
    }

    function startNowTask(taskId) {
        var focusTasks = tasks.filter(function(t) { return t.activeNow; });
        if (focusTasks.length >= 3) {
            showToast('Focus Limit', 'You can only have up to 3 tasks in focus mode');
            return;
        }
        
        var alreadyFocused = focusTasks.some(function(t) { return t.id === taskId; });
        if (alreadyFocused) {
            showToast('Already Focused', 'This task is already in focus mode');
            return;
        }
        
        tasks = tasks.map(function(t) {
            if (t.id === taskId) {
                t.activeNow = true;
                if (t.status === 'todo') {
                    t.status = 'doing';
                }
            }
            return t;
        });
        saveTasks();
        renderNowSlot();
        renderView();
        showToast('Focus Mode', 'Task added to focus! (' + (focusTasks.length + 1) + '/3)');
    }

    function clearNowTask(taskId) {
        if (taskId) {
            tasks = tasks.map(function(t) {
                if (t.id === taskId) {
                    t.activeNow = false;
                }
                return t;
            });
        } else {
            tasks = tasks.map(function(t) {
                t.activeNow = false;
                return t;
            });
        }
        saveTasks();
        renderNowSlot();
        renderView();
    }

    function completeNowTask() {
        var nowTask = tasks.find(function(t) { return t.activeNow; });
        if (nowTask) {
            updateTask(nowTask.id, { status: 'done', completed: true, activeNow: false });
            showToast('Task Done!', 'Great job completing your focus task!');
        }
        renderNowSlot();
    }

    function renderNowSlot() {
        var container = document.getElementById('nowSlotContainer');
        if (!container) return;

        var nowTasks = tasks.filter(function(t) { return t.activeNow; });
        if (nowTasks.length === 0) {
            container.innerHTML = '';
            return;
        }

        var tasksHtml = nowTasks.map(function(task) {
            return '<div class="now-slot" data-task-id="' + task.id + '">' +
                '<span class="now-slot-label">FOCUS ⚡</span>' +
                '<span class="now-slot-title">' + escapeHtml(task.title) + '</span>' +
                '<div class="now-slot-actions">' +
                '<button class="now-slot-btn now-slot-done" data-task-id="' + task.id + '">Done</button>' +
                '<button class="now-slot-btn now-slot-clear" data-task-id="' + task.id + '">Clear</button>' +
                '</div></div>';
        }).join('');

        container.innerHTML = tasksHtml;

        container.querySelectorAll('.now-slot-done').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var taskId = this.getAttribute('data-task-id');
                completeNowTaskById(taskId);
            });
        });

        container.querySelectorAll('.now-slot-clear').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var taskId = this.getAttribute('data-task-id');
                clearNowTask(taskId);
            });
        });
    }

    function completeNowTaskById(taskId) {
        var task = tasks.find(function(t) { return t.id === taskId; });
        if (task) {
            updateTask(taskId, { status: 'done', completed: true, activeNow: false });
            showToast('Task Done!', 'Great job completing your focus task!');
        }
        renderNowSlot();
    }

    function loadTheme() {
        var theme = Storage.getTheme();
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            updateThemeButton(true);
        }
    }

    function loadTasks() {
        tasks = Storage.getTasks();
    }

    function saveTasks() {
        Storage.saveTasks(tasks);
    }

    function loadTrash() {
        try {
            var data = localStorage.getItem('oops-later-trash');
            if (data) {
                trashedTasks = JSON.parse(data).map(function(task) {
                    return Object.assign({}, task, {
                        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
                        deletedAt: task.deletedAt ? new Date(task.deletedAt) : new Date()
                    });
                });
            }
        } catch (error) {
            trashedTasks = [];
        }
    }

    function saveTrash() {
        try {
            localStorage.setItem('oops-later-trash', JSON.stringify(trashedTasks));
        } catch (error) {
            console.error('Error saving trash:', error);
        }
    }

    function setupEventListeners() {
        document.querySelectorAll('.nav-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var view = this.getAttribute('data-view');
                setActiveView(view);
            });
        });

        document.getElementById('themeToggle').addEventListener('click', toggleTheme);
        document.getElementById('addTaskBtn').addEventListener('click', openNewTaskModal);
        document.getElementById('modalClose').addEventListener('click', closeTaskModal);
        document.getElementById('taskModal').addEventListener('click', function(e) {
            if (e.target === this) closeTaskModal();
        });

        document.getElementById('welcomeClose').addEventListener('click', closeWelcome);
        document.getElementById('startFreshBtn').addEventListener('click', closeWelcome);
        document.getElementById('loadSamplesBtn').addEventListener('click', loadSampleTasks);

        setupNewTaskModal();
    }

    var currentSearchQuery = '';

    function openNewTaskModal(prefillText) {
        var modal = document.getElementById('newTaskModal');
        var titleInput = document.getElementById('newTaskTitle');
        
        document.getElementById('newTaskEstimate').value = '15';
        document.getElementById('newTaskEffort').value = '2';
        document.getElementById('newTaskDate').value = '';
        document.getElementById('newTaskTime').value = '';
        document.getElementById('newTaskPriority').value = 'medium';
        document.getElementById('newTaskTags').value = '';
        document.getElementById('newTaskDescription').value = '';
        document.getElementById('newTaskRepeat').value = 'none';
        document.getElementById('customRepeatOptions').style.display = 'none';
        document.getElementById('customRepeatValue').value = '1';
        document.getElementById('customRepeatUnit').value = 'days';
        
        if (typeof prefillText === 'string' && prefillText.trim()) {
            var parsed = TaskParser.parse(prefillText);
            titleInput.value = parsed.title;
            if (parsed.dueDate) {
                document.getElementById('newTaskDate').value = formatDateInput(parsed.dueDate);
            }
            if (parsed.dueTime) {
                document.getElementById('newTaskTime').value = parsed.dueTime;
            }
            if (parsed.priority) {
                document.getElementById('newTaskPriority').value = parsed.priority;
            }
            if (parsed.tags && parsed.tags.length > 0) {
                document.getElementById('newTaskTags').value = parsed.tags.join(', ');
            }
        } else {
            titleInput.value = '';
        }
        
        modal.classList.add('show');
        titleInput.focus();
    }

    function closeNewTaskModal() {
        document.getElementById('newTaskModal').classList.remove('show');
    }

    function setupNewTaskModal() {
        var modal = document.getElementById('newTaskModal');
        var closeBtn = document.getElementById('newTaskModalClose');
        var cancelBtn = document.getElementById('cancelTaskBtn');
        var createBtn = document.getElementById('createTaskBtn');
        var titleInput = document.getElementById('newTaskTitle');
        var repeatSelect = document.getElementById('newTaskRepeat');
        var customRepeatOptions = document.getElementById('customRepeatOptions');

        closeBtn.addEventListener('click', closeNewTaskModal);
        cancelBtn.addEventListener('click', closeNewTaskModal);
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeNewTaskModal();
        });

        createBtn.addEventListener('click', createTaskFromModal);
        
        titleInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                createTaskFromModal();
            }
        });

        repeatSelect.addEventListener('change', function() {
            if (this.value === 'custom') {
                customRepeatOptions.style.display = 'block';
            } else {
                customRepeatOptions.style.display = 'none';
            }
        });

        var estimateSelect = document.getElementById('newTaskEstimate');
        var customEstimateOptions = document.getElementById('customEstimateOptions');
        if (estimateSelect && customEstimateOptions) {
            estimateSelect.addEventListener('change', function() {
                if (this.value === 'custom') {
                    customEstimateOptions.style.display = 'block';
                } else {
                    customEstimateOptions.style.display = 'none';
                }
            });
        }
    }

    function createTaskFromModal() {
        var title = document.getElementById('newTaskTitle').value.trim();
        if (!title) {
            showToast('Missing Title', 'Please enter a task title');
            return;
        }

        var estimateValue = document.getElementById('newTaskEstimate').value;
        var estimateMin;
        if (estimateValue === 'undefined') {
            estimateMin = undefined;
        } else if (estimateValue === 'custom') {
            estimateMin = parseInt(document.getElementById('customEstimateValue').value) || 15;
        } else {
            estimateMin = parseInt(estimateValue) || 15;
        }
        var effort = parseInt(document.getElementById('newTaskEffort').value) || 2;
        var dueDate = document.getElementById('newTaskDate').value;
        var dueTime = document.getElementById('newTaskTime').value;
        var priority = document.getElementById('newTaskPriority').value;
        var tagsStr = document.getElementById('newTaskTags').value;
        var tags = tagsStr ? tagsStr.split(',').map(function(t) { return t.trim(); }).filter(Boolean) : [];
        var description = document.getElementById('newTaskDescription').value.trim();
        var recurrence = document.getElementById('newTaskRepeat').value;
        
        if (recurrence === 'custom') {
            var customValue = parseInt(document.getElementById('customRepeatValue').value) || 1;
            var customUnit = document.getElementById('customRepeatUnit').value;
            recurrence = 'custom:' + customValue + ':' + customUnit;
        }

        var task = {
            id: generateId(),
            title: title,
            description: description,
            status: 'todo',
            priority: priority,
            dueDate: dueDate ? new Date(dueDate + 'T00:00:00') : undefined,
            dueTime: dueTime || undefined,
            tags: tags,
            subtasks: [],
            createdAt: new Date(),
            completed: false,
            pinned: false,
            alarmEnabled: true,
            estimateMin: estimateMin,
            effort: effort,
            activeNow: false,
            recurrence: recurrence
        };

        tasks.unshift(task);
        saveTasks();
        closeNewTaskModal();
        document.getElementById('quickAddInput').value = '';
        renderView();
        showToast('Task Created', '"' + title + '" added to your list');
    }

    function performSearch() {
        var query = document.getElementById('quickAddInput').value.trim().toLowerCase();
        if (!query) {
            clearSearchResults();
            return;
        }

        if (activeView === 'analytics' || activeView === 'settings') {
            setActiveView('board');
        }

        currentSearchQuery = query;
        renderView();
    }

    function clearSearchResults() {
        currentSearchQuery = '';
        document.getElementById('quickAddInput').value = '';
        renderView();
    }

    function openGlobalSearch() {
        var overlay = document.getElementById('globalSearchOverlay');
        var input = document.getElementById('globalSearchInput');
        var results = document.getElementById('globalSearchResults');
        
        overlay.classList.add('show');
        input.value = '';
        results.innerHTML = '';
        input.focus();
    }

    function closeGlobalSearch() {
        var overlay = document.getElementById('globalSearchOverlay');
        overlay.classList.remove('show');
        document.getElementById('globalSearchInput').value = '';
        document.getElementById('globalSearchResults').innerHTML = '';
    }

    function setupGlobalSearch() {
        var overlay = document.getElementById('globalSearchOverlay');
        var input = document.getElementById('globalSearchInput');
        var results = document.getElementById('globalSearchResults');

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeGlobalSearch();
            }
        });

        input.addEventListener('input', function() {
            var query = this.value.trim().toLowerCase();
            if (!query) {
                results.innerHTML = '';
                return;
            }
            performGlobalSearch(query);
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeGlobalSearch();
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                var firstResult = results.querySelector('.global-search-result-item');
                if (firstResult) {
                    var taskId = firstResult.getAttribute('data-task-id');
                    if (taskId) {
                        closeGlobalSearch();
                        openTaskModal(taskId);
                    }
                }
            }
        });
    }

    function performGlobalSearch(query) {
        var results = document.getElementById('globalSearchResults');
        var allTasks = tasks.concat(trashedTasks);
        
        var matches = allTasks.filter(function(task) {
            var titleMatch = task.title.toLowerCase().indexOf(query) !== -1;
            var tagMatch = task.tags && task.tags.some(function(tag) {
                return tag.toLowerCase().indexOf(query) !== -1;
            });
            var descMatch = task.description && task.description.toLowerCase().indexOf(query) !== -1;
            return titleMatch || tagMatch || descMatch;
        });

        if (matches.length === 0) {
            results.innerHTML = '<div class="global-search-empty">No tasks found</div>';
            return;
        }

        var html = matches.slice(0, 10).map(function(task) {
            var statusClass = task.completed ? 'completed' : task.status;
            var tagsHtml = task.tags.slice(0, 3).map(function(tag) {
                return '<span class="badge tag">#' + escapeHtml(tag) + '</span>';
            }).join('');
            
            return '<div class="global-search-result-item" data-task-id="' + task.id + '">' +
                '<div class="global-search-result-title">' + escapeHtml(task.title) + '</div>' +
                '<div class="global-search-result-meta">' +
                '<span class="badge">' + statusClass + '</span>' +
                tagsHtml +
                '</div></div>';
        }).join('');

        results.innerHTML = html;

        results.querySelectorAll('.global-search-result-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var taskId = this.getAttribute('data-task-id');
                closeGlobalSearch();
                openTaskModal(taskId);
            });
        });
    }

    function getSearchResults(query) {
        if (!query) return [];
        
        var searchIn = [];
        if (activeView === 'trash') {
            searchIn = trashedTasks;
        } else {
            searchIn = tasks.filter(function(t) { return !t.completed || activeView === 'board'; });
        }

        return searchIn.filter(function(task) {
            var titleMatch = task.title.toLowerCase().indexOf(query) !== -1;
            var tagMatch = task.tags && task.tags.some(function(tag) {
                return tag.toLowerCase().indexOf(query) !== -1;
            });
            var descMatch = task.description && task.description.toLowerCase().indexOf(query) !== -1;
            return titleMatch || tagMatch || descMatch;
        });
    }

    function setupKeyboardShortcuts() {
        var quickAddInput = document.getElementById('quickAddInput');
        
        quickAddInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                var text = this.value.trim();
                if (text) {
                    var parsed = TaskParser.parseNaturalLanguage(text);
                    addTask({
                        title: parsed.title,
                        priority: parsed.priority,
                        dueDate: parsed.dueDate,
                        dueTime: parsed.dueTime,
                        tags: parsed.tags,
                        recurrence: 'none'
                    });
                    this.value = '';
                    showToast('Task Added', 'Your task has been created successfully');
                } else {
                    openNewTaskModal();
                }
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                if (e.key === 'Escape') {
                    e.target.blur();
                    closeNewTaskModal();
                }
                return;
            }

            if (e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                toggleTheme();
            }

            if (e.key === 'n' || e.key === 'N') {
                e.preventDefault();
                openNewTaskModal();
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                quickAddInput.focus();
                quickAddInput.select();
            }

            if (e.key === '/') {
                e.preventDefault();
                openGlobalSearch();
            }

            if (e.key === 'Escape') {
                closeTaskModal();
                closeNewTaskModal();
                closeGlobalSearch();
                document.getElementById('welcomeModal').classList.remove('show');
                document.getElementById('energyModal').classList.remove('show');
                document.getElementById('energySuggestions').innerHTML = '';
                if (currentSearchQuery) {
                    clearSearchResults();
                }
                if (currentTagFilters.length > 0) {
                    clearTagFilters();
                }
                if (isSelectMode) {
                    toggleSelectMode();
                }
            }
        });
    }

    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    var notificationAudioContext = null;
    
    function initAudioContext() {
        if (!notificationAudioContext) {
            try {
                notificationAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.log('Web Audio API not supported');
            }
        }
        return notificationAudioContext;
    }

    function playNotificationSound(type) {
        var ctx = initAudioContext();
        if (!ctx) return;
        
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        
        try {
            var oscillator = ctx.createOscillator();
            var gainNode = ctx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            if (type === 'urgent') {
                oscillator.frequency.setValueAtTime(880, ctx.currentTime);
                oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
                oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
                oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.3);
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.5);
            } else {
                oscillator.frequency.setValueAtTime(523.25, ctx.currentTime);
                oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15);
                oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3);
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.5);
            }
        } catch (e) {
            console.log('Error playing notification sound:', e);
        }
    }

    function showNotificationWithSound(title, body, tag, type) {
        playNotificationSound(type || 'normal');
        
        if ('Notification' in window && Notification.permission === 'granted') {
            var notification = new Notification(title, {
                body: body,
                icon: '/favicon.ico',
                tag: tag,
                requireInteraction: true,
                silent: false
            });
            
            notification.onclick = function() {
                window.focus();
                notification.close();
            };
        }
    }

    function startAlarmChecker() {
        setInterval(checkAlarms, 30000);
        checkAlarms();
        
        document.addEventListener('click', function initAudio() {
            initAudioContext();
            document.removeEventListener('click', initAudio);
        }, { once: true });
    }

    function checkAlarms() {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        var now = new Date();
        tasks.forEach(function(task) {
            if (task.completed || !task.dueDate || !task.dueTime) return;
            if (task.alarmEnabled === false) return;

            var taskDateTime = new Date(task.dueDate);
            var timeParts = task.dueTime.split(':');
            taskDateTime.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);

            var diff = taskDateTime.getTime() - now.getTime();
            var notifiedKey = 'notified-' + task.id;

            var fiveMinutes = 5 * 60 * 1000;
            if (diff > 0 && diff <= fiveMinutes && !localStorage.getItem(notifiedKey + '-soon')) {
                showNotificationWithSound(
                    'Task Due Soon: ' + task.title,
                    'This task is due in about 5 minutes!',
                    task.id + '-soon',
                    'normal'
                );
                localStorage.setItem(notifiedKey + '-soon', 'true');
            }

            if (diff >= -60000 && diff <= 60000 && !localStorage.getItem(notifiedKey)) {
                showNotificationWithSound(
                    'Task Due Now: ' + task.title,
                    'This task is due right now!',
                    task.id,
                    'urgent'
                );
                localStorage.setItem(notifiedKey, 'true');
            }

            if (diff < -60000 && diff > -180000 && !localStorage.getItem(notifiedKey + '-overdue')) {
                showNotificationWithSound(
                    'Task Overdue: ' + task.title,
                    'This task is now overdue!',
                    task.id + '-overdue',
                    'urgent'
                );
                localStorage.setItem(notifiedKey + '-overdue', 'true');
            }
        });
    }

    function setActiveView(view) {
        activeView = view;
        currentTagFilters = [];
        selectedTaskIds.clear();
        isSelectMode = false;
        document.querySelectorAll('.nav-item').forEach(function(item) {
            item.classList.remove('active');
            if (item.getAttribute('data-view') === view) {
                item.classList.add('active');
            }
        });
        renderView();
    }

    function toggleTheme() {
        var isDark = document.documentElement.classList.toggle('dark');
        Storage.saveTheme(isDark ? 'dark' : 'light');
        updateThemeButton(isDark);
    }

    function updateThemeButton(isDark) {
        var themeText = document.querySelector('.theme-text');
        themeText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    }

    function handleQuickAdd(e) {
        e.preventDefault();
        var input = document.getElementById('quickAddInput');
        var value = input.value.trim();
        if (!value) return;

        var parsed = TaskParser.parseNaturalLanguage(value);
        addTask({
            title: parsed.title,
            priority: parsed.priority,
            dueDate: parsed.dueDate,
            dueTime: parsed.dueTime,
            tags: parsed.tags,
            recurrence: 'none'
        });

        input.value = '';
        showToast('Task Added', 'Your task has been created successfully');
    }

    function addTask(taskData) {
        var newTask = {
            id: generateId(),
            title: taskData.title,
            description: taskData.description || '',
            status: 'todo',
            priority: taskData.priority || 'medium',
            dueDate: taskData.dueDate,
            dueTime: taskData.dueTime,
            tags: taskData.tags || [],
            category: taskData.category || '',
            subtasks: taskData.subtasks || [],
            attachments: taskData.attachments || [],
            recurrence: taskData.recurrence || 'none',
            completed: taskData.completed || false,
            pinned: taskData.pinned || false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        if (taskData.status) {
            newTask.status = taskData.status;
        }

        tasks.push(newTask);
        saveTasks();
        renderView();
    }

    function updateTask(id, updates) {
        var oldTask = tasks.find(function(t) { return t.id === id; });
        
        if (oldTask && (updates.dueDate !== undefined || updates.dueTime !== undefined)) {
            clearNotificationFlags(id);
        }
        
        tasks = tasks.map(function(task) {
            if (task.id === id) {
                return Object.assign({}, task, updates, { updatedAt: new Date() });
            }
            return task;
        });
        saveTasks();
        renderView();
        if (selectedTask && selectedTask.id === id) {
            selectedTask = tasks.find(function(t) { return t.id === id; });
            renderTaskModal();
        }
    }
    
    function clearNotificationFlags(taskId) {
        localStorage.removeItem('notified-' + taskId);
        localStorage.removeItem('notified-' + taskId + '-soon');
        localStorage.removeItem('notified-' + taskId + '-overdue');
    }

    function deleteTask(id, permanent) {
        var task = tasks.find(function(t) { return t.id === id; });
        if (!task) return;

        lastAction = {
            type: 'delete',
            task: Object.assign({}, task)
        };

        tasks = tasks.filter(function(t) { return t.id !== id; });
        
        if (!permanent) {
            task.deletedAt = new Date();
            trashedTasks.push(task);
            saveTrash();
        }
        
        saveTasks();
        renderView();
        closeTaskModal();
        showUndoToast('Task Deleted', 'The task has been moved to trash');
    }

    function restoreTask(id) {
        var taskIndex = trashedTasks.findIndex(function(t) { return t.id === id; });
        if (taskIndex === -1) return;

        var task = trashedTasks[taskIndex];
        delete task.deletedAt;
        tasks.push(task);
        trashedTasks.splice(taskIndex, 1);
        
        saveTasks();
        saveTrash();
        renderView();
        showToast('Task Restored', 'The task has been restored');
    }

    function permanentlyDeleteTask(id) {
        trashedTasks = trashedTasks.filter(function(t) { return t.id !== id; });
        saveTrash();
        renderView();
        showToast('Task Deleted', 'The task has been permanently deleted');
    }

    function emptyTrash() {
        trashedTasks = [];
        saveTrash();
        renderView();
        showToast('Trash Emptied', 'All trashed tasks have been permanently deleted');
    }

    function moveTask(id, newStatus) {
        var task = tasks.find(function(t) { return t.id === id; });
        if (task) {
            lastAction = {
                type: 'move',
                taskId: id,
                oldStatus: task.status
            };
        }
        
        updateTask(id, {
            status: newStatus,
            completed: newStatus === 'done'
        });
        
        showUndoToast('Task Moved', 'Task moved to ' + newStatus);
    }

    function snoozeTask(id, days) {
        var task = tasks.find(function(t) { return t.id === id; });
        if (!task) return;

        var newDate = task.dueDate ? new Date(task.dueDate) : new Date();
        newDate.setDate(newDate.getDate() + days);
        
        updateTask(id, { dueDate: newDate });
        showToast('Task Snoozed', 'Rescheduled to ' + formatDateLong(newDate));
    }

    function togglePin(id) {
        var task = tasks.find(function(t) { return t.id === id; });
        if (!task) return;
        
        updateTask(id, { pinned: !task.pinned });
        showToast(task.pinned ? 'Unpinned' : 'Pinned', task.pinned ? 'Task unpinned' : 'Task pinned to top');
    }

    function duplicateTask(id) {
        var task = tasks.find(function(t) { return t.id === id; });
        if (!task) return;

        addTask({
            title: task.title + ' (copy)',
            description: task.description,
            priority: task.priority,
            dueDate: task.dueDate,
            dueTime: task.dueTime,
            tags: task.tags.slice(),
            category: task.category,
            subtasks: task.subtasks.map(function(st) {
                return { id: generateId(), title: st.title, completed: false };
            }),
            recurrence: task.recurrence
        });
        showToast('Task Duplicated', 'A copy of the task has been created');
    }

    function undoLastAction() {
        if (!lastAction) return;

        if (lastAction.type === 'delete' && lastAction.task) {
            tasks.push(lastAction.task);
            trashedTasks = trashedTasks.filter(function(t) { return t.id !== lastAction.task.id; });
            saveTasks();
            saveTrash();
            renderView();
            showToast('Undone', 'Task restored');
        } else if (lastAction.type === 'move' && lastAction.taskId) {
            updateTask(lastAction.taskId, { 
                status: lastAction.oldStatus,
                completed: lastAction.oldStatus === 'done'
            });
            showToast('Undone', 'Task moved back');
        } else if (lastAction.type === 'done' && lastAction.taskId) {
            updateTask(lastAction.taskId, { 
                status: lastAction.oldStatus,
                completed: false
            });
            showToast('Undone', 'Task unmarked as done');
        }

        lastAction = null;
    }

    function addSubtask(taskId, subtaskTitle) {
        var task = tasks.find(function(t) { return t.id === taskId; });
        if (task) {
            task.subtasks.push({
                id: generateId(),
                title: subtaskTitle,
                completed: false
            });
            task.updatedAt = new Date();
            saveTasks();
            renderView();
            if (selectedTask && selectedTask.id === taskId) {
                selectedTask = task;
                renderTaskModal();
            }
        }
    }

    function toggleSubtask(taskId, subtaskId) {
        var task = tasks.find(function(t) { return t.id === taskId; });
        if (task) {
            task.subtasks = task.subtasks.map(function(st) {
                if (st.id === subtaskId) {
                    return Object.assign({}, st, { completed: !st.completed });
                }
                return st;
            });
            task.updatedAt = new Date();
            saveTasks();
            renderView();
            if (selectedTask && selectedTask.id === taskId) {
                selectedTask = task;
                renderTaskModal();
            }
        }
    }

    function toggleSelectMode() {
        isSelectMode = !isSelectMode;
        selectedTaskIds.clear();
        renderView();
    }

    function toggleTaskSelection(id) {
        if (selectedTaskIds.has(id)) {
            selectedTaskIds.delete(id);
        } else {
            selectedTaskIds.add(id);
        }
        renderView();
    }

    function bulkDelete() {
        selectedTaskIds.forEach(function(id) {
            deleteTask(id);
        });
        selectedTaskIds.clear();
        isSelectMode = false;
        renderView();
    }

    function bulkMove(status) {
        selectedTaskIds.forEach(function(id) {
            updateTask(id, { status: status, completed: status === 'done' });
        });
        selectedTaskIds.clear();
        isSelectMode = false;
        renderView();
        showToast('Tasks Moved', 'Selected tasks moved to ' + status);
    }

    function bulkMarkDone() {
        bulkMove('done');
    }

    function generateId() {
        return 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    function getFilteredTasks() {
        if (currentTagFilters.length === 0) return tasks;
        return tasks.filter(function(task) {
            return currentTagFilters.every(function(filterTag) {
                return task.tags.includes(filterTag);
            });
        });
    }

    function getAllTags() {
        var tagSet = {};
        tasks.forEach(function(task) {
            task.tags.forEach(function(tag) {
                tagSet[tag] = (tagSet[tag] || 0) + 1;
            });
        });
        return Object.keys(tagSet).sort();
    }

    function toggleTagFilter(tagName) {
        var index = currentTagFilters.indexOf(tagName);
        if (index === -1) {
            currentTagFilters.push(tagName);
        } else {
            currentTagFilters.splice(index, 1);
        }
        renderView();
    }

    function clearTagFilters() {
        currentTagFilters = [];
        renderView();
    }

    function sortTasksByPinned(taskList) {
        return taskList.slice().sort(function(a, b) {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return 0;
        });
    }

    function renderView() {
        var container = document.getElementById('viewContainer');
        var searchResultsHtml = '';
        
        if (currentSearchQuery && activeView !== 'analytics' && activeView !== 'settings') {
            searchResultsHtml = renderSearchResults();
        }
        
        switch (activeView) {
            case 'today':
                container.innerHTML = searchResultsHtml + renderTodayView();
                break;
            case 'upcoming':
                container.innerHTML = searchResultsHtml + renderUpcomingView();
                break;
            case 'analytics':
                container.innerHTML = renderAnalyticsView();
                break;
            case 'settings':
                container.innerHTML = renderSettingsView();
                break;
            case 'trash':
                container.innerHTML = searchResultsHtml + renderTrashView();
                break;
            case 'board':
            default:
                container.innerHTML = searchResultsHtml + renderBoardView();
        }
        setupViewEventListeners();
        setupSearchResultListeners();
    }

    function renderSearchResults() {
        var results = getSearchResults(currentSearchQuery);
        
        var resultsHtml = results.length > 0 ? 
            results.map(function(task) {
                var tagsHtml = task.tags.slice(0, 3).map(function(tag) {
                    return '<span class="badge tag">#' + tag + '</span>';
                }).join(' ');
                return '<div class="search-result-item" data-task-id="' + task.id + '">' +
                    '<strong>' + escapeHtml(task.title) + '</strong> ' + tagsHtml +
                    '</div>';
            }).join('') :
            '<div class="search-no-results">No tasks found for "' + escapeHtml(currentSearchQuery) + '"</div>';

        return '<div class="search-results-container">' +
            '<div class="search-results-header">' +
            '<span class="search-results-title">Search Results (' + results.length + ')</span>' +
            '<button class="search-clear-btn" id="clearSearchBtn">Clear</button>' +
            '</div>' +
            '<div class="search-results-list">' + resultsHtml + '</div>' +
            '</div>';
    }

    function setupSearchResultListeners() {
        var clearBtn = document.getElementById('clearSearchBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', clearSearchResults);
        }

        document.querySelectorAll('.search-result-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var taskId = this.getAttribute('data-task-id');
                openTaskModal(taskId);
            });
        });
    }

    function renderTagFilterBar() {
        var allTags = getAllTags();
        if (allTags.length === 0) return '';

        var tagsHtml = allTags.map(function(tag) {
            var isActive = currentTagFilters.indexOf(tag) !== -1;
            return '<button class="tag-filter-btn' + (isActive ? ' active' : '') + '" data-tag="' + tag + '">#' + tag + '</button>';
        }).join('');

        var activeFilterHtml = currentTagFilters.length > 0 ?
            '<div class="active-filters-display">' +
            '<span>Active filters:</span>' +
            currentTagFilters.map(function(tag) {
                return '<span class="active-filter-tag" data-tag="' + tag + '">#' + tag + ' <span class="remove-filter">×</span></span>';
            }).join('') +
            '<button class="clear-all-filters-btn" id="clearAllFilters">Clear All</button>' +
            '</div>' : '';

        return '<div class="tag-filter-bar">' +
            '<div class="tag-filter-header">' +
            '<span class="filter-label">Filter by tags:</span>' +
            '<div class="tag-filter-list">' + tagsHtml + '</div>' +
            '</div>' +
            activeFilterHtml +
            '</div>';
    }

    function renderBoardView() {
        var filteredTasks = getFilteredTasks();
        var todoTasks = sortTasksByPinned(filteredTasks.filter(function(t) { return t.status === 'todo'; }));
        var doingTasks = sortTasksByPinned(filteredTasks.filter(function(t) { return t.status === 'doing'; }));
        var doneTasks = sortTasksByPinned(filteredTasks.filter(function(t) { return t.status === 'done'; }));

        var filterBarHtml = renderTagFilterBar();

        var selectModeHtml = '<div class="select-mode-bar">' +
            '<button class="btn btn-outline btn-sm" id="toggleSelectMode">' + (isSelectMode ? 'Cancel Selection' : 'Select Tasks') + '</button>' +
            (isSelectMode && selectedTaskIds.size > 0 ? 
                '<button class="btn btn-primary btn-sm" id="bulkDone">Mark Done (' + selectedTaskIds.size + ')</button>' +
                '<button class="btn btn-destructive btn-sm" id="bulkDelete">Delete (' + selectedTaskIds.size + ')</button>' : '') +
            '</div>';

        return filterBarHtml + selectModeHtml + 
            '<div class="board-container">' +
            renderColumn('To Do', 'todo', todoTasks, 'pink') +
            renderColumn('Doing', 'doing', doingTasks, 'cyan') +
            renderColumn('Done', 'done', doneTasks, 'lime') +
            '</div>';
    }

    function renderColumn(title, status, columnTasks, color) {
        var tasksHtml = columnTasks.length === 0 ?
            '<div class="empty-column"><p>No tasks here yet</p></div>' :
            columnTasks.map(function(task, index) {
                return '<div style="animation-delay: ' + (index * 50) + 'ms">' + renderTaskCard(task) + '</div>';
            }).join('');

        return '<div class="task-column" data-status="' + status + '" ondragover="event.preventDefault()" ondrop="App.handleDrop(event, \'' + status + '\')">' +
            '<div class="column-header">' +
            '<h2 class="column-title">' + title + '</h2>' +
            '<div class="column-count ' + color + '">' + columnTasks.length + '</div>' +
            '</div>' +
            '<div class="task-list">' + tasksHtml + '</div>' +
            '</div>';
    }

    function renderTaskCard(task) {
        var completedSubtasks = task.subtasks.filter(function(st) { return st.completed; }).length;
        var totalSubtasks = task.subtasks.length;

        var isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;

        var metaHtml = '';
        if (task.dueDate) {
            metaHtml += '<span class="badge' + (isOverdue ? ' overdue' : '') + '">' + getCalendarIcon() + formatDate(task.dueDate) + '</span>';
        }
        if (task.dueTime) {
            metaHtml += '<span class="badge">' + getClockIcon() + task.dueTime + '</span>';
        }
        if (task.recurrence !== 'none') {
            metaHtml += '<span class="badge">' + getRepeatIcon() + task.recurrence + '</span>';
        }
        task.tags.forEach(function(tag) {
            metaHtml += '<span class="badge tag clickable-tag" data-tag="' + tag + '">#' + tag + '</span>';
        });

        var progressHtml = '';
        if (totalSubtasks > 0) {
            var percent = (completedSubtasks / totalSubtasks) * 100;
            progressHtml = '<div class="subtask-progress">' +
                '<div class="progress-bar-container">' +
                '<div class="progress-bar"><div class="progress-bar-fill" style="width: ' + percent + '%"></div></div>' +
                '<span style="font-weight: bold">' + completedSubtasks + '/' + totalSubtasks + '</span>' +
                '</div></div>';
        }

        var overdueButtonsHtml = '';
        if (isOverdue) {
            overdueButtonsHtml = '<div class="overdue-actions">' +
                '<button class="btn btn-sm btn-outline overdue-btn" data-action="snooze1" data-task-id="' + task.id + '">Snooze 1 day</button>' +
                '<button class="btn btn-sm btn-outline overdue-btn" data-action="movetoday" data-task-id="' + task.id + '">Move to Today</button>' +
                '</div>';
        }

        var selectCheckbox = isSelectMode ? 
            '<input type="checkbox" class="task-select-checkbox" data-task-id="' + task.id + '"' + 
            (selectedTaskIds.has(task.id) ? ' checked' : '') + '>' : '';

        var pinnedIcon = task.pinned ? '<span class="pinned-icon">' + getStarIcon() + '</span>' : '';
        var focusBadge = task.activeNow ? '<span class="focus-task-badge">FOCUS</span>' : '';

        return '<div class="task-card' + (task.pinned ? ' pinned' : '') + (task.activeNow ? ' focus-active' : '') + '" data-task-id="' + task.id + '" draggable="true" ondragstart="App.handleDragStart(event, \'' + task.id + '\')">' +
            selectCheckbox +
            '<div class="priority-stripe ' + task.priority + '"></div>' +
            '<div class="task-card-content">' +
            '<div class="task-card-main">' +
            '<h3 class="task-title" data-task-id="' + task.id + '">' + pinnedIcon + escapeHtml(task.title) + focusBadge + '</h3>' +
            (task.description ? '<p class="task-description">' + escapeHtml(task.description) + '</p>' : '') +
            '<div class="task-meta">' + metaHtml + '</div>' +
            progressHtml +
            overdueButtonsHtml +
            '</div>' +
            '<div class="task-actions">' +
            '<div class="dropdown">' +
            '<button class="action-btn dropdown-toggle" data-task-id="' + task.id + '">' + getMoreIcon() + '</button>' +
            '<div class="dropdown-menu" id="dropdown-' + task.id + '">' +
            '<button class="dropdown-item" data-action="edit" data-task-id="' + task.id + '">' + getEditIcon() + 'Edit</button>' +
            '<button class="dropdown-item" data-action="duplicate" data-task-id="' + task.id + '">' + getDuplicateIcon() + 'Duplicate</button>' +
            '<button class="dropdown-item" data-action="pin" data-task-id="' + task.id + '">' + getStarIcon() + (task.pinned ? 'Unpin' : 'Pin') + '</button>' +
            '<button class="dropdown-item" data-action="snooze1day" data-task-id="' + task.id + '">' + getSnoozeIcon() + 'Snooze 1 day</button>' +
            '<button class="dropdown-item" data-action="snooze1week" data-task-id="' + task.id + '">' + getSnoozeIcon() + 'Snooze 1 week</button>' +
            '<button class="dropdown-item" data-action="done" data-task-id="' + task.id + '">' + getCheckIcon() + 'Mark as done</button>' +
            '<button class="dropdown-item destructive" data-action="delete" data-task-id="' + task.id + '">' + getTrashIcon() + 'Delete</button>' +
            '</div></div></div></div></div>';
    }

    function renderTodayView() {
        var today = new Date();
        today.setHours(0, 0, 0, 0);

        var filteredTasks = getFilteredTasks();

        var todayTasks = sortTasksByPinned(filteredTasks.filter(function(task) {
            if (!task.dueDate || task.completed) return false;
            var taskDate = new Date(task.dueDate);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate.getTime() === today.getTime();
        }));

        var overdueTasks = sortTasksByPinned(filteredTasks.filter(function(task) {
            if (!task.dueDate || task.completed) return false;
            var taskDate = new Date(task.dueDate);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate.getTime() < today.getTime();
        }));

        var dateStr = today.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        var filterBarHtml = renderTagFilterBar();

        var html = filterBarHtml + '<div class="space-y-8">' +
            '<div class="view-header">' +
            '<h2 class="view-title">Today</h2>' +
            '<p class="view-subtitle">' + dateStr + '</p>' +
            '</div>';

        if (overdueTasks.length > 0) {
            html += '<div>' +
                '<div class="section-header">' +
                '<div class="section-dot destructive"></div>' +
                '<h3 class="section-title">Overdue (' + overdueTasks.length + ')</h3>' +
                '</div>' +
                '<div class="space-y-4">' +
                overdueTasks.map(function(task) { return renderTaskCard(task); }).join('') +
                '</div></div>';
        }

        html += '<div>' +
            '<div class="section-header">' +
            '<div class="section-dot cyan"></div>' +
            '<h3 class="section-title">Today\'s Tasks (' + todayTasks.length + ')</h3>' +
            '</div>';

        if (todayTasks.length === 0) {
            html += '<div class="empty-state">' +
                '<p class="empty-state-title">No tasks for today!</p>' +
                '<p class="empty-state-subtitle">Time to procrastinate guilt-free</p>' +
                '</div>';
        } else {
            html += '<div class="space-y-4">' +
                todayTasks.map(function(task) { return renderTaskCard(task); }).join('') +
                '</div>';
        }

        html += '</div></div>';
        return html;
    }

    function renderUpcomingView() {
        var today = new Date();
        today.setHours(0, 0, 0, 0);

        var filteredTasks = getFilteredTasks();

        var upcomingTasks = filteredTasks.filter(function(task) {
            if (!task.dueDate || task.completed) return false;
            var taskDate = new Date(task.dueDate);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate.getTime() > today.getTime();
        }).sort(function(a, b) {
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });

        var next7DaysDate = new Date(today);
        next7DaysDate.setDate(next7DaysDate.getDate() + 7);

        var next7Days = sortTasksByPinned(upcomingTasks.filter(function(task) {
            return new Date(task.dueDate) <= next7DaysDate;
        }));

        var later = sortTasksByPinned(upcomingTasks.filter(function(task) {
            return new Date(task.dueDate) > next7DaysDate;
        }));

        var filterBarHtml = renderTagFilterBar();

        var html = filterBarHtml + '<div class="space-y-8">' +
            '<div class="view-header">' +
            '<h2 class="view-title">Upcoming</h2>' +
            '<p class="view-subtitle">' + upcomingTasks.length + ' tasks scheduled</p>' +
            '</div>';

        if (next7Days.length > 0) {
            html += '<div>' +
                '<div class="section-header">' +
                '<div class="section-dot cyan"></div>' +
                '<h3 class="section-title">Next 7 Days (' + next7Days.length + ')</h3>' +
                '</div>' +
                '<div class="space-y-4">' +
                next7Days.map(function(task) { return renderTaskCard(task); }).join('') +
                '</div></div>';
        }

        if (later.length > 0) {
            html += '<div>' +
                '<div class="section-header">' +
                '<div class="section-dot lime"></div>' +
                '<h3 class="section-title">Later (' + later.length + ')</h3>' +
                '</div>' +
                '<div class="space-y-4">' +
                later.map(function(task) { return renderTaskCard(task); }).join('') +
                '</div></div>';
        }

        if (upcomingTasks.length === 0) {
            html += '<div class="empty-state">' +
                '<p class="empty-state-title">No upcoming tasks</p>' +
                '<p class="empty-state-subtitle">Living in the moment, are we?</p>' +
                '</div>';
        }

        html += '</div>';
        return html;
    }

    function renderAnalyticsView() {
        var totalTasks = tasks.length;
        var completedTasks = tasks.filter(function(t) { return t.completed; }).length;
        var pendingTasks = totalTasks - completedTasks;
        var completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        var highPriority = tasks.filter(function(t) { return t.priority === 'high'; }).length;
        var mediumPriority = tasks.filter(function(t) { return t.priority === 'medium'; }).length;
        var lowPriority = tasks.filter(function(t) { return t.priority === 'low'; }).length;

        var todoCount = tasks.filter(function(t) { return t.status === 'todo'; }).length;
        var doingCount = tasks.filter(function(t) { return t.status === 'doing'; }).length;
        var doneCount = tasks.filter(function(t) { return t.status === 'done'; }).length;

        var overdueTasks = tasks.filter(function(t) {
            return t.dueDate && new Date(t.dueDate) < new Date() && !t.completed;
        }).length;

        var progressMessage;
        if (completionRate === 100) {
            progressMessage = 'Perfect score! Time to add more tasks to procrastinate on!';
        } else if (completionRate >= 75) {
            progressMessage = 'Great job! Keep it up!';
        } else if (completionRate >= 50) {
            progressMessage = "You're halfway there!";
        } else {
            progressMessage = 'Plenty of room for improvement!';
        }

        return '<div class="space-y-8">' +
            '<div class="view-header">' +
            '<h2 class="view-title">Analytics</h2>' +
            '<p class="view-subtitle">Your productivity at a glance</p>' +
            '</div>' +

            '<div class="stats-grid">' +
            '<div class="stat-card">' +
            '<div class="stat-header">' + getBarChartIcon('') + '<div class="stat-value cyan">' + totalTasks + '</div></div>' +
            '<h3 class="stat-title">Total Tasks</h3>' +
            '<p class="stat-subtitle">All time</p>' +
            '</div>' +

            '<div class="stat-card">' +
            '<div class="stat-header">' + getCheckCircleIcon('lime') + '<div class="stat-value lime">' + completedTasks + '</div></div>' +
            '<h3 class="stat-title">Completed</h3>' +
            '<p class="stat-subtitle">' + completionRate + '% completion rate</p>' +
            '</div>' +

            '<div class="stat-card">' +
            '<div class="stat-header">' + getClockIconLarge('pink') + '<div class="stat-value pink">' + pendingTasks + '</div></div>' +
            '<h3 class="stat-title">Pending</h3>' +
            '<p class="stat-subtitle">Still to do</p>' +
            '</div>' +

            '<div class="stat-card">' +
            '<div class="stat-header">' + getTrendingUpIcon('destructive') + '<div class="stat-value destructive">' + overdueTasks + '</div></div>' +
            '<h3 class="stat-title">Overdue</h3>' +
            '<p class="stat-subtitle">Oops!</p>' +
            '</div>' +
            '</div>' +

            '<div class="charts-grid">' +
            '<div class="chart-card">' +
            '<h3 class="chart-title">Status Breakdown</h3>' +
            '<div class="chart-bars">' +
            renderChartBar('To Do', todoCount, totalTasks, 'pink') +
            renderChartBar('Doing', doingCount, totalTasks, 'cyan') +
            renderChartBar('Done', doneCount, totalTasks, 'lime') +
            '</div></div>' +

            '<div class="chart-card">' +
            '<h3 class="chart-title">Priority Breakdown</h3>' +
            '<div class="chart-bars">' +
            renderChartBar('High Priority', highPriority, totalTasks, 'pink') +
            renderChartBar('Medium Priority', mediumPriority, totalTasks, 'cyan') +
            renderChartBar('Low Priority', lowPriority, totalTasks, 'lime') +
            '</div></div>' +
            '</div>' +

            '<div class="overall-progress">' +
            '<h3>Overall Progress</h3>' +
            '<div class="big-progress-bar">' +
            '<div class="big-progress-fill" style="width: ' + completionRate + '%">' +
            (completionRate > 10 ? '<span class="big-progress-text">' + completionRate + '%</span>' : '') +
            '</div>' +
            (completionRate <= 10 ? '<span class="big-progress-text-outside">' + completionRate + '%</span>' : '') +
            '</div>' +
            '<p class="progress-message">' + progressMessage + '</p>' +
            '</div>' +
            '</div>';
    }

    function renderChartBar(label, count, total, color) {
        var percent = total > 0 ? (count / total) * 100 : 0;
        return '<div class="chart-bar-item">' +
            '<div class="chart-bar-label"><span>' + label + '</span><span class="chart-bar-count">' + count + '</span></div>' +
            '<div class="chart-bar"><div class="chart-bar-fill ' + color + '" style="width: ' + percent + '%"></div></div>' +
            '</div>';
    }

    function renderTrashView() {
        var html = '<div class="space-y-8">' +
            '<div class="view-header">' +
            '<h2 class="view-title">Trash</h2>' +
            '<p class="view-subtitle">' + trashedTasks.length + ' deleted tasks</p>' +
            '</div>';

        if (trashedTasks.length > 0) {
            html += '<div class="trash-actions-bar">' +
                '<button class="btn btn-destructive" id="emptyTrashBtn">' + getTrashIcon() + 'Empty Trash</button>' +
                '</div>';

            html += '<div class="space-y-4">' +
                trashedTasks.map(function(task) {
                    return '<div class="task-card trashed-task" data-task-id="' + task.id + '">' +
                        '<div class="priority-stripe ' + task.priority + '"></div>' +
                        '<div class="task-card-content">' +
                        '<div class="task-card-main">' +
                        '<h3 class="task-title">' + escapeHtml(task.title) + '</h3>' +
                        '<p class="trash-deleted-at">Deleted ' + formatDateLong(task.deletedAt) + '</p>' +
                        '</div>' +
                        '<div class="trash-task-actions">' +
                        '<button class="btn btn-sm btn-primary restore-btn" data-task-id="' + task.id + '">Restore</button>' +
                        '<button class="btn btn-sm btn-destructive permanent-delete-btn" data-task-id="' + task.id + '">Delete</button>' +
                        '</div></div></div>';
                }).join('') +
                '</div>';
        } else {
            html += '<div class="empty-state">' +
                '<p class="empty-state-title">Trash is empty</p>' +
                '<p class="empty-state-subtitle">No deleted tasks</p>' +
                '</div>';
        }

        html += '</div>';
        return html;
    }

    function renderSettingsView() {
        var completedCount = tasks.filter(function(t) { return t.completed; }).length;
        var notificationStatus = 'Notification' in window ? 
            (Notification.permission === 'granted' ? 'Enabled' : 
             Notification.permission === 'denied' ? 'Blocked' : 'Not enabled') : 'Not supported';

        return '<div class="space-y-8">' +
            '<div class="view-header">' +
            '<h2 class="view-title">Settings</h2>' +
            '<p class="view-subtitle">Manage your data and preferences</p>' +
            '</div>' +

            '<div class="settings-section">' +
            '<h3 class="settings-title">Notifications</h3>' +
            '<p class="settings-description">Get reminded about upcoming and overdue tasks.</p>' +
            '<div class="storage-info">' +
            '<div class="storage-row"><span>Browser Notifications:</span><span>' + notificationStatus + '</span></div>' +
            '</div>' +
            (Notification.permission === 'default' ? 
                '<button class="btn btn-primary" id="enableNotificationsBtn" style="margin-top: 16px">Enable Notifications</button>' : '') +
            '</div>' +

            '<div class="settings-section">' +
            '<h3 class="settings-title">Export Data</h3>' +
            '<p class="settings-description">Download your tasks in JSON or CSV format for backup or analysis.</p>' +
            '<div class="settings-buttons">' +
            '<button class="btn btn-cyan" id="exportJsonBtn">' + getFileJsonIcon() + 'Export to JSON</button>' +
            '<button class="btn btn-primary" id="exportCsvBtn">' + getFileSpreadsheetIcon() + 'Export to CSV</button>' +
            '</div></div>' +

            '<div class="settings-section">' +
            '<h3 class="settings-title">Storage Info</h3>' +
            '<div class="storage-info">' +
            '<div class="storage-row"><span>Total Tasks:</span><span>' + tasks.length + '</span></div>' +
            '<div class="storage-row"><span>Completed Tasks:</span><span>' + completedCount + '</span></div>' +
            '<div class="storage-row"><span>Trashed Tasks:</span><span>' + trashedTasks.length + '</span></div>' +
            '<div class="storage-row"><span>Storage Type:</span><span>Local Storage</span></div>' +
            '</div></div>' +

            '<div class="settings-section">' +
            '<h3 class="settings-title">About</h3>' +
            '<div class="about-text">' +
            '<p><strong>Oops, Later!</strong> is a playful todo app for procrastinators who need a gentle (but firm) nudge.</p>' +
            '<p class="muted">Built with HTML, CSS, and JavaScript. All data is stored locally in your browser.</p>' +
            '</div></div>' +

            '<div class="settings-section">' +
            '<h3 class="settings-title">Keyboard Shortcuts</h3>' +
            '<div class="shortcuts-grid">' +
            '<div class="shortcut-row"><span>Toggle Dark Mode:</span><kbd class="shortcut-key">D</kbd></div>' +
            '<div class="shortcut-row"><span>New Task:</span><kbd class="shortcut-key">N</kbd></div>' +
            '<div class="shortcut-row"><span>Search Tasks:</span><kbd class="shortcut-key">/</kbd></div>' +
            '<div class="shortcut-row"><span>Close Modal/Clear Filter:</span><kbd class="shortcut-key">Esc</kbd></div>' +
            '</div></div>' +
            '</div>';
    }

    function setupViewEventListeners() {
        document.querySelectorAll('.task-card:not(.trashed-task)').forEach(function(card) {
            card.addEventListener('click', function(e) {
                if (e.target.closest('.dropdown')) return;
                if (e.target.closest('.task-select-checkbox')) return;
                if (e.target.closest('.overdue-btn')) return;
                if (e.target.closest('.clickable-tag')) return;
                var taskId = this.getAttribute('data-task-id');
                openTaskModal(taskId);
            });

            card.addEventListener('dblclick', function(e) {
                var titleEl = e.target.closest('.task-title');
                if (titleEl) {
                    e.preventDefault();
                    e.stopPropagation();
                    startInlineEdit(titleEl);
                }
            });
        });

        document.querySelectorAll('.clickable-tag').forEach(function(tag) {
            tag.addEventListener('click', function(e) {
                e.stopPropagation();
                var tagName = this.getAttribute('data-tag');
                toggleTagFilter(tagName);
            });
        });

        document.querySelectorAll('.tag-filter-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var tagName = this.getAttribute('data-tag');
                toggleTagFilter(tagName);
            });
        });

        document.querySelectorAll('.active-filter-tag').forEach(function(tag) {
            tag.addEventListener('click', function(e) {
                e.stopPropagation();
                var tagName = this.getAttribute('data-tag');
                toggleTagFilter(tagName);
            });
        });

        var clearAllFiltersBtn = document.getElementById('clearAllFilters');
        if (clearAllFiltersBtn) {
            clearAllFiltersBtn.addEventListener('click', function() {
                clearTagFilters();
            });
        }

        document.querySelectorAll('.task-select-checkbox').forEach(function(checkbox) {
            checkbox.addEventListener('change', function(e) {
                e.stopPropagation();
                var taskId = this.getAttribute('data-task-id');
                toggleTaskSelection(taskId);
            });
        });

        var toggleSelectBtn = document.getElementById('toggleSelectMode');
        if (toggleSelectBtn) {
            toggleSelectBtn.addEventListener('click', toggleSelectMode);
        }

        var bulkDoneBtn = document.getElementById('bulkDone');
        if (bulkDoneBtn) {
            bulkDoneBtn.addEventListener('click', bulkMarkDone);
        }

        var bulkDeleteBtn = document.getElementById('bulkDelete');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener('click', bulkDelete);
        }

        document.querySelectorAll('.overdue-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var action = this.getAttribute('data-action');
                var taskId = this.getAttribute('data-task-id');
                
                if (action === 'snooze1') {
                    snoozeTask(taskId, 1);
                } else if (action === 'movetoday') {
                    var today = new Date();
                    today.setHours(0, 0, 0, 0);
                    updateTask(taskId, { dueDate: today });
                    showToast('Task Updated', 'Due date set to today');
                }
            });
        });

        document.querySelectorAll('.dropdown-toggle').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var taskId = this.getAttribute('data-task-id');
                var menu = document.getElementById('dropdown-' + taskId);
                var wasOpen = menu.classList.contains('show') || menu.classList.contains('show-above');
                
                document.querySelectorAll('.dropdown-menu').forEach(function(m) {
                    m.classList.remove('show');
                    m.classList.remove('show-above');
                });
                
                if (!wasOpen) {
                    var rect = this.getBoundingClientRect();
                    var menuHeight = 280;
                    var spaceBelow = window.innerHeight - rect.bottom;
                    
                    if (spaceBelow < menuHeight) {
                        menu.classList.add('show-above');
                    } else {
                        menu.classList.add('show');
                    }
                }
            });
        });

        document.querySelectorAll('.dropdown-item').forEach(function(item) {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                var action = this.getAttribute('data-action');
                var taskId = this.getAttribute('data-task-id');
                document.querySelectorAll('.dropdown-menu').forEach(function(m) {
                    m.classList.remove('show');
                });
                
                switch (action) {
                    case 'edit':
                        openTaskModal(taskId);
                        break;
                    case 'duplicate':
                        duplicateTask(taskId);
                        break;
                    case 'pin':
                        togglePin(taskId);
                        break;
                    case 'snooze1day':
                        snoozeTask(taskId, 1);
                        break;
                    case 'snooze1week':
                        snoozeTask(taskId, 7);
                        break;
                    case 'done':
                        var task = tasks.find(function(t) { return t.id === taskId; });
                        if (task) {
                            lastAction = {
                                type: 'done',
                                taskId: taskId,
                                oldStatus: task.status
                            };
                        }
                        moveTask(taskId, 'done');
                        break;
                    case 'delete':
                        deleteTask(taskId);
                        break;
                }
            });
        });

        document.addEventListener('click', function() {
            document.querySelectorAll('.dropdown-menu').forEach(function(m) {
                m.classList.remove('show');
                m.classList.remove('show-above');
            });
        });

        document.querySelectorAll('.restore-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var taskId = this.getAttribute('data-task-id');
                restoreTask(taskId);
            });
        });

        document.querySelectorAll('.permanent-delete-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var taskId = this.getAttribute('data-task-id');
                permanentlyDeleteTask(taskId);
            });
        });

        var emptyTrashBtn = document.getElementById('emptyTrashBtn');
        if (emptyTrashBtn) {
            emptyTrashBtn.addEventListener('click', function() {
                if (confirm('Are you sure you want to permanently delete all trashed tasks?')) {
                    emptyTrash();
                }
            });
        }

        var enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
        if (enableNotificationsBtn) {
            enableNotificationsBtn.addEventListener('click', function() {
                Notification.requestPermission().then(function(permission) {
                    renderView();
                    if (permission === 'granted') {
                        showToast('Notifications Enabled', 'You will receive task reminders');
                    }
                });
            });
        }

        var exportJsonBtn = document.getElementById('exportJsonBtn');
        var exportCsvBtn = document.getElementById('exportCsvBtn');
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', function() {
                Storage.exportToJSON(tasks);
                showToast('Export Successful', 'Tasks exported to JSON file');
            });
        }
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', function() {
                Storage.exportToCSV(tasks);
                showToast('Export Successful', 'Tasks exported to CSV file');
            });
        }
    }

    function startInlineEdit(titleEl) {
        var taskId = titleEl.getAttribute('data-task-id');
        var task = tasks.find(function(t) { return t.id === taskId; });
        if (!task) return;

        var currentTitle = task.title;
        var input = document.createElement('input');
        input.type = 'text';
        input.value = currentTitle;
        input.className = 'inline-edit-input';
        
        titleEl.innerHTML = '';
        titleEl.appendChild(input);
        input.focus();
        input.select();

        function saveEdit() {
            var newTitle = input.value.trim();
            if (newTitle && newTitle !== currentTitle) {
                updateTask(taskId, { title: newTitle });
            } else {
                renderView();
            }
        }

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                renderView();
            }
        });
    }

    function handleDragStart(e, taskId) {
        draggedTaskId = taskId;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', taskId);
        e.target.classList.add('dragging');
    }

    function handleDrop(e, status) {
        e.preventDefault();
        if (draggedTaskId) {
            moveTask(draggedTaskId, status);
            draggedTaskId = null;
        }
        document.querySelectorAll('.task-card').forEach(function(card) {
            card.classList.remove('dragging');
        });
    }

    function openTaskModal(taskId) {
        selectedTask = tasks.find(function(t) { return t.id === taskId; });
        if (!selectedTask) return;
        renderTaskModal();
        document.getElementById('taskModal').classList.add('show');
    }

    function closeTaskModal() {
        document.getElementById('taskModal').classList.remove('show');
        selectedTask = null;
    }

    function renderTaskModal() {
        if (!selectedTask) return;

        var task = selectedTask;
        var completedSubtasks = task.subtasks.filter(function(st) { return st.completed; }).length;
        var totalSubtasks = task.subtasks.length;
        var progressPercent = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

        var dueDateValue = task.dueDate ? formatDateInput(task.dueDate) : '';
        var dueTimeValue = task.dueTime || '';
        var alarmEnabled = task.alarmEnabled !== false;

        var allTags = getAllTags();
        var existingTagsHtml = allTags.map(function(tag) {
            var isSelected = task.tags.indexOf(tag) !== -1;
            return '<button class="modal-tag-btn' + (isSelected ? ' selected' : '') + '" data-tag="' + tag + '">#' + tag + '</button>';
        }).join('');

        var subtasksHtml = task.subtasks.map(function(st) {
            return '<div class="subtask-item">' +
                '<input type="checkbox" class="subtask-checkbox" data-subtask-id="' + st.id + '"' + (st.completed ? ' checked' : '') + '>' +
                '<span class="subtask-title' + (st.completed ? ' completed' : '') + '">' + escapeHtml(st.title) + '</span>' +
                (st.completed ? getCheckCircleIconSmall() : '') +
                '</div>';
        }).join('');

        var html = '<h2 class="modal-title">' + escapeHtml(task.title) + '</h2>' +

            '<div class="modal-badges">' +
            '<span class="badge status-badge">' + task.status + '</span>' +
            '<span class="badge priority-badge">' + task.priority + '</span>' +
            (task.pinned ? '<span class="badge pinned-badge">' + getStarIcon() + 'Pinned</span>' : '') +
            (task.activeNow ? '<span class="badge" style="background-color:var(--neon-pink);color:white;">FOCUS</span>' : '') +
            '<div class="modal-actions">' +
            '<button class="btn btn-outline btn-sm" id="moveLeftBtn"' + (task.status === 'todo' ? ' disabled' : '') + '>' + getArrowLeftIcon() + 'Move Left</button>' +
            '<button class="btn btn-outline btn-sm" id="moveRightBtn"' + (task.status === 'done' ? ' disabled' : '') + '>Move Right' + getArrowRightIcon() + '</button>' +
            '</div></div>' +

            '<div class="modal-quick-actions">' +
            '<button class="btn btn-outline btn-sm" id="pinTaskBtn">' + getStarIcon() + (task.pinned ? 'Unpin' : 'Pin') + '</button>' +
            '<button class="btn btn-outline btn-sm" id="duplicateTaskBtn">' + getDuplicateIcon() + 'Duplicate</button>' +
            '<button class="btn btn-outline btn-sm" id="snooze1DayBtn">' + getSnoozeIcon() + 'Snooze 1 day</button>' +
            '<button class="btn btn-outline btn-sm" id="snooze1WeekBtn">' + getSnoozeIcon() + 'Snooze 1 week</button>' +
            '</div>' +

            '<div class="edit-section modal-section">' +
            '<h3>Date & Time</h3>' +
            '<div class="datetime-edit-row">' +
            '<div class="datetime-field">' +
            '<label for="editDueDate">' + getCalendarIcon() + ' Due Date</label>' +
            '<input type="date" id="editDueDate" class="datetime-input" value="' + dueDateValue + '">' +
            '</div>' +
            '<div class="datetime-field">' +
            '<label for="editDueTime">' + getClockIcon() + ' Due Time</label>' +
            '<input type="time" id="editDueTime" class="datetime-input" value="' + dueTimeValue + '">' +
            '</div>' +
            '</div>' +
            '<button class="btn btn-primary btn-sm" id="saveDateTimeBtn" style="margin-top: 12px">Save Date & Time</button>' +
            '</div>' +

            '<div class="alarm-section modal-section">' +
            '<h3>Alarm Notification</h3>' +
            '<div class="alarm-toggle-row">' +
            '<label class="toggle-switch">' +
            '<input type="checkbox" id="alarmToggle"' + (alarmEnabled ? ' checked' : '') + '>' +
            '<span class="toggle-slider"></span>' +
            '</label>' +
            '<span class="alarm-label">' + (alarmEnabled ? 'Alarm enabled - You will be notified 15 minutes before due time' : 'Alarm disabled') + '</span>' +
            '</div>' +
            '</div>' +

            '<div class="description-box modal-section">' +
            '<h3>Description</h3>' +
            '<div class="description-edit-container" id="descriptionContainer">' +
            '<textarea class="description-textarea" id="descriptionTextarea" placeholder="Add a description...">' + escapeHtml(task.description || '') + '</textarea>' +
            '<button class="btn btn-primary btn-sm" id="saveDescriptionBtn">Save</button>' +
            '</div></div>' +

            '<div class="subtasks-box modal-section">' +
            '<div class="subtasks-header">' +
            '<h3>Subtasks' + (totalSubtasks > 0 ? ' (' + completedSubtasks + '/' + totalSubtasks + ')' : '') + '</h3>' +
            (totalSubtasks > 0 ? '<div class="subtasks-progress"><div class="subtasks-progress-fill" style="width: ' + progressPercent + '%"></div></div>' : '') +
            '</div>' +
            '<div class="subtask-list">' + subtasksHtml + '</div>' +
            '<div class="add-subtask-form">' +
            '<input type="text" class="add-subtask-input" id="newSubtaskInput" placeholder="Add a subtask...">' +
            '<button class="btn btn-primary btn-icon" id="addSubtaskBtn">' + getPlusIcon() + '</button>' +
            '</div></div>' +

            '<div class="tags-section modal-section">' +
            '<h3>Tags</h3>' +
            '<div class="tags-current">' +
            (task.tags.length > 0 ? task.tags.map(function(tag) {
                return '<span class="badge tag removable-tag" data-tag="' + tag + '">#' + tag + ' <span class="remove-tag-x">×</span></span>';
            }).join('') : '<span class="no-tags-text">No tags added</span>') +
            '</div>' +
            (allTags.length > 0 ? '<div class="tags-available"><span class="tags-label">Select tags:</span><div class="modal-tag-list">' + existingTagsHtml + '</div></div>' : '') +
            '<div class="add-tag-form">' +
            '<input type="text" id="newTagInput" class="add-tag-input" placeholder="Add new tag...">' +
            '<button class="btn btn-primary btn-sm" id="addTagBtn">Add</button>' +
            '</div>' +
            '</div>' +

            '<div class="delete-section">' +
            '<button class="btn btn-destructive" id="deleteTaskBtn">' + getTrashIcon() + 'Delete Task</button>' +
            '</div>';

        document.getElementById('modalBody').innerHTML = html;
        setupModalEventListeners();
    }

    function formatDateInput(date) {
        var d = new Date(date);
        var year = d.getFullYear();
        var month = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }

    function setupModalEventListeners() {
        var moveLeftBtn = document.getElementById('moveLeftBtn');
        var moveRightBtn = document.getElementById('moveRightBtn');
        var deleteTaskBtn = document.getElementById('deleteTaskBtn');
        var addSubtaskBtn = document.getElementById('addSubtaskBtn');
        var newSubtaskInput = document.getElementById('newSubtaskInput');
        var saveDescriptionBtn = document.getElementById('saveDescriptionBtn');
        var descriptionTextarea = document.getElementById('descriptionTextarea');
        var pinTaskBtn = document.getElementById('pinTaskBtn');
        var duplicateTaskBtn = document.getElementById('duplicateTaskBtn');
        var snooze1DayBtn = document.getElementById('snooze1DayBtn');
        var snooze1WeekBtn = document.getElementById('snooze1WeekBtn');

        if (moveLeftBtn) {
            moveLeftBtn.addEventListener('click', function() {
                var statuses = ['todo', 'doing', 'done'];
                var currentIndex = statuses.indexOf(selectedTask.status);
                if (currentIndex > 0) {
                    moveTask(selectedTask.id, statuses[currentIndex - 1]);
                }
            });
        }

        if (moveRightBtn) {
            moveRightBtn.addEventListener('click', function() {
                var statuses = ['todo', 'doing', 'done'];
                var currentIndex = statuses.indexOf(selectedTask.status);
                if (currentIndex < statuses.length - 1) {
                    moveTask(selectedTask.id, statuses[currentIndex + 1]);
                }
            });
        }

        if (deleteTaskBtn) {
            deleteTaskBtn.addEventListener('click', function() {
                deleteTask(selectedTask.id);
            });
        }

        if (addSubtaskBtn && newSubtaskInput) {
            addSubtaskBtn.addEventListener('click', function() {
                var value = newSubtaskInput.value.trim();
                if (value) {
                    addSubtask(selectedTask.id, value);
                    newSubtaskInput.value = '';
                }
            });

            newSubtaskInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    var value = newSubtaskInput.value.trim();
                    if (value) {
                        addSubtask(selectedTask.id, value);
                        newSubtaskInput.value = '';
                    }
                }
            });
        }

        document.querySelectorAll('.subtask-checkbox').forEach(function(checkbox) {
            checkbox.addEventListener('change', function() {
                var subtaskId = this.getAttribute('data-subtask-id');
                toggleSubtask(selectedTask.id, subtaskId);
            });
        });

        if (saveDescriptionBtn && descriptionTextarea) {
            saveDescriptionBtn.addEventListener('click', function() {
                var newDesc = descriptionTextarea.value.trim();
                updateTask(selectedTask.id, { description: newDesc });
                showToast('Description Saved', 'Task description updated');
            });
        }

        if (pinTaskBtn) {
            pinTaskBtn.addEventListener('click', function() {
                togglePin(selectedTask.id);
            });
        }

        if (duplicateTaskBtn) {
            duplicateTaskBtn.addEventListener('click', function() {
                duplicateTask(selectedTask.id);
                closeTaskModal();
            });
        }

        if (snooze1DayBtn) {
            snooze1DayBtn.addEventListener('click', function() {
                snoozeTask(selectedTask.id, 1);
            });
        }

        if (snooze1WeekBtn) {
            snooze1WeekBtn.addEventListener('click', function() {
                snoozeTask(selectedTask.id, 7);
            });
        }

        var saveDateTimeBtn = document.getElementById('saveDateTimeBtn');
        var editDueDate = document.getElementById('editDueDate');
        var editDueTime = document.getElementById('editDueTime');
        
        if (saveDateTimeBtn) {
            saveDateTimeBtn.addEventListener('click', function() {
                var dateValue = editDueDate.value;
                var timeValue = editDueTime.value;
                var updates = {};
                
                if (dateValue) {
                    updates.dueDate = new Date(dateValue + 'T00:00:00');
                } else {
                    updates.dueDate = undefined;
                }
                
                updates.dueTime = timeValue || undefined;
                
                updateTask(selectedTask.id, updates);
                showToast('Date & Time Updated', 'Task schedule has been updated');
            });
        }

        var alarmToggle = document.getElementById('alarmToggle');
        if (alarmToggle) {
            alarmToggle.addEventListener('change', function() {
                updateTask(selectedTask.id, { alarmEnabled: this.checked });
                showToast(this.checked ? 'Alarm Enabled' : 'Alarm Disabled', 
                    this.checked ? 'You will be notified before the task is due' : 'Alarm notifications disabled for this task');
            });
        }

        document.querySelectorAll('.modal-tag-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var tagName = this.getAttribute('data-tag');
                var currentTags = selectedTask.tags.slice();
                var tagIndex = currentTags.indexOf(tagName);
                
                if (tagIndex === -1) {
                    currentTags.push(tagName);
                } else {
                    currentTags.splice(tagIndex, 1);
                }
                
                updateTask(selectedTask.id, { tags: currentTags });
            });
        });

        document.querySelectorAll('.removable-tag').forEach(function(tag) {
            tag.addEventListener('click', function() {
                var tagName = this.getAttribute('data-tag');
                var currentTags = selectedTask.tags.filter(function(t) { return t !== tagName; });
                updateTask(selectedTask.id, { tags: currentTags });
            });
        });

        var addTagBtn = document.getElementById('addTagBtn');
        var newTagInput = document.getElementById('newTagInput');
        if (addTagBtn && newTagInput) {
            addTagBtn.addEventListener('click', function() {
                var tagValue = newTagInput.value.trim().replace(/^#/, '').replace(/\s+/g, '-');
                if (tagValue && selectedTask.tags.indexOf(tagValue) === -1) {
                    var newTags = selectedTask.tags.concat([tagValue]);
                    updateTask(selectedTask.id, { tags: newTags });
                    newTagInput.value = '';
                }
            });
            
            newTagInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addTagBtn.click();
                }
            });
        }
    }

    function checkWelcome() {
        var hasSeenWelcome = localStorage.getItem('oops-later-welcome-seen');
        if (!hasSeenWelcome && tasks.length === 0) {
            document.getElementById('welcomeModal').classList.add('show');
        }
    }

    function closeWelcome() {
        document.getElementById('welcomeModal').classList.remove('show');
        localStorage.setItem('oops-later-welcome-seen', 'true');
    }

    function loadSampleTasks() {
        var samples = SampleData.getSampleTasks();
        samples.forEach(function(taskData) {
            addTask(taskData);
        });
        closeWelcome();
        showToast('Sample Tasks Loaded', 'Added ' + samples.length + ' sample tasks');
    }

    function showToast(title, description) {
        var container = document.getElementById('toastContainer');
        var toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = '<div class="toast-title">' + title + '</div>' +
            '<div class="toast-description">' + description + '</div>';
        container.appendChild(toast);

        setTimeout(function() {
            toast.remove();
        }, 3000);
    }

    function showUndoToast(title, description) {
        var container = document.getElementById('toastContainer');
        var toast = document.createElement('div');
        toast.className = 'toast toast-with-undo';
        toast.innerHTML = '<div class="toast-content">' +
            '<div class="toast-title">' + title + '</div>' +
            '<div class="toast-description">' + description + '</div>' +
            '</div>' +
            '<button class="undo-btn">Undo</button>';
        container.appendChild(toast);

        var undoBtn = toast.querySelector('.undo-btn');
        undoBtn.addEventListener('click', function() {
            undoLastAction();
            toast.remove();
        });

        setTimeout(function() {
            toast.remove();
        }, 5000);
    }

    function formatDate(date) {
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[date.getMonth()] + ' ' + date.getDate();
    }

    function formatDateLong(date) {
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getCalendarIcon() {
        return '<svg style="width:12px;height:12px;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';
    }

    function getClockIcon() {
        return '<svg style="width:12px;height:12px;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
    }

    function getClockIconLarge(color) {
        return '<svg class="stat-icon ' + color + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
    }

    function getRepeatIcon() {
        return '<svg style="width:12px;height:12px;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>';
    }

    function getMoreIcon() {
        return '<svg style="width:20px;height:20px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>';
    }

    function getEditIcon() {
        return '<svg style="width:16px;height:16px;margin-right:8px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
    }

    function getCheckIcon() {
        return '<svg style="width:16px;height:16px;margin-right:8px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    }

    function getTrashIcon() {
        return '<svg style="width:16px;height:16px;margin-right:8px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    }

    function getStarIcon() {
        return '<svg style="width:16px;height:16px;margin-right:8px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
    }

    function getSnoozeIcon() {
        return '<svg style="width:16px;height:16px;margin-right:8px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h16v6l-3 3 3 3v6H4V4z"></path><line x1="8" y1="12" x2="16" y2="12"></line></svg>';
    }

    function getDuplicateIcon() {
        return '<svg style="width:16px;height:16px;margin-right:8px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    }

    function getBarChartIcon(color) {
        return '<svg class="stat-icon ' + color + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>';
    }

    function getCheckCircleIcon(color) {
        return '<svg class="stat-icon ' + color + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    }

    function getCheckCircleIconSmall() {
        return '<svg class="subtask-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    }

    function getTrendingUpIcon(color) {
        return '<svg class="stat-icon ' + color + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>';
    }

    function getArrowLeftIcon() {
        return '<svg style="width:16px;height:16px;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';
    }

    function getArrowRightIcon() {
        return '<svg style="width:16px;height:16px;margin-left:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';
    }

    function getPlusIcon() {
        return '<svg style="width:20px;height:20px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
    }

    function getFileJsonIcon() {
        return '<svg style="width:20px;height:20px;margin-right:8px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
    }

    function getFileSpreadsheetIcon() {
        return '<svg style="width:20px;height:20px;margin-right:8px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><line x1="8" y1="9" x2="10" y2="9"></line></svg>';
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        addTask: addTask,
        updateTask: updateTask,
        deleteTask: deleteTask,
        moveTask: moveTask,
        handleDragStart: handleDragStart,
        handleDrop: handleDrop
    };
})();
