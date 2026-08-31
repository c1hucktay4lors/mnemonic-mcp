# mnemonic-mcp

Persistent memory server for MCP clients — lets AI assistants remember things about you across sessions.

- **Simple**: single markdown file, human-readable, easy to edit
- **Fast**: stdio transport, no database required
- **Safe**: auto-backups before every write, keeps last 10 backups by default

## Tools

| Tool | Description |
|------|-------------|
| `read_memory` | Read all memory or a specific section by name |
| `auto_save` | Silently save info during conversations (proactive/background). Automatically categorizes into sections. |
| `save_memory` | Explicitly save a fact when asked directly. Auto-categorizes. |
| `update_memory` | Find and replace existing content |
| `delete_memory` | Remove content by unique fragment |
| `search_memory` | Keyword search across all entries |
| `list_sections` | List section headers for navigation |
| `save_to_section` | Add info under a named section (creates if missing) |
| `replace_section` | Overwrite an entire section at once |
| `tidy_memory` | Organize orphaned dated entries into proper sections. Use when memory looks messy. |
| `context_status` | Check LM Studio context-window usage: exact tokens used (from LM Studio's own records), limit, remaining, percent, and NORMAL/WARNING/CRITICAL/EMERGENCY status. For self-managing long tasks — write checkpoints via this server before running low. Requires LM Studio on localhost:1234 with a conversation active. |

**Smart categorization:** When saving facts, the server automatically detects the right section:
- Hardware/peripherals/devices → **Tech Setup & Hardware**
- Food/drink/preferences/health → **Personal Preferences**
- Games/hobbies/projects/skills → **Interests & Projects**
- Communication style preferences → **Communication Preferences**

Unclassifiable facts become dated entries at the bottom. You can run `tidy_memory` anytime to clean those up.

## Setup

### 1. Install dependencies

```bash
cd mnemonic-mcp
npm install
npm run build
```

### 2. Configure your MCP client

#### LM Studio (recommended)

LM Studio supports MCP servers via its built-in configuration file.

**Step 1: Locate or create the config file:**

| Platform | Config path |
|----------|-------------|
| Linux / macOS | `~/.lmstudio/mcp.json` |
| Windows | `%APPDATA%\LMStudio\mcp.json` |

Create the folder if needed. Example on Linux/macOS:
```bash
mkdir -p ~/.lmstudio
touch ~/.lmstudio/mcp.json
```

**Step 2: Add mnemonic-mcp:**

Open `mcp.json` and add a `"mnemonic"` entry under `"mcpServers"`. Replace the path with where you cloned this repo:

```json
{
  "mcpServers": {
    "mnemonic": {
      "command": "node",
      "args": ["/full/path/to/mnemonic-mcp/dist/server.js"],
      "cwd": "/full/path/to/mnemonic-mcp"
    }
  }
}
```

Examples:
- Linux/macOS: `/home/username/Projects/mnemonic-mcp/dist/server.js`
- Windows: `C:\Users\YourName\Projects\mnemonic-mcp\dist\server.js`

**Step 3: Restart LM Studio** (or reload MCP from Settings → Tools).

**Step 4: Test it:**

Start a new chat and ask your model something like:

> "Check what tools you have available. If you see memory-related tools, list the sections in my memory."

If working, it will call `list_sections()` or `read_memory()` automatically. You can also directly ask:

> "Remember that I use Arch Linux with KDE Plasma and prefer direct answers."

The model should call `save_memory` or `auto_save` and add it to your memory file at `~/.mcp-memory/memory.md`.


#### Any MCP client (stdio transport)

Use this as your server config:

```json
{
  "command": "node",
  "args": ["/path/to/mnemonic-mcp/dist/server.js"],
  "cwd": "/path/to/mnemonic-mcp"
}
```

### Troubleshooting LM Studio

**Tools not showing up:**
- Make sure you're using the **full absolute path** to `dist/server.js` — relative paths don't work.
- Restart LM Studio after editing `mcp.json`. Changes aren't picked up live in some versions.
- Check the MCP server status: Settings → Tools → look for your mnemonic entry.

**"Module not found" or crash:**
- Verify you ran `npm install` and `npm run build` first.
- Ensure Node.js is installed (`node --version`).
- Double-check the path has no typos — especially on Windows with backslashes vs forward slashes (JSON paths should use `/` or double backslash `\\`).

**Memory not persisting between chats:**
- Memory uses a shared file, so it persists by default. If it's not saving:
  - Check your memory file exists: open `~/.mcp-memory/memory.md` (Linux/macOS) or `%USERPROFILE%\.mcp-memory\memory.md` (Windows).
  - Ask the model explicitly: "What tools do you have? Use one of them to save something."

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
