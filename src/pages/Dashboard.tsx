import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  LayersControl,
  Marker,
  Popup,
} from "react-leaflet";
import { Icon, type LatLngTuple, type LatLngBoundsExpression } from "leaflet";
import L from "leaflet";
import type { AxiosError } from "axios";
import {
  pipelineApi,
  satelliteImageApi,
  anomalyApi,
  notificationApi,
} from "@/lib/api";
import {
  type Pipeline,
  type SatelliteImage,
  type Anomaly,
  type Notification,
  // type GroupedAnalysisResults,
} from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  XCircle,
  Activity,
  User,
  Loader2,
  Gauge,
  Satellite,
  PanelLeftClose,
  PanelLeftOpen,
  BarChart3,
  Minimize2,
  Clock,
  AlertCircle,
  Radar,
  Layers,
  MapPin,
  Filter,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout } from "@/store/authSlice";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import "leaflet/dist/leaflet.css";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import AnalysisResultsCard from "@/components/AnalysisResults";
import { MapLegend } from "@/components/MapLegend";

// Fix for default marker icons in react-leaflet
delete (Icon.Default.prototype as { _getIconUrl?: () => string })._getIconUrl;
Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface SatelliteImageLayerProps {
  image: SatelliteImage;
  onLoadingStart: () => void;
  onLoadingEnd: () => void;
  onError: (error: string) => void;
  onSuccess: () => void;
}

function SatelliteImageLayer({
  image,
  onLoadingStart,
  onLoadingEnd,
  onError,
  onSuccess,
}: SatelliteImageLayerProps) {
  const map = useMap();
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [bbox, setBbox] = useState<{
    minx: number;
    miny: number;
    maxx: number;
    maxy: number;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let currentBbox: {
      minx: number;
      miny: number;
      maxx: number;
      maxy: number;
    } | null = null;

    if (image.bbox) {
      currentBbox = image.bbox;
    } else if (
      image.bbox_minx !== null &&
      image.bbox_miny !== null &&
      image.bbox_maxx !== null &&
      image.bbox_maxy !== null
    ) {
      currentBbox = {
        minx: image.bbox_minx,
        miny: image.bbox_miny,
        maxx: image.bbox_maxx,
        maxy: image.bbox_maxy,
      };
    }

    const isValidWGS84 = (bbox: {
      minx: number;
      miny: number;
      maxx: number;
      maxy: number;
    }) => {
      return (
        bbox.minx >= -180 &&
        bbox.minx <= 180 &&
        bbox.maxx >= -180 &&
        bbox.maxx <= 180 &&
        bbox.miny >= -90 &&
        bbox.miny <= 90 &&
        bbox.maxy >= -90 &&
        bbox.maxy <= 90 &&
        bbox.minx < bbox.maxx &&
        bbox.miny < bbox.maxy
      );
    };

    if (currentBbox && !isValidWGS84(currentBbox)) {
      console.warn("Invalid bbox coordinates, re-extracting:", currentBbox);
      currentBbox = null;
    }

    if (
      !currentBbox &&
      (image.is_cog_converted || image.original_tiff) &&
      !isProcessing
    ) {
      setIsProcessing(true);
      satelliteImageApi
        .extractBbox(image.id)
        .then((response) => {
          const extractedBbox = response.data.bbox || {
            minx: response.data.bbox_minx,
            miny: response.data.bbox_miny,
            maxx: response.data.bbox_maxx,
            maxy: response.data.bbox_maxy,
          };
          if (extractedBbox && isValidWGS84(extractedBbox)) {
            setBbox(extractedBbox);
          }
        })
        .catch((err) => {
          console.error("Error extracting bbox:", err);
        })
        .finally(() => {
          setIsProcessing(false);
        });
      return;
    }

    if (!currentBbox) {
      return;
    }

    setBbox(currentBbox);
  }, [image, isProcessing]);

  useEffect(() => {
    if (!bbox) {
      if (overlayRef.current) {
        try {
          map.removeLayer(overlayRef.current);
          overlayRef.current = null;
        } catch (e) {
          console.warn("Error removing overlay:", e);
        }
      }
      onLoadingEnd();
      return;
    }

    const bounds: LatLngBoundsExpression = [
      [bbox.miny, bbox.minx],
      [bbox.maxy, bbox.maxx],
    ];

    if (overlayRef.current) {
      try {
        map.removeLayer(overlayRef.current);
        overlayRef.current = null;
      } catch (e) {
        console.warn("Error removing existing overlay:", e);
      }
    }

    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const backendPort =
      hostname === "localhost" ? "8000" : window.location.port || "8000";
    const imageUrl = `${protocol}//${hostname}:${backendPort}/api/satellite-images/${image.id}/display_image/`;

    const loadImage = async () => {
      try {
        onLoadingStart();

        const axios = (await import("axios")).default;
        const { getAccessToken } = await import("@/lib/jwt");
        const token = getAccessToken();

        const imageResponse = await axios.get(imageUrl, {
          responseType: "blob",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          timeout: 30000,
        });

        const blob = imageResponse.data;
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;

        const overlay = L.imageOverlay(blobUrl, bounds, {
          opacity: 0.85,
          interactive: false,
          className: "satellite-image-overlay",
          zIndex: 1000,
        }).addTo(map);

        overlay.bringToFront();
        overlayRef.current = overlay;

        overlay.on("load", () => {
          onLoadingEnd();
          onSuccess();
          try {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
          } catch (e) {
            console.warn("Could not fit bounds:", e);
          }
        });

        overlay.on("error", (err) => {
          console.error("Error loading overlay:", err);
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
          }
          onError("Failed to display image overlay");
          onLoadingEnd();
        });
      } catch (error) {
        const axiosError = error as AxiosError;
        console.error("Error fetching satellite image:", axiosError);

        let errorMessage = "Failed to load satellite image";
        if (
          axiosError.response?.status === 401 ||
          axiosError.response?.status === 403
        ) {
          errorMessage = "Authentication failed. Please login again.";
        } else if (axiosError.response?.status === 404) {
          errorMessage = "Image file not found on server";
        } else if (axiosError.code === "ECONNABORTED") {
          errorMessage = "Request timeout. Image may be too large.";
        }

        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        onError(errorMessage);
        onLoadingEnd();
      }
    };

    loadImage();

    return () => {
      if (overlayRef.current) {
        try {
          map.removeLayer(overlayRef.current);
          overlayRef.current = null;
        } catch (e) {
          console.warn("Error removing overlay:", e);
        }
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [bbox, image, map, onLoadingStart, onLoadingEnd, onError, onSuccess]);

  return null;
}

interface MapBoundsUpdaterProps {
  geojson: GeoJSON.FeatureCollection | null;
}

function MapBoundsUpdater({ geojson }: MapBoundsUpdaterProps) {
  const map = useMap();

  useEffect(() => {
    if (!geojson) return;

    try {
      const geojsonLayer = L.geoJSON(geojson);
      const bounds = geojsonLayer.getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch (error) {
      console.error("Error fitting map bounds:", error);
    }
  }, [geojson, map]);

  return null;
}

interface MapResizeHandlerProps {
  isSidebarOpen: boolean;
  isStatsVisible: boolean;
}

function MapResizeHandler({
  isSidebarOpen,
  isStatsVisible,
}: MapResizeHandlerProps) {
  const map = useMap();
  const resizeRef = useRef<number | null>(null);

  useEffect(() => {
    if (resizeRef.current) {
      clearTimeout(resizeRef.current);
    }
    resizeRef.current = window.setTimeout(() => {
      try {
        map.invalidateSize();
      } catch (error) {
        console.error("Error invalidating map size:", error);
      }
    }, 300);

    return () => {
      if (resizeRef.current) {
        clearTimeout(resizeRef.current);
      }
    };
  }, [isSidebarOpen, isStatsVisible, map]);

  return null;
}

// Continuation from Part 1...
export default function Dashboard() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [satelliteImages, setSatelliteImages] = useState<SatelliteImage[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<string>("all");
  const [selectedImage, setSelectedImage] = useState<string>("all");
  const [pipelineGeoJSON, setPipelineGeoJSON] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageLoadingError, setImageLoadingError] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isStatsVisible, setIsStatsVisible] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [showAnomalies, setShowAnomalies] = useState(true);
  const [imageLoadProgress, setImageLoadProgress] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const notificationsResponse = await notificationApi.getAll({
        is_read: false,
      });
      const newNotifications =
        notificationsResponse.data.results || notificationsResponse.data;

      setNotifications((prevNotifications) => {
        if (newNotifications.length > prevNotifications.length) {
          toast.info(
            `${newNotifications.length} new notification${
              newNotifications.length !== 1 ? "s" : ""
            }`,
            { autoClose: 3000 }
          );
        }
        return newNotifications;
      });
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  }, []);

  const loadPipelineGeoJSON = useCallback(async (pipelineId: string) => {
    try {
      const response = await pipelineApi.getGeoJSON(pipelineId);
      if (
        response.data &&
        (response.data.type === "FeatureCollection" ||
          response.data.type === "Feature")
      ) {
        setPipelineGeoJSON(response.data);
      } else {
        console.error("Invalid GeoJSON format:", response.data);
        toast.error("Invalid GeoJSON file format");
        setPipelineGeoJSON(null);
      }
    } catch (error) {
      console.error("Failed to load GeoJSON:", error);
      toast.error("Failed to load pipeline GeoJSON");
      setPipelineGeoJSON(null);
    }
  }, []);

  const loadData = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const [pipelinesRes, imagesRes, anomaliesRes, notificationsRes] =
        await Promise.all([
          pipelineApi.getAll(),
          satelliteImageApi.getAll(),
          anomalyApi.getAll({ is_resolved: false }),
          notificationApi.getAll({ is_read: false }),
        ]);

      setPipelines(pipelinesRes.data.results || pipelinesRes.data);
      setSatelliteImages(imagesRes.data.results || imagesRes.data);
      setAnomalies(anomaliesRes.data.results || anomaliesRes.data);
      setNotifications(notificationsRes.data.results || notificationsRes.data);

      if (selectedPipeline !== "all") {
        await loadPipelineGeoJSON(selectedPipeline);
      }
    } catch (error) {
      toast.error("Failed to load dashboard data");
      console.error(error);
    } finally {
      setIsDataLoading(false);
    }
  }, [selectedPipeline, loadPipelineGeoJSON]);

  useEffect(() => {
    loadData();
    loadNotifications();
    const notificationsInterval = setInterval(loadNotifications, 30000);
    return () => clearInterval(notificationsInterval);
  }, [loadData, loadNotifications]);

  const handleLogout = async () => {
    await dispatch(logout());
    navigate("/login");
  };

  const filteredImages = useMemo(
    () =>
      selectedPipeline === "all"
        ? satelliteImages
        : satelliteImages.filter((img) => img.pipeline === selectedPipeline),
    [satelliteImages, selectedPipeline]
  );

  const displayedImage = useMemo(
    () =>
      selectedImage === "all"
        ? null
        : satelliteImages.find((img) => img.id === selectedImage),
    [satelliteImages, selectedImage]
  );

  const formatImageDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getSeverityBadgeColor = (severity: string | null) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "high":
        return "default";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  const handleImageLoadingStart = useCallback(() => {
    setIsImageLoading(true);
    setImageLoadingError("");
    setImageLoadProgress(0);

    const interval = setInterval(() => {
      setImageLoadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);
  }, []);

  const handleImageLoadingEnd = useCallback(() => {
    setImageLoadProgress(100);
    setTimeout(() => {
      setIsImageLoading(false);
      setImageLoadProgress(0);
    }, 500);
  }, []);

  const handleImageError = useCallback((error: string) => {
    setImageLoadingError(error);
    setIsImageLoading(false);
    setImageLoadProgress(0);
    toast.error(error, { autoClose: 5000 });
  }, []);

  const handleImageSuccess = useCallback(() => {
    toast.success("Satellite image loaded successfully", { autoClose: 2000 });
  }, []);

  const criticalAnomalies = useMemo(
    () => anomalies.filter((a) => a.severity === "critical").length,
    [anomalies]
  );
  const highAnomalies = useMemo(
    () => anomalies.filter((a) => a.severity === "high").length,
    [anomalies]
  );

  const totalAnomaliesCount = anomalies.length;
  const resolvedCount = anomalies.filter((a) => a.is_resolved).length;

  // Collect all unique legends from analysis results and mapped objects
  const allLegends = useMemo(() => {
    const legendsMap = new Map<string, any>();

    if (displayedImage?.grouped_analysis_results) {
      const results = displayedImage.grouped_analysis_results;

      // Add legends from oil spill detection
      if (results.oil_spill_detection?.legends) {
        results.oil_spill_detection.legends.forEach((legend) => {
          const key = `${legend.name}-${legend.color}`;
          if (!legendsMap.has(key)) {
            legendsMap.set(key, legend);
          }
        });
      }

      // Add legends from pipeline encroachment
      if (results.pipeline_encroachment?.legends) {
        results.pipeline_encroachment.legends.forEach((legend) => {
          const key = `${legend.name}-${legend.color}`;
          if (!legendsMap.has(key)) {
            legendsMap.set(key, legend);
          }
        });
      }

      // Add legends from object detection
      if (results.object_detection?.legends) {
        results.object_detection.legends.forEach((legend) => {
          const key = `${legend.name}-${legend.color}`;
          if (!legendsMap.has(key)) {
            legendsMap.set(key, legend);
          }
        });
      }
    }

    // Also add legends from mapped objects
    if (displayedImage?.mapped_objects_data) {
      displayedImage.mapped_objects_data.forEach((obj) => {
        if (obj.legend_category_data) {
          const legend = {
            name: obj.legend_category_data.name,
            color: obj.legend_category_data.color,
            icon: obj.legend_category_data.icon,
          };
          const key = `${legend.name}-${legend.color}`;
          if (!legendsMap.has(key)) {
            legendsMap.set(key, legend);
          }
        }
      });
    }

    return Array.from(legendsMap.values());
  }, [displayedImage]);

  // Get analysis results for the displayed image
  const analysisResults = displayedImage?.grouped_analysis_results;

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col bg-linear-to-br from-background via-background to-muted/20">
        {/* Header - Same as before */}
        <header className="bg-card/95 backdrop-blur-sm border-b border-border px-6 py-4 shadow-lg z-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="absolute inset-0 bg-linear-to-br from-blue-600 to-cyan-600 rounded-xl blur-md opacity-75 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative bg-linear-to-br from-blue-600 to-cyan-600 rounded-xl p-3 shadow-xl border-2 border-blue-400/50">
                  <div className="flex items-center justify-center">
                    <Radar className="h-6 w-6 text-white animate-pulse" />
                    <Layers className="h-4 w-4 text-white absolute -bottom-1 -right-1" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold bg-linear-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  PF-FlowSafe
                </h1>
                <p className="text-xs text-muted-foreground font-medium">
                  Pipeline Monitoring • {user?.username}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-muted"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  >
                    {isSidebarOpen ? (
                      <PanelLeftClose className="h-5 w-5" />
                    ) : (
                      <PanelLeftOpen className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-muted"
                    onClick={() => setIsStatsVisible(!isStatsVisible)}
                  >
                    {isStatsVisible ? (
                      <Minimize2 className="h-5 w-5" />
                    ) : (
                      <BarChart3 className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isStatsVisible ? "Hide stats" : "Show stats"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-muted"
                    onClick={() => loadData()}
                    disabled={isDataLoading}
                  >
                    <RefreshCw
                      className={`h-5 w-5 ${
                        isDataLoading ? "animate-spin" : ""
                      }`}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh data</TooltipContent>
              </Tooltip>
              <ThemeToggle />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative hover:bg-muted"
                    onClick={() => navigate("/notifications")}
                  >
                    <Bell className="h-5 w-5" />
                    {notifications.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-destructive text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
                        {notifications.length}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {notifications.length} unread notification
                  {notifications.length !== 1 ? "s" : ""}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-muted"
                    onClick={() => navigate("/profile")}
                  >
                    <User className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Profile settings</TooltipContent>
              </Tooltip>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="font-medium"
              >
                Logout
              </Button>
            </div>
          </div>
        </header>

        {/* Stats Cards - Same as before */}
        {isStatsVisible && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-linear-to-r from-muted/30 to-muted/10">
            {isDataLoading ? (
              <>
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </>
            ) : (
              <>
                <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-l-blue-500 bg-linear-to-br from-card to-card/80">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Gauge className="h-4 w-4 text-blue-500" />
                      </div>
                      Total Pipelines
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">
                      {pipelines.length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Monitoring active
                    </p>
                  </CardContent>
                </Card>
                <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-l-cyan-500 bg-linear-to-br from-card to-card/80">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                      <div className="p-2 bg-cyan-500/10 rounded-lg">
                        <Satellite className="h-4 w-4 text-cyan-500" />
                      </div>
                      Satellite Images
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-cyan-600">
                      {satelliteImages.length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      SAR acquisitions
                    </p>
                  </CardContent>
                </Card>
                <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-l-red-500 bg-linear-to-br from-card to-card/80">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                      <div className="p-2 bg-red-500/10 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
                      </div>
                      Critical Anomalies
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600">
                      {criticalAnomalies}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Requires immediate attention
                    </p>
                  </CardContent>
                </Card>
                <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-l-orange-500 bg-linear-to-br from-card to-card/80">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                      <div className="p-2 bg-orange-500/10 rounded-lg">
                        <Activity className="h-4 w-4 text-orange-500" />
                      </div>
                      High Priority
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-600">
                      {highAnomalies}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Priority investigations
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Main Content Area - To be continued in Part 3 */}
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Enhanced Sidebar */}
          {isSidebarOpen && (
            <aside className="w-96 border-r border-border overflow-y-auto shrink-0 p-6 space-y-6 bg-card/50 backdrop-blur-sm shadow-xl">
              {isDataLoading ? (
                <>
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-64 rounded-xl" />
                  ))}
                </>
              ) : (
                <>
                  {/* Filters Card */}
                  <Card className="shadow-lg border-2 hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-4 bg-linear-to-r from-primary/5 to-transparent rounded-t-lg">
                      <CardTitle className="text-base flex items-center gap-2 font-bold">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Filter className="h-4 w-4 text-primary" />
                        </div>
                        Filters
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-semibold mb-2 text-foreground flex items-center gap-2">
                          <Gauge className="h-3 w-3" />
                          Pipeline Selection
                        </label>
                        <Select
                          value={selectedPipeline}
                          onValueChange={(value: string) => {
                            setSelectedPipeline(value);
                            if (value !== "all") {
                              loadPipelineGeoJSON(value);
                            } else {
                              setPipelineGeoJSON(null);
                            }
                          }}
                        >
                          <SelectTrigger className="w-full bg-background hover:bg-muted transition-colors">
                            <SelectValue placeholder="Select pipeline" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              <div className="flex items-center gap-2">
                                <Layers className="h-3 w-3" />
                                All Pipelines
                              </div>
                            </SelectItem>
                            {pipelines.map((pipeline: Pipeline) => (
                              <SelectItem key={pipeline.id} value={pipeline.id}>
                                <div className="flex items-center gap-2">
                                  <Gauge className="h-3 w-3" />
                                  {pipeline.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedPipeline !== "all" && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {filteredImages.length} image
                            {filteredImages.length !== 1 ? "s" : ""} available
                          </p>
                        )}
                      </div>
                      <Separator />
                      <div>
                        <label className="text-sm font-semibold mb-2 text-foreground flex items-center gap-2">
                          <Satellite className="h-3 w-3" />
                          Satellite Image
                        </label>
                        <Select
                          value={selectedImage}
                          onValueChange={(value: string) => {
                            setSelectedImage(value);
                            setIsImageLoading(false);
                            setImageLoadingError("");
                          }}
                        >
                          <SelectTrigger className="w-full bg-background hover:bg-muted transition-colors">
                            <SelectValue placeholder="Select image" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              <div className="flex items-center gap-2">
                                <Eye className="h-3 w-3" />
                                No Image Overlay
                              </div>
                            </SelectItem>
                            {filteredImages.map((image: SatelliteImage) => (
                              <SelectItem key={image.id} value={image.id}>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <Satellite className="h-3 w-3" />
                                    <span className="truncate font-medium">
                                      {image.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {formatImageDate(image.created_at)}
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {displayedImage && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-2">
                            <p className="text-xs font-semibold">
                              Image Details:
                            </p>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Type:
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {displayedImage.image_type.toUpperCase()}
                                </Badge>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Status:
                                </span>
                                <Badge
                                  variant={
                                    displayedImage.is_cog_converted
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {displayedImage.is_cog_converted
                                    ? "COG Ready"
                                    : "Processing"}
                                </Badge>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Acquired:
                                </span>
                                <span className="font-medium">
                                  {formatImageDate(
                                    displayedImage.acquisition_date
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Analysis Results Cards */}
                  <Card className="shadow-lg border-2 hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-4 bg-linear-to-r from-cyan-500/5 to-transparent rounded-t-lg">
                      <CardTitle className="text-base flex items-center gap-2 font-bold">
                        <div className="p-2 bg-cyan-500/10 rounded-lg">
                          <BarChart3 className="h-4 w-4 text-cyan-500" />
                        </div>
                        Analysis Results
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[600px] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                        {selectedImage === "all" ? (
                          <div className="text-center py-12">
                            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                              <BarChart3 className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground font-medium">
                              Select a satellite image to view analysis results
                            </p>
                          </div>
                        ) : displayedImage ? (
                          analysisResults ? (
                            <>
                              {/* Oil Spill Detection Result */}
                              {analysisResults.oil_spill_detection && (
                                <AnalysisResultsCard
                                  type="oil_spill"
                                  data={analysisResults.oil_spill_detection}
                                />
                              )}

                              {/* Pipeline Encroachment Result */}
                              {analysisResults.pipeline_encroachment && (
                                <AnalysisResultsCard
                                  type="pipeline_encroachment"
                                  data={analysisResults.pipeline_encroachment}
                                />
                              )}

                              {/* Object Detection Result */}
                              {analysisResults.object_detection && (
                                <AnalysisResultsCard
                                  type="object_detection"
                                  data={analysisResults.object_detection}
                                />
                              )}

                              {/* No Results Message */}
                              {!analysisResults.oil_spill_detection &&
                                !analysisResults.pipeline_encroachment &&
                                !analysisResults.object_detection && (
                                  <div className="text-center py-12">
                                    <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                      <AlertCircle className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm text-muted-foreground font-medium mb-2">
                                      No analysis results available
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Run analysis to view detailed results
                                    </p>
                                  </div>
                                )}
                            </>
                          ) : (
                            <div className="text-center py-12">
                              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                <AlertCircle className="h-8 w-8 text-muted-foreground" />
                              </div>
                              <p className="text-sm text-muted-foreground font-medium mb-2">
                                No analysis results available
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Run analysis to view detailed results
                              </p>
                            </div>
                          )
                        ) : (
                          <div className="text-center py-12">
                            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                              <XCircle className="h-8 w-8 text-destructive" />
                            </div>
                            <p className="text-sm text-muted-foreground font-medium">
                              Selected image not found
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Anomalies List Card */}
                  <Card className="shadow-lg border-2 hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-4 bg-linear-to-r from-red-500/5 to-transparent rounded-t-lg">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2 font-bold">
                          <div className="p-2 bg-red-500/10 rounded-lg">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          </div>
                          Recent Anomalies
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAnomalies(!showAnomalies)}
                          className="h-8 w-8 p-0"
                        >
                          {showAnomalies ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="destructive" className="text-xs">
                          {totalAnomaliesCount} Total
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {resolvedCount} Resolved
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                        {anomalies.length > 0 ? (
                          anomalies.slice(0, 15).map((anomaly: Anomaly) => (
                            <Tooltip key={anomaly.id}>
                              <TooltipTrigger asChild>
                                <div
                                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                                    anomaly.severity === "critical"
                                      ? "border-red-200 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800 dark:hover:bg-red-900/30"
                                      : anomaly.severity === "high"
                                      ? "border-orange-200 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:border-orange-800 dark:hover:bg-orange-900/30"
                                      : "border-border bg-muted/50 hover:bg-muted"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <MapPin className="h-3 w-3 shrink-0" />
                                        <p className="font-semibold text-sm truncate">
                                          {anomaly.anomaly_type_display}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge
                                          variant={getSeverityBadgeColor(
                                            anomaly.severity
                                          )}
                                          className="text-xs"
                                        >
                                          {anomaly.severity_display}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {(
                                            anomaly.confidence_score * 100
                                          ).toFixed(0)}
                                          % confidence
                                        </span>
                                      </div>
                                    </div>
                                    <div className="shrink-0 ml-2">
                                      {anomaly.is_resolved ? (
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                      ) : (
                                        <XCircle className="h-5 w-5 text-red-500" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                <div className="space-y-1">
                                  <p className="font-semibold">
                                    {anomaly.anomaly_type_display}
                                  </p>
                                  <p className="text-xs">
                                    Confidence:{" "}
                                    {(anomaly.confidence_score * 100).toFixed(
                                      1
                                    )}
                                    %
                                  </p>
                                  <p className="text-xs">
                                    Location: {anomaly.location_lat.toFixed(4)},{" "}
                                    {anomaly.location_lon.toFixed(4)}
                                  </p>
                                  {anomaly.description && (
                                    <p className="text-xs text-muted-foreground">
                                      {anomaly.description}
                                    </p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ))
                        ) : (
                          <div className="text-center py-12">
                            <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                              <CheckCircle className="h-8 w-8 text-green-500" />
                            </div>
                            <p className="text-sm text-muted-foreground font-medium">
                              No anomalies detected
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              All systems normal
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </aside>
          )}

          {/* Map Container - Continue in Part 4 */}
          <main className="flex-1 relative overflow-hidden bg-muted/20">
            {/* Image Loading Indicator */}
            {isImageLoading && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-1001 bg-card/95 backdrop-blur-md border-2 border-primary/50 rounded-xl shadow-2xl px-6 py-4 min-w-[320px]">
                <div className="flex items-center gap-3 mb-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm font-semibold">
                    Loading Satellite Image
                  </span>
                </div>
                <Progress value={imageLoadProgress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {imageLoadProgress < 30
                    ? "Fetching image data..."
                    : imageLoadProgress < 60
                    ? "Processing..."
                    : imageLoadProgress < 90
                    ? "Rendering overlay..."
                    : "Almost done..."}
                </p>
              </div>
            )}

            {/* Image Loading Error */}
            {imageLoadingError && !isImageLoading && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-1001 bg-destructive/10 backdrop-blur-md border-2 border-destructive rounded-xl shadow-2xl px-6 py-4 min-w-[320px]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-destructive/20 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-destructive mb-1">
                      Image Loading Failed
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {imageLoadingError}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setImageLoadingError("");
                      if (displayedImage) {
                        setSelectedImage("all");
                        setTimeout(
                          () => setSelectedImage(displayedImage.id),
                          100
                        );
                      }
                    }}
                    className="shrink-0"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Map Controls Overlay */}
            <div className="absolute top-6 right-6 z-1000 flex flex-col gap-2">
              {displayedImage && (
                <Card className="shadow-lg bg-card/95 backdrop-blur-sm">
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Satellite className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold truncate max-w-[150px]">
                          {displayedImage.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatImageDate(displayedImage.acquisition_date)}
                      </div>
                      <Badge
                        variant="outline"
                        className="w-full justify-center text-xs"
                      >
                        {displayedImage.image_type.toUpperCase()}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Map Legend */}
            <MapLegend legends={allLegends} />

            {/* Leaflet Map */}
            <MapContainer
              center={[20, 0] as LatLngTuple}
              zoom={2}
              style={{ height: "100%", width: "100%" }}
              zoomControl={true}
              className="z-0"
            >
              <MapBoundsUpdater geojson={pipelineGeoJSON} />
              <MapResizeHandler
                isSidebarOpen={isSidebarOpen}
                isStatsVisible={isStatsVisible}
              />
              <LayersControl position="bottomright">
                <LayersControl.BaseLayer checked name="OpenStreetMap">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Satellite View">
                  <TileLayer
                    attribution="&copy; Esri"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Terrain">
                  <TileLayer
                    attribution="&copy; OpenTopoMap"
                    url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                  />
                </LayersControl.BaseLayer>

                {pipelineGeoJSON && (
                  <LayersControl.Overlay checked name="Pipeline Routes">
                    <GeoJSON
                      key={selectedPipeline}
                      data={pipelineGeoJSON}
                      style={{
                        color: "#3b82f6",
                        weight: 4,
                        opacity: 0.8,
                        dashArray: "10, 5",
                      }}
                      onEachFeature={(
                        feature: GeoJSON.Feature,
                        layer: L.Layer
                      ) => {
                        if (feature.properties) {
                          const popupContent = `
                            <div class="p-2">
                              <p class="font-bold mb-2 text-blue-600">Pipeline Information</p>
                              ${Object.keys(feature.properties)
                                .map(
                                  (key: string) =>
                                    `<div class="text-sm"><strong>${key}:</strong> ${String(
                                      feature.properties?.[key] ?? ""
                                    )}</div>`
                                )
                                .join("")}
                            </div>
                          `;
                          layer.bindPopup(popupContent);
                        }
                      }}
                    />
                  </LayersControl.Overlay>
                )}

                {displayedImage &&
                  (displayedImage.is_cog_converted ||
                    displayedImage.original_tiff) &&
                  (displayedImage.bbox ||
                    (displayedImage.bbox_minx !== null &&
                      displayedImage.bbox_miny !== null &&
                      displayedImage.bbox_maxx !== null &&
                      displayedImage.bbox_maxy !== null)) && (
                    <LayersControl.Overlay
                      checked
                      name={`SAR: ${displayedImage.name}`}
                    >
                      <SatelliteImageLayer
                        image={displayedImage}
                        onLoadingStart={handleImageLoadingStart}
                        onLoadingEnd={handleImageLoadingEnd}
                        onError={handleImageError}
                        onSuccess={handleImageSuccess}
                      />
                    </LayersControl.Overlay>
                  )}

                {/* Mapped Objects Layer */}
                {displayedImage &&
                  displayedImage.mapped_objects_data &&
                  displayedImage.mapped_objects_data.length > 0 && (
                    <LayersControl.Overlay checked name="Mapped Objects">
                      <>
                        {displayedImage.mapped_objects_data.map(
                          (obj) =>
                            obj.geojson_data && (
                              <GeoJSON
                                key={obj.id}
                                data={obj.geojson_data}
                                style={{
                                  color:
                                    obj.legend_category_data?.color ||
                                    "#FF0000",
                                  weight: 2,
                                  opacity: 0.8,
                                  fillOpacity: 0.4,
                                }}
                                onEachFeature={(
                                  _feature: GeoJSON.Feature,
                                  layer: L.Layer
                                ) => {
                                  layer.bindPopup(`
                                <div class="p-2">
                                  <h3 class="font-bold">${obj.name}</h3>
                                  <p class="text-sm">${
                                    obj.object_type_display
                                  }</p>
                                  ${
                                    obj.area_m2
                                      ? `<p class="text-xs">Area: ${obj.area_m2.toFixed(
                                          2
                                        )} m²</p>`
                                      : ""
                                  }
                                  ${
                                    obj.legend_category_data
                                      ? `
                                    <div class="flex items-center gap-2 mt-2">
                                      <div style="width: 12px; height: 12px; background-color: ${obj.legend_category_data.color}; border-radius: 50%;"></div>
                                      <span class="text-xs">${obj.legend_category_data.name}</span>
                                    </div>
                                  `
                                      : ""
                                  }
                                </div>
                              `);
                                }}
                              />
                            )
                        )}
                      </>
                    </LayersControl.Overlay>
                  )}

                {showAnomalies && anomalies.length > 0 && (
                  <LayersControl.Overlay checked name="Detected Anomalies">
                    <>
                      {anomalies.map((anomaly: Anomaly) => {
                        const iconUrl =
                          anomaly.severity === "critical"
                            ? "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png"
                            : anomaly.severity === "high"
                            ? "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png"
                            : anomaly.severity === "medium"
                            ? "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png"
                            : "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png";

                        const customIcon = new Icon({
                          iconUrl,
                          iconSize: [25, 41],
                          iconAnchor: [12, 41],
                          popupAnchor: [1, -34],
                          shadowUrl:
                            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
                          shadowSize: [41, 41],
                        });

                        const position: LatLngTuple = [
                          anomaly.location_lat,
                          anomaly.location_lon,
                        ];

                        return (
                          <Marker
                            key={anomaly.id}
                            position={position}
                            icon={customIcon}
                          >
                            <Popup>
                              <div className="p-2 min-w-[200px]">
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                                  <strong className="text-sm">
                                    {anomaly.anomaly_type_display}
                                  </strong>
                                </div>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      Severity:
                                    </span>
                                    <span className="font-semibold">
                                      {anomaly.severity_display}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      Confidence:
                                    </span>
                                    <span className="font-semibold">
                                      {(anomaly.confidence_score * 100).toFixed(
                                        1
                                      )}
                                      %
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      Status:
                                    </span>
                                    <span
                                      className={
                                        anomaly.is_resolved
                                          ? "text-green-600"
                                          : "text-red-600"
                                      }
                                    >
                                      {anomaly.is_resolved
                                        ? "Resolved"
                                        : "Active"}
                                    </span>
                                  </div>
                                  {anomaly.area_m2 && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">
                                        Area:
                                      </span>
                                      <span className="font-semibold">
                                        {anomaly.area_m2.toFixed(1)} m²
                                      </span>
                                    </div>
                                  )}
                                  {anomaly.description && (
                                    <div className="mt-2 pt-2 border-t">
                                      <p className="text-muted-foreground">
                                        Description:
                                      </p>
                                      <p className="mt-1">
                                        {anomaly.description}
                                      </p>
                                    </div>
                                  )}
                                  <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                                    <p>
                                      Lat: {anomaly.location_lat.toFixed(6)}
                                    </p>
                                    <p>
                                      Lon: {anomaly.location_lon.toFixed(6)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </Popup>
                          </Marker>
                        );
                      })}
                    </>
                  </LayersControl.Overlay>
                )}
              </LayersControl>
            </MapContainer>
          </main>
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: hsl(var(--muted));
          border-radius: 3px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--primary) / 0.5);
          border-radius: 3px;
          transition: background 0.2s;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--primary) / 0.7);
        }
        
        .satellite-image-overlay {
          transition: opacity 0.3s ease-in-out;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .leaflet-popup-content-wrapper {
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        }
        
        .leaflet-popup-tip {
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
      `}</style>
    </TooltipProvider>
  );
}
