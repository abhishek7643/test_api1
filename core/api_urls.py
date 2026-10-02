from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.urls import include, path
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.routers import DefaultRouter
from rest_framework.views import APIView

from core.models import (
    Collection,
    Environment,
    EnvironmentVariable,
    RequestHistory,
    SavedRequest,
)
from core.serializers import (
    CollectionSerializer,
    EnvironmentSerializer,
    EnvironmentVariableSerializer,
    RequestHistorySerializer,
    SavedRequestSerializer,
)


def get_user_filter(request):
    """
    Returns a Q object to filter records by either clerk_user_id or user.
    Enforces strict tenant isolation.
    """
    clerk_id = getattr(request, 'clerk_user_id', '') or ''
    if clerk_id:
        if request.user and request.user.is_authenticated:
            return Q(clerk_user_id=clerk_id) | Q(user=request.user)
        return Q(clerk_user_id=clerk_id)
    if request.user and request.user.is_authenticated:
        return Q(user=request.user)
    return Q(pk__isnull=True)


class HistoryListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = RequestHistory.objects.filter(get_user_filter(request))
        method = request.query_params.get('method')
        if method:
            qs = qs.filter(method__iexact=method.strip())
        status_code = request.query_params.get('status')
        if status_code:
            try:
                qs = qs.filter(status_code=int(status_code))
            except (ValueError, TypeError):
                pass
        search = request.query_params.get('search') or request.query_params.get('q')
        if search:
            qs = qs.filter(Q(url__icontains=search.strip()) | Q(method__icontains=search.strip()))

        limit = min(int(request.query_params.get('limit', 100)), 200)
        qs = qs.order_by('-executed_at')[:limit]
        serializer = RequestHistorySerializer(qs, many=True)
        return Response(serializer.data)

    def delete(self, request):
        deleted_count, _ = RequestHistory.objects.filter(get_user_filter(request)).delete()
        return Response({'deleted': deleted_count}, status=status.HTTP_200_OK)


class HistoryDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        qs = RequestHistory.objects.filter(get_user_filter(request))
        obj = get_object_or_404(qs, pk=pk)
        serializer = RequestHistorySerializer(obj)
        return Response(serializer.data)

    def delete(self, request, pk):
        qs = RequestHistory.objects.filter(get_user_filter(request))
        obj = get_object_or_404(qs, pk=pk)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CollectionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CollectionSerializer

    def get_queryset(self):
        return Collection.objects.filter(get_user_filter(self.request)).order_by('-updated_at')

    def get_object(self):
        qs = self.get_queryset()
        pk = self.kwargs.get('pk')
        return get_object_or_404(qs, pk=pk)

    def perform_create(self, serializer):
        clerk_id = getattr(self.request, 'clerk_user_id', '') or ''
        user = self.request.user if self.request.user and self.request.user.is_authenticated else None
        serializer.save(user=user, clerk_user_id=clerk_id)


class SavedRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = SavedRequestSerializer

    def get_queryset(self):
        qs = SavedRequest.objects.filter(get_user_filter(self.request))
        collection_id = self.request.query_params.get('collection', None)
        if collection_id is not None:
            if collection_id == 'null' or collection_id == '' or collection_id == 'none':
                qs = qs.filter(collection__isnull=True)
            else:
                try:
                    cid = int(collection_id)
                    qs = qs.filter(collection_id=cid)
                except (ValueError, TypeError):
                    pass
        return qs.order_by('-updated_at')

    def get_object(self):
        qs = self.get_queryset()
        pk = self.kwargs.get('pk')
        return get_object_or_404(qs, pk=pk)

    def _validate_collection(self, request, collection_value):
        if collection_value is None:
            return None
        if isinstance(collection_value, Collection):
            collection = collection_value
        else:
            try:
                collection = Collection.objects.get(pk=collection_value)
            except (Collection.DoesNotExist, TypeError, ValueError):
                return None

        # Verify collection ownership
        clerk_id = getattr(request, 'clerk_user_id', '')
        if clerk_id and collection.clerk_user_id and collection.clerk_user_id != clerk_id:
            return None
        if request.user and request.user.is_authenticated and collection.user_id and collection.user_id != request.user.id:
            return None
        return collection

    def perform_create(self, serializer):
        collection_value = serializer.validated_data.get('collection', None)
        collection = self._validate_collection(self.request, collection_value)
        if collection_value is not None and collection is None:
            serializer.validated_data['collection'] = None
        clerk_id = getattr(self.request, 'clerk_user_id', '') or ''
        user = self.request.user if self.request.user and self.request.user.is_authenticated else None
        serializer.save(user=user, clerk_user_id=clerk_id)

    def perform_update(self, serializer):
        if 'collection' in serializer.validated_data:
            collection_value = serializer.validated_data.get('collection', None)
            collection = self._validate_collection(self.request, collection_value)
            if collection_value is not None and collection is None:
                serializer.validated_data['collection'] = None
        serializer.save()


class EnvironmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = EnvironmentSerializer

    def get_queryset(self):
        return Environment.objects.filter(get_user_filter(self.request)).prefetch_related('variables').order_by('-updated_at')

    def get_object(self):
        qs = self.get_queryset()
        pk = self.kwargs.get('pk')
        return get_object_or_404(qs, pk=pk)

    def perform_create(self, serializer):
        clerk_id = getattr(self.request, 'clerk_user_id', '') or ''
        user = self.request.user if self.request.user and self.request.user.is_authenticated else None
        serializer.save(user=user, clerk_user_id=clerk_id)


class EnvironmentVariableViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = EnvironmentVariableSerializer

    def get_queryset(self):
        # Filter variables whose environment belongs to current user
        user_envs = Environment.objects.filter(get_user_filter(self.request))
        qs = EnvironmentVariable.objects.filter(environment__in=user_envs)
        env_id = self.request.query_params.get('environment')
        if env_id:
            try:
                qs = qs.filter(environment_id=int(env_id))
            except (ValueError, TypeError):
                pass
        return qs.order_by('key')

    def perform_create(self, serializer):
        env = serializer.validated_data.get('environment')
        user_envs = Environment.objects.filter(get_user_filter(self.request))
        if env not in user_envs:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have access to this environment.")
        serializer.save()

    def perform_update(self, serializer):
        env = serializer.validated_data.get('environment') or serializer.instance.environment
        user_envs = Environment.objects.filter(get_user_filter(self.request))
        if env not in user_envs:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have access to this environment.")
        serializer.save()


router = DefaultRouter()
router.register(r'collections', CollectionViewSet, basename='collection')
router.register(r'saved-requests', SavedRequestViewSet, basename='savedrequest')
router.register(r'environments', EnvironmentViewSet, basename='environment')
router.register(r'environment-variables', EnvironmentVariableViewSet, basename='environmentvariable')

urlpatterns = [
    path('history/', HistoryListView.as_view(), name='history-list'),
    path('history/<int:pk>/', HistoryDetailView.as_view(), name='history-detail'),
    path('', include(router.urls)),
]
