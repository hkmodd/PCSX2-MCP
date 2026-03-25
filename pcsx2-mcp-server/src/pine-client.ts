/**
 * Pine IPC Client — PCSX2's built-in IPC protocol (TCP port 28011)
 * Can read/write memory, get game info, save/load states
 * Works with vanilla PCSX2 — no patches required
 *
 * Protocol reference: PCSX2/pcsx2/PINE.cpp (ParseCommand)
 *
 * PACKET FORMAT:
 *   Request:  [4-byte LE size (includes these 4 bytes)] [command bytes...]
 *   Response: [4-byte LE size (includes these 4 bytes)] [1-byte result: 0=OK, 0xFF=FAIL] [data...]
 *
 * STRING RESPONSE FORMAT (MsgTitle, MsgID, MsgUUID, MsgGameVersion, MsgVersion):
 *   After the result byte: [4-byte LE string length (includes null)] [string bytes + null]
 *
 * STATUS RESPONSE FORMAT (MsgStatus):
 *   After the result byte: [4-byte LE uint32 status]
 *
 * MEMORY READ RESPONSE FORMAT:
 *   After the result byte: [value in LE, sized by read type]
 */

import * as net from 'node:net';

// ============================================================
//  Opcodes — MUST match PCSX2's PINE.cpp IPCCommand enum exactly
// ============================================================
export enum PineCmd {
  MsgRead8       = 0x00,
  MsgRead16      = 0x01,
  MsgRead32      = 0x02,
  MsgRead64      = 0x03,
  MsgWrite8      = 0x04,
  MsgWrite16     = 0x05,
  MsgWrite32     = 0x06,
  MsgWrite64     = 0x07,
  MsgVersion     = 0x08,
  MsgSaveState   = 0x09,  // was 0x0C — WRONG!
  MsgLoadState   = 0x0A,  // was 0x0D — WRONG!
  MsgTitle       = 0x0B,  // was 0x0E — WRONG!
  MsgID          = 0x0C,  // was 0x0F — WRONG!
  MsgUUID        = 0x0D,  // was 0x10 — WRONG!
  MsgGameVersion = 0x0E,  // was 0x11 — WRONG!
  MsgStatus      = 0x0F,  // was 0x12 — WRONG!
}

export enum EmuStatus { Running = 0, Paused = 1, Shutdown = 2 }

export class PineClient {
  private host: string;
  private port: number;
  private socket: net.Socket | null = null;
  private connected = false;

  // Command queue: Pine is sequential request/response over a single TCP socket.
  // We MUST serialize commands to prevent response interleaving.
  private commandQueue: Promise<any> = Promise.resolve();

  constructor(host = '127.0.0.1', port = 28011) {
    this.host = host;
    this.port = port;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.setNoDelay(true);  // disable Nagle for low-latency IPC
      const timeout = setTimeout(() => { this.socket?.destroy(); reject(new Error('Pine timeout')); }, 3000);
      this.socket.connect(this.port, this.host, () => { clearTimeout(timeout); this.connected = true; resolve(); });
      this.socket.on('error', (e) => { clearTimeout(timeout); this.connected = false; reject(e); });
      this.socket.on('close', () => { this.connected = false; });
    });
  }

  isConnected(): boolean { return this.connected; }
  disconnect(): void { this.socket?.destroy(); this.socket = null; this.connected = false; }

  /**
   * Send a raw Pine command and receive the full response.
   * Uses a queue to ensure commands are serialized (no interleaving).
   *
   * Response format from PCSX2:
   *   [4 bytes LE: total size] [1 byte: 0x00=OK or 0xFF=FAIL] [payload...]
   *
   * Returns the response AFTER the size header (i.e., starting with result byte).
   */
  private sendCommand(payload: Buffer): Promise<Buffer> {
    // Chain onto the queue so commands are strictly sequential
    const task = this.commandQueue.then(() => this._sendCommandRaw(payload));
    // Update the queue head (swallow errors so queue doesn't permanently break)
    this.commandQueue = task.catch(() => {});
    return task;
  }

  private _sendCommandRaw(payload: Buffer): Promise<Buffer> {
    if (!this.socket || !this.connected) throw new Error('Pine not connected');
    return new Promise((resolve, reject) => {
      // Build packet: [4-byte LE size] [payload]
      // Size field = payload.length + 4 (size includes itself)
      const sizeBuf = Buffer.alloc(4);
      sizeBuf.writeUInt32LE(payload.length + 4);
      const packet = Buffer.concat([sizeBuf, payload]);

      const timeout = setTimeout(() => {
        this.socket?.off('data', handler);
        reject(new Error('Pine response timeout'));
      }, 5000);

      // Accumulate data — response may arrive in multiple TCP segments
      let accumulated = Buffer.alloc(0);
      const handler = (data: Buffer) => {
        accumulated = Buffer.concat([accumulated, data]);

        // Need at least 4 bytes to read the response size
        if (accumulated.length < 4) return;

        const expectedSize = accumulated.readUInt32LE(0);
        if (expectedSize < 5 || expectedSize > 650000) {
          clearTimeout(timeout);
          this.socket?.off('data', handler);
          reject(new Error(`Pine: invalid response size ${expectedSize}`));
          return;
        }

        // Wait until we have the full response
        if (accumulated.length < expectedSize) return;

        clearTimeout(timeout);
        this.socket?.off('data', handler);

        // Response payload starts after the 4-byte size header
        const responsePayload = accumulated.subarray(4, expectedSize);

        // First byte of payload is the result code
        const retCode = responsePayload[0];
        if (retCode !== 0) {
          reject(new Error(`Pine error code: 0x${retCode.toString(16).toUpperCase()} (command: 0x${payload[0].toString(16)})`));
          return;
        }

        resolve(responsePayload);
      };

      this.socket!.on('data', handler);
      this.socket!.write(packet);
    });
  }

  // ============================================================
  //  Memory Read
  // ============================================================
  async read8(addr: number): Promise<number> {
    const buf = Buffer.alloc(5); buf[0] = PineCmd.MsgRead8; buf.writeUInt32LE(addr, 1);
    const r = await this.sendCommand(buf);
    return r[1]; // result[0]=OK, result[1]=value
  }

  async read16(addr: number): Promise<number> {
    const buf = Buffer.alloc(5); buf[0] = PineCmd.MsgRead16; buf.writeUInt32LE(addr, 1);
    const r = await this.sendCommand(buf);
    return r.readUInt16LE(1);
  }

  async read32(addr: number): Promise<number> {
    const buf = Buffer.alloc(5); buf[0] = PineCmd.MsgRead32; buf.writeUInt32LE(addr, 1);
    const r = await this.sendCommand(buf);
    return r.readUInt32LE(1);
  }

  async read64(addr: number): Promise<bigint> {
    const buf = Buffer.alloc(5); buf[0] = PineCmd.MsgRead64; buf.writeUInt32LE(addr, 1);
    const r = await this.sendCommand(buf);
    return r.readBigUInt64LE(1);
  }

  async readMemory(addr: number, length: number): Promise<Buffer> {
    const result = Buffer.alloc(length);
    for (let i = 0; i < length; i++) { result[i] = await this.read8(addr + i); }
    return result;
  }

  // ============================================================
  //  Memory Write
  // ============================================================
  async write8(addr: number, val: number): Promise<void> {
    const buf = Buffer.alloc(6); buf[0] = PineCmd.MsgWrite8; buf.writeUInt32LE(addr, 1); buf[5] = val;
    await this.sendCommand(buf);
  }

  async write16(addr: number, val: number): Promise<void> {
    const buf = Buffer.alloc(7); buf[0] = PineCmd.MsgWrite16; buf.writeUInt32LE(addr, 1); buf.writeUInt16LE(val, 5);
    await this.sendCommand(buf);
  }

  async write32(addr: number, val: number): Promise<void> {
    const buf = Buffer.alloc(9); buf[0] = PineCmd.MsgWrite32; buf.writeUInt32LE(addr, 1); buf.writeUInt32LE(val, 5);
    await this.sendCommand(buf);
  }

  async write64(addr: number, val: bigint): Promise<void> {
    const buf = Buffer.alloc(13); buf[0] = PineCmd.MsgWrite64; buf.writeUInt32LE(addr, 1); buf.writeBigUInt64LE(val, 5);
    await this.sendCommand(buf);
  }

  async writeMemory(addr: number, data: Buffer): Promise<void> {
    for (let i = 0; i < data.length; i++) { await this.write8(addr + i, data[i]); }
  }

  // ============================================================
  //  String Queries (Title, ID, UUID, GameVersion, Version)
  //
  //  PCSX2 response format (after size header):
  //    [1 byte: IPC_OK] [4 bytes LE: string length incl. null] [string bytes + null]
  //
  //  Our `sendCommand` returns data starting from the result byte,
  //  so the string length is at offset 1, and string data at offset 5.
  // ============================================================
  private async getString(cmd: PineCmd): Promise<string> {
    const buf = Buffer.alloc(1); buf[0] = cmd;
    const r = await this.sendCommand(buf);
    // r[0] = result code (already validated as 0x00 by sendCommand)
    // r[1..4] = string length (uint32 LE, includes null terminator)
    // r[5..] = string data
    if (r.length < 5) return '';
    const strLen = r.readUInt32LE(1);
    if (strLen <= 0 || r.length < 5 + strLen) return '';
    return r.subarray(5, 5 + strLen).toString('utf8').replace(/\0/g, '');
  }

  async getTitle(): Promise<string> { return this.getString(PineCmd.MsgTitle); }
  async getID(): Promise<string> { return this.getString(PineCmd.MsgID); }
  async getUUID(): Promise<string> { return this.getString(PineCmd.MsgUUID); }
  async getGameVersion(): Promise<string> { return this.getString(PineCmd.MsgGameVersion); }
  async getVersion(): Promise<string> { return this.getString(PineCmd.MsgVersion); }

  // ============================================================
  //  Emulator Status
  //
  //  PCSX2 response: [1 byte: IPC_OK] [4 bytes LE: EmuStatus enum]
  // ============================================================
  async getStatus(): Promise<EmuStatus> {
    const buf = Buffer.alloc(1); buf[0] = PineCmd.MsgStatus;
    const r = await this.sendCommand(buf);
    return r.readUInt32LE(1);
  }

  // ============================================================
  //  Save/Load State
  // ============================================================
  async saveState(slot: number): Promise<void> {
    const buf = Buffer.alloc(2); buf[0] = PineCmd.MsgSaveState; buf[1] = slot;
    await this.sendCommand(buf);
  }

  async loadState(slot: number): Promise<void> {
    const buf = Buffer.alloc(2); buf[0] = PineCmd.MsgLoadState; buf[1] = slot;
    await this.sendCommand(buf);
  }
}
