import * as vscode from "vscode";
import { MCPServerConnection } from "./mcpServerConnection";
import { getServerConfigurations, ServerConfig } from "./config";
import { McpTool } from "./tool";
import * as chatUtils from "@vscode/chat-extension-utils";

export class MCPConnectionManager {
    private connections: Map<string, MCPServerConnection> = new Map();

    constructor(context: vscode.ExtensionContext) {}

    public async initializeConnections(): Promise<void> {
        // Get server configurations from settings
        const serverConfigs = getServerConfigurations();

        if (serverConfigs.length === 0) {
            vscode.window.showWarningMessage(
                "No MCP servers configured. Add server configurations in settings."
            );
            return;
        }

        // Create connections for each enabled server
        for (const config of serverConfigs) {
            if (config.enabled) {
                await this.createConnection(config);
            }
        }
    }

    private async getTools(conn: MCPServerConnection): Promise<McpTool[]> {
        let ret: McpTool[] = [];

        const tools = await conn.getClient()?.listTools();

        if (!tools) {
            return ret;
        }

        const toolsArray = Array.isArray(tools) ? tools : Object.values(tools);

        for (const tool of toolsArray) {
            // Create a new MCP tool
            let client = conn.getClient();
            if (!client) {
                continue;
            }
            const mcpTool = new McpTool(client, tool);

            // Register the tool
            ret.push(mcpTool);
        }

        return ret;
    }

    private async getAllTools(): Promise<McpTool[]> {
        let ret: McpTool[] = [];
        let getTools = this.getTools;
        this.connections.forEach(async (conn, key) => {
            let tools = await getTools(conn);
            ret.push(...tools);
        });
        return ret;
    }

    private async registerTools(
        context: vscode.ExtensionContext,
        conn: MCPServerConnection
    ): Promise<void> {
        // register lm tools from the mcp connections

        // Get the tools from the connection
        const tools = await conn.getClient()?.listTools();

        // Register the tools
        if (!tools) {
            return;
        }

        // Check if tools is an array, otherwise get its entries
        // const toolsArray = Array.isArray(tools) ? tools : Object.values(tools);

        for (const tool of tools.tools) {
            // Create a new MCP tool
            let client = conn.getClient();
            if (!client) {
                continue;
            }
            const name = `mcp_${conn.name}_${tool.name}`;
            const mcpTool = new McpTool(client, tool);

            // Register the tool
            console.log(`Registering tool: ${name}`, mcpTool);
            context.subscriptions.push(vscode.lm.registerTool(name, mcpTool));
        }
    }
    public async registerAllTools(
        context: vscode.ExtensionContext
    ): Promise<void> {
        // TODO: unregister tools?
        for (const [name, connection] of this.connections.entries()) {
            await this.registerTools(context, connection);
        }
    }

    private async createConnection(config: ServerConfig): Promise<void> {
        // Check if connection already exists and disconnect
        if (this.connections.has(config.name)) {
            await this.connections.get(config.name)?.disconnect();
            this.connections.delete(config.name);
        }

        // Create new connection
        const connection = new MCPServerConnection(config);
        await connection.connect();
        this.connections.set(config.name, connection);

        vscode.window.showInformationMessage(
            `Connected to MCP server: ${config.name}`
        );
    }

    /**
     * Registers a chat participant for MCP (Microsoft Copilot for Microsoft 365) integration in the VSCode extension.
     * This method creates and configures a chat participant that can handle chat requests within VSCode.
     *
     * @param context - The VSCode extension context used to register disposable resources and access extension information
     * @returns A Promise that resolves when the chat participant is successfully registered
     *
     * @remarks
     * The chat participant is configured with:
     * - An ID of "mcpClient.mcp"
     * - A custom icon located at the extension's "media/icon.png" path
     * - The participant is properly disposed when the extension is deactivated by adding it to context.subscriptions
     */
    public async registerChatParticipant(context: vscode.ExtensionContext) {
        // Define chat handler
        // https://github.com/microsoft/vscode-extension-samples/blob/main/chat-sample/src/chatUtilsSample.ts

        const handler: vscode.ChatRequestHandler = async (
            request: vscode.ChatRequest,
            chatContext: vscode.ChatContext,
            stream: vscode.ChatResponseStream,
            token: vscode.CancellationToken
        ) => {
            if (request.command === "list") {
                stream.markdown(
                    `Available tools: ${vscode.lm.tools
                        .map((tool) => tool.name)
                        .join(", ")}\n\n`
                );
                return;
            }
            const prompt = `
You are a helpful assistant that can utilize all the tools available to you to anser user's queries. Following are the guidelines you should follow when use these tools:
- Always use tools when the tools can directly answer the user's query or perform the task user is asking
- If multiple tools are needed to answer the query or perform the task, use your best judgment to determine the order of tool usage.
- Only if no tools can help you answer the query or perform the task, you can use your own knowledge to answer the query or perform the task.
`;

            const tools = vscode.lm.tools.filter((tools) =>
                tools.tags.includes("mcp")
            );
            // const tools = vscode.lm.tools.filter(tools => !tools.tags.includes('ddd'));
            const libResult = chatUtils.sendChatParticipantRequest(
                request,
                chatContext,
                {
                    prompt: prompt,
                    responseStreamOptions: {
                        stream,
                        references: true,
                        responseText: true,
                    },
                    tools,
                },
                token
            );

            const output = await libResult.result;

            return output;
        };

        // Register chat participant
        const participant = vscode.chat.createChatParticipant(
            "mcpClient.mcp",
            handler
        );
        // set the icon
        participant.iconPath = vscode.Uri.joinPath(
            context.extensionUri,
            "media",
            "icon.png"
        );
        // Add participant to subscriptions for extension deactivation disposal
        context.subscriptions.push(participant);
    }

    public async reconnectAll(): Promise<void> {
        // Disconnect all existing connections
        await this.shutdown();

        // Clear connections map
        this.connections.clear();

        // Initialize connections again
        await this.initializeConnections();
    }

    public async shutdown(): Promise<void> {
        const shutdownPromises: Promise<void>[] = [];

        for (const [name, connection] of this.connections.entries()) {
            console.log(`Disconnecting from MCP server: ${name}`);
            shutdownPromises.push(connection.disconnect());
        }

        await Promise.all(shutdownPromises);
        console.log("All MCP server connections closed");
    }
}
