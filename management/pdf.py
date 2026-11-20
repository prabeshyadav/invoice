from io import BytesIO

from django.http import HttpResponse
from django.template.loader import get_template
from xhtml2pdf import pisa


def render_to_pdf(template_src, context_dict=None):
    """Render a template to a PDF HttpResponse, or None if rendering fails."""
    html = get_template(template_src).render(context_dict or {})
    result = BytesIO()
    # UTF-8 so non-latin characters (e.g. Nepali names) don't raise UnicodeEncodeError.
    pdf = pisa.pisaDocument(BytesIO(html.encode('UTF-8')), result, encoding='UTF-8')
    if pdf.err:
        return None
    return HttpResponse(result.getvalue(), content_type='application/pdf')
