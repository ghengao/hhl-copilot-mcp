# VSCode MCP Client Extension

This VSCode extension implements a Model Context Protocol (MCP) client that can connect to various MCP servers configured by the user.

## Features

- Connect to multiple MCP servers simultaneously (stdio or SSE)
- Support for MCP protocol version 2024-11-05
- Proper lifecycle management (initialization, operation, shutdown)
- Configuration through VSCode settings

## Configuration

Configure MCP servers in your VSCode settings:

```json
"mcpClient.servers": [
  {
    "type": "stdio",
    "name": "Local MCP Server",
    "enabled": true,
    "command": "path/to/server/executable",
    "args": ["--optional-arg1", "--optional-arg2"]
  },
  {
    "type": "sse",
    "name": "Remote MCP Server",
    "enabled": true,
    "url": "https://example.com/mcp-server"
  }
]
```

## Commands

- `mcpClient.reconnectServers`: Manually reconnect to all configured MCP servers

## Development

1. Clone the repository
2. `pnpm install`
3. Open in VSCode
4. Press F5 to start debugging
