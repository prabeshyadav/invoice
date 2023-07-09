from django.shortcuts import render, HttpResponse,redirect, get_object_or_404,HttpResponseRedirect
from django.contrib.auth import authenticate, login, logout
from .forms import *
from django.views import View
from django.contrib import messages
from .models import *
from weasyprint import HTML, CSS
from django.template.loader import render_to_string
import tempfile
import datetime


from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.decorators import login_required
from management.models import AddCustomer
from django.urls import reverse
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
        fm=InvoiceForm(request.POST)
        if fm.is_valid():
            obj = fm.save()
            invoice_ids = obj.id
            
            items_detail = request.POST.getlist('items_detail[]')
            quality = request.POST.getlist('quality[]')
            rate = request.POST.getlist('rate[]')
            amount = request.POST.getlist('quantity1[]')
            
            print("-----------------Items detail------------")
            print(quality)
            
            
            for i, q, r, a in zip(items_detail, quality, rate, amount):
                print("data")
                print(i)
                form_date={
                    'items_detail':i,
                    'quality':q,
                    'rate':r,
                    'amount':a,
                    'invoice_id':invoice_ids,
                }
                form=TableItemsForm(form_date)
                print(form)," alskdjlaksdjlkajsd oiaui oisud"
                if form.is_valid():
                    print(" data created")
                    ob = TableItems.objects.create(**form.cleaned_data)
                    print(ob.id)
            print("lllllllll")
            
            # else:
            #     messages.error(request, "Please fill the form with correct data")
            #     return redirect('invoicelist')
        
            
            
            #return HttpResponse(request.post.items())
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

    invoice_id = int(Invoice.objects.all().last().invoice_number)+1
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
    context={'invoice_object': invoice_object}
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


def generate_pdf(request):
    
    
    response = HttpResponse(content_type='application/pdf')
    response ['Content-Disposition'] = 'filename=invoice.pdf' +\
        str(datetime.datetime.now())+'.pdf'
        
    response['Content-Transfer-Encoding'] = 'binary'
    html_string=render_to_string('pdf.html',{'invoice':[],'total':0})
    
    html=HTML(string=html_string)
    result=html.write_pdf()
    
    with tempfile.NamedTemporaryFile(delete=True) as output:
        output.write(result)
        output.flush()
        output=open(output.name,'rb')
        response.write(output.read())
        
    return response
    
    
    

def pdf(request):
    return render(request,'pdf.html')