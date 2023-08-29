from io import BytesIO
from xhtml2pdf  import pisa
from .forms import *
from django.db.models import Sum,F
from django.shortcuts import render, HttpResponse,redirect, get_object_or_404,HttpResponseRedirect
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.conf import settings
from django.template.loader import render_to_string
from django.template.loader import get_template
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.decorators import login_required
from django.urls import reverse
from django.http import HttpResponse
from django.core.mail import send_mail
from django.contrib.auth.models import User
from django.core.mail import EmailMessage
from django.http import HttpResponse
from .utils import new_invoice_number


# Create your views here.





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
    data = {
        's': commons.SALUTATION_CHOICES,
        'c':commons.CURRENCY_CHOICES,
    }
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

          
    else:
        fm=AddCUstomerForm()
    context={'forms':fm, 'data': data}
    return render(request,'index.html',context)








def InvoiceView(request):
    if request.method=='POST':
        fm=InvoiceForm(request.POST)
        if fm.is_valid():    
            customer_id = request.POST.get('customer_name')  # Assuming you're passing the customer ID from the form
            customer = AddCustomer.objects.get(id=customer_id)  # Fetch the customer instance based on the
            obj = fm.save(commit=False)
            obj.customer_name = customer
            obj.save()
            items_details = request.POST.getlist('items_details[]')
            quality = request.POST.getlist('quality[]')
            rate = request.POST.getlist('rate[]')
            
            
            result = [
                    {
                        'items_details': items_details[i],
                        'quality': quality[i],
                        'rate': rate[i]
                    }
                    for i in range(len(items_details))
                ]
            for item in result:
                TableItems.objects.create(invoice=obj,**item)
            messages.success(request, "Successfully Added Customer." )
            return redirect(reverse('invoicelist'))
        else:
            print("form is invalid")
            messages.error(request, fm.errors)
            print(fm.errors)
    else:
        fm=InvoiceForm()
    users = AddCustomer.objects.all()
    get_new_invoice_number = new_invoice_number()
    context={'forms':fm,'users':users, 'new_invoice_number': get_new_invoice_number}
    return render(request,'invoices.html',context)
            
            
            
                
        
            
    
    
            
            


def CustomerViewPage(request, id):
    obj=get_object_or_404(AddCustomer, id=id)
    obj1 = obj.invoices.all()
    ammount_pay_obj = TableItems.objects.filter(invoice__customer_name__id = id).aggregate(total_amount = Sum(F('rate')*F('quality')))['total_amount']
    total_sum = ammount_pay_obj
    context={'obj1': obj1, 'obj': obj,'total_sum':total_sum}
    return render(request,'customerviewpage.html',context)
    
        
    
    
    

    

def DeleteCustomer(request, id):
    obj = get_object_or_404(AddCustomer, id=id)
    obj.delete()
    return redirect('table')
    



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
    invoice_items =TableItems.objects.filter(invoice=invoice_object)
    context={'invoice_object': invoice_object,"invoice_items":invoice_items}
    return render(request,'indexview.html',context)
    
















def invoicepage(request,id):
    user=Invoice.objects.get(id=id)
    context={'user':user}
    return render(request,'',context)

def EditView(request,id):
    
    table_items = TableItems.objects.filter(invoice__id=id)
    data = {
        'user': AddCustomer.objects.all(),
        # 'invoice': Invoice.objects.all(),
        'table_items': table_items,
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
            print(form.errors   )
    else:
        form = InvoiceForm(instance=obj)
        
    context={"form":form,"obj":obj, 'data': data,'tables_item':table_items}
    return render(request,'editinvoice.html',context)


def EditCustomer(request,id):
    obj=get_object_or_404(AddCustomer,id=id)
    if request.method=='POST':
        
        form=EditCustomerForm(request.POST,instance=obj)
        
        if form.is_valid():
            form.save()
            messages.success(request, "Invoice updated successfully.")
            return redirect('customerview', id=id)
        else:
            print(form.errors)
    else:
        form = InvoiceForm(instance=obj)
        #print(form.errors)

    
        
    context={'form':form,'obj':obj}
    return render(request,'customerviewpage.html',context)
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





def download_invoice_pdf(request, guid):
    # ticket = get_object_or_404(ActivityBookingTicket, guid=guid)

  
    pdf = render_to_pdf("invoice_pdf.html")
    return HttpResponse(pdf, content_type="application/pdf")


def send_mail(request,id):
    user=AddCustomer.objects.filter(email=id)
    
    
    for customer in user:
        email = EmailMessage(
            'Subject of the Email',
            'Body of the Email',
            'sender@example.com',  # Sender's email address
            [customer.email],  # Email address of the customer
        )

        # Attach PDF or any other attachments as needed
        pdf_path = 'path_to_your_generated_pdf.pdf'  # Replace with the actual path to your PDF file

        with open(pdf_path, 'rb') as pdf_file:
            email.attach('invoice.pdf', pdf_file.read(), 'application/pdf')

        email.send()

    return HttpResponse('Emails sent to filtered customers')

def email(request):
    return render(request,'email.html')
