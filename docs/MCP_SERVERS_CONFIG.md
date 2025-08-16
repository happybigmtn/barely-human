# MCP Servers Configuration for Claude

## Overview
MCP (Model Context Protocol) servers extend Claude's capabilities with specialized tools and integrations. For the Barely Human project, we recommend adding these three MCP servers to enhance development productivity.

## Required MCP Servers

### 1. Context7 - Documentation & Code Examples
```json
{
  "mcpServers": {
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {}
    }
  }
}
```
**Purpose**: Retrieve up-to-date documentation, code examples, and API references
**Use Cases**:
- Looking up Solidity best practices
- Finding OpenZeppelin contract examples
- Retrieving Chainlink VRF documentation
- Getting Uniswap V4 hook implementations

### 2. Playwright - Browser Automation
```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"],
      "env": {}
    }
  }
}
```
**Purpose**: Automated browser testing and web interaction
**Use Cases**:
- End-to-end testing of web interfaces
- Testing wallet connections
- Verifying NFT display on OpenSea
- Testing fiat onramp integrations

### 3. TaskMaster AI - Task Management
```json
{
  "mcpServers": {
    "taskmaster-ai": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "--package=task-master-ai", "task-master-ai"],
      "env": {}
    }
  }
}
```
**Purpose**: Complex task orchestration and project management
**Use Cases**:
- Managing multi-step deployment processes
- Coordinating between smart contract and backend development
- Tracking testing and audit progress
- Organizing bot personality implementations

## Installation Instructions

### For Claude Desktop App

1. **Locate Configuration File**:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/claude/claude_desktop_config.json`

2. **Edit Configuration**:
   Create or edit the configuration file with all three servers:

```json
{
  "mcpServers": {
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {}
    },
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"],
      "env": {}
    },
    "taskmaster-ai": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "--package=task-master-ai", "task-master-ai"],
      "env": {}
    }
  }
}
```

3. **Restart Claude Desktop** to load the new configuration

### For Claude CLI

If using Claude through a CLI interface, ensure these packages are available:

```bash
# Install globally for CLI access
npm install -g @upstash/context7-mcp
npm install -g @playwright/mcp@latest
npm install -g task-master-ai
```

## Usage in Development

### Context7 Usage
When you need documentation or examples:
- "Look up Chainlink VRF v2 implementation"
- "Find examples of ERC4626 vault contracts"
- "Get Uniswap V4 hook documentation"

### Playwright Usage
For testing web interactions:
- "Test the CLI wallet connection flow"
- "Verify NFT displays correctly on testnet OpenSea"
- "Automate testing of the fiat onramp integration"

### TaskMaster AI Usage
For complex project management:
- "Create a deployment checklist for mainnet launch"
- "Organize the 64 bet type implementations into tasks"
- "Track progress on AI bot personality development"

## Project-Specific Benefits

### Smart Contract Development
- Context7 provides instant access to Solidity patterns and security best practices
- Reference implementations for complex DeFi mechanics

### Testing & QA
- Playwright enables comprehensive end-to-end testing
- Automated verification of wallet interactions and NFT minting

### Project Management
- TaskMaster AI helps coordinate the 16-week development roadmap
- Track dependencies between contract, backend, and frontend development

### AI Agent Development
- Context7 can fetch ElizaOS documentation and examples
- TaskMaster AI organizes the 10 bot personality implementations

## Troubleshooting

### Common Issues

1. **MCP Server Not Loading**:
   - Ensure Node.js is installed (v18+ recommended)
   - Check that npx is available in PATH
   - Restart Claude after configuration changes

2. **Permission Errors**:
   - Ensure the config file has proper read/write permissions
   - On macOS/Linux: `chmod 644 claude_desktop_config.json`

3. **Server Timeout**:
   - Some MCP servers may take time to initialize on first use
   - Wait for the download to complete
   - Check internet connectivity

## Security Considerations

- MCP servers run locally on your machine
- They don't have access to your Claude conversation history
- Each server operates in a sandboxed environment
- Review server permissions before enabling

## Additional Resources

- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [Claude Desktop Configuration Guide](https://docs.anthropic.com/claude/docs/desktop-config)
- [NPX Documentation](https://docs.npmjs.com/cli/v7/commands/npx)

## Notes for Barely Human Development

These MCP servers are particularly useful for:
1. **Contract Development**: Quick access to OpenZeppelin and Chainlink docs
2. **Integration Testing**: Automated testing of Uniswap hooks and VRF
3. **Multi-Agent Coordination**: Managing ElizaOS bot implementations
4. **Cross-Platform Testing**: Ensuring CLI works on all platforms
5. **Documentation Generation**: Creating comprehensive API docs

By integrating these MCP servers, the development process becomes more efficient with direct access to documentation, automated testing capabilities, and sophisticated task management.