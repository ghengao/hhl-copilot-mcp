import * as vscode from "vscode";

export interface StdioServerConfig {
    type: "stdio";
    name: string;
    enabled: boolean;
    command: string;
    args?: string[];
}

export interface SSEServerConfig {
    type: "sse";
    name: string;
    enabled: boolean;
    url: string;
}

export type ServerConfig = StdioServerConfig | SSEServerConfig;

/**
 * Get MCP server configurations from VSCode settings
 */
export function getServerConfigurations(): ServerConfig[] {
    const config = vscode.workspace.getConfiguration("mcpClient");
    const servers = config.get<ServerConfig[]>("servers") || [];

    // Validate configurations
    return servers.filter((server: StdioServerConfig | SSEServerConfig) => {
        if (!server.name) {
            vscode.window.showWarningMessage(
                `Skipping MCP server with missing name.`
            );
            return false;
        }

        if (server.type === "stdio" && !server.command) {
            vscode.window.showWarningMessage(
                `MCP server "${server.name}" is missing command property.`
            );
            return false;
        }

        if (server.type === "sse" && !server.url) {
            vscode.window.showWarningMessage(
                `MCP server "${server.name}" is missing url property.`
            );
            return false;
        }

        if (server.type !== "stdio" && server.type !== "sse") {
            vscode.window.showWarningMessage(
                `MCP server "${(server as ServerConfig).name}" has invalid type property.`
            );
            return false;
        }

        return true;
    });
}
