# mnemonic-mcp

Persistent memory server for MCP clients — lets AI assistants remember things about you across sessions.

- **Simple**: single markdown file, human-readable, easy to edit
- **Fast**: stdio transport, no database required
- **Safe**: auto-backups before every write, keeps last 10 backups by default

## Tools

| Tool | Description |
|------|-------------|
| `read_memory` | Read all memory or a specific section by name |
| `auto_save` | Silently save info during conversations (proactive/background) |
| `save_memory` | Explicitly save a fact when asked directly |
| `update_memory` | Find and replace existing content |
| `delete_memory` | Remove content by unique fragment |
| `search_memory` | Keyword search across all entries |
| `list_sections` | List section headers for navigation |
| `save_to_section` | Add info under a named section (creates if missing) |
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

Memory is stored in a single markdown file. Auto-backups go into `backups/` (keeps last 10). Works cross-platform without any configuration needed.

### Default path

On first run, creates:

| Platform | Path |
|----------|------|
| Linux / macOS | `~/.mcp-memory/memory.md` |
| Windows | `%USERPROFILE%\.mcp-memory\memory.md` |

If an older-style file exists at `~/.local/share/mcp-memory/memory.md`, it will be used automatically for backward compatibility.

### Override via environment variable

Set `MEMORY_FILE_PATH` to use a custom location:

```bash
# Linux/macOS
export MEMORY_FILE_PATH="$HOME/Documents/my-memory.md"
node dist/server.js

# Windows (PowerShell)
$env:MEMORY_FILE_PATH="C:\Users\YourName\Documents\my-memory.md"
node dist\server.js

# Windows (CMD)
set MEMORY_FILE_PATH=C:\Users\YourName\Documents\my-memory.md
node dist\server.js
```

Example with Claude Desktop (`claude_desktop_config.json`):

```json
{
  "memory": {
    "command": "node",
    "args": ["/path/to/mnemonic_mcp/dist/server.js"],
    "env": {
      "MEMORY_FILE_PATH": "~/Documents/my-memory.md"
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
