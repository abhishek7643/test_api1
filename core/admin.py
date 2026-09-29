from django.contrib import admin

from .models import Collection, RequestHistory, SavedRequest


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'created_at', 'updated_at')
    list_filter = ('user', 'created_at')
    search_fields = ('name', 'user__username')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(SavedRequest)
class SavedRequestAdmin(admin.ModelAdmin):
    list_display = ('name', 'method', 'user', 'collection', 'created_at', 'updated_at')
    list_filter = ('method', 'auth_type', 'user', 'collection', 'created_at')
    search_fields = ('name', 'url', 'user__username')
    readonly_fields = ('created_at', 'updated_at')
    raw_id_fields = ('user', 'collection')


@admin.register(RequestHistory)
class RequestHistoryAdmin(admin.ModelAdmin):
    list_display = ('executed_at', 'method', 'status_code', 'response_time_ms', 'user', 'url_short')
    list_filter = ('method', 'status_code', 'auth_type', 'user', 'executed_at')
    search_fields = ('url', 'user__username', 'error_type')
    readonly_fields = ('executed_at',)
    raw_id_fields = ('user',)
    date_hierarchy = 'executed_at'

    def url_short(self, obj):
        return obj.url[:120] + ('...' if len(obj.url) > 120 else '')
    url_short.short_description = 'URL'
