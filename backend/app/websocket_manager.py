from fastapi import WebSocket
from typing import List, Dict, Any
import json

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast message to all connected clients"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        
        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast_model_update(self, model_data: Dict[str, Any]):
        await self.broadcast({
            "type": "model_update",
            "table": "model_versions",
            "data": model_data
        })

    async def broadcast_status_update(self, status_data: Dict[str, Any]):
        await self.broadcast({
            "type": "status_update",
            "table": "system_status",
            "data": status_data
        })

    async def broadcast_log_update(self, log_data: Dict[str, Any]):
        await self.broadcast({
            "type": "log_update",
            "table": "inference_logs",
            "data": log_data
        })

    async def broadcast_alert_update(self, alert_data: Dict[str, Any]):
        await self.broadcast({
            "type": "alert_update",
            "table": "drift_alerts",
            "data": alert_data
        })

    async def broadcast_pipeline_update(self, step_data: Dict[str, Any]):
        await self.broadcast({
            "type": "pipeline_update",
            "table": "pipeline_steps",
            "data": step_data
        })

manager = ConnectionManager()
