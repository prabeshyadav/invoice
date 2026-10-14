from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views
from .api import RegisterView, router as api_router


urlpatterns = [
    path('', views.Customer, name="index"),
    path('invoice/',views.InvoiceView,name='invoice'),
    path('login/',views.loginPage,name='login'),
    path('logout/',views.logoutUser,name='logout'),
    path('register',views.register,name='register'),
    path('reset',views.ResetPassword,name='reset'),
    path('delete/<int:id>/', views.DeleteCustomer,name="delete_customer"),
    path('items/',views.ItemView,name='items'),
    path('table',views.tableView,name='table'),
    path('invoicelist',views.InvoiceListView,name='invoicelist'),
    path('customerview/<int:id>/',views.CustomerViewPage,name='customerview'),
    path('home/',views.home,name='home'),
    path('invoice-detail/<int:id>/',views.IndexView,name='indexview'),
    path('email',views.email,name='email'),
    
    path('edit/<int:id>/',views.EditView,name='edit'),
    path('editcustomer/<int:id>',views.EditCustomer,name='editcustomer'),
    
    path('pdf/<int:id>/',views.pdf,name='PfdMd'),

    # REST API (JWT) — HTML views above are untouched.
    path('api/auth/register/', RegisterView.as_view(), name='api-register'),
    path('api/auth/token/', TokenObtainPairView.as_view(), name='api-token'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='api-token-refresh'),
    path('api/', include(api_router.urls)),
]