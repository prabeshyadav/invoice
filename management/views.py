from django.shortcuts import render, HttpResponse,redirect, get_object_or_404,HttpResponseRedirect
from django.contrib.auth import authenticate, login, logout
from .forms import *
from django.views import View
from django.contrib import messages
from django.conf import settings

from .models import *
from weasyprint import HTML, CSS
from django.template.loader import render_to_string
import tempfile
import datetime
from io import BytesIO
import pdfkit
from django.template.loader import get_template
from django.template.exceptions import TemplateDoesNotExist
from xhtml2pdf.pisa import CreatePDF
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph



from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.decorators import login_required
from management.models import AddCustomer
from django.urls import reverse
from xhtml2pdf  import pisa
from django.http import HttpResponse
# Create your views here.
from .models import *
def register(request):
    form= CreateUserForm()
    if request.method=='POST':
        form= CreateUserForm(request.POST)
        if form.is_valid():
            form.save(  )
            user=form.cleaned_data.get('username')
            messages.success(request,'Account is created'+user)
            return redirect('login')
        else:
            return HttpResponse("not valid data")
    context={'forms':form}
    

    return render(request,'register.html',context)


def loginPage(request):
	if request.method == 'POST':
		username = request.POST['username']
		password = request.POST['password']
		user = authenticate(request, username = username, password = password)
		if user is not None:
			form = login(request, user)
			messages.success(request, f' wecome {username} !!')
			return redirect('table')
		else:
			messages.info(request, f'account done not exit plz sign in')
	form = CreateUserForm()
	return render(request, 'login.html', {'form':form, 'title':'log in'})


def ResetPassword(request):
    context={}
    return render(request,'reset.html',context)

@login_required
def logoutUser(request):
	logout(request)
	messages.info(request, "Logged out successfully!")
	return redirect("login")

@login_required
def Customer(request):
    # return HttpResponse(request)
    data = {
        's': commons.SALUTATION_CHOICES,
        'c':commons.CURRENCY_CHOICES,
    }
    # return HttpResponse(data)
    if request.method=='POST':
        print(request.POST)
        fm=CustomerModelForm(request.POST) 
        if fm.is_valid():
            fm.save()
            messages.success(request, "Successfully Added Customer." )
            return redirect("table")
        else:
            print("form is invalid")
            messages.error(request, fm.errors )
            print(fm.errors)

            # cleaned_data = fm.cleaned_data
            # print("cleaned data is ",cleaned_data)
            # AddCustomer.objects.create(**cleaned_data)
            # return HttpResponse("saved")
    else:
        fm=AddCUstomerForm()
    context={'forms':fm, 'data': data}
    return render(request,'index.html',context)





# @login_required
# def Customer(request):
#     form = CustomerModelForm()
#     if request.method == "POST":
#         print("DATA GIVEN FORM IS ",request.POST)
#         a = AddCustomer(**request.POST)
#         a.save()
#             # print("DATA GIVEN IS ",request.POST)
#         # form = CustomerModelForm(request.POST)
#         # if form.is_valid():
#         #     form.save()
#         #     return redirect("index")
#     context={"form":form}
#     return render(request,'index.html',context)


def InvoiceView(request):
    if request.method=='POST':
        print(request.POST)
        fm=InvoiceForm(request.POST)
        if fm.is_valid():
            obj = fm.save()
            invoice_ids = obj.id
            
            items_details = request.POST.getlist('items_details[]')
            quality = request.POST.getlist('quality[]')
            rate = request.POST.getlist('rate[]')
            amount = request.POST.getlist('quantity1[]')
            
            print("-----------------Items detail------------")
            print(request.POST)
            
            result = [
                    {
                        'items_details': items_details[i],
                        'quality': quality[i],
                        'rate': rate[i]
                    }
                    for i in range(len(items_details))
                ]
            
            for item in result:
                TableItems.objects.create(invoice=obj,amount=69,**item)
                
            messages.success(request, "Successfully Added Customer." )
            return redirect(reverse('invoicelist'))
        
        else:
            print("form is invalid")
            messages.error(request, fm.errors)
            print(fm.errors)
            
    else:
        fm=InvoiceForm()
    from .models import AddCustomer
    users = AddCustomer.objects.all()

    # invoice_id = int(Invoice.objects.all().last().invoice_number)+1
    invoice_id=98
    context={'forms':fm,'users':users,'invoice_id':invoice_id}
    
    return render(request,'invoices.html',context)


# def index(request):
#     return render(request,'index.html')


def tableView(request):
    user=AddCustomer.objects.all()
    
    context={'user':user}
    return render(request,'itemslist.html',context)


def InvoiceListView(request):
    user=Invoice.objects.all()
    context={'user':user}
    return render(request,'invoicelist.html',context)
    
    
    
def Delete_table(request,id):
    if request.method=='POST':
        pi=AddCustomer.objects.get(pk=id)
        pi.delete()
        
        return HttpResponse('/')


def ItemView(request):
    context={}
    return render(request,'items.html',context)

def getItem():
    data = [
        {'item_name':"product1","price":23},
        {'item_name':"product1","price":23},
        {'item_name':"product1","price":23},
        {'item_name':"product1","price":23},
    ]
    
def home(reequest):
    return render(reequest,'base.html',)

def IndexView(request, id):
    invoice_object = get_object_or_404(Invoice, id=id)
    # invoice_object = Invoice.objects.get(id=id)
    
    invoice_items =TableItems.objects.filter(invoice=invoice_object)
    context={'invoice_object': invoice_object,"invoice_items":invoice_items}
    return render(request,'indexview.html',context)






def email(request,id):
    mail=get_object_or_404(Invoice,id=id)
    context={'mail':mail}
    
    return render(request,'email.html',context)









def invoicepage(request,id):
    user=Invoice.objects.get(id=id)
    context={'user':user}
    return render(request,'',context)

def EditView(request,id):
    data = {
        'user': AddCustomer.objects.all(),
    }
    obj=get_object_or_404(Invoice,id=id)
    if request.method == 'POST':
        form=InvoiceForm(request.POST or None,instance=obj)
        if form.is_valid():
            form.save()
            messages.success(request, "Invoice updated successfully.")
            return redirect('indexview', id=id)
        else:
            messages.error(request, "Form is invalid. Please check the entered data.")    
    else:
        form = InvoiceForm(instance=obj)
        
    context={"form":form,"obj":obj, 'data': data}
    return render(request,'invoices.html',context)


# def generate_pdf(request):
    
    
#     response = HttpResponse(content_type='application/pdf')
#     response ['Content-Disposition'] = 'filename=invoice.pdf' +\
#         str(datetime.datetime.now())+'.pdf'
        
#     response['Content-Transfer-Encoding'] = 'binary'
#     html_string=render_to_string('invoice_pdf.html',{'invoice':[],'total':0})
    
#     html=HTML(string=html_string)
#     result=html.write_pdf()
    
#     with tempfile.NamedTemporaryFile(delete=True) as output:
#         output.write(result)
#         output.flush()
#         output=open(output.name,'rb')
#         response.write(output.read())
        
#     return response

    # class GeneratePdf(View):
    #     def get(self, request, *args, **kwargs):
    #         try:
    #             # Render the HTML template to a string
    #             html = render_to_string('pdf.html')

    #             # Generate the PDF
    #             pdf = pisa.CreatePDF(html)

    #             if pdf.err:
    #                 # Handle the error if PDF generation failed
    #                 raise Exception("PDF generation error: {}".format(pdf.err))

    #             # Create a BytesIO object to store the PDF content
    #             pdf_buffer = io.BytesIO(pdf.dest.getvalue())

    #             # Set the file pointer of the BytesIO object to the beginning
    #             pdf_buffer.seek(0)

    #             # Create a HTTP response with PDF mime type
    #             response = HttpResponse(content_type='application/pdf')

    #             # Set the file name for the PDF attachment
    #             response['Content-Disposition'] = 'attachment; filename="invoice.pdf"'

    #             # Write the PDF content to the response
    #             response.write(pdf_buffer.getvalue())

    #             return response

    #         except TemplateDoesNotExist as e:
    #             return HttpResponse("Template does not exist: {}".format(str(e)))

    #         except Exception as e:
    #             return HttpResponse("Error generating PDF: {}".format(str(e)))
        
        

# def generate_pdf(request):
#     # Create a BytesIO object to store the PDF content
#     pdf_buffer =io.BytesIO()
    
#     # Set the document title and filename
#     document_title = "invoice_" + str(datetime.datetime.now()) + ".pdf"
#     document_filename = document_title.replace(":", "-")
    
#     # Create the PDF document
#     doc = SimpleDocTemplate(pdf_buffer, pagesize=A4)
    
#     # Define the styles for the PDF content
#     styles = getSampleStyleSheet()
    
#     # Render the HTML template to a string
#     html_string = render_to_string('invoice_pdf.html', {'invoice': [], 'total': 0})
    
#     # Create a Paragraph object from the HTML content
#     content = [Paragraph(html_string, styles["Normal"])]
    
#     # Build the PDF document
#     doc.build(content)
    
#     # Set the file pointer of the BytesIO object to the beginning
#     pdf_buffer.seek(0)
    
#     # Create a HTTP response with PDF mime type
#     response = HttpResponse(content_type='application/pdf')
    
#     # Set the file name for the PDF attachment
#     response['Content-Disposition'] = 'attachment; filename="{}"'.format(document_filename)
    
#     # Write the PDF content to the response
#     response.write(pdf_buffer.getvalue())
    
#     return response

# def html_to_pdf(request):
#     context = {
#         'invoice_number': 'INV-001',
#         'customer_name': 'kantipurinfotech',
#         # Add more context variables as needed
#     }
    
#     html = render(request, 'invoice_pdf.html', context).content.decode('utf-8')
    
#     pdf = pdfkit.from_string(html, False,configuration=settings.PDFKIT_CONFIG)
#     response = HttpResponse(content_type='application/pdf')
#     response['Content-Disposition'] = 'attachment; filename="invoice.pdf"'
#     response.write(pdf)
#     return response

# def render_to_pdf(template_src,context_dict={}):
#     template=get_template(template_src)
#     html=template.render(context_dict)
#     result=BytesIO()
#     pdf=pisa.pisaDocument(BytesIO(html.encode("UTF-8")),result)
#     if not pdf.err:
#         return HttpResponse(result.getvalue(),content_type='application/pdf')
#     return None

# data={
#     'invoice_number': 'INV-001',
#     'customer_name': 'kantipurinfotech',
#         # Add more cont
# }


# class ViewPdf(View):
#     def get(self,request,*args, **kwargs):
#         pdf=render_to_pdf('invoice_pdf.html',data)
#         return HttpResponse(pdf,content_type='application')
# from django.views.generic import View
# from .utils import render_to_pdf
# class GeneratePdf(View):
#     def get(self,request,*args, **kwargs):
#         template=get_template('invoice_pdf.html')
#         context={
#             'invoice_id':234,
#             'customer_name':'kantipurinfotech'
#         }
#         html=template.render(context)
#         pdf=render_to_pdf('invoice_pdf.html',context)
#         if pdf:
#             response =HttpResponse(pdf,content_type='application')
#             filename='invoice%_%s'%('1234')
#             content="inline; filename='%s'"%(filename)
#             response['content-Disposition']=content
#             return response
#         return HttpResponse('Not Found')

# from django.template import RequestContext

# def xhtml_to_pdf(request):
#     # Render the invoice_pdf.html template
#     context = {}  # Add your desired context variables here
#     html_content = render_to_string('invoice_pdf.html', context, request=request)

#     # Generate PDF from HTML content
#     options = {
#         'encoding': 'UTF-8'
#     }
#     pdf = pdfkit.from_string(html_content, False, options=options)

#     # Create a HTTP response with PDF content
#     response = HttpResponse(content_type='application/pdf')
#     response['Content-Disposition'] = 'attachment; filename="output.pdf"'
#     response.write(pdf)

#     return response

# def generate_pdf(request):
#     # Get the HTML content from the Django template
#     template = 'invoice_pdf.html'
#     context = {}  # Add any necessary context data
#     html_string = render_to_string(template, context)

#     # Create a PDF response
#     response = HttpResponse(content_type='application/pdf')
#     response['Content-Disposition'] = 'attachment; filename="invoice.pdf"'

#     # Convert HTML to PDF
#     pdf = pisa.CreatePDF(html_string, dest=response)

#     # If PDF generation failed, return an error message
#     if pdf.err:
#         return HttpResponse('PDF generation error')

#     return response

def render_to_pdf(template_src, context_dict={}):
    template = get_template(template_src)
    html = template.render(context_dict)
    result = BytesIO()
    pdf = pisa.pisaDocument(BytesIO(html.encode("ISO-8859-1")), result)
    if not pdf.err:
        return HttpResponse(result.getvalue(), content_type="application/pdf")
    return None

def pdf(request,id):
    invoice_object = get_object_or_404(Invoice, id=id)
    
    invoice_items =TableItems.objects.filter(invoice=invoice_object)
    data={'invoice_object': invoice_object,"invoice_items":invoice_items}

    pdf = render_to_pdf("invoice_pdf.html", data)
    return HttpResponse(pdf, content_type="application/pdf")
    # return render(request,'invoice_pdf.html',)





def download_activity_ticket(request, guid):
    # ticket = get_object_or_404(ActivityBookingTicket, guid=guid)

    data = {
        "booking": "sdfsdf",
        "domain": request.META["HTTP_HOST"],
        "ticket": "sdf",
        "guid": guid,
    }
    pdf = render_to_pdf("activity_ticket.html", data)
    return HttpResponse(pdf, content_type="application/pdf")