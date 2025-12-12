var TaskParser = (function() {
    var weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    function getNextWeekday(targetDay, addWeeks) {
        addWeeks = addWeeks || 0;
        var today = new Date();
        var currentDay = today.getDay();
        var targetDayIndex = weekdays.indexOf(targetDay.toLowerCase());
        
        if (targetDayIndex === -1) return null;
        
        var daysUntilTarget = targetDayIndex - currentDay;
        if (daysUntilTarget <= 0) {
            daysUntilTarget += 7;
        }
        
        daysUntilTarget += (addWeeks * 7);
        
        var result = new Date();
        result.setDate(today.getDate() + daysUntilTarget);
        return result;
    }
    
    function parseNaturalLanguage(input) {
        var title = input;
        var priority = 'medium';
        var dueDate = undefined;
        var dueTime = undefined;
        var tags = [];

        var priorityRegex = /(high|low|medium)\s+priority/i;
        var priorityMatch = input.match(priorityRegex);
        if (priorityMatch) {
            priority = priorityMatch[1].toLowerCase();
            title = title.replace(priorityRegex, '').trim();
        }

        var tagRegex = /#(\w+)/g;
        var tagMatch;
        while ((tagMatch = tagRegex.exec(input)) !== null) {
            tags.push(tagMatch[1]);
            title = title.replace(tagMatch[0], '').trim();
        }

        var timeRegex = /\b(\d{1,2}):?(\d{2})?\s*(am|pm)?\b/i;
        var timeMatch = input.match(timeRegex);
        if (timeMatch) {
            var hours = parseInt(timeMatch[1]);
            var minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            var meridiem = timeMatch[3] ? timeMatch[3].toLowerCase() : null;

            if (meridiem === 'pm' && hours < 12) hours += 12;
            if (meridiem === 'am' && hours === 12) hours = 0;

            dueTime = hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');
            title = title.replace(timeMatch[0], '').trim();
        }

        var nextWeekDayRegex = /\bnext\s+week\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
        var thisWeekDayRegex = /\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
        var onWeekDayRegex = /\bon\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
        var justWeekDayRegex = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
        var tomorrowRegex = /\btomorrow\b/i;
        var todayRegex = /\btoday\b/i;
        var nextWeekRegex = /\bnext\s+week\b/i;
        var inDaysRegex = /\bin\s+(\d+)\s+days?\b/i;
        var inWeeksRegex = /\bin\s+(\d+)\s+weeks?\b/i;
        var specificDateRegex = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;

        var nextWeekDayMatch = input.match(nextWeekDayRegex);
        var thisWeekDayMatch = input.match(thisWeekDayRegex);
        var onWeekDayMatch = input.match(onWeekDayRegex);
        var inDaysMatch = input.match(inDaysRegex);
        var inWeeksMatch = input.match(inWeeksRegex);

        if (nextWeekDayMatch) {
            dueDate = getNextWeekday(nextWeekDayMatch[1], 1);
            title = title.replace(nextWeekDayRegex, '').trim();
        } else if (thisWeekDayMatch) {
            dueDate = getNextWeekday(thisWeekDayMatch[1], 0);
            title = title.replace(thisWeekDayRegex, '').trim();
        } else if (onWeekDayMatch) {
            dueDate = getNextWeekday(onWeekDayMatch[1], 0);
            title = title.replace(onWeekDayRegex, '').trim();
        } else if (inDaysMatch) {
            dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + parseInt(inDaysMatch[1]));
            title = title.replace(inDaysRegex, '').trim();
        } else if (inWeeksMatch) {
            dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (parseInt(inWeeksMatch[1]) * 7));
            title = title.replace(inWeeksRegex, '').trim();
        } else if (tomorrowRegex.test(input)) {
            dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 1);
            title = title.replace(tomorrowRegex, '').trim();
        } else if (todayRegex.test(input)) {
            dueDate = new Date();
            title = title.replace(todayRegex, '').trim();
        } else if (nextWeekRegex.test(input)) {
            dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 7);
            title = title.replace(nextWeekRegex, '').trim();
        } else {
            var justWeekDayMatch = input.match(justWeekDayRegex);
            if (justWeekDayMatch && !timeMatch) {
                dueDate = getNextWeekday(justWeekDayMatch[1], 0);
                title = title.replace(justWeekDayRegex, '').trim();
            } else {
                var dateMatch = input.match(specificDateRegex);
                if (dateMatch) {
                    var month = parseInt(dateMatch[1]) - 1;
                    var day = parseInt(dateMatch[2]);
                    var year = dateMatch[3] ? parseInt(dateMatch[3]) : new Date().getFullYear();
                    dueDate = new Date(year, month, day);
                    title = title.replace(dateMatch[0], '').trim();
                }
            }
        }

        title = title.replace(/\s+/g, ' ').trim();

        return {
            title: title,
            priority: priority,
            dueDate: dueDate,
            dueTime: dueTime,
            tags: tags
        };
    }

    return {
        parseNaturalLanguage: parseNaturalLanguage,
        parse: parseNaturalLanguage
    };
})();
