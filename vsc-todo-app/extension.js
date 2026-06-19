const vscode = require('vscode');

function activate(context) {
    // Save your birthday here (Year, Month - 1, Day) -> e.g., October 15, 1998
    const birthDate = new Date(1998, 9, 15); 

    class TaskViewProvider {
        resolveWebviewView(webviewView) {
            webviewView.webview.options = { enableScripts: true };
            webviewView.webview.html = this.getHtmlContent(birthDate);
        }

        getHtmlContent(birthday) {
            return `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 15px; color: var(--vscode-foreground); }
                        .section { margin-bottom: 20px; padding: 10px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-sideBar-background); }
                        h3 { margin-top: 0; color: var(--vscode-button-background); }
                        .date-display { font-size: 1.2em; font-weight: bold; }
                        .age-display { font-family: monospace; font-size: 1.1em; color: #4caf50; }
                        .task-item { display: flex; align-items: center; margin: 8px 0; }
                        .task-text { margin-left: 8px; flex-grow: 1; }
                        input[type="text"] { width: 70%; padding: 5px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); }
                        button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 5px 10px; cursor: pointer; }
                        button:hover { background: var(--vscode-button-hoverBackground); }
                    </style>
                </head>
                <body>
                    <div class="section">
                        <h3>📅 Today's Date</h3>
                        <div class="date-display" id="currentDate">Loading Date...</div>
                    </div>

                    <div class="section">
                        <h3>⏳ Your Age Progress</h3>
                        <div class="age-display" id="ageDisplay">Calculating...</div>
                    </div>

                    <div class="section">
                        <h3>✅ Daily Tasks</h3>
                        <div style="margin-bottom: 10px;">
                            <input type="text" id="taskInput" placeholder="Add daily task..." />
                            <button onclick="addTask()">Add</button>
                        </div>
                        <div id="taskList"></div>
                    </div>

                    <script>
                        // Update Date & Live Age Tracker
                        const birthTime = ${birthday.getTime()};
                        
                        function updateDashboard() {
                            const now = new Date();
                            // Update Date
                            document.getElementById('currentDate').innerText = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                            
                            // Calculate Age precisely down to milliseconds
                            const ageInMilliseconds = now.getTime() - birthTime;
                            const ageInYears = (ageInMilliseconds / (1000 * 60 * 60 * 24 * 365.25)).toFixed(8);
                            document.getElementById('ageDisplay').innerText = ageInYears + " years old";
                        }
                        setInterval(updateDashboard, 100);

                        // Simple Task List Array
                        let tasks = [];

                        function addTask() {
                            const input = document.getElementById('taskInput');
                            if (input.value.trim() !== "") {
                                tasks.push({ text: input.value, completed: false });
                                input.value = "";
                                renderTasks();
                            }
                        }

                        function toggleTask(index) {
                            tasks[index].completed = !tasks[index].completed;
                            renderTasks();
                        }

                        function renderTasks() {
                            const list = document.getElementById('taskList');
                            list.innerHTML = "";
                            tasks.forEach((task, index) => {
                                list.innerHTML += \`
                                    <div class="task-item">
                                        <input type="checkbox" \${task.completed ? 'checked' : ''} onchange="toggleTask(\${index})">
                                        <span class="task-text" style="\${task.completed ? 'text-decoration: line-through; opacity: 0.5;' : ''}">\${task.text}</span>
                                    </div>
                                \`;
                            });
                        }
                    </script>
                </body>
                </html>
            `;
        }
    }

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('lifeTaskWebview', new TaskViewProvider())
    );
}

function deactivate() {}

module.exports = { activate, deactivate };