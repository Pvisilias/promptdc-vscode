import * as vscode from 'vscode';
import * as https from 'https';
import { AuthManager } from './authManager';
import { ConfigManager } from './configManager';

export interface EnhancementResult {
    success: boolean;
    data?: {
        improvedText: string;
    };
    error?: string;
}

interface ModelDetectionResult {
    platform: string;
    model: string;
}

export class PromptEnhancer {

    constructor(
        private authManager: AuthManager,
        private configManager: ConfigManager
    ) {
    }

    async enhanceText(autoDetect: boolean = false): Promise<void> {

        if (!await this.checkAuth()) {
            return;
        }

        await this.enhanceChatText();
    }

    async enhanceTextDirect(): Promise<void> {

        if (!await this.checkAuth()) {
            return;
        }

        // Get text from user input
        const textToEnhance = await vscode.window.showInputBox({
            prompt: 'PromptDC: Enter the text you want to enhance',
            placeHolder: 'Type or paste your text here...',
            ignoreFocusOut: true,
            validateInput: (text) => {
                if (!text || text.trim().length === 0) {
                    return 'Please enter some text to enhance';
                }
                if (text.length > 4000) {
                    return 'Text is too long (max 4000 characters)';
                }
                return null;
            }
        });

        if (!textToEnhance) {
            return;
        }

        // Enhance the text with model detection
        const modelInfo = this.detectModel();
        await this.processEnhancement(textToEnhance, false, modelInfo);
    }

    async enhanceChatText(): Promise<void> {
        if (!await this.checkAuth()) {
            return;
        }

        const chatText = await this.getChatInputText();
        if (!chatText) {
            vscode.window.showWarningMessage(
                'PromptDC: No text found. Please click on the chat and try again.'
            );
            return;
        }

        const modelInfo = this.detectModel();
        await this.processEnhancement(chatText, true, modelInfo);
    }

    private detectModel(): ModelDetectionResult {
        const clineEnabled = this.configManager.getClineEnabled();

        if (clineEnabled) {
            return {
                platform: 'cline',
                model: 'cline'
            };
        } else {
            return {
                platform: 'copilot',
                model: 'copilot'
            };
        }
    }

    private async getChatInputText(): Promise<string | null> {
        const originalClipboard = await vscode.env.clipboard.readText();

        try {
            const clineEnabled = this.configManager.getClineEnabled();
            let chatFocusCommands: string[];

            if (clineEnabled) {
                chatFocusCommands = [
                    'cline.focusChatInput'
                ];
            } else {
                chatFocusCommands = [
                    'workbench.action.chat.focusInput',
                    'workbench.panel.chat.view.copilot.focus',
                    'chat.action.focus'
                ];
            }

            let chatFocused = false;
            for (const command of chatFocusCommands) {
                try {
                    await vscode.commands.executeCommand(command);
                    await new Promise(resolve => setTimeout(resolve, 300));
                    chatFocused = true;
                    break;
                } catch (error) {
                    // Try next command
                }
            }

            if (!chatFocused) {
                return null;
            }

            // Step 1: Select all text in chat input
            await vscode.commands.executeCommand('editor.action.selectAll');
            await new Promise(resolve => setTimeout(resolve, 200));

            // Step 2: Copy the selected text
            await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
            await new Promise(resolve => setTimeout(resolve, 200));

            const copiedText = await vscode.env.clipboard.readText();
            await vscode.env.clipboard.writeText(originalClipboard);

            if (copiedText && copiedText !== originalClipboard && copiedText.trim().length > 0) {
                return copiedText.trim();
            }

            return null;

        } catch (error) {
            await vscode.env.clipboard.writeText(originalClipboard);
            return null;
        }
    }

    private async replaceChatText(enhancedText: string, modelInfo: ModelDetectionResult): Promise<void> {
        try {
            await this.replaceChatInputText(enhancedText, modelInfo);
        } catch (error) {
            await vscode.env.clipboard.writeText(enhancedText);
        }
    }

    private async replaceChatInputText(enhancedText: string, modelInfo: ModelDetectionResult): Promise<void> {
        try {
            // Store original clipboard
            const originalClipboard = await vscode.env.clipboard.readText();
            await vscode.env.clipboard.writeText(enhancedText);

            const clineEnabled = this.configManager.getClineEnabled();

            if (clineEnabled) {
                // Focus chat using Cline commands
                try {
                    await vscode.commands.executeCommand('cline.focusChatInput');
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (error) {
                    // Fallback to generic focus commands
                    await vscode.commands.executeCommand('workbench.action.focusAuxiliaryBar');
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            } else {
                // Focus chat using VS Code Copilot commands
                const chatFocusCommands = [
                    'workbench.panel.chat.view.copilot.focus',
                    'workbench.action.chat.open',
                    'workbench.view.extension.copilot-chat.focus'
                ];

                let chatFocused = false;
                for (const command of chatFocusCommands) {
                    try {
                        await vscode.commands.executeCommand(command);
                        await new Promise(resolve => setTimeout(resolve, 300));
                        chatFocused = true;
                        break;
                    } catch (error) {
                        // Try next command
                    }
                }

                if (!chatFocused) {
                    await vscode.commands.executeCommand('workbench.action.focusAuxiliaryBar');
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }

            // Select all text and paste
            await vscode.commands.executeCommand('editor.action.selectAll');
            await new Promise(resolve => setTimeout(resolve, 200));

            await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
            await new Promise(resolve => setTimeout(resolve, 200));

            // Restore original clipboard
            await vscode.env.clipboard.writeText(originalClipboard);
        } catch (error) {
            throw error;
        }
    }

    private async processEnhancement(textToEnhance: string, replaceInChat: boolean, modelInfo: ModelDetectionResult): Promise<void> {
        try {
            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "PromptDC: Enhancing your prompt...",
                cancellable: false
            }, async () => {
                return await this.callEnhancementAPI(textToEnhance, modelInfo);
            });

            if (result.success && result.data?.improvedText) {
                if (replaceInChat) {
                    await this.replaceChatText(result.data.improvedText, modelInfo);
                } else {
                    // Show enhanced text in a new document and copy to clipboard
                    const doc = await vscode.workspace.openTextDocument({
                        content: result.data.improvedText,
                        language: 'markdown'
                    });
                    await vscode.window.showTextDocument(doc);
                    await vscode.env.clipboard.writeText(result.data.improvedText);
                }
            } else {
                this.handleError(result.error || 'Enhancement failed');
            }
        } catch (error) {
            vscode.window.showErrorMessage('PromptDC: Enhancement failed');
        }
    }

    private async checkAuth(): Promise<boolean> {
        const isLoggedIn = await this.authManager.isLoggedIn();
        if (!isLoggedIn) {
            vscode.window.showWarningMessage('PromptDC: Please login first.', 'Open Settings')
                .then(selection => {
                    if (selection === 'Open Settings') {
                        vscode.commands.executeCommand('promptdc.openSettings');
                    }
                });
            return false;
        }

        const userInfo = await this.authManager.getUserInfo();
        if (userInfo?.plan === 'developer_lifetime') {
            const apiKey = await this.authManager.getApiKey();
            if (!apiKey || apiKey.trim() === '') {
                vscode.window.showWarningMessage('PromptDC: Please add your OpenAI API key in settings.', 'Open Settings')
                    .then(selection => {
                        if (selection === 'Open Settings') {
                            vscode.commands.executeCommand('promptdc.openSettings');
                        }
                    });
                return false;
            }
        }

        return true;
    }

    private async callEnhancementAPI(text: string, modelInfo: ModelDetectionResult): Promise<EnhancementResult> {
        const userInfo = await this.authManager.getUserInfo();
        const userToken = await this.authManager.getAccessToken();

        return this.callPromptDCAPI(text, userToken, userInfo, modelInfo);
    }

    private async callPromptDCAPI(text: string, token: string | null, userInfo: any, modelInfo: ModelDetectionResult): Promise<EnhancementResult> {
        if (!token) {
            return { success: false, error: 'Authentication token not found' };
        }

        const data: any = {
            message: text,
            model: modelInfo.model
        };

        // If lifetime user, include their API key in the request
        if (userInfo?.plan === 'developer_lifetime') {
            const apiKey = await this.authManager.getApiKey();
            if (!apiKey) {
                return {
                    success: false,
                    error: 'Please add your OpenAI API key in settings for lifetime plan.'
                };
            }
            data.userApiKey = apiKey;
        }

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        try {
            const apiUrl = this.configManager.getConfig().apiUrl + '/openai';
            const response = await this.makeHttpsRequest(apiUrl, data, headers);

            // Convert response format to match expected format
            if (response.content) {
                return {
                    success: true,
                    data: {
                        improvedText: response.content
                    }
                };
            } else {
                return { success: false, error: response.error || 'No content returned' };
            }
        } catch (error) {
            return { success: false, error: 'Failed to call PromptDC API' };
        }
    }

    private makeHttpsRequest(url: string, data: any, headers: Record<string, string>): Promise<any> {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(data);
            const urlObj = new URL(url);

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const jsonResponse = JSON.parse(responseData);
                        resolve(jsonResponse);
                    } catch (error) {
                        reject(new Error('Invalid JSON response'));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(postData);
            req.end();
        });
    }

    private handleError(error: string): void {
        console.error('PromptDC Error:', error);

        if (error.includes('quota') || error.includes('limit')) {
            vscode.window.showErrorMessage('PromptDC: API quota exceeded. Please try again later.');
        } else if (error.includes('authentication') || error.includes('unauthorized')) {
            vscode.window.showErrorMessage('PromptDC: Authentication failed. Please check your credentials.');
        } else {
            vscode.window.showErrorMessage(`PromptDC: ${error}`);
        }
    }
} 