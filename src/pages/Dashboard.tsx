import { useEffect, useState, useCallback, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  LayersControl,
  Marker,
  Popup,
} from "react-leaflet";
import { Icon, type LatLngTuple } from "leaflet";
import L from "leaflet";
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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout } from "@/store/authSlice";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import "leaflet/dist/leaflet.css";

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
}

function SatelliteImageLayer({ image }: SatelliteImageLayerProps) {
  const map = useMap();
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const [bbox, setBbox] = useState<{
    minx: number;
    miny: number;
    maxx: number;
    maxy: number;
  } | null>(null);

  useEffect(() => {
    // First, check if we have bbox data
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

    // Validate bbox coordinates are in WGS84 (lat/lon) format
    // Longitude should be between -180 and 180, latitude between -90 and 90
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

    // If bbox exists but coordinates look like projected (UTM) instead of WGS84, trigger re-extraction
    if (currentBbox && !isValidWGS84(currentBbox)) {
      console.warn(
        "Bbox coordinates appear to be in projected CRS, re-extracting with WGS84 transformation:",
        currentBbox
      );
      currentBbox = null; // Force re-extraction
    }

    // If no bbox, try to extract it using the extract_bbox endpoint
    if (!currentBbox && (image.is_cog_converted || image.original_tiff)) {
      satelliteImageApi
        .extractBbox(image.id)
        .then((response) => {
          if (
            response.data.bbox ||
            (response.data.bbox_minx &&
              response.data.bbox_miny &&
              response.data.bbox_maxx &&
              response.data.bbox_maxy)
          ) {
            const extractedBbox = response.data.bbox || {
              minx: response.data.bbox_minx,
              miny: response.data.bbox_miny,
              maxx: response.data.bbox_maxx,
              maxy: response.data.bbox_maxy,
            };
            setBbox(extractedBbox);
            console.log("Bbox extracted successfully:", extractedBbox);
          }
        })
        .catch((err) => {
          console.error("Error extracting bbox:", err);
          // Try display_image endpoint as fallback (it also extracts bbox)
          const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
          const imageUrl = `${API_BASE_URL}/satellite-images/${image.id}/display_image/`;
          fetch(imageUrl)
            .then(() => {
              // Wait a bit and reload image data
              setTimeout(() => {
                satelliteImageApi
                  .getById(image.id)
                  .then((res) => {
                    if (
                      res.data.bbox ||
                      (res.data.bbox_minx &&
                        res.data.bbox_miny &&
                        res.data.bbox_maxx &&
                        res.data.bbox_maxy)
                    ) {
                      setBbox(
                        res.data.bbox || {
                          minx: res.data.bbox_minx,
                          miny: res.data.bbox_miny,
                          maxx: res.data.bbox_maxx,
                          maxy: res.data.bbox_maxy,
                        }
                      );
                    }
                  })
                  .catch(() => {});
              }, 500);
            })
            .catch((fetchErr) => {
              console.error("Error accessing display_image:", fetchErr);
            });
        });
      return;
    }

    if (!currentBbox) {
      console.warn("Satellite image missing bbox data:", {
        name: image.name,
        is_cog_converted: image.is_cog_converted,
        conversion_status: image.conversion_status,
      });
      return;
    }

    setBbox(currentBbox);
  }, [image, map]);

  useEffect(() => {
    if (!bbox) {
      // Clean up any existing overlay when bbox is cleared
      if (overlayRef.current) {
        try {
          map.removeLayer(overlayRef.current);
          overlayRef.current = null;
        } catch (e) {
          console.warn("Error removing overlay:", e);
        }
      }
      return;
    }

    const bounds: L.LatLngBoundsExpression = [
      [bbox.miny, bbox.minx],
      [bbox.maxy, bbox.maxx],
    ];

    // Use the display_image endpoint that converts TIFF to PNG for browser display
    // Construct the correct backend URL - Django is typically on port 8000
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    // Use port 8000 for Django backend, or current port if different
    const backendPort =
      hostname === "localhost" ? "8000" : window.location.port || "8000";
    const imageUrl = `${protocol}//${hostname}:${backendPort}/api/satellite-images/${image.id}/display_image/`;

    console.log("Image URL constructed:", {
      imageUrl,
      hostname,
      port: backendPort,
      currentHost: window.location.host,
    });

    // Clean up any existing overlay first
    if (overlayRef.current) {
      try {
        map.removeLayer(overlayRef.current);
        overlayRef.current = null;
      } catch (e) {
        console.warn("Error removing existing overlay:", e);
      }
    }

    // Create the overlay directly - Leaflet will handle loading
    // Note: We don't need to preload since L.imageOverlay handles it
    try {
      const overlay = L.imageOverlay(imageUrl, bounds, {
        opacity: 1.0, // Full opacity for better visibility
        interactive: false,
        className: "satellite-image-overlay",
        zIndex: 1000, // Ensure it's above base layers
        attribution: `Satellite Image: ${image.name}`,
      }).addTo(map);

      // Force the overlay to bring itself to front
      overlay.bringToFront();

      overlayRef.current = overlay;

      console.log("Added satellite image overlay:", {
        url: imageUrl,
        bounds: bounds,
        imageName: image.name,
        bounds_string: `[[${bbox.miny}, ${bbox.minx}], [${bbox.maxy}, ${bbox.maxx}]]`,
        overlayAdded: true,
        mapHasLayer: map.hasLayer(overlay),
      });

      // Listen for when the image loads
      overlay.on("load", () => {
        console.log("Satellite image overlay loaded successfully", {
          url: imageUrl,
          bounds: bounds,
          element: overlay.getElement(),
        });
        // Try to fit bounds to the image after it loads
        try {
          map.fitBounds(bounds, { padding: [20, 20] });
        } catch (e) {
          console.warn("Could not fit bounds:", e);
        }
      });

      overlay.on("error", (err) => {
        console.error("Error loading satellite image overlay:", {
          url: imageUrl,
          error: err,
          imageId: image.id,
        });
      });

      // Check if the overlay element exists in the DOM and verify image loaded
      setTimeout(() => {
        const element = overlay.getElement();
        if (element) {
          const img = element as HTMLImageElement;
          console.log("Overlay element found in DOM:", {
            src: img.src,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            width: img.width,
            height: img.height,
            complete: img.complete,
            style: img.style.cssText,
            bounds: bounds,
          });

          // If image is complete, verify it loaded correctly
          if (img.complete) {
            if (img.naturalWidth === 0 || img.naturalHeight === 0) {
              console.error("Image failed to load - natural dimensions are 0");
              // Try to reload the image
              const newUrl = `${imageUrl}?t=${Date.now()}`;
              overlay.setUrl(newUrl);
            } else {
              console.log("Image loaded successfully:", {
                naturalDimensions: `${img.naturalWidth}x${img.naturalHeight}`,
                displayDimensions: `${img.width}x${img.height}`,
              });
            }
          } else {
            console.log("Image still loading...");
            img.onload = () => {
              console.log("Image loaded event fired:", {
                naturalDimensions: `${img.naturalWidth}x${img.naturalHeight}`,
              });
            };
            img.onerror = () => {
              console.error("Image failed to load from:", img.src);
            };
          }
        } else {
          console.warn("Overlay element not found in DOM");
        }
      }, 500); // Increased timeout to allow image to load

      // Also try to fit bounds immediately
      try {
        map.fitBounds(bounds, { padding: [20, 20] });
      } catch (e) {
        console.warn("Could not fit bounds:", e);
      }
    } catch (error) {
      console.error("Error creating image overlay:", error);
    }

    return () => {
      if (overlayRef.current) {
        try {
          map.removeLayer(overlayRef.current);
          overlayRef.current = null;
        } catch (e) {
          console.warn("Error removing overlay:", e);
        }
      }
    };
  }, [bbox, image, map]);

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
      // Create a GeoJSON layer temporarily to get bounds
      const geojsonLayer = L.geoJSON(geojson);
      const bounds = geojsonLayer.getBounds();

      // Only fit bounds if they are valid
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch (error) {
      console.error("Error fitting map bounds:", error);
    }
  }, [geojson, map]);

  return null;
}

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

  const loadNotifications = useCallback(async () => {
    try {
      const response = await notificationApi.getAll({ is_read: false });
      const newNotifications = response.data.results || response.data;
      setNotifications((prevNotifications) => {
        if (newNotifications.length > prevNotifications.length) {
          toast.info(`You have ${newNotifications.length} new notifications`);
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
      // Ensure we have valid GeoJSON data
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

      // Load GeoJSON for selected pipeline
      if (selectedPipeline !== "all") {
        loadPipelineGeoJSON(selectedPipeline);
      }
    } catch (error) {
      toast.error("Failed to load data");
      console.error(error);
    }
  }, [selectedPipeline, loadPipelineGeoJSON]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadNotifications, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [loadData, loadNotifications]);

  const handleLogout = async () => {
    await dispatch(logout());
    navigate("/login");
  };

  const filteredImages =
    selectedPipeline === "all"
      ? satelliteImages
      : satelliteImages.filter((img) => img.pipeline === selectedPipeline);

  const displayedImage =
    selectedImage === "all"
      ? null
      : satelliteImages.find((img) => img.id === selectedImage);

  // Debug: Log displayed image info and extract bbox if missing
  useEffect(() => {
    if (displayedImage) {
      console.log("Displayed Image:", {
        id: displayedImage.id,
        name: displayedImage.name,
        is_cog_converted: displayedImage.is_cog_converted,
        cog_url: displayedImage.cog_url,
        original_url: displayedImage.original_url,
        bbox: displayedImage.bbox,
        bbox_fields: {
          minx: displayedImage.bbox_minx,
          miny: displayedImage.bbox_miny,
          maxx: displayedImage.bbox_maxx,
          maxy: displayedImage.bbox_maxy,
        },
        conversion_status: displayedImage.conversion_status,
      });

      // If bbox is missing, try to trigger extraction by accessing display_image endpoint
      // This will extract bbox on the backend if missing
      const hasBbox =
        displayedImage.bbox ||
        (displayedImage.bbox_minx !== null &&
          displayedImage.bbox_miny !== null &&
          displayedImage.bbox_maxx !== null &&
          displayedImage.bbox_maxy !== null);

      if (
        !hasBbox &&
        (displayedImage.is_cog_converted || displayedImage.original_tiff)
      ) {
        // Access display_image endpoint which will extract bbox if missing
        const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
        const imageUrl = `${API_BASE_URL}/satellite-images/${displayedImage.id}/display_image/`;
        // Create a hidden image to trigger bbox extraction
        const img = new Image();
        img.onload = () => {
          console.log(
            "Image loaded, bbox should be extracted now. Refreshing data..."
          );
          // Reload satellite images to get updated bbox
          setTimeout(() => {
            loadData();
          }, 1000);
        };
        img.onerror = (err: Event | string) => {
          console.error("Error loading display image:", err);
        };
        img.src = imageUrl;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedImage]);

  const criticalAnomalies = anomalies.filter(
    (a) => a.severity === "critical"
  ).length;
  const highAnomalies = anomalies.filter((a) => a.severity === "high").length;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Pipeline Monitoring Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Welcome, {user?.username}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="relative">
              <Button variant="outline" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/profile")}
              size="icon"
            >
              <User className="h-5 w-5" />
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pipelines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {pipelines.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Satellite Images
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {satelliteImages.length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Critical Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {criticalAnomalies}
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600 dark:text-orange-400 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              High Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {highAnomalies}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls and Map */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 overflow-hidden">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4 overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Pipeline
                </label>
                <Select
                  value={selectedPipeline}
                  onValueChange={(value) => {
                    setSelectedPipeline(value);
                    if (value !== "all") {
                      loadPipelineGeoJSON(value);
                    } else {
                      setPipelineGeoJSON(null);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Pipelines</SelectItem>
                    {pipelines.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Satellite Image
                </label>
                <Select value={selectedImage} onValueChange={setSelectedImage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select image" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">No Image</SelectItem>
                    {filteredImages.map((image) => (
                      <SelectItem key={image.id} value={image.id}>
                        {image.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Anomalies List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Anomalies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {anomalies.slice(0, 10).map((anomaly) => (
                  <div
                    key={anomaly.id}
                    className={`p-3 rounded-lg border ${
                      anomaly.severity === "critical"
                        ? "border-red-200 bg-red-50 dark:bg-red-900/20"
                        : anomaly.severity === "high"
                        ? "border-orange-200 bg-orange-50 dark:bg-orange-900/20"
                        : "border-gray-200 bg-gray-50 dark:bg-gray-800"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {anomaly.anomaly_type_display}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {anomaly.severity_display}
                        </p>
                      </div>
                      {anomaly.is_resolved ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                ))}
                {anomalies.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No anomalies detected
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map */}
        <div className="lg:col-span-3 rounded-lg overflow-hidden border border-border relative">
          <MapContainer
            center={[20, 0]}
            zoom={2}
            style={{ height: "100%", width: "100%" }}
            zoomControl={true}
          >
            <MapBoundsUpdater geojson={pipelineGeoJSON} />
            <LayersControl position="topright">
              {/* Base Layers */}
              <LayersControl.BaseLayer checked name="OpenStreetMap">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>

              <LayersControl.BaseLayer name="Satellite">
                <TileLayer
                  attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.mapbox.com/about/maps/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              </LayersControl.BaseLayer>

              <LayersControl.BaseLayer name="Terrain">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://www.openstreetmap.org/copyright">OpenTopoMap</a>'
                  url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>

              {/* Overlays */}
              {pipelineGeoJSON && (
                <LayersControl.Overlay checked name="Pipeline Routes">
                  <GeoJSON
                    key={selectedPipeline}
                    data={pipelineGeoJSON}
                    style={{
                      color: "#3b82f6",
                      weight: 3,
                      opacity: 0.8,
                    }}
                    onEachFeature={(
                      feature: GeoJSON.Feature,
                      layer: L.Layer
                    ) => {
                      if (feature.properties) {
                        const popupContent = Object.keys(feature.properties)
                          .map(
                            (key) =>
                              `<strong>${key}:</strong> ${String(
                                feature.properties?.[key] ?? ""
                              )}`
                          )
                          .join("<br>");
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
                  <LayersControl.Overlay checked name={displayedImage.name}>
                    <SatelliteImageLayer image={displayedImage} />
                  </LayersControl.Overlay>
                )}

              {anomalies.length > 0 && (
                <LayersControl.Overlay checked name="Anomalies">
                  {anomalies.map((anomaly) => {
                    const iconUrl =
                      anomaly.severity === "critical"
                        ? "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png"
                        : anomaly.severity === "high"
                        ? "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png"
                        : "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";

                    const customIcon = new Icon({
                      iconUrl,
                      iconSize: [25, 41],
                      iconAnchor: [12, 41],
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
                          <div>
                            <strong>{anomaly.anomaly_type_display}</strong>
                            <br />
                            Severity: {anomaly.severity_display}
                            <br />
                            Confidence:{" "}
                            {(anomaly.confidence_score * 100).toFixed(1)}%
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </LayersControl.Overlay>
              )}
            </LayersControl>
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
