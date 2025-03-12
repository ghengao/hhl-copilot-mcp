import * as vscode from "vscode";
import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index";
import {
    CallToolRequest,
    Tool,
    CallToolResultSchema,
} from "@modelcontextprotocol/sdk/types";
import { MCPServerConnection } from "./mcpServerConnection";

// vscode.LanguageModelTool
export class McpTool implements vscode.LanguageModelChatTool {
    private client: McpClient;
    private tool: Tool;
    public name: string;
    public inputSchema: Tool["inputSchema"];
    public description: string;

    constructor(client: McpClient, tool: Tool) {
        this.client = client;
        this.tool = tool;
        this.name = tool.name;
        this.inputSchema = tool.inputSchema;
        this.description = tool.description || "";
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationOptions<any>
    ): Promise<{ confirmationMessage?: string; invocationMessage?: string }> {
        return {
            confirmationMessage: `Allow tool "${this.tool.name}" to run?`,
            invocationMessage: `Running tool "${this.tool.name}"...`,
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<any>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const payload: CallToolRequest["params"] = {
            name: this.name,
            arguments: options.input,
        };
        const result = await this.client.callTool(
            payload,
            CallToolResultSchema,
            {
                timeout: 5 * 60 * 1000,
                onprogress: (progress) => {
                    console.log(`Tool ${this.tool.name} progress: ${progress}`);
                },
            }
        );
        console.log(`Tool (${this.tool.name}) result: ${result}`);

        const toolResult = CallToolResultSchema.parse(result);
        if (toolResult.error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `tool (${this.tool.name}) error: ${JSON.stringify(
                        toolResult.error
                    )}`
                ),
            ]);
        }

        let content: (
            | vscode.LanguageModelTextPart
            | vscode.LanguageModelPromptTsxPart
        )[] = [];
        if (Array.isArray(result.content)) {
            for (const item of result.content) {
                if (item.type === "text" && typeof item.text === "string") {
                    content.push(new vscode.LanguageModelTextPart(item.text));
                }
            }
        }

        return new vscode.LanguageModelToolResult(content);
    }
}
