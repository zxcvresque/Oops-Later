var SampleData = (function() {
    function getSampleTasks() {
        var now = Date.now();
        var day = 86400000;

        return [
            {
                title: 'Design new landing page',
                description: 'Create mockups for the new product landing page with hero section and features',
                status: 'doing',
                priority: 'high',
                dueDate: new Date(now + day),
                dueTime: '14:00',
                tags: ['design', 'urgent'],
                category: 'Work',
                subtasks: [
                    { id: '1', title: 'Research competitor sites', completed: true },
                    { id: '2', title: 'Create wireframes', completed: true },
                    { id: '3', title: 'Design hero section', completed: false },
                    { id: '4', title: 'Get feedback', completed: false }
                ],
                attachments: [],
                recurrence: 'none',
                completed: false
            },
            {
                title: 'Buy groceries',
                description: 'Milk, eggs, bread, coffee, and vegetables',
                status: 'todo',
                priority: 'medium',
                dueDate: new Date(),
                tags: ['shopping', 'personal'],
                category: 'Personal',
                subtasks: [],
                attachments: [],
                recurrence: 'weekly',
                completed: false
            },
            {
                title: 'Call mom',
                status: 'todo',
                priority: 'high',
                dueDate: new Date(),
                dueTime: '18:00',
                tags: ['family'],
                category: 'Personal',
                subtasks: [],
                attachments: [],
                recurrence: 'none',
                completed: false
            },
            {
                title: 'Review pull requests',
                description: 'Check and approve pending PRs from the team',
                status: 'todo',
                priority: 'medium',
                dueDate: new Date(now + day * 2),
                tags: ['code-review', 'work'],
                category: 'Work',
                subtasks: [],
                attachments: [],
                recurrence: 'daily',
                completed: false
            },
            {
                title: 'Finish quarterly report',
                description: 'Compile data and write summary for Q4 performance',
                status: 'done',
                priority: 'high',
                dueDate: new Date(now - day),
                tags: ['report', 'work'],
                category: 'Work',
                subtasks: [
                    { id: '5', title: 'Gather data', completed: true },
                    { id: '6', title: 'Create charts', completed: true },
                    { id: '7', title: 'Write summary', completed: true },
                    { id: '8', title: 'Submit to manager', completed: true }
                ],
                attachments: [],
                recurrence: 'none',
                completed: true
            },
            {
                title: 'Gym workout',
                description: 'Leg day - squats, lunges, and cardio',
                status: 'done',
                priority: 'low',
                dueDate: new Date(),
                tags: ['fitness', 'health'],
                category: 'Personal',
                subtasks: [],
                attachments: [],
                recurrence: 'daily',
                completed: true
            },
            {
                title: 'Plan weekend trip',
                description: 'Research destinations and book accommodation',
                status: 'todo',
                priority: 'low',
                dueDate: new Date(now + day * 5),
                tags: ['travel', 'fun'],
                category: 'Personal',
                subtasks: [
                    { id: '9', title: 'Choose destination', completed: false },
                    { id: '10', title: 'Book hotel', completed: false },
                    { id: '11', title: 'Plan activities', completed: false }
                ],
                attachments: [],
                recurrence: 'none',
                completed: false
            }
        ];
    }

    return {
        getSampleTasks: getSampleTasks
    };
})();
