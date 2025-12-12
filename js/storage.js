var Storage = (function() {
    var STORAGE_KEY = 'oops-later-tasks';
    var THEME_KEY = 'oops-later-theme';

    function getTasks() {
        try {
            var data = localStorage.getItem(STORAGE_KEY);
            if (!data) return [];
            var tasks = JSON.parse(data);
            return tasks.map(function(task) {
                return Object.assign({}, task, {
                    dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
                    createdAt: new Date(task.createdAt),
                    updatedAt: new Date(task.updatedAt)
                });
            });
        } catch (error) {
            console.error('Error loading tasks:', error);
            return [];
        }
    }

    function saveTasks(tasks) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        } catch (error) {
            console.error('Error saving tasks:', error);
        }
    }

    function getTheme() {
        try {
            var theme = localStorage.getItem(THEME_KEY);
            return theme || 'light';
        } catch (error) {
            return 'light';
        }
    }

    function saveTheme(theme) {
        try {
            localStorage.setItem(THEME_KEY, theme);
        } catch (error) {
            console.error('Error saving theme:', error);
        }
    }

    function exportToJSON(tasks) {
        var dataStr = JSON.stringify(tasks, null, 2);
        var dataBlob = new Blob([dataStr], { type: 'application/json' });
        var url = URL.createObjectURL(dataBlob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'oops-later-tasks-' + new Date().toISOString().split('T')[0] + '.json';
        link.click();
        URL.revokeObjectURL(url);
    }

    function exportToCSV(tasks) {
        var headers = ['Title', 'Status', 'Priority', 'Due Date', 'Due Time', 'Tags', 'Category', 'Completed'];
        var rows = tasks.map(function(task) {
            return [
                task.title,
                task.status,
                task.priority,
                task.dueDate ? task.dueDate.toLocaleDateString() : '',
                task.dueTime || '',
                task.tags.join('; '),
                task.category || '',
                task.completed ? 'Yes' : 'No'
            ];
        });

        var csvContent = [
            headers.join(','),
            rows.map(function(row) {
                return row.map(function(cell) {
                    return '"' + cell + '"';
                }).join(',');
            }).join('\n')
        ].join('\n');

        var dataBlob = new Blob([csvContent], { type: 'text/csv' });
        var url = URL.createObjectURL(dataBlob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'oops-later-tasks-' + new Date().toISOString().split('T')[0] + '.csv';
        link.click();
        URL.revokeObjectURL(url);
    }

    return {
        getTasks: getTasks,
        saveTasks: saveTasks,
        getTheme: getTheme,
        saveTheme: saveTheme,
        exportToJSON: exportToJSON,
        exportToCSV: exportToCSV
    };
})();
