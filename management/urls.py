from django.urls import path
from . import views


urlpatterns = [
    path('', views.Customer, name="index"),
    path('invoice/',views.InvoiceView,name='invoice'),
    path('login/',views.loginPage,name='login'),
    path('logout/',views.logoutUser,name='logout'),
    path('register',views.register,name='register'),
    path('reset',views.ResetPassword,name='reset'),
    path('delete/<int:id>/', views.Delete_table,name="delete_data"),
    #path('edit/<int:id>/', views.update_data,name="update"),
    path('items/',views.ItemView,name='items'),
    path('table',views.tableView,name='table'),
    path('invoicelist',views.InvoiceListView,name='invoicelist'),
    #path('',views.AddCustomer.as_view(),name='index')
    path('home/',views.home,name='home'),
    path('indexview/<int:id>/',views.IndexView,name='indexview'),
    path('email',views.email,name='email'),
    
    path('edit/<int:id>/',views.EditView,name='edit')
]