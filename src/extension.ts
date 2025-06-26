import * as vscode from 'vscode';
import { PromptEnhancer } from './promptEnhancer';
import { AuthManager } from './authManager';
import { ConfigManager } from './configManager';

let promptEnhancer: PromptEnhancer;
let authManager: AuthManager;
let configManager: ConfigManager;

export function activate(context: vscode.ExtensionContext) {

    // Initialize managers
    configManager = new ConfigManager(context);
    authManager = new AuthManager(context, configManager);
    promptEnhancer = new PromptEnhancer(authManager, configManager);

    // Validate stored session on startup (silently)
    authManager.validateSession().then(isValid => {
        if (isValid) {
        } else {
        }
    }).catch(error => {
        console.error('PromptDC: Error validating session on startup:', error);
    });

    // Create settings status bar item (context-sensitive)
    const settingsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    settingsStatusBarItem.text = "$(gear) PromptDC";
    settingsStatusBarItem.command = 'promptdc.openSettings';
    settingsStatusBarItem.tooltip = 'PromptDC Settings - Login, Credits, API Key';
    settingsStatusBarItem.show(); // Always show the status bar item

    // Register commands
    const enhanceCommand = vscode.commands.registerCommand('promptdc.enhanceText', (autoDetect = false) => {
        promptEnhancer.enhanceText(autoDetect);
    });

    // Register command for button clicks (auto-detect)
    const enhanceButtonCommand = vscode.commands.registerCommand('promptdc.enhanceTextAuto', () => {
        promptEnhancer.enhanceText(true);
    });

    // Register command for direct text input (bypasses automatic detection)
    const enhanceDirectCommand = vscode.commands.registerCommand('promptdc.enhanceTextDirect', () => {
        promptEnhancer.enhanceTextDirect();
    });

    // Register command specifically for chat text enhancement
    const enhanceChatCommand = vscode.commands.registerCommand('promptdc.enhanceChatText', () => {
        promptEnhancer.enhanceChatText();
    });

    const loginCommand = vscode.commands.registerCommand('promptdc.login', () => {
        authManager.login();
    });

    const logoutCommand = vscode.commands.registerCommand('promptdc.logout', () => {
        authManager.logout();
    });

    const openSettingsCommand = vscode.commands.registerCommand('promptdc.openSettings', () => {
        openSettingsPanel(context, authManager, configManager);
    });

    const configCommand = vscode.commands.registerCommand('promptdc.configure', () => {
        openSettingsPanel(context, authManager, configManager);
    });

    // Removed CodeLens and Hover providers - only work with right sidebar chat

    // Add to context subscriptions
    context.subscriptions.push(
        enhanceCommand,
        enhanceButtonCommand,
        enhanceDirectCommand,
        enhanceChatCommand,
        loginCommand,
        logoutCommand,
        openSettingsCommand,
        configCommand,
        settingsStatusBarItem
    );

    // Show welcome message on first activation
    const hasShownWelcome = context.globalState.get('hasShownWelcome', false);
    if (!hasShownWelcome) {
        const isMac = process.platform === 'darwin';
        const shortcut = isMac ? 'Cmd+Ctrl+E' : 'Ctrl+Alt+E';
        vscode.window.showInformationMessage(
            `PromptDC extension activated! Use ${shortcut} to enhance your prompts.`,
            'Got it!'
        );
        context.globalState.update('hasShownWelcome', true);
    }

    // Periodic token refresh check for long-term stability (every 30 minutes)
    const tokenCheckInterval = setInterval(async () => {
        try {
            await authManager.getAccessToken(); // This will refresh token if needed
        } catch (error) {
            // Silently handle errors
        }
    }, 30 * 60 * 1000); // 30 minutes

    context.subscriptions.push({
        dispose: () => clearInterval(tokenCheckInterval)
    });
}

function openSettingsPanel(context: vscode.ExtensionContext, authManager: AuthManager, configManager: ConfigManager) {
    let panel: vscode.WebviewPanel | undefined = vscode.window.createWebviewPanel(
        'promptdcSettings',
        'PromptDC Settings',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    const loadWebviewContent = async () => {
        if (panel) {
            panel.webview.html = getSettingsWebviewContent();
            const data = await getSettingsData(authManager);
            panel.webview.postMessage({ command: 'refreshData', data });
        }
    };

    loadWebviewContent();

    panel.onDidDispose(() => {
        panel = undefined;
    });

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
        async (message) => {
            if (!panel) return; // Stop if panel is closed

            switch (message.command) {
                case 'login':
                    const loginSuccess = await authManager.login();
                    if (loginSuccess) {
                        // Reload the webview to reflect the new login state
                        vscode.window.showInformationMessage("Login successful! Refreshing settings...");
                        await loadWebviewContent();
                    }
                    break;
                case 'logout':
                    await authManager.logout();
                    await loadWebviewContent();
                    break;
                case 'saveApiKey':
                    await context.globalState.update('promptdc.apiKey', message.apiKey);
                    // Small delay to ensure the value is persisted
                    await new Promise(resolve => setTimeout(resolve, 100));
                    vscode.window.showInformationMessage('API Key saved successfully!');
                    break;
                case 'saveClineEnabled':
                    await configManager.setSelectedModel(message.model);
                    // Small delay to ensure the value is persisted
                    await new Promise(resolve => setTimeout(resolve, 100));
                    vscode.window.showInformationMessage('Model setting saved successfully!');
                    break;
                case 'getSettings':
                    // Send current settings data
                    const currentSettingsData = await getSettingsData(authManager);
                    panel.webview.postMessage({
                        command: 'refreshData',
                        data: currentSettingsData
                    });
                    break;
                case 'editKeybinding':
                    vscode.commands.executeCommand('workbench.action.openGlobalKeybindings', 'promptdc.enhanceTextAuto');
                    break;
            }
        },
        undefined,
        context.subscriptions
    );
}

async function getSettingsData(authManager: AuthManager) {
    const isLoggedIn = await authManager.isLoggedIn();
    const userInfo = isLoggedIn ? await authManager.getUserInfo() : null;
    const savedApiKey = await authManager.getApiKey();
    const selectedModel = configManager.getSelectedModel();

    const data = {
        isLoggedIn,
        userInfo,
        savedApiKey: savedApiKey || '',
        selectedModel
    };
    return data;
}



function getSettingsWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PromptDC Settings</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            font-size: var(--vscode-font-size);
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
        }
        .section {
            margin-bottom: 24px;
            padding: 16px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            background-color: var(--vscode-panel-background);
            border-radius: 12px;
        }
        .section h2 {
            margin: 0 0 16px 0;
            color: var(--vscode-foreground);
            font-size: 16px;
            font-weight: 600;
        }
        .status {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
        }
        .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }
        .status-online { 
            background-color: var(--vscode-terminal-ansiGreen); 
        }
        .status-offline { 
            background-color: var(--vscode-terminal-ansiRed); 
        }
        
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 2px;
            cursor: pointer;
            font-size: var(--vscode-font-size);
            font-family: var(--vscode-font-family);
            border-radius: 8px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        button:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: 2px;
        }
        
        #toggleApiKeyVisibility {
            transition: opacity 0.2s ease;
        }
        #toggleApiKeyVisibility:hover:not(:disabled) {
            opacity: 0.7;
        }
        #toggleApiKeyVisibility:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
        
        input[type="password"], input[type="text"] {
            width: 50%;
            padding: 8px 16px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            box-sizing: border-box;
            border-radius: 8px;
        }
        input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
            border-radius: 8px;
        }

        input:disabled {
            background-color: var(--vscode-input-background);
            opacity: 0.5;
            cursor: not-allowed;
            border-radius: 8px;
        }
        
        .user-info {
            background-color: var(--vscode-editor-background);
            padding: 12px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 2px;
            margin: 12px 0;
            border-radius: 8px;
        }
        .user-info div {
            margin-bottom: 4px;
        }
        .user-info div:last-child {
            margin-bottom: 0;
        }
        
        .api-key-help {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 8px;
            line-height: 1.4;
        }
        
        .loading {
            text-align: center;
            padding: 16px;
            color: var(--vscode-descriptionForeground);
        }
        
        .description {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 12px;
            font-size: 14px;
        }
        
        .instructions {
            color: var(--vscode-foreground);
            line-height: 1.6;
        }
        .instructions p {
            margin: 8px 0;
            font-size: 14px;
        }
        .instructions strong {
            color: var(--vscode-foreground);
            font-weight: 600;
        }
        
        code {
            background-color: var(--vscode-textCodeBlock-background);
            color: var(--vscode-textPreformat-foreground);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: var(--vscode-editor-font-family), 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 12px;
            font-weight: 500;
            border: 1px solid var(--vscode-textSeparator-foreground);
        }
        
        select {
            cursor: pointer;
        }
        
        select:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        label {
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="section">
            <h2>Account Status</h2>
            <div id="accountSection">
                <div class="loading">Loading...</div>
            </div>
        </div>

        <div class="section">
            <h2>Keyboard Shortcut</h2>
            <p class="description">Change the keyboard shortcut for enhancing text..</p>
            <div id="keybinding-section">
                <button onclick="editKeybinding()">Change Shortcut</button>
            </div>
            <div class="api-key-help">
                &bull; Default: <code id="shortcutDisplay2">cmd+ctrl+e</code> for quick enhancement<br>
            </div>
        </div>

        <div class="section">
            <h2>Model Selection</h2>
            <p class="description">Choose which AI model to use for prompt enhancement</p>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <label for="modelSelect">Model:</label>
                <select id="modelSelect" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--vscode-input-border); background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size);">
                    <option value="copilot">Copilot</option>
                    <option value="cline">Cline</option>
                </select>
            </div>
          
        </div>

        <div class="section">
            <h2>API Key</h2>
            <p class="description">For lifetime subscription users only</p>
            <div class="api-key-section">
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="position: relative; flex: 1;">
                    <input type="password" id="apiKeyInput" placeholder="sk-..." disabled style="width: 100%; padding-right: 40px;">
                    <button id="toggleApiKeyVisibility" onclick="toggleApiKeyVisibility()" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--vscode-foreground); padding: 4px; display: flex; align-items: center; justify-content: center;" disabled>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" id="eyeIcon">
                            <path d="M8 2C4.5 2 1.5 4.5 0 8c1.5 3.5 4.5 6 8 6s6.5-2.5 8-6c-1.5-3.5-4.5-6-8-6zm0 10c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4zm0-6c-1.1 0-2 0.9-2 2s0.9 2 2 2 2-0.9 2-2-0.9-2-2-2z"/>
                        </svg>
                    </button>
                </div>
                <button id="saveApiKeyButton" onclick="saveApiKey()" disabled>Save API Key</button>
            </div>
                <div class="api-key-help">
                    &bull; Stored locally and securely in VS Code.<br>
                    &bull; Bring your own OpenAI API key.
                </div>
            </div>
        </div>

        <div class="section">
            <h2>How to Use</h2>
            <div class="instructions">
                <p><strong>1.</strong> Click in the chat input area</p>
                <p><strong>2.</strong> Type your prompt</p>
                <p><strong>3.</strong> Press your keyboard shortcut to enhance</p>
                <p><strong>4.</strong> Your text will be automatically enhanced and replaced</p>
                <p><strong>⚠️ Important:</strong> Make sure you have clicked in the chat input area first, otherwise the enhancement will not work.</p>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Request initial data
        vscode.postMessage({ command: 'getSettings' });
        
        // Update keyboard shortcut display based on platform
        function updateShortcutDisplay() {
            const isMac = navigator.platform.toLowerCase().includes('mac');
            const shortcut = isMac ? 'Cmd+Ctrl+E' : 'Ctrl+Alt+E';
            const shortcutDisplay1 = document.getElementById('shortcutDisplay1');
            const shortcutDisplay2 = document.getElementById('shortcutDisplay2');
            if (shortcutDisplay1) shortcutDisplay1.textContent = shortcut;
            if (shortcutDisplay2) shortcutDisplay2.textContent = shortcut;
        }
        
        // Call on page load
        updateShortcutDisplay();
        
        function editKeybinding() {
            vscode.postMessage({ command: 'editKeybinding' });
        }
        
        function login() {
            vscode.postMessage({ command: 'login' });
        }
        
        function logout() {
            vscode.postMessage({ command: 'logout' });
        }
        
        function saveApiKey() {
            const apiKey = document.getElementById('apiKeyInput').value.trim();
            vscode.postMessage({ command: 'saveApiKey', apiKey: apiKey });
        }
        
        function saveModelSelection() {
            const model = document.getElementById('modelSelect').value;
            vscode.postMessage({ command: 'saveClineEnabled', model: model });
        }
        
        function toggleApiKeyVisibility() {
            const apiKeyInput = document.getElementById('apiKeyInput');
            const toggleButton = document.getElementById('toggleApiKeyVisibility');
            
            if (apiKeyInput.type === 'password') {
                apiKeyInput.type = 'text';
                toggleButton.innerHTML = \`
                 <svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" width="16" height="16" x="0" y="0" viewBox="0 0 512 512" style="enable-background:new 0 0 512 512" xml:space="preserve"><g><g data-name="Layer 16"><path d="M419.72 419.72 92.26 92.27l-.07-.08a19 19 0 0 0-26.78 27l28.67 28.67a332.64 332.64 0 0 0-88.19 89 34.22 34.22 0 0 0 0 38.38C65.86 364 160.93 416 256 415.35a271.6 271.6 0 0 0 90.46-15.16l46.41 46.41a19 19 0 0 0 26.94-26.79zM256 363.74a107.78 107.78 0 0 1-98.17-152.18l29.95 29.95a69.75 69.75 0 0 0 82.71 82.71l29.95 29.95a107.23 107.23 0 0 1-44.44 9.57zM506.11 236.81C446.14 148 351.07 96 256 96.65a271.6 271.6 0 0 0-90.46 15.16l46 46a107.78 107.78 0 0 1 142.63 142.63l63.74 63.74a332.49 332.49 0 0 0 88.2-89 34.22 34.22 0 0 0 0-38.37z" fill="currentColor" opacity="1" data-original="currentColor"></path><path d="M256 186.26a69.91 69.91 0 0 0-14.49 1.52l82.71 82.7A69.74 69.74 0 0 0 256 186.26z" fill="currentColor" opacity="1" data-original="currentColor"></path></g></g></svg>

                \`;
                toggleButton.title = 'Hide API key';
            } else {
                apiKeyInput.type = 'password';
                toggleButton.innerHTML = \`
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 2C4.5 2 1.5 4.5 0 8c1.5 3.5 4.5 6 8 6s6.5-2.5 8-6c-1.5-3.5-4.5-6-8-6zm0 10c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4zm0-6c-1.1 0-2 0.9-2 2s0.9 2 2 2 2-0.9 2-2-0.9-2-2-2z"/>
                    </svg>
                \`;
                toggleButton.title = 'Show API key';
            }
        }
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'refreshData':
                    updateUI(message.data);
                    break;
            }
        });
        
        function mapPlanName(planType) {
            const planMappings = {
                'free': 'Free',
                'pro_monthly': 'Pro', 
                'enterprise_monthly': 'Enterprise',
                'developer_lifetime': 'Developer Lifetime'
            };
            return planMappings[planType] || planType || 'Unknown';
        }
        
        function shouldShowApiKey(planType) {
            const plansWithApiKey = ['developer_lifetime'];
            return plansWithApiKey.includes(planType);
        }

        function updateUI(data) {
            const accountSection = document.getElementById('accountSection');
            const apiKeyInput = document.getElementById('apiKeyInput');
            const saveApiKeyButton = document.getElementById('saveApiKeyButton');
            const toggleVisibilityButton = document.getElementById('toggleApiKeyVisibility');
            const modelSelect = document.getElementById('modelSelect');
            
            // Update model dropdown
            if (modelSelect) {
                modelSelect.value = data.selectedModel || 'copilot';
                modelSelect.addEventListener('change', saveModelSelection);
            }

            if (data.isLoggedIn && data.userInfo) {
                const rawPlan = data.userInfo.plan;
                const displayPlan = mapPlanName(rawPlan);
                const showApiKey = shouldShowApiKey(rawPlan);

                accountSection.innerHTML = \`
                    <div class="status">
                        <div class="status-indicator status-online"></div>
                        <span><strong>Logged In</strong></span>
                    </div>
                    <div class="user-info">
                        <div><strong>Email:</strong> \${data.userInfo.email || 'N/A'}</div>
                        <div><strong>Plan:</strong> \${displayPlan}</div>
                    </div>
                    <button onclick="logout()">Logout</button>
                \`;

                if (showApiKey) {
                    apiKeyInput.disabled = false;
                    saveApiKeyButton.disabled = false;
                    toggleVisibilityButton.disabled = false;
                    
                    // Always show the saved API key value
                    apiKeyInput.value = data.savedApiKey || '';
                    
                    if (data.savedApiKey && data.savedApiKey.trim() !== '') {
                        apiKeyInput.placeholder = "API key saved";
                        toggleVisibilityButton.style.display = 'block';
                    } else {
                        apiKeyInput.placeholder = "Enter your OpenAI API key here...";
                        toggleVisibilityButton.style.display = 'none';
                    }
                } else {
                    apiKeyInput.disabled = true;
                    saveApiKeyButton.disabled = true;
                    toggleVisibilityButton.disabled = true;
                    toggleVisibilityButton.style.display = 'none';
                    apiKeyInput.placeholder = "API key input is for lifetime plan users.";
                    apiKeyInput.value = '';
                }

            } else {
                accountSection.innerHTML = \`
                    <div class="status">
                        <div class="status-indicator status-offline"></div>
                        <span>Not logged in</span>
                    </div>
                    <p class="description">Login to access PromptDC features.</p>
                    <button onclick="login()">Login</button>
                \`;
                apiKeyInput.disabled = true;
                saveApiKeyButton.disabled = true;
                toggleVisibilityButton.disabled = true;
                toggleVisibilityButton.style.display = 'none';
                apiKeyInput.value = '';
            }
        }
    </script>
</body>
</html>`;
}

// Removed CodeLens and Hover providers - extension only works with right sidebar chat

export function deactivate() {
} 