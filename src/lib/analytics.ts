import type { PostHog } from 'posthog-js'

export type BoothViewSource =
  | 'map'
  | 'search_results'
  | 'booth_list'
  | 'route_sidebar'
  | 'route_mobile'

export type BoothSaveSource = 'search_results' | 'booth_list' | 'booth_detail'
export type RouteSurface = 'sidebar' | 'mobile'
export type RouteToggleSurface = 'desktop_sidebar' | 'mobile_controls'

type AnalyticsEvents = {
  booth_search_completed: {
    query_length: number
    result_count: number
    has_results: boolean
  }
  booth_viewed: {
    booth_id: string
    source: BoothViewSource
    position?: number
    result_count?: number
  }
  booth_save_changed: {
    booth_id: string
    action: 'add' | 'remove'
    source: BoothSaveSource
    saved_count: number
  }
  route_viewed: { surface: RouteSurface; saved_count: number }
  route_reordered: {
    surface: RouteSurface
    saved_count: number
    from_position: number
    to_position: number
  }
  route_map_visibility_changed: {
    visible: boolean
    saved_count: number
    surface: RouteToggleSurface
  }
  map_control_used: { control: 'zoom_in' | 'zoom_out' | 'reset' }
  booth_memo_saved: { booth_id: string; memo_length: number; has_content: boolean }
  booth_photo_changed: {
    booth_id: string
    action: 'add' | 'remove'
    photo_count: number
    changed_count: number
  }
  booth_photo_failed: {
    booth_id: string
    reason: 'invalid_type' | 'quota' | 'load_failed' | 'storage_failure'
  }
  data_backup_exported: { saved_booth_count: number; memo_count: number; photo_count: number }
  data_backup_imported: { saved_booth_count: number; memo_count: number; photo_count: number }
  data_backup_failed: {
    action: 'export' | 'import'
    reason: 'archive_creation' | 'archive_read' | 'restore'
  }
}

export function captureEvent<EventName extends keyof AnalyticsEvents>(
  posthog: PostHog,
  event: EventName,
  properties: AnalyticsEvents[EventName],
) {
  posthog.capture(event, properties)
}
