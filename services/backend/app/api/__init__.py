from fastapi import APIRouter

from .routes import router as routes_router
from .websocket import router as websocket_router

api_router = APIRouter()
api_router.include_router(routes_router)
api_router.include_router(websocket_router)

__all__ = ["api_router"]
