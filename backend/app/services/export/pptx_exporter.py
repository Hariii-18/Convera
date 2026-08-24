import io

from pptx import Presentation
from pptx.util import Inches, Pt

from app.services.export.content import ExportDocument

_MAX_LINES_PER_SLIDE = 8
_MAX_CHARS_PER_LINE = 220
_TITLE_LAYOUT = 0
_TITLE_AND_CONTENT_LAYOUT = 1


def _wrapped_lines(lines: list[str]) -> list[str]:
    """Splits on existing newlines (the long-form sections carry paragraph
    breaks that way) and hard-wraps anything still too long for one bullet
    to keep a slide from overflowing its placeholder.
    """
    wrapped: list[str] = []
    for line in lines:
        for raw in line.split("\n"):
            text = raw.strip()
            if not text:
                continue
            while len(text) > _MAX_CHARS_PER_LINE:
                wrapped.append(text[:_MAX_CHARS_PER_LINE])
                text = text[_MAX_CHARS_PER_LINE:]
            wrapped.append(text)
    return wrapped


class PptxExporter:
    content_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    file_extension = "pptx"

    def render(self, document: ExportDocument) -> bytes:
        prs = Presentation()
        prs.slide_width = Inches(13.333)
        prs.slide_height = Inches(7.5)

        self._add_title_slide(prs, document)
        for section in document.sections:
            self._add_section_slides(prs, section.heading, section.lines)

        buffer = io.BytesIO()
        prs.save(buffer)
        return buffer.getvalue()

    def _add_title_slide(self, prs: Presentation, document: ExportDocument) -> None:
        slide = prs.slides.add_slide(prs.slide_layouts[_TITLE_LAYOUT])
        slide.shapes.title.text = document.meeting_title

        subtitle_parts = [document.date_time_ist, document.duration_label, document.participants_label]
        subtitle = " · ".join(part for part in subtitle_parts if part)
        if len(slide.placeholders) > 1:
            slide.placeholders[1].text = f"{document.brand} · {subtitle}" if subtitle else document.brand

    def _add_section_slides(self, prs: Presentation, heading: str, lines: list[str]) -> None:
        wrapped = _wrapped_lines(lines) or ["No content recorded."]
        chunks = [
            wrapped[i : i + _MAX_LINES_PER_SLIDE] for i in range(0, len(wrapped), _MAX_LINES_PER_SLIDE)
        ]

        for index, chunk in enumerate(chunks):
            slide = prs.slides.add_slide(prs.slide_layouts[_TITLE_AND_CONTENT_LAYOUT])
            slide.shapes.title.text = heading if index == 0 else f"{heading} (cont.)"

            body = slide.placeholders[1].text_frame
            body.clear()
            for line_index, line in enumerate(chunk):
                paragraph = body.paragraphs[0] if line_index == 0 else body.add_paragraph()
                paragraph.text = line
                paragraph.font.size = Pt(16)
