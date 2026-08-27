from typing import Protocol

from app.services.export.content import ExportDocument


class Exporter(Protocol):
    """One rendering backend for `ExportDocument`. `ExportService` (see
    `export_service.py`) is the only thing that knows the list of exporters;
    each one only knows how to turn the shared document into bytes.
    """

    content_type: str
    file_extension: str

    def render(self, document: ExportDocument) -> bytes: ...
