
# PCSX2-MCP
<p align="center">
<img width="500" height="500" alt="PCSX2-MCP" src="https://github.com/user-attachments/assets/e35e394e-87f0-4ce5-ab14-e4fdcfa079ca" />
</p>

##  A PCSX2 modification and MCP server

> **Control a PS2 emulator from your AI coding assistant.**
> Set breakpoints, read registers, disassemble MIPS, inspect memory — all via MCP tools.

```
┌─────────────┐    stdio (MCP)    ┌─────────────────────┐    TCP:21512    ┌─────────────────┐
│ AI Assistant │ ◄──────────────► │  pcsx2-mcp-server   │ ◄────────────► │  PCSX2 Emulator │
│ (Antigravity │                  │  (Node.js bridge)    │                │  + DebugServer   │
│  Claude etc) │                  │                      │ ◄────────────► │  + Pine IPC      │
└─────────────┘                  └─────────────────────┘    TCP:28011    └─────────────────┘
```

---

## ⚠️ Repository vs Release — Read This First

> **This git repo does NOT contain the full PCSX2 source code.**
> We only provide the source of our modifications to avoid wasting storage uploading 1 GB of upstream code.

| | This Git Repo | GitHub Release (zip) |
|---|---|---|
| **Purpose** | Source code only | Ready-to-run package |
| **PCSX2 binaries** | ❌ Not included | ✅ Pre-built `pcsx2-qt.exe` + all DLLs |
| **PCSX2 full source** | ❌ Not included (see [upstream](https://github.com/PCSX2/pcsx2)) | ❌ Not included |
| **DebugServer patch** | ✅ `pcsx2-plugin/DebugServer.cpp` + `.h` | ✅ Included (already compiled in) |
| **MCP server source** | ✅ `pcsx2-mcp-server/src/` | ✅ Pre-built `dist/` + `node_modules/` |
| **Setup script** | ✅ `setup-mcp.bat` | ✅ Included |

**Want to just USE it?** → Download the **[latest Release](../../releases)** zip. Everything is pre-built.

**Want to modify or rebuild?** → Clone this repo, then follow [Building from Source](#building-from-source) below.

---

## Quick Start (3 steps)

### 1. Download

Grab the latest release from [GitHub Releases](../../releases) — extract the zip anywhere.

### 2. Setup

Run `setup-mcp.bat` — it checks Node.js and writes the MCP config for you.

> **Requires [Node.js](https://nodejs.org/) ≥ 18.** The setup script will tell you if it's missing.

### 3. Use

1. Launch `pcsx2-qt.exe` from the extracted folder
2. Load a PS2 game (ISO or disc)
3. Restart your AI assistant (Antigravity / Claude Desktop)
4. Ask: *"Connect to PCSX2 and show me the thread list"*

That's it! Your AI assistant now has **29 debugging tools** for PS2.

---

## Manual MCP Configuration

If `setup-mcp.bat` doesn't work or you want to configure manually:

<details>
<summary><b>Antigravity / Gemini</b></summary>

Edit `~/.gemini/antigravity/mcp_config.json`:

```json
{
  "mcpServers": {
    "pcsx2": {
      "command": "node",
      "args": ["<path-to-extracted>/pcsx2-mcp-server/dist/index.js"],
      "disabled": false
    }
  }
}
```
</details>

<details>
<summary><b>Claude Desktop</b></summary>

Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pcsx2": {
      "command": "node",
      "args": ["<path-to-extracted>/pcsx2-mcp-server/dist/index.js"]
    }
  }
}
```
</details>

<details>
<summary><b>VS Code (Copilot / Continue.dev)</b></summary>

Create `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "pcsx2": {
      "command": "node",
      "args": ["<path-to-extracted>/pcsx2-mcp-server/dist/index.js"]
    }
  }
}
```
</details>

---

## What's Inside

### DebugServer (built into PCSX2)

A custom TCP server injected into PCSX2 that listens on **port 21512**. When the emulator starts, you'll see:

```
[DebugServer] Listening on 127.0.0.1:21512
```

### MCP Server (Node.js bridge)

Translates MCP tool calls into DebugServer TCP commands. Also supports **Pine IPC** (port 28011) as fallback for basic memory R/W and save states.

---

## All 29 Tools

### Connection & Status
| Tool | Description |
|---|---|
| `pcsx2_connect` | Connect to PCSX2 (auto-detects DebugServer or Pine) |
| `pcsx2_status` | Connection type + emulator status |

### Memory
| Tool | Description |
|---|---|
| `pcsx2_read_memory` | Read N bytes as hex dump |
| `pcsx2_write_memory` | Write hex data to address |
| `pcsx2_read_string` | Read null-terminated string |
| `pcsx2_find_pattern` | Search for hex pattern (`??` wildcards) |
| `pcsx2_memory_diff` | Snapshot + diff memory regions |

### Registers
| Tool | Description |
|---|---|
| `pcsx2_read_registers` | All 7 categories (GPR, CP0, FPU, VU…), full 128-bit |
| `pcsx2_write_register` | Write register by category + index |

### Disassembly
| Tool | Description |
|---|---|
| `pcsx2_disassemble` | Native MIPS disassembly at address |
| `pcsx2_evaluate` | Evaluate expressions: `v0 + 0x100`, `gp - 4` |

### Breakpoints & Watchpoints
| Tool | Description |
|---|---|
| `pcsx2_set_breakpoint` | Set BP with optional condition + description |
| `pcsx2_remove_breakpoint` | Remove by address |
| `pcsx2_list_breakpoints` | List all with condition/status |
| `pcsx2_set_watchpoint` | Watch read/write/access/onChange |
| `pcsx2_remove_watchpoint` | Remove watchpoint |
| `pcsx2_list_watchpoints` | List with hit counts |
| `pcsx2_clear_all_breakpoints` | Remove ALL breakpoints + watchpoints |

### Execution Control
| Tool | Description |
|---|---|
| `pcsx2_step` | Step one instruction |
| `pcsx2_step_over` | Step over JAL/JALR calls |
| `pcsx2_continue` | Resume execution |
| `pcsx2_pause` | Halt emulator |

### System
| Tool | Description |
|---|---|
| `pcsx2_get_threads` | List EE/IOP BIOS threads |
| `pcsx2_get_modules` | List loaded IOP modules |
| `pcsx2_game_info` | Game title/ID/version (Pine) |
| `pcsx2_save_state` | Save state to slot 0-9 (Pine) |
| `pcsx2_load_state` | Load state from slot (Pine) |

### PS2Recomp Integration
| Tool | Description |
|---|---|
| `ps2recomp_lookup_function` | Search overrides by address or name |
| `ps2recomp_list_overrides` | List all function overrides |

---

## Example Workflows

### Reverse engineering a function
```
> "Connect to PCSX2"
> "Disassemble 40 instructions at 0x001000E0"
> "Set breakpoint at 0x001000E0 with condition v0 == 5"
> "Continue and wait for breakpoint"
> "Read registers"
> "Read 256 bytes at the address in a0"
```

### Finding a memory value with diffing
```
> "Take a memory snapshot of 0x200000, size 4096"
  (do something in the game)
> "Diff the snapshot to find changes"
```

### Comparing with PS2Recomp
```
> "Look up function at 0x0072e5c0 in PS2Recomp"
> "Set breakpoint at 0x0072e5c0 in PCSX2"
> "Step through and compare register values"
```

---

## Architecture

### Git Repository
```
PCSX2-MCP/                       ← source code only, lightweight
├── pcsx2-plugin/
│   ├── DebugServer.cpp          ← our custom patch for PCSX2 (this is the only PCSX2 modification)
│   └── DebugServer.h
├── pcsx2-mcp-server/
│   ├── src/index.ts             ← MCP server source (TypeScript)
│   ├── src/debug-server-client.ts
│   ├── src/pine-client.ts
│   ├── package.json
│   └── tsconfig.json
├── README.md
├── setup-mcp.bat
└── package-release.ps1
```

### GitHub Release (zip)
```
PCSX2-MCP-v1.0.0-win64/          ← ready to run, everything pre-built
├── pcsx2-qt.exe                 ← PCSX2 with DebugServer already compiled in
├── *.dll                        ← Qt + runtime dependencies
├── platforms/                   ← Qt platform plugins
├── resources/                   ← PCSX2 shaders, GameDB, etc
├── pcsx2-mcp-server/
│   ├── dist/index.js            ← compiled MCP server
│   └── node_modules/            ← pre-installed dependencies
├── source/
│   ├── DebugServer.cpp          ← patch source (GPL compliance)
│   └── DebugServer.h
├── setup-mcp.bat
└── README.md
```

---

## Building from Source

<details>
<summary>Only needed if you want to modify PCSX2 or the MCP server</summary>

### Prerequisites

| Component | Requires |
|---|---|
| **PCSX2** | Git, CMake ≥ 3.22, Ninja, MSVC (Visual Studio 2022), Qt 6 |
| **MCP Server** | [Node.js](https://nodejs.org/) ≥ 18 (includes npm) |

> All MCP server dependencies (`@modelcontextprotocol/sdk`, `zod`, `typescript`) are declared in `package.json` and installed automatically by `npm install`. You do **not** need to install them manually.

### PCSX2

```powershell
# 1. Clone the upstream PCSX2 source (we don't include it in this repo to save space)
git clone https://github.com/PCSX2/pcsx2.git pcsx2-src
cd pcsx2-src

# 2. Copy our DebugServer patch into the PCSX2 source tree
cp ../pcsx2-plugin/DebugServer.cpp pcsx2/DebugTools/
cp ../pcsx2-plugin/DebugServer.h pcsx2/DebugTools/

# 3. Add to CMakeLists.txt (in pcsx2/DebugTools/)
# Add DebugServer.cpp and DebugServer.h to the source list

# 4. Build with CMake + Ninja + MSVC
cmake -G Ninja -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --target pcsx2-qt
```

### MCP Server

```bash
cd pcsx2-mcp-server

# Install all dependencies (MCP SDK, Zod, TypeScript, etc.)
npm install

# Compile TypeScript → dist/index.js
npm run build
```

</details>

---

## Troubleshooting

| Issue | Fix |
|---|---|
| "No Qt platform plugin" | Make sure `platforms/qwindows.dll` exists next to `pcsx2-qt.exe` |
| DebugServer not listening | Check PCSX2 console for `[DebugServer] Listening on 127.0.0.1:21512` |
| "No connection" from tools | Call `pcsx2_connect` first |
| Pine tools fail | Enable Pine IPC: PCSX2 Settings → Advanced → Enable Pine IPC |
| Breakpoints don't trigger | Game must be running (not in BIOS/menu) |

---

## License

- **PCSX2**: GPL-3.0 (same as [upstream](https://github.com/PCSX2/pcsx2))
- **DebugServer plugin**: GPL-3.0 (derivative work)
- **MCP Server**: MIT

The GitHub Release includes a pre-built PCSX2 binary (GPL-3.0). Full source for our modifications is provided in `pcsx2-plugin/` (this repo) and also bundled in the release zip under `source/`. The unmodified PCSX2 source is available at [github.com/PCSX2/pcsx2](https://github.com/PCSX2/pcsx2).
