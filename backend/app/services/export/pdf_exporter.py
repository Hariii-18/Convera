import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer

from app.services.export.content import ExportDocument, escape_xml

_BRAND_COLOR = colors.HexColor("#6D28D9")


class PdfExporter:
    content_type = "application/pdf"
    file_extension = "pdf"

    def render(self, document: ExportDocument) -> bytes:
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
        heading_style = ParagraphStyle(
            "SectionHeading", parent=styles["Heading2"], spaceBefore=16, spaceAfter=8
        )
        body_style = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10, leading=14)
        bullet_style = ParagraphStyle("Bullet", parent=body_style, spaceAfter=4)

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
        if document.disclaimer:
            story.append(Paragraph(escape_xml(document.disclaimer), disclaimer_style))

        for section in document.sections:
            story.append(Paragraph(escape_xml(section.heading), heading_style))
            if not section.lines:
                continue
            if section.is_long_form:
                for paragraph in section.lines[0].split("\n"):
                    if paragraph.strip():
                        story.append(Paragraph(escape_xml(paragraph), body_style))
                        story.append(Spacer(1, 4))
            else:
                items = [
                    ListItem(Paragraph(escape_xml(line), bullet_style), leftIndent=6)
                    for line in section.lines
                ]
                story.append(ListFlowable(items, bulletType="bullet", leftIndent=14))

        doc.build(story)
        return buffer.getvalue()
