import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from app.services.export.content import escape_xml
from app.services.export.conversation_content import ConversationExportDocument

_BRAND_COLOR = colors.HexColor("#6D28D9")


class ConversationPdfExporter:
    content_type = "application/pdf"
    file_extension = "pdf"

    def render(self, document: ConversationExportDocument) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=LETTER,
            topMargin=0.75 * inch,
            bottomMargin=0.75 * inch,
            leftMargin=0.75 * inch,
            rightMargin=0.75 * inch,
            title=document.meeting_title,
        )

        styles = getSampleStyleSheet()
        brand_style = ParagraphStyle(
            "Brand", parent=styles["Normal"], textColor=_BRAND_COLOR,
            fontSize=10, fontName="Helvetica-Bold", spaceAfter=6,
        )
        title_style = ParagraphStyle("Title", parent=styles["Title"], fontSize=20, spaceAfter=4)
        meta_style = ParagraphStyle(
            "Meta", parent=styles["Normal"], textColor=colors.grey, fontSize=9, spaceAfter=6
        )
        disclaimer_style = ParagraphStyle(
            "Disclaimer", parent=styles["Normal"], textColor=colors.grey,
            fontSize=8, fontName="Helvetica-Oblique", spaceAfter=18,
        )
        speaker_style = ParagraphStyle(
            "Speaker", parent=styles["Normal"], textColor=_BRAND_COLOR,
            fontSize=10, fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=2,
        )
        body_style = ParagraphStyle(
            "Body", parent=styles["Normal"], fontSize=10, leading=14, spaceAfter=2
        )

        story = [
            Paragraph(escape_xml(document.brand.upper()), brand_style),
            Paragraph(escape_xml(document.meeting_title), title_style),
        ]

        meta_parts = [document.date_time_ist, document.duration_label, document.participants_label]
        meta_line = " &middot; ".join(escape_xml(part) for part in meta_parts if part)
        if meta_line:
            story.append(Paragraph(meta_line, meta_style))
        else:
            story.append(Spacer(1, 6))
        story.append(Paragraph(escape_xml(document.disclaimer), disclaimer_style))

        for turn in document.turns:
            if turn.speaker_label:
                story.append(Paragraph(escape_xml(f"{turn.speaker_label}:"), speaker_style))
            for text in turn.texts:
                story.append(Paragraph(escape_xml(text), body_style))

        doc.build(story)
        return buffer.getvalue()
