from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List
import asyncio
import json

from app.database import engine, Base, get_db
from app.routers import models, batches, inference, alerts, status
from app.routers.training import router as training_router
from app.websocket_manager import manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown
    await engine.dispose()

app = FastAPI(
    title="SolarDefect ML Ops API",
    description="ML Pipeline Backend for Solar Panel Defect Detection",
    version="1.0.0",
    lifespan=lifespan
)

# CORS - Update origins for your frontend URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(status.router, prefix="/api", tags=["Status"])
app.include_router(models.router, prefix="/api", tags=["Models"])
app.include_router(batches.router, prefix="/api", tags=["Batches"])
app.include_router(inference.router, prefix="/api", tags=["Inference"])
app.include_router(alerts.router, prefix="/api", tags=["Alerts"])
app.include_router(training_router, prefix="/api", tags=["Training"])

@app.get("/")
async def root():
    return {"message": "SolarDefect ML Ops API", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming messages if needed
            message = json.loads(data)
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
