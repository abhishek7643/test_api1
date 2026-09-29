from django.shortcuts import get_object_or_404
from django.urls import path, include
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.routers import DefaultRouter

from core.models import Collection, RequestHistory, SavedRequest
from core.serializers import (
    CollectionSerializer,
    RequestHistorySerializer,
    SavedRequestSerializer,
)


class HistoryListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = RequestHistory.objects.filter(user=request.user).order_by('-executed_at')[:50]
        serializer = RequestHistorySerializer(qs, many=True)
        return Response(serializer.data)

    def delete(self, request):
        RequestHistory.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class HistoryDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        qs = RequestHistory.objects.filter(user=request.user)
        obj = get_object_or_404(qs, pk=pk)
        serializer = RequestHistorySerializer(obj)
        return Response(serializer.data)

    def delete(self, request, pk):
        qs = RequestHistory.objects.filter(user=request.user)
        obj = get_object_or_404(qs, pk=pk)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CollectionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CollectionSerializer

    def get_queryset(self):
        return Collection.objects.filter(user=self.request.user)

    def get_object(self):
        qs = self.get_queryset()
        pk = self.kwargs.get('pk')
        return get_object_or_404(qs, pk=pk)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SavedRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = SavedRequestSerializer

    def get_queryset(self):
        qs = SavedRequest.objects.filter(user=self.request.user)
        collection_id = self.request.query_params.get('collection', None)
        if collection_id is not None:
            if collection_id == 'null' or collection_id == '':
                qs = qs.filter(collection__isnull=True)
            else:
                try:
                    cid = int(collection_id)
                    qs = qs.filter(collection_id=cid)
                except (ValueError, TypeError):
                    pass
        return qs

    def get_object(self):
        qs = self.get_queryset()
        pk = self.kwargs.get('pk')
        return get_object_or_404(qs, pk=pk)

    def _validate_collection(self, user, collection_value):
        if collection_value is None:
            return None
        if isinstance(collection_value, Collection):
            collection = collection_value
        else:
            try:
                collection = Collection.objects.get(pk=collection_value)
            except (Collection.DoesNotExist, TypeError, ValueError):
                return None
        if collection.user_id != user.id:
            return None
        return collection

    def perform_create(self, serializer):
        collection_value = serializer.validated_data.get('collection', None)
        collection = self._validate_collection(self.request.user, collection_value)
        if collection_value is not None and collection is None:
            serializer.validated_data['collection'] = None
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        if 'collection' in serializer.validated_data:
            collection_value = serializer.validated_data.get('collection', None)
            collection = self._validate_collection(self.request.user, collection_value)
            if collection_value is not None and collection is None:
                serializer.validated_data['collection'] = None
        serializer.save()


router = DefaultRouter()
router.register(r'collections', CollectionViewSet, basename='collection')
router.register(r'saved-requests', SavedRequestViewSet, basename='savedrequest')

urlpatterns = [
    path('history/', HistoryListView.as_view(), name='history-list'),
    path('history/<int:pk>/', HistoryDetailView.as_view(), name='history-detail'),
    path('', include(router.urls)),
]
