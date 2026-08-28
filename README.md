# mnemonic-mcp

Persistent memory server for MCP clients — lets AI assistants remember things about you across sessions.

- **Simple**: single markdown file, human-readable, easy to edit
- **Fast**: stdio transport, no database required
- **Safe**: auto-backups before every write, keeps last 10 backups by default

## Tools

| Tool | Description |
|------|-------------|
| `read_memory` | Read all memory or a specific section (e.g., "Health & Wellness") |
| `save_memory` | Append a dated fact to memory |
| `update_memory` | Find and replace existing content |
| `delete_memory` | Remove content by unique fragment |
| `search_memory` | Search for info in memory |
| `save_to_section` | Add structured info under a named section (creates if missing) |
| `replace_section` | Overwrite an entire section at once |

## Setup

### 1. Install dependencies

```bash
cd mnemonic-mcp
npm install
npm run build
```

### 2. Configure your MCP client

#### LM Studio

In **Settings → MCP Servers**, add:

- Name: `Memory`
- Command: `node /path/to/mnemonic_mcp/dist/server.js`

#### Claude Desktop (`claude_desktop_config.json`)

Add under `"mcpServers"`:

```json
{
  "memory": {
    "command": "node",
    "args": ["/path/to/mnemonic_mcp/dist/server.js"],
    "cwd": "/path/to/mnemonic_mcp"
  }
}
```

#### Any MCP client (stdio transport)

Use this as your server config:

```json
{
  "command": "node",
  "args": ["/path/to/mnemonic_mcp/dist/server.js"],
  "cwd": "/path/to/mnemonic_mcp"
}
```

## Storage

Memory is stored in a single markdown file. Auto-backups go into `backups/` (keeps last 10).

### Default path (Linux/macOS)

```
~/.local/share/mnemonic-mcp/memory.md
```

### Override via environment variable

Set `MEMORY_FILE_PATH` to use a custom location:

```bash
# Linux/macOS export, or add to your config's env section
export MEMORY_FILE_PATH="$HOME/Documents/my-memory.md"
node dist/server.js
```

Example with Claude Desktop (`claude_desktop_config.json`):

```json
{
  "memory": {
    "command": "node",
    "args": ["/path/to/mnemonic_mcp/dist/server.js"],
    "env": {
      "MEMORY_FILE_PATH": "/home/max/Documents/my-memory.md"
    }
  }
}
```

## Memory file format

The memory file is plain markdown. Sections use standard `## Header` syntax:

```markdown
[2026-08-28] User prefers direct answers and copy-paste-ready commands.

## Health & Wellness
- Takes ibuprofen for headaches

## Tech Setup
- Arch Linux, KDE Plasma, Wayland
```

You can edit the file directly — it's just markdown. The server reads/writes atomically with backups.

## Development

```bash
npm run build    # TypeScript → dist/
npm run dev      # Watch mode (uses tsx)
npm start        # Run built version
```

## License

MIT
