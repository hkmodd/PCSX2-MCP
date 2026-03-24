# PCSX2 Debug Server — Integration Guide

## How to Patch PCSX2

### 1. Copy files to PCSX2 source tree

```
cp pcsx2-plugin/DebugServer.h   <pcsx2-src>/pcsx2/DebugTools/DebugServer.h
cp pcsx2-plugin/DebugServer.cpp <pcsx2-src>/pcsx2/DebugTools/DebugServer.cpp
```

### 2. Add to CMakeLists.txt

In `<pcsx2-src>/pcsx2/CMakeLists.txt`, find the `DebugTools` sources section and add:

```cmake
set(pcsx2DebugToolsSources
    # ... existing files ...
    DebugTools/DebugServer.cpp
    DebugTools/DebugServer.h
)
```

### 3. Start the server on PCSX2 boot

In `<pcsx2-src>/pcsx2/VMManager.cpp`, add near include section:

```cpp
#include "DebugTools/DebugServer.h"
```

In `VMManager::Internal::InitializeMemory()` (or similar init function), add:

```cpp
DebugServer::Start(21512);
```

In `VMManager::Shutdown()`, add:

```cpp
DebugServer::Stop();
```

### 4. Build PCSX2

```bash
cd <pcsx2-src>/build
cmake --build . --config Release
```

### 5. Run and Connect

1. Launch the patched PCSX2
2. It prints `[DebugServer] Listening on 127.0.0.1:21512`
3. Use the MCP server — it auto-connects

## Protocol Reference

Port: **21512** (127.0.0.1 only)
Format: Newline-delimited JSON over TCP

### Commands

| Command | Description |
|---------|-------------|
| `status` | Alive, paused, PC, cycles |
| `read_registers` | All 7 register categories (128-bit) |
| `write_register` | Set any register (128-bit) |
| `set_pc` | Change program counter |
| `read_memory` | Read memory (hex string) |
| `write_memory` | Write memory |
| `read_string` | Read null-terminated string |
| `disassemble` | NATIVE PCSX2 disassembly |
| `evaluate` | Expression eval with symbol support |
| `set_breakpoint` | BP with optional condition |
| `remove_breakpoint` | Remove BP |
| `list_breakpoints` | List all BPs |
| `set_memcheck` | Watchpoint (r/w/onChange + condition) |
| `remove_memcheck` | Remove watchpoint |
| `list_memchecks` | List all watchpoints |
| `pause` | Halt CPU |
| `resume` | Continue execution |
| `step` | Single instruction step |
| `step_over` | Step over JAL/JALR |
| `get_threads` | BIOS thread list |
| `get_modules` | IOP module list |
| `is_valid_address` | Address validation |
| `clear_breakpoints` | Clear all BP + watchpoints |

### Example

```
→ {"cmd":"read_registers","cpu":"ee","category":0}\n
← {"ok":true,"data":{"GPR":{"size":128,"count":32,"regs":[{"name":"zero","value":"00000000000000000000000000000000","display":"0000000000000000 0000000000000000"}, ...]}}}\n

→ {"cmd":"set_breakpoint","address":"0x12d660","condition":"v0 == 0x42"}\n
← {"ok":true,"address":"0x0012d660"}\n

→ {"cmd":"evaluate","expression":"gp + 0x20"}\n
← {"ok":true,"result":1234568,"hex":"0x12d638"}\n
```
