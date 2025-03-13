import * as vscode from "vscode";
import { MCPConnectionManager } from "./mcpConnectionManager";
import { registerChatTools } from "./exampleTools";
import {registerChatLibChatParticipant} from "./chatUtilsSample";

let connectionManager: MCPConnectionManager | undefined;

export async function activate(context: vscode.ExtensionContext) {
    console.log("MCP Client extension is now active");

    try {
        // Initialize connection manager
        connectionManager = new MCPConnectionManager(context);

        // Initialize all MCP server connections
        await connectionManager.initializeConnections();
        await connectionManager.registerChatParticipant(context);
        await connectionManager.registerAllTools(context);

        // Register commands and event handlers
        context.subscriptions.push(
            vscode.commands.registerCommand(
                "mcpClient.reconnectAll",
                async () => {
                    if (connectionManager) {
                        await connectionManager.reconnectAll();
                        vscode.window.showInformationMessage(
                            "MCP servers reconnected"
                        );
                    }
                }
            ),

            vscode.workspace.onDidChangeConfiguration(async (event) => {
                if (
                    event.affectsConfiguration("mcpClient") &&
                    connectionManager
                ) {
                    // Reload connections when configuration changes
                    await connectionManager.reconnectAll();
                }
            })
        );

        registerChatLibChatParticipant(context);
        registerChatTools(context);
        vscode.window.showInformationMessage("MCP Client extension activated");
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to activate MCP Client: ${error}`
        );
    }
}

export function deactivate(): Thenable<void> | undefined {
    if (connectionManager) {
        return connectionManager.shutdown();
    }
    return undefined;
}
