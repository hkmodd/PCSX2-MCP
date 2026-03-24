/**
 * Pine IPC Client — PCSX2's built-in IPC protocol (TCP port 28011)
 * Can read/write memory, get game info, save/load states
 * Works with vanilla PCSX2 — no patches required
 */

import * as net from 'node:net';

export enum PineCmd {
  MsgRead8 = 0, MsgRead16 = 1, MsgRead32 = 2, MsgRead64 = 3,
  MsgWrite8 = 4, MsgWrite16 = 5, MsgWrite32 = 6, MsgWrite64 = 7,
  MsgVersion = 8,
  MsgTitle = 0x0E, MsgID = 0x0F, MsgUUID = 0x10,
  MsgGameVersion = 0x11, MsgStatus = 0x12,
  MsgSaveState = 0x0C, MsgLoadState = 0x0D,
}

export enum EmuStatus { Running = 0, Paused = 1, Shutdown = 2 }

export class PineClient {
  private host: string;
  private port: number;
  private socket: net.Socket | null = null;
  private connected = false;

  constructor(host = '127.0.0.1', port = 28011) {
    this.host = host;
    this.port = port;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      const timeout = setTimeout(() => { this.socket?.destroy(); reject(new Error('Pine timeout')); }, 3000);
      this.socket.connect(this.port, this.host, () => { clearTimeout(timeout); this.connected = true; resolve(); });
      this.socket.on('error', (e) => { clearTimeout(timeout); this.connected = false; reject(e); });
      this.socket.on('close', () => { this.connected = false; });
    });
  }

  isConnected(): boolean { return this.connected; }
  disconnect(): void { this.socket?.destroy(); this.socket = null; this.connected = false; }

  private async sendCommand(payload: Buffer): Promise<Buffer> {
    if (!this.socket || !this.connected) throw new Error('Pine not connected');
    return new Promise((resolve, reject) => {
      const sizeBuf = Buffer.alloc(4);
      sizeBuf.writeUInt32LE(payload.length + 4);
      const packet = Buffer.concat([sizeBuf, payload]);
      const timeout = setTimeout(() => reject(new Error('Pine response timeout')), 5000);
      const handler = (data: Buffer) => {
        clearTimeout(timeout);
        this.socket?.off('data', handler);
        if (data.length < 5) { reject(new Error('Pine: short response')); return; }
        const retCode = data[4];
        if (retCode !== 0) { reject(new Error(`Pine error code: ${retCode}`)); return; }
        resolve(data.subarray(4));
      };
      this.socket!.on('data', handler);
      this.socket!.write(packet);
    });
  }

  async read8(addr: number): Promise<number> {
    const buf = Buffer.alloc(5); buf[0] = PineCmd.MsgRead8; buf.writeUInt32LE(addr, 1);
    const r = await this.sendCommand(buf); return r[1];
  }
  async read16(addr: number): Promise<number> {
    const buf = Buffer.alloc(5); buf[0] = PineCmd.MsgRead16; buf.writeUInt32LE(addr, 1);
    const r = await this.sendCommand(buf); return r.readUInt16LE(1);
  }
  async read32(addr: number): Promise<number> {
    const buf = Buffer.alloc(5); buf[0] = PineCmd.MsgRead32; buf.writeUInt32LE(addr, 1);
    const r = await this.sendCommand(buf); return r.readUInt32LE(1);
  }
  async read64(addr: number): Promise<bigint> {
    const buf = Buffer.alloc(5); buf[0] = PineCmd.MsgRead64; buf.writeUInt32LE(addr, 1);
    const r = await this.sendCommand(buf); return r.readBigUInt64LE(1);
  }

  async readMemory(addr: number, length: number): Promise<Buffer> {
    const result = Buffer.alloc(length);
    for (let i = 0; i < length; i++) { result[i] = await this.read8(addr + i); }
    return result;
  }

  async write8(addr: number, val: number): Promise<void> {
    const buf = Buffer.alloc(6); buf[0] = PineCmd.MsgWrite8; buf.writeUInt32LE(addr, 1); buf[5] = val;
    await this.sendCommand(buf);
  }
  async write32(addr: number, val: number): Promise<void> {
    const buf = Buffer.alloc(9); buf[0] = PineCmd.MsgWrite32; buf.writeUInt32LE(addr, 1); buf.writeUInt32LE(val, 5);
    await this.sendCommand(buf);
  }

  async writeMemory(addr: number, data: Buffer): Promise<void> {
    for (let i = 0; i < data.length; i++) { await this.write8(addr + i, data[i]); }
  }

  private async getString(cmd: PineCmd): Promise<string> {
    const buf = Buffer.alloc(1); buf[0] = cmd;
    const r = await this.sendCommand(buf);
    return r.subarray(1).toString('utf8').replace(/\0/g, '');
  }

  async getTitle(): Promise<string> { return this.getString(PineCmd.MsgTitle); }
  async getID(): Promise<string> { return this.getString(PineCmd.MsgID); }
  async getUUID(): Promise<string> { return this.getString(PineCmd.MsgUUID); }
  async getGameVersion(): Promise<string> { return this.getString(PineCmd.MsgGameVersion); }
  async getVersion(): Promise<string> { return this.getString(PineCmd.MsgVersion); }

  async getStatus(): Promise<EmuStatus> {
    const buf = Buffer.alloc(1); buf[0] = PineCmd.MsgStatus;
    const r = await this.sendCommand(buf); return r.readUInt32LE(1);
  }

  async saveState(slot: number): Promise<void> {
    const buf = Buffer.alloc(2); buf[0] = PineCmd.MsgSaveState; buf[1] = slot;
    await this.sendCommand(buf);
  }
  async loadState(slot: number): Promise<void> {
    const buf = Buffer.alloc(2); buf[0] = PineCmd.MsgLoadState; buf[1] = slot;
    await this.sendCommand(buf);
  }
}
