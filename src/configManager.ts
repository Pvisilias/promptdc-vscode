import * as vscode from 'vscode';

export interface PromptDCConfig {
    apiUrl: string;
    enableAutoDetection: boolean;
    supabaseApiKey: string;
    selectedModel: string;
}

export class ConfigManager {
    private context: vscode.ExtensionContext;
    
    // Private constants - not exposed in settings
    private readonly API_URL = 'https://gcsidhjsunmcsocmbdgz.supabase.co/functions/v1';
    private readonly SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2lkaGpzdW5tY3NvY21iZGd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMxNjk5MjksImV4cCI6MjA0ODc0NTkyOX0.yZOVGdHVW7rPNVCvKzGnAUGxeWRvdoTFLqGGJqXZLoo';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    getConfig(): PromptDCConfig {
        const config = vscode.workspace.getConfiguration('promptdc');

        return {
            apiUrl: this.API_URL,
            enableAutoDetection: config.get<boolean>('enableAutoDetection', true),
            supabaseApiKey: this.SUPABASE_ANON_KEY,
            selectedModel: this.getSelectedModel()
        };
    }

    getSupabaseApiKey(): string {
        return this.SUPABASE_ANON_KEY;
    }

    getSelectedModel(): string {
        return this.context.globalState.get<string>('promptdc.selectedModel', 'copilot');
    }

    async setSelectedModel(model: string): Promise<void> {
        await this.context.globalState.update('promptdc.selectedModel', model);
    }

    getClineEnabled(): boolean {
        return this.getSelectedModel() === 'cline';
    }

    async updateConfig(key: keyof PromptDCConfig, value: any): Promise<void> {
        const config = vscode.workspace.getConfiguration('promptdc');
        await config.update(key, value, vscode.ConfigurationTarget.Global);
    }

    onConfigurationChanged(callback: () => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('promptdc')) {
                callback();
            }
        });
    }

    openSettings(): void {
        vscode.commands.executeCommand('workbench.action.openSettings', 'promptdc');
    }
} 