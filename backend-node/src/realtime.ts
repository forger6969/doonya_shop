import { WebSocket } from 'ws';
import { createNotification } from './repo';

function sendJson(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }
}

// ── Support chat manager (mirrors support.py ConnectionManager) ───────────────
class SupportManager {
  users = new Map<number, WebSocket>();
  agents = new Map<number, WebSocket>();

  connectUser(userId: number, ws: WebSocket): void {
    this.users.set(userId, ws);
  }
  connectAgent(agentId: number, ws: WebSocket): void {
    this.agents.set(agentId, ws);
  }
  disconnectUser(userId: number): void {
    this.users.delete(userId);
  }
  disconnectAgent(agentId: number): void {
    this.agents.delete(agentId);
  }
  sendToUser(userId: number, data: unknown): void {
    const ws = this.users.get(userId);
    if (ws) sendJson(ws, data);
  }
  broadcastToAgents(data: unknown): void {
    for (const ws of this.agents.values()) sendJson(ws, data);
  }
  get hasAgents(): boolean {
    return this.agents.size > 0;
  }
}

// ── Order chat manager (mirrors order_chat.py OrderChatManager) ───────────────
class OrderChatManager {
  users = new Map<string, Map<number, WebSocket>>();
  admins = new Map<number, WebSocket>();

  connectUser(orderId: string, userId: number, ws: WebSocket): void {
    if (!this.users.has(orderId)) this.users.set(orderId, new Map());
    this.users.get(orderId)!.set(userId, ws);
  }
  connectAdmin(adminId: number, ws: WebSocket): void {
    this.admins.set(adminId, ws);
  }
  disconnectUser(orderId: string, userId: number): void {
    this.users.get(orderId)?.delete(userId);
  }
  disconnectAdmin(adminId: number): void {
    this.admins.delete(adminId);
  }
  sendToUser(orderId: string, data: unknown): void {
    for (const ws of (this.users.get(orderId) ?? new Map<number, WebSocket>()).values()) sendJson(ws, data);
  }
  broadcastToAdmins(data: unknown): void {
    for (const ws of this.admins.values()) sendJson(ws, data);
  }
}

// ── Notify manager (mirrors notifications.py NotifyManager) ───────────────────
class NotifyManager {
  connections = new Map<number, WebSocket>();

  connect(userId: number, ws: WebSocket): void {
    this.connections.set(userId, ws);
  }
  disconnect(userId: number): void {
    this.connections.delete(userId);
  }
  // Persist first (guarantees delivery on reconnect), then push if online.
  async send(userId: number, type: string, payload: Record<string, unknown>): Promise<void> {
    await createNotification(userId, type, payload);
    const ws = this.connections.get(userId);
    if (ws) sendJson(ws, { type, ...payload });
  }
}

export const supportManager = new SupportManager();
export const orderChatManager = new OrderChatManager();
export const notifyManager = new NotifyManager();
export { sendJson };
