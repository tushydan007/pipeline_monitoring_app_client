export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface Pipeline {
  id: string;
  user: string;
  name: string;
  description: string;
  geojson_file: string;
  status: "active" | "inactive" | "maintenance";
  length_km: number | null;
  satellite_images_count: number;
  created_at: string;
  updated_at: string;
}

export interface SatelliteImage {
  id: string;
  user: string;
  pipeline: string | null;
  pipeline_name: string | null;
  name: string;
  description: string;
  original_tiff: string;
  original_url: string | null;
  cog_tiff: string | null;
  cog_url: string | null;
  acquisition_date: string;
  image_type: "optical" | "sar" | "thermal" | "multispectral";
  is_cog_converted: boolean;
  conversion_status: "pending" | "processing" | "completed" | "failed";
  bbox: {
    minx: number;
    miny: number;
    maxx: number;
    maxy: number;
  } | null;
  bbox_minx: number | null;
  bbox_miny: number | null;
  bbox_maxx: number | null;
  bbox_maxy: number | null;
  analyses_count: number;
  created_at: string;
  updated_at: string;
}

export interface Analysis {
  id: string;
  user: string;
  satellite_image: string;
  satellite_image_name: string;
  pipeline: string | null;
  pipeline_name: string | null;
  analysis_type: string;
  analysis_type_display: string;
  status: "pending" | "processing" | "completed" | "failed";
  confidence_score: number | null;
  severity: "low" | "medium" | "high" | "critical" | null;
  severity_display: string | null;
  results_json: Record<string, unknown>;
  metadata: Record<string, unknown>;
  processing_time_seconds: number | null;
  error_message: string;
  anomalies_count: number;
  created_at: string;
  updated_at: string;
}

export interface Anomaly {
  id: string;
  analysis: string;
  user: string;
  analysis_type: string;
  satellite_image_name: string;
  anomaly_type: string;
  anomaly_type_display: string;
  severity: "low" | "medium" | "high" | "critical";
  severity_display: string;
  location_lat: number;
  location_lon: number;
  area_m2: number | null;
  description: string;
  confidence_score: number;
  is_verified: boolean;
  is_resolved: boolean;
  verified_by: number | null;
  verified_by_username: string | null;
  verified_at: string | null;
  resolved_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user: string;
  anomaly: string | null;
  anomaly_type: string | null;
  notification_type: "email" | "push" | "both";
  notification_type_display: string;
  title: string;
  message: string;
  is_read: boolean;
  is_sent: boolean;
  sent_at: string | null;
  read_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}
