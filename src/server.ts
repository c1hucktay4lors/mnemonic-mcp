import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";

const BACKUP_RETENTION = 10;

function resolveMemoryPath(): string {
  // Allow override via env var for custom paths
  if (process.env.MEMORY_FILE_PATH) return process.env.MEMORY_FILE_PATH;

  const homeDir = os.homedir();
  const newDefault = path.join(homeDir, ".mcp-memory", "memory.md");
  
  // Backward compat: fall back to old XDG-style location if it exists
  const legacyPath = process.env.XDG_DATA_HOME || path.join(homeDir, ".local", "share", "mcp-memory");
  const legacyFile = path.join(legacyPath, "memory.md");

  try { fsSync.accessSync(newDefault); return newDefault; } catch {}
  try { fsSync.accessSync(legacyFile); return legacyFile; } catch {}

  // Neither exists yet — default to the simpler path going forward
  return newDefault;
}

const memoryFilePath = resolveMemoryPath();

function ensureDirectory(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
}

async function readMemory(): Promise<string> {
  try { return await fs.readFile(memoryFilePath, "utf-8"); } catch { return ""; }
}

async function writeMemory(content: string): Promise<void> {
  ensureDirectory(memoryFilePath);
  try {
    const existing = await fs.readFile(memoryFilePath, "utf-8");
    if (existing.trim()) createBackup();
  } catch {}
  await fs.writeFile(memoryFilePath, content, "utf-8");
}

async function createBackup(): Promise<void> {
  const backupDir = path.join(path.dirname(memoryFilePath), "backups");
  try {
    if (!fsSync.existsSync(backupDir)) await fs.mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -4);
    await fs.copyFile(memoryFilePath, path.join(backupDir, `memory-${stamp}.md`));
    const files = (await fs.readdir(backupDir)).filter(f => f.startsWith("memory-") && f.endsWith(".md")).sort();
    while (files.length > BACKUP_RETENTION) await fs.unlink(path.join(backupDir, files.shift()!));
  } catch {} // non-fatal
}

function findSection(lines: string[], name: string): { start: number; end: number } | null {
  const header = `## ${name}`;
  const s = lines.findIndex(l => l.trim() === header);
  if (s === -1) return null;
  let e = lines.length;
  for (let i = s + 1; i < lines.length && !lines[i].startsWith("## "); i++) e = i;
  return { start: s, end: e };
}

function listSections(content: string): string[] {
  return [...content.matchAll(/^##\s+(.+)$/gm)].map(m => m[1].trim());
}

const server = new McpServer({ name: "mcp-memory", version: "1.0.0" });

// ---------- Tools ----------

server.registerTool("read_memory", {
  title: "Read Memory",
  description: "Read persistent memory. Use list_sections first if unsure where info is stored, then read that section directly.",
  inputSchema: z.object({ section: z.string().optional().describe("Section name to read (e.g., 'Tech Setup & Hardware'). Omit for full memory.") }),
}, async ({ section }) => {
  let content = await readMemory();
  if (!content.trim()) return { content: [{ type: "text", text: "Memory is empty." }] };

  if (section?.trim()) {
    const lines = content.split("\n");
    const range = findSection(lines, section.trim());
    if (!range) {
      const sections = listSections(content);
      return { content: [{ type: "text", text: `Section '${section}' not found. Available: ${sections.length ? sections.join(", ") : "(none)"}.` }] };
    }
    const body = lines.slice(range.start, range.end).join("\n").trim();
    return { content: [{ type: "text", text: body || `Section '${section}' is empty.` }] };
  }

  let result = content;
  if (content.length > 8000) {
    const entries = (content.match(/^\[\d{4}-\d{2}-\d{2}\]/gm) || []).length;
    result += `\n\n[Memory note: ${content.length} chars, ${entries} entries. Consider consolidating.]`;
  }
  return { content: [{ type: "text", text: result }] };
});

server.registerTool("auto_save", {
  title: "Auto Save",
  description: "Silently save information about me worth remembering long-term. Call this proactively during conversations when I reveal preferences, facts, corrections, or project state — don't announce you're doing it unless asked.",
  inputSchema: z.object({ fact: z.string().describe("The fact to remember.") }),
}, async ({ fact }) => {
  const content = await readMemory();
  const trimmedFact = fact.trim();
  if (content.toLowerCase().includes(trimmedFact.slice(0, 50).toLowerCase())) {
    return { content: [{ type: "text", text: "Skipped — similar info exists. Use update_memory to change it." }] };
  }
  const date = new Date().toISOString().split("T")[0];
  await writeMemory(content.trimEnd() + `\n[${date}] ${trimmedFact}`);
  return { content: [{ type: "text", text: "" }] }; // silent — no announcement needed
});

server.registerTool("save_memory", {
  title: "Save Memory",
  description: "Explicitly save a fact to memory when asked directly. Use auto_save for background/proactive saves instead.",
  inputSchema: z.object({ fact: z.string().describe("The fact to remember.") }),
}, async ({ fact }) => {
  const content = await readMemory();
  const trimmedFact = fact.trim();
  if (content.toLowerCase().includes(trimmedFact.slice(0, 50).toLowerCase())) {
    return { content: [{ type: "text", text: "Skipped — similar info exists. Use update_memory to change it." }] };
  }
  const date = new Date().toISOString().split("T")[0];
  await writeMemory(content.trimEnd() + `\n[${date}] ${trimmedFact}`);
  return { content: [{ type: "text", text: "Saved." }] };
});

server.registerTool("update_memory", {
  title: "Update Memory",
  description: "Find and replace existing memory. Pass exact text to find.",
  inputSchema: z.object({ 
    find: z.string().describe("Existing text in memory to find."),
    replace: z.string().optional().describe("New text, or empty/omit to delete.")
  }),
}, async ({ find, replace }) => {
  const content = await readMemory();
  if (!content.toLowerCase().includes(find.toLowerCase())) {
    return { content: [{ type: "text", text: "Not found in memory." }] };
  }
  
  const lines = content.split("\n");
  const newLines: string[] = [];
  let skipBlock = false;
  
  for (const line of lines) {
    if (skipBlock && !line.trim()) { skipBlock = false; continue; }
    if (!skipBlock && line.toLowerCase().includes(find.toLowerCase())) {
      if (replace?.trim()) newLines.push(replace.trim());
      skipBlock = true;
      continue;
    }
    if (!skipBlock || line.trim()) newLines.push(line);
  }
  
  await writeMemory(newLines.join("\n").replace(/\n{3,}/g, "\n\n"));
  return { content: [{ type: "text", text: !replace?.trim() ? "Deleted." : "Updated." }] };
});

server.registerTool("delete_memory", {
  title: "Delete Memory",
  description: "Delete something from memory. Provide a unique fragment.",
  inputSchema: z.object({ text: z.string().describe("A distinctive part of the entry to delete.") }),
}, async ({ text }) => {
  const content = await readMemory();
  if (!content.toLowerCase().includes(text.toLowerCase())) {
    return { content: [{ type: "text", text: "Not found." }] };
  }
  
  const lines = content.split("\n");
  const newLines: string[] = [];
  let skipBlock = false;
  
  for (const line of lines) {
    if (skipBlock && !line.trim()) { skipBlock = false; continue; }
    if (!skipBlock && line.toLowerCase().includes(text.toLowerCase())) { skipBlock = true; continue; }
    if (!skipBlock || line.trim()) newLines.push(line);
  }
  
  await writeMemory(newLines.join("\n").replace(/\n{3,}/g, "\n\n"));
  return { content: [{ type: "text", text: "Deleted." }] };
});

server.registerTool("search_memory", {
  title: "Search Memory",
  description: "Search for specific info in memory. Uses keyword matching across all entries.",
  inputSchema: z.object({ query: z.string().describe("Keywords to search for.") }),
}, async ({ query }) => {
  const content = await readMemory();
  if (!content.trim()) return { content: [{ type: "text", text: "Empty." }] };

  // Tokenize into meaningful words (skip short stop words)
  const stopWords = new Set(["a","an","the","is","are","was","were","to","for","of","in","on","at","by","with","and","or","but","it","my","me","you","your","has","have","had","do","does","did","be","been","being"]);
  const tokens = query.toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  if (!tokens.length) return { content: [{ type: "text", text: `No meaningful search terms in "${query}".` }] };

  const matches: string[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    // Line matches if it contains at least one search token
    if (!tokens.some(t => lineLower.includes(t))) continue;

    let block = "";
    for (let j = i; j < lines.length && lines[j].trim(); j++) block += (block ? "\n" : "") + lines[j];
    if (!matches.includes(block)) matches.push(block);
  }

  if (!matches.length) return { content: [{ type: "text", text: `No matches for "${query}".` }] };
  const result = `Found ${matches.length} match${matches.length > 1 ? "es" : ""}:\n\n${matches.map((m, i) => `${i + 1}. ${m}`).join("\n\n")}`;
  return { content: [{ type: "text", text: result }] };
});

server.registerTool("list_sections", {
  title: "List Sections",
  description: "List all named sections in memory. Use this when you're unsure where info might be stored.",
}, async () => {
  const content = await readMemory();
  if (!content.trim()) return { content: [{ type: "text", text: "Memory is empty." }] };

  // Find section headers and any standalone dated entries not under a section
  const sections = listSections(content);
  const hasStandaloneEntries = /^\[\d{4}-\d{2}-\d{2}\]/m.test(content) && !content.startsWith("##");

  let result = `Sections in memory:\n`;
  for (const s of sections) result += `- ${s}\n`;
  if (hasStandaloneEntries) result += `- (standalone dated entries)\n`;

  return { content: [{ type: "text", text: result.trim() }] };
});

server.registerTool("save_to_section", {
  title: "Save to Section",
  description: "Add info to a categorized section. Creates it if needed.",
  inputSchema: z.object({ 
    section: z.string().describe("Section name without ##. E.g., 'Health & Wellness', 'Tech Setup'."),
    content: z.string().describe("Content to add.")
  }),
}, async ({ section, content }) => {
  const fileContent = await readMemory();
  const lines = fileContent.split("\n");
  const trimmedSection = section.trim();
  const trimmedContent = content.trim();
  
  const range = findSection(lines, trimmedSection);
  
  if (!range) {
    await writeMemory(fileContent.trimEnd() + `\n\n## ${trimmedSection}\n${trimmedContent}`);
    return { content: [{ type: "text", text: `Created '${trimmedSection}' and added content.` }] };
  } else {
    const before = lines.slice(0, range.end).join("\n");
    const after = lines.slice(range.end).join("\n");
    await writeMemory(before.trimEnd() + `\n${trimmedContent}` + after);
  }
  
  return { content: [{ type: "text", text: `Added to '${trimmedSection}'.` }] };
});

server.registerTool("replace_section", {
  title: "Replace Section",
  description: "Replace ALL content in a named section.",
  inputSchema: z.object({ 
    section: z.string().describe("Exact name of existing section (no ##)."),
    new_content: z.string().describe("Full replacement.")
  }),
}, async ({ section, new_content }) => {
  const fileContent = await readMemory();
  const lines = fileContent.split("\n");
  const range = findSection(lines, section);
  
  if (!range) return { content: [{ type: "text", text: `Section '${section}' not found. Use save_to_section to create it.` }] };
  
  const newLines = [...lines.slice(0, range.start), lines[range.start], "", new_content.trim(), "", ...lines.slice(range.end)];
  await writeMemory(newLines.join("\n"));
  return { content: [{ type: "text", text: `Replaced '${section}'.` }] };
});

// ---------- Start ----------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => { console.error("Failed:", err.message); process.exit(1); });
