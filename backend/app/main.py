"""SwachhSetu prototype server: the API plus the built web app, from one process."""
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .api import router
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(_app):
    seed_if_empty()
    yield


app = FastAPI(title="SwachhSetu prototype", version="0.1.0", lifespan=lifespan,
              description="Verified public sanitation and rapid maintenance network. SYNTHETIC DEMO DATA.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router)

STATIC_DIR = Path(os.getenv("STATIC_DIR", Path(__file__).resolve().parents[2] / "frontend" / "dist"))


if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)
        candidate = STATIC_DIR / path
        if path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")
else:
    @app.get("/", include_in_schema=False)
    def root():
        return {"message": "API running. Build the frontend (make build) to serve the web app here.",
                "docs": "/docs"}
