import logging

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

logger = logging.getLogger("converra")


class AppError(Exception):
    """Base class for domain errors that should map to a specific HTTP response."""

    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _error_response(status_code: int, message: str, details: object = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"message": message, "details": details}},
    )


class UnhandledExceptionMiddleware(BaseHTTPMiddleware):
    """Catches unhandled exceptions inside the middleware stack (below CORSMiddleware).

    Starlette moves any handler registered for the bare `Exception` class onto
    `ServerErrorMiddleware`, which sits *outside* every `app.add_middleware(...)` layer
    (including CORS). Left alone, that means any unhandled exception produces a 500
    response with no `Access-Control-Allow-Origin` header, and browsers report it as a
    CORS failure instead of the real error. Catching it here — inside CORSMiddleware —
    ensures error responses still carry CORS headers. Register this middleware before
    `CORSMiddleware` so it ends up as the inner layer.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint):
        try:
            return await call_next(request)
        except Exception as exc:  # noqa: BLE001  (last-resort safety net)
            logger.exception("Unhandled exception", exc_info=exc)
            return _error_response(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "Internal server error",
            )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        return _error_response(exc.status_code, exc.message)

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
        return _error_response(exc.status_code, str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return _error_response(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Validation failed",
            exc.errors(),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception", exc_info=exc)
        return _error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Internal server error",
        )
