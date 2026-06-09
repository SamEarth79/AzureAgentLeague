export class WSClient {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private onMessage: (data: any) => void;
  private onConnect: () => void;
  private onDisconnect: () => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private messageQueue: any[] = [];

  constructor(
    sessionId: string,
    handlers: {
      onMessage: (data: any) => void;
      onConnect: () => void;
      onDisconnect: () => void;
    }
  ) {
    this.sessionId = sessionId;
    this.onMessage = handlers.onMessage;
    this.onConnect = handlers.onConnect;
    this.onDisconnect = handlers.onDisconnect;
  }

  connect() {
    const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8000";
    this.ws = new WebSocket(`${wsUrl}/api/sessions/${this.sessionId}/stream`);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.flushQueue();
      this.onConnect();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessage(data);
      } catch {
        // ignore malformed message
      }
    };

    this.ws.onclose = () => {
      this.onDisconnect();
      this.attemptReconnect();
    };

    this.ws.onerror = () => {
      // error triggers onclose which handles reconnect
    };
  }

  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else if (this.ws?.readyState === WebSocket.CONNECTING) {
      this.messageQueue.push(message);
    }
  }

  disconnect() {
    this.maxReconnectAttempts = 0;
    this.messageQueue = [];
    this.ws?.close();
  }

  private flushQueue() {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      this.ws?.send(JSON.stringify(msg));
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
    }
  }
}
