import * as vscode from "vscode";
import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index";
import { ServerConfig } from "./config";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport";
import { url } from "inspector";

export class MCPServerConnection {
    public name: string;
    private client: McpClient | null = null;
    private connected: boolean = false;
    private transport: Transport | null = null;

    constructor(private config: ServerConfig) {
        if (config.type === "stdio") {
            this.transport = new StdioClientTransport({
                command: config.command,
                args: config.args || [],
            });
        } else if (config.type === "sse") {
            this.transport = new SSEClientTransport(new URL(config.url), {});
        }

        if (!this.transport) {
            throw new Error("Transport not created");
        }
        this.name = config.name;

        this.client = new McpClient(
            {
                name: "VSCodeMCPClient",
                version: "0.1.0",
            },
            {
                capabilities: {
                    prompts: {},
                    resources: {},
                    tools: {},
                },
            }
        );
    }

    /**
     * Connect to the MCP server based on configuration
     */
    public async connect(): Promise<void> {
        if (this.connected) {
            return;
        }

        if (!this.client || !this.transport) {
            throw new Error("Client or transport not created");
        }
        try {
            await this.client?.connect(this.transport);
            await this.initialize();
            this.connected = true;
        } catch (error) {
            this.client = null;
            this.transport = null;
            throw new Error(
                `Failed to connect to ${this.config.name}: ${error}`
            );
        }
    }

    /**
     * Initialize the MCP connection with capability negotiation
     */
    private async initialize(): Promise<void> {
        if (!this.client || !this.transport) {
            throw new Error("Client not created");
        }

        // Send initialize request
        const capabilities = this.client.getServerCapabilities();
        const serverVersion = this.client.getServerVersion();
        console.log(
            `Server capabilities: ${JSON.stringify(
                capabilities
            )}, Server version: ${JSON.stringify(serverVersion)}`
        );

        await this.client.ping();
    }

    public getClient(): McpClient | null {
        return this.client;
    }

    /**
     * Disconnect from the MCP server
     */
    public async disconnect(): Promise<void> {
        if (!this.client || !this.connected) {
            return;
        }

        try {
            // Follow the shutdown protocol
            await this.client.close();
            console.log(`Disconnected from MCP server: ${this.config.name}`);
        } catch (error) {
            console.error(
                `Error disconnecting from ${this.config.name}:`,
                error
            );
            // Force disconnect even if there was an error
        }
        this.connected = false;
        this.client = null;
        this.transport = null;
    }

    /**
     * Check if the connection is active
     */
    public isConnected(): boolean {
        return (
            this.connected && this.client !== null && this.transport !== null
        );
    }
}
