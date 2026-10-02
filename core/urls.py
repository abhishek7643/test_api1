from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.urls import path

from .views import about

def index(request):
    return render(request, 'core/index.html', {})


app_name = 'core'
urlpatterns = [
    path('', index, name='index'),
    path('about/', about, name='about'),
]
