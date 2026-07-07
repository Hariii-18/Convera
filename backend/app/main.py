from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.exceptions import UnhandledExceptionMiddleware, register_exception_handlers

settings = get_settings()

app = FastAPI(title="Converra API", version="0.1.0")

# Registered before CORSMiddleware so it sits *inside* it (add_middleware makes the
# most-recently-added middleware outermost) — this way error responses it produces
# still pass through CORSMiddleware and get CORS headers. See UnhandledExceptionMiddleware.
app.add_middleware(UnhandledExceptionMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(api_router)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
