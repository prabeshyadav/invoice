from django import forms
from .models import *
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.forms import ModelForm



class InvoiceForm(forms.ModelForm):
    class Meta:
        model=Invoice
        # fields='__all__'
        exclude=("invoice_number",)
        
class CustomerModelForm(forms.ModelForm):
    class Meta:
        model = AddCustomer
        fields='__all__'
        


class AddCUstomerForm(forms.Form):
    #customer_type=forms.CharField()
    #primary_contact=forms.CharField()
    customer_display_name=forms.CharField()
    first_name = forms.CharField()
    last_name = forms.CharField()
    company_name = forms.CharField()
    customer_display_name = forms.CharField()
    email = forms.EmailField()
    #website=forms.CharField()
    phone = forms.CharField()
    mobile = forms.CharField()   
    
    
class CreateUserForm(UserCreationForm):
    class Meta:
        model       =User
        fields=['username','email','password1','password2']
    
    
class TableItemsForm(forms.Form):
    items_details=forms.CharField(max_length=225)
    quality=forms.IntegerField()
    rate=forms.IntegerField()
    amount=models.IntegerField()
