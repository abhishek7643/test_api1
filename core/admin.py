from django.contrib import admin

from .models import (
    Collection,
    Environment,
    EnvironmentVariable,
    RequestHistory,
    SavedRequest,
)


class EnvironmentVariableInline(admin.TabularInline):
    model = EnvironmentVariable
    extra = 1


@admin.register(Environment)
class EnvironmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'clerk_user_id', 'user', 'created_at', 'updated_at')
    list_filter = ('created_at',)
    search_fields = ('name', 'clerk_user_id', 'user__username')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [EnvironmentVariableInline]


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ('name', 'clerk_user_id', 'user', 'created_at', 'updated_at')
    list_filter = ('created_at',)
    search_fields = ('name', 'clerk_user_id', 'user__username')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(SavedRequest)
class SavedRequestAdmin(admin.ModelAdmin):
    list_display = ('name', 'method', 'clerk_user_id', 'user', 'collection', 'created_at', 'updated_at')
    list_filter = ('method', 'auth_type', 'collection', 'created_at')
    search_fields = ('name', 'url', 'clerk_user_id', 'user__username')
    readonly_fields = ('created_at', 'updated_at')
    raw_id_fields = ('user', 'collection')


@admin.register(RequestHistory)
class RequestHistoryAdmin(admin.ModelAdmin):
    list_display = ('executed_at', 'method', 'status_code', 'response_time_ms', 'response_size_bytes', 'clerk_user_id', 'user', 'url_short')
    list_filter = ('method', 'status_code', 'auth_type', 'executed_at')
    search_fields = ('url', 'clerk_user_id', 'user__username', 'error_type')
    readonly_fields = ('executed_at',)
    raw_id_fields = ('user',)
    date_hierarchy = 'executed_at'

    def url_short(self, obj):
        return obj.url[:120] + ('...' if len(obj.url) > 120 else '')
    url_short.short_description = 'URL'

