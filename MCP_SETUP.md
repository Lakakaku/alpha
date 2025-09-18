# MCP Server Setup

## Configuration

The MCP servers are configured and ready to use. Your credentials are stored in `.mcp.json` which is excluded from git for security.

## Files

- `.mcp.json` - Active configuration with credentials (git-ignored)
- `.mcp.json.template` - Template for reference (safe to commit)
- `.env` - Environment variables backup (git-ignored)
- `.gitignore` - Excludes sensitive files from git

## Server Details

1. **Vercel** - Deployment and hosting management
2. **Supabase** - Database and backend services (read-only mode)
3. **Context7** - HTTP streaming and library information
4. **Serena** - No authentication required
5. **Playwright** - Browser automation
6. **GitHub** - Repository management (needs token to be added)

## Platform-Specific Usage

### For Cursor IDE
Copy `.mcp.json` to `.cursor/mcp.json`:
```bash
cp .mcp.json .cursor/mcp.json
```

### For VS Code
Copy `.mcp.json` to `.vscode/mcp.json`:
```bash
cp .mcp.json .vscode/mcp.json
```

### For Claude Desktop
The `.mcp.json` file is already in the correct location.

## GitHub Token

Remember to add your GitHub Personal Access Token when needed:
1. Go to https://github.com/settings/tokens
2. Generate a new token with appropriate permissions
3. Update the `GITHUB_PERSONAL_ACCESS_TOKEN` in `.mcp.json`

## Security Note

Never commit `.mcp.json` or `.env` to git. These files contain sensitive credentials and are automatically excluded via `.gitignore`.