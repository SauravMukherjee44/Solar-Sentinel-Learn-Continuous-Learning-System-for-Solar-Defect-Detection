import config from './backend-config';

const { apiUrl, wsUrl } = config;

export const pythonApi = {
  // Get system status
  getStatus: async () => {
    const response = await fetch(`${apiUrl}/api/status`);
    if (!response.ok) throw new Error('Failed to fetch status');
    return response.json();
  },

  // Get all models
  getModels: async () => {
    const response = await fetch(`${apiUrl}/api/models`);
    if (!response.ok) throw new Error('Failed to fetch models');
    return response.json();
  },

  // Get inference logs
  getLogs: async (limit = 100) => {
    const response = await fetch(`${apiUrl}/api/logs?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch logs');
    return response.json();
  },

  // Get drift alerts
  getAlerts: async () => {
    const response = await fetch(`${apiUrl}/api/alerts`);
    if (!response.ok) throw new Error('Failed to fetch alerts');
    return response.json();
  },

  // Get training batches
  getBatches: async () => {
    const response = await fetch(`${apiUrl}/api/batches`);
    if (!response.ok) throw new Error('Failed to fetch batches');
    return response.json();
  },

  // Get pipeline steps
  getPipelineSteps: async (batchId?: string) => {
    const url = batchId 
      ? `${apiUrl}/api/pipeline-steps?batch_id=${batchId}`
      : `${apiUrl}/api/pipeline-steps`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch pipeline steps');
    return response.json();
  },

  // Upload batch - triggers training pipeline
  uploadBatch: async (phase: number, totalImages: number, normalImages: number, defectImages: number) => {
    const response = await fetch(`${apiUrl}/api/upload-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase, total_images: totalImages, normal_images: normalImages, defect_images: defectImages }),
    });
    if (!response.ok) throw new Error('Failed to upload batch');
    return response.json();
  },

  // Promote canary to production
  promoteCanary: async (modelId: string) => {
    const response = await fetch(`${apiUrl}/api/promote-canary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id: modelId }),
    });
    if (!response.ok) throw new Error('Failed to promote canary');
    return response.json();
  },

  // Rollback to a previous model version
  rollbackModel: async (modelId: string) => {
    const response = await fetch(`${apiUrl}/api/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id: modelId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to rollback model');
    }
    return response.json();
  },

  // Acknowledge alert
  acknowledgeAlert: async (alertId: string) => {
    const response = await fetch(`${apiUrl}/api/acknowledge-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert_id: alertId }),
    });
    if (!response.ok) throw new Error('Failed to acknowledge alert');
    return response.json();
  },

  // Simulate inference (for testing)
  simulateInference: async (imageId?: string) => {
    const response = await fetch(`${apiUrl}/api/simulate-inference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_id: imageId }),
    });
    if (!response.ok) throw new Error('Failed to simulate inference');
    return response.json();
  },
};

// WebSocket connection for real-time updates
export class RealtimeConnection {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private callbacks: {
    onModelUpdate?: (data: unknown) => void;
    onStatusUpdate?: (data: unknown) => void;
    onLogUpdate?: (data: unknown) => void;
    onAlertUpdate?: (data: unknown) => void;
    onPipelineUpdate?: (data: unknown) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
  } = {};

  connect(callbacks: typeof this.callbacks) {
    this.callbacks = callbacks;
    this.createConnection();
  }

  private createConnection() {
    try {
      this.ws = new WebSocket(`${wsUrl}/ws`);

      this.ws.onopen = () => {
        console.log('WebSocket connected to Python backend');
        this.reconnectAttempts = 0;
        this.callbacks.onConnect?.();
        
        // Send ping every 30 seconds to keep connection alive
        this.startPingInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'model_update':
              this.callbacks.onModelUpdate?.(message.data);
              break;
            case 'status_update':
              this.callbacks.onStatusUpdate?.(message.data);
              break;
            case 'log_update':
              this.callbacks.onLogUpdate?.(message.data);
              break;
            case 'alert_update':
              this.callbacks.onAlertUpdate?.(message.data);
              break;
            case 'pipeline_update':
              this.callbacks.onPipelineUpdate?.(message.data);
              break;
            case 'pong':
              // Heartbeat response
              break;
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.callbacks.onDisconnect?.();
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.attemptReconnect();
    }
  }

  private pingInterval: number | null = null;

  private startPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    this.pingInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.createConnection(), delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  disconnect() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
let realtimeConnection: RealtimeConnection | null = null;

export const getRealtimeConnection = () => {
  if (!realtimeConnection) {
    realtimeConnection = new RealtimeConnection();
  }
  return realtimeConnection;
};

// Subscribe to real-time updates
export const subscribeToUpdates = (callbacks: {
  onModelUpdate?: (payload: unknown) => void;
  onStatusUpdate?: (payload: unknown) => void;
  onLogUpdate?: (payload: unknown) => void;
  onAlertUpdate?: (payload: unknown) => void;
  onPipelineUpdate?: (payload: unknown) => void;
}) => {
  const connection = getRealtimeConnection();
  connection.connect(callbacks);
  
  return () => connection.disconnect();
};

export default pythonApi;
