// import { useEffect, useState, useCallback, useRef } from "react";
// import {
//   MapContainer,
//   TileLayer,
//   GeoJSON,
//   useMap,
//   LayersControl,
//   Marker,
//   Popup,
// } from "react-leaflet";
// import { Icon, type LatLngTuple } from "leaflet";
// import L from "leaflet";
// import type { AxiosError } from "axios";
// import {
//   pipelineApi,
//   satelliteImageApi,
//   anomalyApi,
//   notificationApi,
//   analysisApi,
// } from "@/lib/api";
// import {
//   type Pipeline,
//   type SatelliteImage,
//   type Anomaly,
//   type Notification,
//   type Analysis,
// } from "@/types";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { toast } from "react-toastify";
// import {
//   AlertTriangle,
//   Bell,
//   CheckCircle,
//   XCircle,
//   Activity,
//   User,
//   Loader2,
//   Gauge,
//   Satellite,
//   PanelLeftClose,
//   PanelLeftOpen,
//   BarChart3,
//   Minimize2,
//   FileText,
//   TrendingUp,
//   Clock,
// } from "lucide-react";
// import { useNavigate } from "react-router-dom";
// import { useAppDispatch, useAppSelector } from "@/store/hooks";
// import { logout } from "@/store/authSlice";
// import { ThemeToggle } from "@/components/ui/theme-toggle";
// import "leaflet/dist/leaflet.css";

// // Fix for default marker icons in react-leaflet
// delete (Icon.Default.prototype as { _getIconUrl?: () => string })._getIconUrl;
// Icon.Default.mergeOptions({
//   iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
//   iconRetinaUrl:
//     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
//   shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
// });

// interface SatelliteImageLayerProps {
//   image: SatelliteImage;
//   onLoadingStart?: () => void;
//   onLoadingEnd?: () => void;
//   onError?: () => void;
// }

// function SatelliteImageLayer({
//   image,
//   onLoadingStart,
//   onLoadingEnd,
//   onError,
// }: SatelliteImageLayerProps) {
//   const map = useMap();
//   const overlayRef = useRef<L.ImageOverlay | null>(null);
//   const blobUrlRef = useRef<string | null>(null);
//   const [bbox, setBbox] = useState<{
//     minx: number;
//     miny: number;
//     maxx: number;
//     maxy: number;
//   } | null>(null);

//   useEffect(() => {
//     // First, check if we have bbox data
//     let currentBbox: {
//       minx: number;
//       miny: number;
//       maxx: number;
//       maxy: number;
//     } | null = null;

//     if (image.bbox) {
//       currentBbox = image.bbox;
//     } else if (
//       image.bbox_minx !== null &&
//       image.bbox_miny !== null &&
//       image.bbox_maxx !== null &&
//       image.bbox_maxy !== null
//     ) {
//       currentBbox = {
//         minx: image.bbox_minx,
//         miny: image.bbox_miny,
//         maxx: image.bbox_maxx,
//         maxy: image.bbox_maxy,
//       };
//     }

//     // Validate bbox coordinates are in WGS84 (lat/lon) format
//     // Longitude should be between -180 and 180, latitude between -90 and 90
//     const isValidWGS84 = (bbox: {
//       minx: number;
//       miny: number;
//       maxx: number;
//       maxy: number;
//     }) => {
//       return (
//         bbox.minx >= -180 &&
//         bbox.minx <= 180 &&
//         bbox.maxx >= -180 &&
//         bbox.maxx <= 180 &&
//         bbox.miny >= -90 &&
//         bbox.miny <= 90 &&
//         bbox.maxy >= -90 &&
//         bbox.maxy <= 90 &&
//         bbox.minx < bbox.maxx &&
//         bbox.miny < bbox.maxy
//       );
//     };

//     // If bbox exists but coordinates look like projected (UTM) instead of WGS84, trigger re-extraction
//     if (currentBbox && !isValidWGS84(currentBbox)) {
//       console.warn(
//         "Bbox coordinates appear to be in projected CRS, re-extracting with WGS84 transformation:",
//         currentBbox
//       );
//       currentBbox = null; // Force re-extraction
//     }

//     // If no bbox, try to extract it using the extract_bbox endpoint
//     if (!currentBbox && (image.is_cog_converted || image.original_tiff)) {
//       satelliteImageApi
//         .extractBbox(image.id)
//         .then((response) => {
//           if (
//             response.data.bbox ||
//             (response.data.bbox_minx &&
//               response.data.bbox_miny &&
//               response.data.bbox_maxx &&
//               response.data.bbox_maxy)
//           ) {
//             const extractedBbox = response.data.bbox || {
//               minx: response.data.bbox_minx,
//               miny: response.data.bbox_miny,
//               maxx: response.data.bbox_maxx,
//               maxy: response.data.bbox_maxy,
//             };
//             setBbox(extractedBbox);
//             console.log("Bbox extracted successfully:", extractedBbox);
//           }
//         })
//         .catch((err) => {
//           console.error("Error extracting bbox:", err);
//           // Try display_image endpoint as fallback (it also extracts bbox)
//           const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
//           const imageUrl = `${API_BASE_URL}/satellite-images/${image.id}/display_image/`;
//           fetch(imageUrl)
//             .then(() => {
//               // Wait a bit and reload image data
//               setTimeout(() => {
//                 satelliteImageApi
//                   .getById(image.id)
//                   .then((res) => {
//                     if (
//                       res.data.bbox ||
//                       (res.data.bbox_minx &&
//                         res.data.bbox_miny &&
//                         res.data.bbox_maxx &&
//                         res.data.bbox_maxy)
//                     ) {
//                       setBbox(
//                         res.data.bbox || {
//                           minx: res.data.bbox_minx,
//                           miny: res.data.bbox_miny,
//                           maxx: res.data.bbox_maxx,
//                           maxy: res.data.bbox_maxy,
//                         }
//                       );
//                     }
//                   })
//                   .catch(() => {});
//               }, 500);
//             })
//             .catch((fetchErr) => {
//               console.error("Error accessing display_image:", fetchErr);
//             });
//         });
//       return;
//     }

//     if (!currentBbox) {
//       console.warn("Satellite image missing bbox data:", {
//         name: image.name,
//         is_cog_converted: image.is_cog_converted,
//         conversion_status: image.conversion_status,
//       });
//       return;
//     }

//     setBbox(currentBbox);
//   }, [image, map]);

//   useEffect(() => {
//     if (!bbox) {
//       // Clean up any existing overlay when bbox is cleared
//       if (overlayRef.current) {
//         try {
//           map.removeLayer(overlayRef.current);
//           overlayRef.current = null;
//         } catch (e) {
//           console.warn("Error removing overlay:", e);
//         }
//       }
//       // Clear loading state when bbox is cleared
//       onLoadingEnd?.();
//       return;
//     }

//     const bounds: L.LatLngBoundsExpression = [
//       [bbox.miny, bbox.minx],
//       [bbox.maxy, bbox.maxx],
//     ];

//     // Clean up any existing overlay first
//     if (overlayRef.current) {
//       try {
//         map.removeLayer(overlayRef.current);
//         overlayRef.current = null;
//       } catch (e) {
//         console.warn("Error removing existing overlay:", e);
//       }
//     }

//     // Use the display_image endpoint that converts TIFF to PNG for browser display
//     // Construct the correct backend URL - Django is typically on port 8000
//     const protocol = window.location.protocol;
//     const hostname = window.location.hostname;
//     // Use port 8000 for Django backend, or current port if different
//     const backendPort =
//       hostname === "localhost" ? "8000" : window.location.port || "8000";
//     const imageUrl = `${protocol}//${hostname}:${backendPort}/api/satellite-images/${image.id}/display_image/`;

//     console.log("Image URL constructed:", {
//       imageUrl,
//       hostname,
//       port: backendPort,
//       currentHost: window.location.host,
//     });

//     // Fetch the image with authentication using axios
//     // This is necessary because Leaflet's imageOverlay doesn't send auth headers
//     const loadImage = async () => {
//       try {
//         // Notify that loading has started
//         onLoadingStart?.();

//         console.log("Fetching satellite image with authentication:", {
//           imageUrl,
//           imageId: image.id,
//         });

//         // Fetch the image using axios with full URL and authentication
//         // Create a new axios instance for this request to use the full URL
//         const axios = (await import("axios")).default;
//         const { getAccessToken } = await import("@/lib/jwt");
//         const token = getAccessToken();

//         const imageResponse = await axios.get(imageUrl, {
//           responseType: "blob", // Important: request as blob
//           headers: token ? { Authorization: `Bearer ${token}` } : {},
//         });

//         // Create a blob URL from the response
//         const blob = imageResponse.data;
//         const blobUrl = URL.createObjectURL(blob);
//         blobUrlRef.current = blobUrl; // Store in ref for cleanup

//         console.log("Image fetched successfully, creating overlay:", {
//           blobSize: blob.size,
//           blobType: blob.type,
//           blobUrl,
//         });

//         // Create the overlay with the blob URL
//         const overlay = L.imageOverlay(blobUrl, bounds, {
//           opacity: 1.0,
//           interactive: false,
//           className: "satellite-image-overlay",
//           zIndex: 1000,
//           attribution: `Satellite Image: ${image.name}`,
//         }).addTo(map);

//         // Force the overlay to bring itself to front
//         overlay.bringToFront();

//         overlayRef.current = overlay;

//         // Listen for when the image loads
//         overlay.on("load", () => {
//           console.log("Satellite image overlay loaded successfully", {
//             bounds: bounds,
//             imageName: image.name,
//           });
//           onLoadingEnd?.();
//           // Try to fit bounds to the image after it loads
//           try {
//             map.fitBounds(bounds, { padding: [20, 20] });
//           } catch (e) {
//             console.warn("Could not fit bounds:", e);
//           }
//         });

//         overlay.on("error", (err) => {
//           console.error("Error loading satellite image overlay:", {
//             error: err,
//             imageId: image.id,
//           });
//           // Clean up blob URL on error
//           if (blobUrlRef.current) {
//             URL.revokeObjectURL(blobUrlRef.current);
//             blobUrlRef.current = null;
//           }
//           onError?.();
//           onLoadingEnd?.();
//         });
//       } catch (error) {
//         const axiosError = error as AxiosError;
//         console.error("Error fetching satellite image:", axiosError);
//         // Check if it's an authentication error
//         if (
//           axiosError.response?.status === 401 ||
//           axiosError.response?.status === 403
//         ) {
//           console.error("Authentication error - token may be expired");
//         } else if (axiosError.response?.status === 404) {
//           console.error("Image file not found on server");
//         } else {
//           console.error("Error response:", axiosError.response?.data);
//         }
//         // Clean up blob URL on error
//         if (blobUrlRef.current) {
//           URL.revokeObjectURL(blobUrlRef.current);
//           blobUrlRef.current = null;
//         }
//         onError?.();
//         onLoadingEnd?.();
//       }
//     };

//     loadImage();

//     return () => {
//       if (overlayRef.current) {
//         try {
//           map.removeLayer(overlayRef.current);
//           overlayRef.current = null;
//         } catch (e) {
//           console.warn("Error removing overlay:", e);
//         }
//       }
//       // Clean up blob URL
//       if (blobUrlRef.current) {
//         URL.revokeObjectURL(blobUrlRef.current);
//         blobUrlRef.current = null;
//       }
//     };
//   }, [bbox, image, map, onLoadingStart, onLoadingEnd, onError]);

//   return null;
// }

// interface MapBoundsUpdaterProps {
//   geojson: GeoJSON.FeatureCollection | null;
// }

// function MapBoundsUpdater({ geojson }: MapBoundsUpdaterProps) {
//   const map = useMap();

//   useEffect(() => {
//     if (!geojson) return;

//     try {
//       // Create a GeoJSON layer temporarily to get bounds
//       const geojsonLayer = L.geoJSON(geojson);
//       const bounds = geojsonLayer.getBounds();

//       // Only fit bounds if they are valid
//       if (bounds.isValid()) {
//         map.fitBounds(bounds, { padding: [50, 50] });
//       }
//     } catch (error) {
//       console.error("Error fitting map bounds:", error);
//     }
//   }, [geojson, map]);

//   return null;
// }

// interface MapResizeHandlerProps {
//   isSidebarOpen: boolean;
//   isStatsVisible: boolean;
// }

// function MapResizeHandler({
//   isSidebarOpen,
//   isStatsVisible,
// }: MapResizeHandlerProps) {
//   const map = useMap();

//   useEffect(() => {
//     // Use a small timeout to ensure DOM has updated after sidebar state change
//     const timeoutId = setTimeout(() => {
//       try {
//         map.invalidateSize();
//       } catch (error) {
//         console.error("Error invalidating map size:", error);
//       }
//     }, 100);

//     return () => clearTimeout(timeoutId);
//   }, [isSidebarOpen, isStatsVisible, map]);

//   return null;
// }

// export default function Dashboard() {
//   const navigate = useNavigate();
//   const dispatch = useAppDispatch();
//   const { user } = useAppSelector((state) => state.auth);

//   const [pipelines, setPipelines] = useState<Pipeline[]>([]);
//   const [satelliteImages, setSatelliteImages] = useState<SatelliteImage[]>([]);
//   const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
//   const [analyses, setAnalyses] = useState<Analysis[]>([]);
//   const [notifications, setNotifications] = useState<Notification[]>([]);
//   const [selectedPipeline, setSelectedPipeline] = useState<string>("all");
//   const [selectedImage, setSelectedImage] = useState<string>("all");
//   const [pipelineGeoJSON, setPipelineGeoJSON] =
//     useState<GeoJSON.FeatureCollection | null>(null);
//   const [isImageLoading, setIsImageLoading] = useState(false);
//   const [imageLoadingError, setImageLoadingError] = useState(false);
//   const [isSidebarOpen, setIsSidebarOpen] = useState(true);
//   const [isStatsVisible, setIsStatsVisible] = useState(true);

//   const loadNotifications = useCallback(async () => {
//     try {
//       // Load unread notifications for display
//       const notificationsResponse = await notificationApi.getAll({
//         is_read: false,
//       });
//       const newNotifications =
//         notificationsResponse.data.results || notificationsResponse.data;

//       setNotifications((prevNotifications) => {
//         if (newNotifications.length > prevNotifications.length) {
//           toast.info(
//             `You have ${newNotifications.length} new notification${
//               newNotifications.length !== 1 ? "s" : ""
//             }`
//           );
//         }
//         return newNotifications;
//       });
//     } catch (error) {
//       console.error("Failed to load notifications:", error);
//     }
//   }, []);

//   const loadPipelineGeoJSON = useCallback(async (pipelineId: string) => {
//     try {
//       const response = await pipelineApi.getGeoJSON(pipelineId);
//       // Ensure we have valid GeoJSON data
//       if (
//         response.data &&
//         (response.data.type === "FeatureCollection" ||
//           response.data.type === "Feature")
//       ) {
//         setPipelineGeoJSON(response.data);
//       } else {
//         console.error("Invalid GeoJSON format:", response.data);
//         toast.error("Invalid GeoJSON file format");
//         setPipelineGeoJSON(null);
//       }
//     } catch (error) {
//       console.error("Failed to load GeoJSON:", error);
//       toast.error("Failed to load pipeline GeoJSON");
//       setPipelineGeoJSON(null);
//     }
//   }, []);

//   const loadData = useCallback(async () => {
//     try {
//       const [
//         pipelinesRes,
//         imagesRes,
//         anomaliesRes,
//         analysesRes,
//         notificationsRes,
//       ] = await Promise.all([
//         pipelineApi.getAll(),
//         satelliteImageApi.getAll(),
//         anomalyApi.getAll({ is_resolved: false }),
//         analysisApi.getAll(),
//         notificationApi.getAll({ is_read: false }),
//       ]);

//       setPipelines(pipelinesRes.data.results || pipelinesRes.data);
//       setSatelliteImages(imagesRes.data.results || imagesRes.data);
//       setAnomalies(anomaliesRes.data.results || anomaliesRes.data);
//       // Filter to only completed analyses
//       const completedAnalyses = (
//         analysesRes.data.results || analysesRes.data
//       ).filter((a: Analysis) => a.status === "completed");
//       setAnalyses(completedAnalyses);
//       setNotifications(notificationsRes.data.results || notificationsRes.data);

//       // Load GeoJSON for selected pipeline
//       if (selectedPipeline !== "all") {
//         loadPipelineGeoJSON(selectedPipeline);
//       }
//     } catch (error) {
//       toast.error("Failed to load data");
//       console.error(error);
//     }
//   }, [selectedPipeline, loadPipelineGeoJSON]);

//   useEffect(() => {
//     loadData();
//     // Load notifications immediately and then every 10 seconds for real-time updates
//     loadNotifications();
//     const notificationsInterval = setInterval(loadNotifications, 10000);
//     return () => clearInterval(notificationsInterval);
//   }, [loadData, loadNotifications]);

//   const handleLogout = async () => {
//     await dispatch(logout());
//     navigate("/login");
//   };

//   const filteredImages =
//     selectedPipeline === "all"
//       ? satelliteImages
//       : satelliteImages.filter((img) => img.pipeline === selectedPipeline);

//   const displayedImage =
//     selectedImage === "all"
//       ? null
//       : satelliteImages.find((img) => img.id === selectedImage);

//   // Format creation date for display
//   const formatImageDate = (dateString: string) => {
//     const date = new Date(dateString);
//     return date.toLocaleDateString("en-US", {
//       year: "numeric",
//       month: "short",
//       day: "numeric",
//     });
//   };

//   // Group analyses by satellite image
//   const analysesByImage = analyses.reduce((acc, analysis) => {
//     const imageId = analysis.satellite_image;
//     if (!acc[imageId]) {
//       acc[imageId] = [];
//     }
//     acc[imageId].push(analysis);
//     return acc;
//   }, {} as Record<string, Analysis[]>);

//   // Get severity badge color
//   const getSeverityBadgeColor = (severity: string | null) => {
//     switch (severity) {
//       case "critical":
//         return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
//       case "high":
//         return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
//       case "medium":
//         return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
//       case "low":
//         return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
//       default:
//         return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
//     }
//   };

//   // Debug: Log displayed image info and extract bbox if missing
//   useEffect(() => {
//     // Reset loading state when displayed image changes
//     setIsImageLoading(false);
//     setImageLoadingError(false);

//     if (displayedImage) {
//       console.log("Displayed Image:", {
//         id: displayedImage.id,
//         name: displayedImage.name,
//         is_cog_converted: displayedImage.is_cog_converted,
//         cog_url: displayedImage.cog_url,
//         original_url: displayedImage.original_url,
//         bbox: displayedImage.bbox,
//         bbox_fields: {
//           minx: displayedImage.bbox_minx,
//           miny: displayedImage.bbox_miny,
//           maxx: displayedImage.bbox_maxx,
//           maxy: displayedImage.bbox_maxy,
//         },
//         conversion_status: displayedImage.conversion_status,
//       });

//       // If bbox is missing, try to trigger extraction by accessing display_image endpoint
//       // This will extract bbox on the backend if missing
//       const hasBbox =
//         displayedImage.bbox ||
//         (displayedImage.bbox_minx !== null &&
//           displayedImage.bbox_miny !== null &&
//           displayedImage.bbox_maxx !== null &&
//           displayedImage.bbox_maxy !== null);

//       if (
//         !hasBbox &&
//         (displayedImage.is_cog_converted || displayedImage.original_tiff)
//       ) {
//         // Access display_image endpoint which will extract bbox if missing
//         const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
//         const imageUrl = `${API_BASE_URL}/satellite-images/${displayedImage.id}/display_image/`;
//         // Create a hidden image to trigger bbox extraction
//         const img = new Image();
//         img.onload = () => {
//           console.log(
//             "Image loaded, bbox should be extracted now. Refreshing data..."
//           );
//           // Reload satellite images to get updated bbox
//           setTimeout(() => {
//             loadData();
//           }, 1000);
//         };
//         img.onerror = (err: Event | string) => {
//           console.error("Error loading display image:", err);
//         };
//         img.src = imageUrl;
//       }
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [displayedImage]);

//   // Memoize callbacks for SatelliteImageLayer to prevent unnecessary re-renders
//   const handleImageLoadingStart = useCallback(() => {
//     setIsImageLoading(true);
//     setImageLoadingError(false);
//   }, []);

//   const handleImageLoadingEnd = useCallback(() => {
//     setIsImageLoading(false);
//   }, []);

//   const handleImageError = useCallback(() => {
//     setImageLoadingError(true);
//     setIsImageLoading(false);
//   }, []);

//   const criticalAnomalies = anomalies.filter(
//     (a) => a.severity === "critical"
//   ).length;
//   const highAnomalies = anomalies.filter((a) => a.severity === "high").length;

//   return (
//     <div className="h-screen flex flex-col bg-background">
//       {/* Header */}
//       <header className="bg-card border-b border-border px-6 py-4 shadow-sm">
//         <div className="flex items-center justify-between">
//           <div className="flex items-center gap-4">
//             {/* Logo */}
//             <div className="flex items-center gap-3">
//               <div className="relative">
//                 <div className="absolute inset-0 bg-gray-900/20 dark:bg-gray-800/30 rounded-lg blur-sm"></div>
//                 <div className="relative bg-linear-to-br from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900 rounded-lg p-2.5 shadow-lg border border-gray-700/50 dark:border-gray-600/50">
//                   <div className="flex items-center justify-center">
//                     <Satellite className="h-6 w-6 text-white" />
//                     <div className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-100 rounded-full p-0.5 shadow-md border border-gray-300 dark:border-gray-400">
//                       <Gauge className="h-3 w-3 text-gray-900 dark:text-gray-800" />
//                     </div>
//                   </div>
//                 </div>
//               </div>
//               <div className="flex flex-col">
//                 <h1 className="text-2xl font-bold text-foreground leading-tight">
//                   PF-FlowSafe
//                 </h1>
//                 <p className="text-xs text-muted-foreground">
//                   Welcome, {user?.username}
//                 </p>
//               </div>
//             </div>
//           </div>
//           <div className="flex items-center gap-4">
//             <Button
//               variant="outline"
//               size="icon"
//               className="cursor-pointer"
//               onClick={() => setIsSidebarOpen(!isSidebarOpen)}
//               title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
//             >
//               {isSidebarOpen ? (
//                 <PanelLeftClose className="h-5 w-5" />
//               ) : (
//                 <PanelLeftOpen className="h-5 w-5" />
//               )}
//             </Button>
//             <Button
//               variant="outline"
//               size="icon"
//               className="cursor-pointer"
//               onClick={() => setIsStatsVisible(!isStatsVisible)}
//               title={isStatsVisible ? "Hide stats" : "Show stats"}
//             >
//               {isStatsVisible ? (
//                 <Minimize2 className="h-5 w-5" />
//               ) : (
//                 <BarChart3 className="h-5 w-5" />
//               )}
//             </Button>
//             <ThemeToggle />
//             <div className="relative">
//               <Button
//                 variant="outline"
//                 size="icon"
//                 className="relative cursor-pointer"
//                 onClick={() => navigate("/notifications")}
//               >
//                 <Bell className="h-5 w-5" />
//                 {notifications.length > 0 && (
//                   <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
//                     {notifications.length}
//                   </span>
//                 )}
//               </Button>
//             </div>
//             <Button
//               variant="outline"
//               onClick={() => navigate("/profile")}
//               size="icon"
//               className="cursor-pointer"
//             >
//               <User className="h-5 w-5" />
//             </Button>
//             <Button
//               variant="outline"
//               onClick={handleLogout}
//               className="cursor-pointer"
//             >
//               Logout
//             </Button>
//           </div>
//         </div>
//       </header>

//       {/* Stats Cards */}
//       {isStatsVisible && (
//         <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6">
//           <Card>
//             <CardHeader className="pb-2">
//               <CardTitle className="text-sm font-medium text-muted-foreground">
//                 Total Pipelines
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold text-foreground">
//                 {pipelines.length}
//               </div>
//             </CardContent>
//           </Card>
//           <Card>
//             <CardHeader className="pb-2">
//               <CardTitle className="text-sm font-medium text-muted-foreground">
//                 Satellite Images
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold text-foreground">
//                 {satelliteImages.length}
//               </div>
//             </CardContent>
//           </Card>
//           <Card className="border-destructive/50">
//             <CardHeader className="pb-2">
//               <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
//                 <AlertTriangle className="h-4 w-4" />
//                 Critical Anomalies
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold text-destructive">
//                 {criticalAnomalies}
//               </div>
//             </CardContent>
//           </Card>
//           <Card className="border-orange-500/50">
//             <CardHeader className="pb-2">
//               <CardTitle className="text-sm font-medium text-orange-600 dark:text-orange-400 flex items-center gap-2">
//                 <Activity className="h-4 w-4" />
//                 High Priority
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
//                 {highAnomalies}
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       )}

//       {/* Controls and Map */}
//       <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 overflow-hidden">
//         {/* Sidebar */}
//         {isSidebarOpen && (
//           <div className="lg:col-span-1 space-y-4 overflow-y-auto">
//             <Card>
//               <CardHeader>
//                 <CardTitle className="text-lg">Filters</CardTitle>
//               </CardHeader>
//               <CardContent className="space-y-4">
//                 <div>
//                   <label className="text-sm font-medium mb-2 block">
//                     Pipeline
//                   </label>
//                   <Select
//                     value={selectedPipeline}
//                     onValueChange={(value) => {
//                       setSelectedPipeline(value);
//                       if (value !== "all") {
//                         loadPipelineGeoJSON(value);
//                       } else {
//                         setPipelineGeoJSON(null);
//                       }
//                     }}
//                   >
//                     <SelectTrigger>
//                       <SelectValue placeholder="Select pipeline" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       <SelectItem value="all">Select Pipeline</SelectItem>
//                       {pipelines.map((pipeline) => (
//                         <SelectItem key={pipeline.id} value={pipeline.id}>
//                           {pipeline.name}
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                 </div>
//                 <div>
//                   <label className="text-sm font-medium mb-2 block">
//                     Satellite Image
//                   </label>
//                   <Select
//                     value={selectedImage}
//                     onValueChange={(value) => {
//                       setSelectedImage(value);
//                       setIsImageLoading(false);
//                       setImageLoadingError(false);
//                     }}
//                   >
//                     <SelectTrigger>
//                       <SelectValue placeholder="Select image" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       <SelectItem value="all">Select Image</SelectItem>
//                       {filteredImages.map((image) => (
//                         <SelectItem
//                           key={image.id}
//                           value={image.id}
//                           className="[&>span:last-child]:flex [&>span:last-child]:items-center [&>span:last-child]:justify-between [&>span:last-child]:w-full"
//                         >
//                           <span className="flex-1 truncate">{image.name}</span>
//                           <span className="text-xs text-muted-foreground ml-4 shrink-0">
//                             {formatImageDate(image.created_at)}
//                           </span>
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                 </div>
//               </CardContent>
//             </Card>

//             {/* Analysis Results */}
//             <Card>
//               <CardHeader>
//                 <CardTitle className="text-lg flex items-center gap-2">
//                   <FileText className="h-5 w-5" />
//                   Analysis Results
//                 </CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <div className="space-y-4 max-h-[600px] overflow-y-auto">
//                   {selectedImage === "all" ? (
//                     <p className="text-sm text-muted-foreground text-center py-8">
//                       Please select a satellite image to view its analysis results.
//                     </p>
//                   ) : displayedImage ? (
//                     (() => {
//                       const imageAnalyses = analysesByImage[selectedImage] || [];
//                       return imageAnalyses.length > 0 ? (
//                         <div className="border border-border rounded-lg p-3 space-y-3">
//                           <div className="flex items-start justify-between">
//                             <div className="flex-1">
//                               <h4 className="font-semibold text-sm flex items-center gap-2">
//                                 <Satellite className="h-4 w-4 text-primary" />
//                                 {displayedImage.name}
//                               </h4>
//                               <p className="text-xs text-muted-foreground mt-1">
//                                 {imageAnalyses.length} analysis
//                                 {imageAnalyses.length !== 1 ? "es" : ""}{" "}
//                                 completed
//                               </p>
//                             </div>
//                           </div>

//                           <div className="space-y-2">
//                             {imageAnalyses.map((analysis) => (
//                               <div
//                                 key={analysis.id}
//                                 className="p-2 rounded-md bg-muted/50 border border-border"
//                               >
//                                 <div className="flex items-start justify-between mb-2">
//                                   <div className="flex-1">
//                                     <p className="font-medium text-xs">
//                                       {analysis.analysis_type_display}
//                                     </p>
//                                     {analysis.severity && (
//                                       <span
//                                         className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${getSeverityBadgeColor(
//                                           analysis.severity
//                                         )}`}
//                                       >
//                                         {analysis.severity_display}
//                                       </span>
//                                     )}
//                                   </div>
//                                   {analysis.status === "completed" && (
//                                     <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
//                                   )}
//                                 </div>

//                                 <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
//                                   {analysis.confidence_score !== null && (
//                                     <div className="flex items-center gap-1 text-muted-foreground">
//                                       <TrendingUp className="h-3 w-3" />
//                                       <span>
//                                         Confidence:{" "}
//                                         {(
//                                           analysis.confidence_score * 100
//                                         ).toFixed(1)}
//                                         %
//                                       </span>
//                                     </div>
//                                   )}
//                                   {analysis.processing_time_seconds !==
//                                     null && (
//                                     <div className="flex items-center gap-1 text-muted-foreground">
//                                       <Clock className="h-3 w-3" />
//                                       <span>
//                                         {analysis.processing_time_seconds.toFixed(
//                                           1
//                                         )}
//                                         s
//                                       </span>
//                                     </div>
//                                   )}
//                                   {analysis.anomalies_count > 0 && (
//                                     <div className="flex items-center gap-1 text-muted-foreground col-span-2">
//                                       <AlertTriangle className="h-3 w-3 text-orange-500" />
//                                       <span>
//                                         {analysis.anomalies_count} anomal
//                                         {analysis.anomalies_count !== 1
//                                           ? "ies"
//                                           : "y"}{" "}
//                                         detected
//                                       </span>
//                                     </div>
//                                   )}
//                                 </div>

//                                 {Object.keys(analysis.results_json || {})
//                                   .length > 0 && (
//                                   <details className="mt-2">
//                                     <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
//                                       View details
//                                     </summary>
//                                     <div className="mt-2 p-2 bg-background rounded text-xs font-mono overflow-x-auto">
//                                       <pre className="whitespace-pre-wrap wrap-break-words">
//                                         {JSON.stringify(
//                                           analysis.results_json,
//                                           null,
//                                           2
//                                         )}
//                                       </pre>
//                                     </div>
//                                   </details>
//                                 )}
//                               </div>
//                             ))}
//                           </div>
//                         </div>
//                       ) : (
//                         <p className="text-sm text-muted-foreground text-center py-8">
//                           No analysis results available for this image. Run analysis on this satellite
//                           image to see results here.
//                         </p>
//                       );
//                     })()
//                   ) : (
//                     <p className="text-sm text-muted-foreground text-center py-8">
//                       Selected image not found.
//                     </p>
//                   )}
//                 </div>
//               </CardContent>
//             </Card>

//             {/* Anomalies List */}
//             <Card>
//               <CardHeader>
//                 <CardTitle className="text-lg">Recent Anomalies</CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <div className="space-y-2 max-h-96 overflow-y-auto">
//                   {anomalies.slice(0, 10).map((anomaly) => (
//                     <div
//                       key={anomaly.id}
//                       className={`p-3 rounded-lg border ${
//                         anomaly.severity === "critical"
//                           ? "border-red-200 bg-red-50 dark:bg-red-900/20"
//                           : anomaly.severity === "high"
//                           ? "border-orange-200 bg-orange-50 dark:bg-orange-900/20"
//                           : "border-gray-200 bg-gray-50 dark:bg-gray-800"
//                       }`}
//                     >
//                       <div className="flex items-start justify-between">
//                         <div className="flex-1">
//                           <p className="font-medium text-sm">
//                             {anomaly.anomaly_type_display}
//                           </p>
//                           <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
//                             {anomaly.severity_display}
//                           </p>
//                         </div>
//                         {anomaly.is_resolved ? (
//                           <CheckCircle className="h-4 w-4 text-green-500" />
//                         ) : (
//                           <XCircle className="h-4 w-4 text-red-500" />
//                         )}
//                       </div>
//                     </div>
//                   ))}
//                   {anomalies.length === 0 && (
//                     <p className="text-sm text-gray-500 text-center py-4">
//                       No anomalies detected
//                     </p>
//                   )}
//                 </div>
//               </CardContent>
//             </Card>
//           </div>
//         )}

//         {/* Map */}
//         <div
//           className={`rounded-lg overflow-hidden border border-border relative transition-all duration-300 ${
//             isSidebarOpen ? "lg:col-span-3" : "lg:col-span-4"
//           }`}
//         >
//           {/* Loading indicator */}
//           {isImageLoading && (
//             <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10000 bg-card border border-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
//               <Loader2 className="h-5 w-5 animate-spin text-primary" />
//               <span className="text-sm font-medium text-foreground">
//                 Loading satellite image...
//               </span>
//             </div>
//           )}
//           {/* Error indicator */}
//           {imageLoadingError && !isImageLoading && (
//             <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10000 bg-destructive/10 border border-destructive/50 rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
//               <AlertTriangle className="h-5 w-5 text-destructive" />
//               <span className="text-sm font-medium text-destructive">
//                 Failed to load satellite image. Please try again.
//               </span>
//             </div>
//           )}
//           <MapContainer
//             center={[20, 0]}
//             zoom={2}
//             style={{ height: "100%", width: "100%" }}
//             zoomControl={true}
//           >
//             <MapBoundsUpdater geojson={pipelineGeoJSON} />
//             <MapResizeHandler
//               isSidebarOpen={isSidebarOpen}
//               isStatsVisible={isStatsVisible}
//             />
//             <LayersControl position="topright">
//               {/* Base Layers */}
//               <LayersControl.BaseLayer checked name="OpenStreetMap">
//                 <TileLayer
//                   attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
//                   url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//                 />
//               </LayersControl.BaseLayer>

//               <LayersControl.BaseLayer name="Satellite">
//                 <TileLayer
//                   attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.mapbox.com/about/maps/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
//                   url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
//                 />
//               </LayersControl.BaseLayer>

//               <LayersControl.BaseLayer name="Terrain">
//                 <TileLayer
//                   attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://www.openstreetmap.org/copyright">OpenTopoMap</a>'
//                   url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
//                 />
//               </LayersControl.BaseLayer>

//               {/* Overlays */}
//               {pipelineGeoJSON && (
//                 <LayersControl.Overlay checked name="Pipeline Routes">
//                   <GeoJSON
//                     key={selectedPipeline}
//                     data={pipelineGeoJSON}
//                     style={{
//                       color: "#3b82f6",
//                       weight: 3,
//                       opacity: 0.8,
//                     }}
//                     onEachFeature={(
//                       feature: GeoJSON.Feature,
//                       layer: L.Layer
//                     ) => {
//                       if (feature.properties) {
//                         const popupContent = Object.keys(feature.properties)
//                           .map(
//                             (key) =>
//                               `<strong>${key}:</strong> ${String(
//                                 feature.properties?.[key] ?? ""
//                               )}`
//                           )
//                           .join("<br>");
//                         layer.bindPopup(popupContent);
//                       }
//                     }}
//                   />
//                 </LayersControl.Overlay>
//               )}

//               {displayedImage &&
//                 (displayedImage.is_cog_converted ||
//                   displayedImage.original_tiff) &&
//                 (displayedImage.bbox ||
//                   (displayedImage.bbox_minx !== null &&
//                     displayedImage.bbox_miny !== null &&
//                     displayedImage.bbox_maxx !== null &&
//                     displayedImage.bbox_maxy !== null)) && (
//                   <LayersControl.Overlay checked name={displayedImage.name}>
//                     <SatelliteImageLayer
//                       image={displayedImage}
//                       onLoadingStart={handleImageLoadingStart}
//                       onLoadingEnd={handleImageLoadingEnd}
//                       onError={handleImageError}
//                     />
//                   </LayersControl.Overlay>
//                 )}

//               {anomalies.length > 0 && (
//                 <LayersControl.Overlay checked name="Anomalies">
//                   {anomalies.map((anomaly) => {
//                     const iconUrl =
//                       anomaly.severity === "critical"
//                         ? "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png"
//                         : anomaly.severity === "high"
//                         ? "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png"
//                         : "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";

//                     const customIcon = new Icon({
//                       iconUrl,
//                       iconSize: [25, 41],
//                       iconAnchor: [12, 41],
//                     });

//                     const position: LatLngTuple = [
//                       anomaly.location_lat,
//                       anomaly.location_lon,
//                     ];

//                     return (
//                       <Marker
//                         key={anomaly.id}
//                         position={position}
//                         icon={customIcon}
//                       >
//                         <Popup>
//                           <div>
//                             <strong>{anomaly.anomaly_type_display}</strong>
//                             <br />
//                             Severity: {anomaly.severity_display}
//                             <br />
//                             Confidence:{" "}
//                             {(anomaly.confidence_score * 100).toFixed(1)}%
//                           </div>
//                         </Popup>
//                       </Marker>
//                     );
//                   })}
//                 </LayersControl.Overlay>
//               )}
//             </LayersControl>
//           </MapContainer>
//         </div>
//       </div>
//     </div>
//   );
// }

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
  analysisApi,
} from "@/lib/api";
import {
  type Pipeline,
  type SatelliteImage,
  type Anomaly,
  type Notification,
  type Analysis,
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
  FileText,
  TrendingUp,
  Clock,
  AlertCircle,
  Radar,
  Layers,
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
  onError: () => void;
}

function SatelliteImageLayer({
  image,
  onLoadingStart,
  onLoadingEnd,
  onError,
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
      // Clear loading state when bbox is cleared
      onLoadingEnd();
      return;
    }

    const bounds: LatLngBoundsExpression = [
      [bbox.miny, bbox.minx],
      [bbox.maxy, bbox.maxx],
    ];

    // Clean up any existing overlay first
    if (overlayRef.current) {
      try {
        map.removeLayer(overlayRef.current);
        overlayRef.current = null;
      } catch (e) {
        console.warn("Error removing existing overlay:", e);
      }
    }

    // Use the display_image endpoint that converts TIFF to PNG for browser display
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const backendPort =
      hostname === "localhost" ? "8000" : window.location.port || "8000";
    const imageUrl = `${protocol}//${hostname}:${backendPort}/api/satellite-images/${image.id}/display_image/`;

    console.log("Image URL constructed:", {
      imageUrl,
      hostname,
      port: backendPort,
      currentHost: window.location.host,
    });

    // Fetch the image with authentication using axios
    // This is necessary because Leaflet's imageOverlay doesn't send auth headers
    const loadImage = async () => {
      try {
        // Notify that loading has started
        onLoadingStart();

        console.log("Fetching satellite image with authentication:", {
          imageUrl,
          imageId: image.id,
        });

        const axios = (await import("axios")).default;
        const { getAccessToken } = await import("@/lib/jwt");
        const token = getAccessToken();

        const imageResponse = await axios.get(imageUrl, {
          responseType: "blob",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const blob = imageResponse.data;
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;

        console.log("Image fetched successfully, creating overlay:", {
          blobSize: blob.size,
          blobType: blob.type,
          blobUrl,
        });

        const overlay = L.imageOverlay(blobUrl, bounds, {
          opacity: 1.0,
          interactive: false,
          className: "satellite-image-overlay",
          zIndex: 1000,
          attribution: `Satellite Image: ${image.name}`,
        }).addTo(map);

        overlay.bringToFront();

        overlayRef.current = overlay;

        overlay.on("load", () => {
          console.log("Satellite image overlay loaded successfully", {
            bounds: bounds,
            imageName: image.name,
          });
          onLoadingEnd();
          try {
            map.fitBounds(bounds, { padding: [20, 20] });
          } catch (e) {
            console.warn("Could not fit bounds:", e);
          }
        });

        overlay.on("error", (err) => {
          console.error("Error loading satellite image overlay:", {
            error: err,
            imageId: image.id,
          });
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
          }
          onError();
          onLoadingEnd();
        });
      } catch (error) {
        const axiosError = error as AxiosError;
        console.error("Error fetching satellite image:", axiosError);
        if (
          axiosError.response?.status === 401 ||
          axiosError.response?.status === 403
        ) {
          console.error("Authentication error - token may be expired");
        } else if (axiosError.response?.status === 404) {
          console.error("Image file not found on server");
        } else {
          console.error("Error response:", axiosError.response?.data);
        }
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        onError();
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
  }, [bbox, image, map, onLoadingStart, onLoadingEnd, onError]);

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
    resizeRef.current = setTimeout(() => {
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

export default function Dashboard() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [satelliteImages, setSatelliteImages] = useState<SatelliteImage[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<string>("all");
  const [selectedImage, setSelectedImage] = useState<string>("all");
  const [pipelineGeoJSON, setPipelineGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageLoadingError, setImageLoadingError] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isStatsVisible, setIsStatsVisible] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(true);

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
            `You have ${newNotifications.length} new notification${
              newNotifications.length !== 1 ? "s" : ""
            }`
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
      const [
        pipelinesRes,
        imagesRes,
        anomaliesRes,
        analysesRes,
        notificationsRes,
      ] = await Promise.all([
        pipelineApi.getAll(),
        satelliteImageApi.getAll(),
        anomalyApi.getAll({ is_resolved: false }),
        analysisApi.getAll(),
        notificationApi.getAll({ is_read: false }),
      ]);

      setPipelines(pipelinesRes.data.results || pipelinesRes.data);
      setSatelliteImages(imagesRes.data.results || imagesRes.data);
      setAnomalies(anomaliesRes.data.results || anomaliesRes.data);
      const completedAnalyses = (
        analysesRes.data.results || analysesRes.data
      ).filter((a: Analysis) => a.status === "completed");
      setAnalyses(completedAnalyses);
      setNotifications(notificationsRes.data.results || notificationsRes.data);

      if (selectedPipeline !== "all") {
        loadPipelineGeoJSON(selectedPipeline);
      }
    } catch (error) {
      toast.error("Failed to load data");
      console.error(error);
    } finally {
      setIsDataLoading(false);
    }
  }, [selectedPipeline, loadPipelineGeoJSON]);

  useEffect(() => {
    loadData();
    loadNotifications();
    const notificationsInterval = setInterval(loadNotifications, 10000);
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

  const analysesByImage = useMemo(
    () =>
      analyses.reduce((acc: Record<string, Analysis[]>, analysis: Analysis) => {
        const imageId = analysis.satellite_image;
        if (!acc[imageId]) {
          acc[imageId] = [];
        }
        acc[imageId].push(analysis);
        return acc;
      }, {}),
    [analyses]
  );

  const getSeverityBadgeColor = (severity: string | null) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "low":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  useEffect(() => {
    setIsImageLoading(false);
    setImageLoadingError(false);

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
        const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
        const imageUrl = `${API_BASE_URL}/satellite-images/${displayedImage.id}/display_image/`;
        const img = new Image();
        img.onload = () => {
          console.log(
            "Image loaded, bbox should be extracted now. Refreshing data..."
          );
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
  }, [displayedImage, loadData]);

  const handleImageLoadingStart = useCallback(() => {
    setIsImageLoading(true);
    setImageLoadingError(false);
  }, []);

  const handleImageLoadingEnd = useCallback(() => {
    setIsImageLoading(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageLoadingError(true);
    setIsImageLoading(false);
  }, []);

  const criticalAnomalies = useMemo(
    () => anomalies.filter((a) => a.severity === "critical").length,
    [anomalies]
  );
  const highAnomalies = useMemo(
    () => anomalies.filter((a) => a.severity === "high").length,
    [anomalies]
  );

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col bg-background text-foreground">
        {/* Modern Header */}
        <header className="bg-card/95 backdrop-blur-sm border-b border-border px-6 py-4 shadow-lg z-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Modern Logo */}
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
                  SAR Pipeline Monitoring • {user?.username}
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

        {/* Enhanced Stats Cards */}
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

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          {isSidebarOpen && (
            <aside className="w-80 border-r border-border overflow-y-auto shrink-0 p-4 space-y-4 bg-card shadow-inner">
              {isDataLoading ? (
                <>
                  <Skeleton className="h-48 rounded-lg" />
                  <Skeleton className="h-64 rounded-lg" />
                  <Skeleton className="h-48 rounded-lg" />
                </>
              ) : (
                <>
                  <Card className="shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Filters
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block text-foreground">
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
                          <SelectTrigger className="w-full">
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
                        <label className="text-sm font-medium mb-1 block text-foreground">
                          Satellite Image
                        </label>
                        <Select
                          value={selectedImage}
                          onValueChange={(value) => {
                            setSelectedImage(value);
                            setIsImageLoading(false);
                            setImageLoadingError(false);
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select image" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Images</SelectItem>
                            {filteredImages.map((image) => (
                              <SelectItem key={image.id} value={image.id}>
                                <div className="flex justify-between items-center w-full">
                                  <span className="truncate flex-1">
                                    {image.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {formatImageDate(image.created_at)}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Analysis Results */}
                  <Card className="shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Analysis Results
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
                        {selectedImage === "all" ? (
                          <p className="text-sm text-muted-foreground text-center py-6">
                            Select a satellite image to view analysis results.
                          </p>
                        ) : displayedImage ? (
                          (() => {
                            const imageAnalyses =
                              analysesByImage[selectedImage] || [];
                            return imageAnalyses.length > 0 ? (
                              <Accordion
                                type="single"
                                collapsible
                                className="w-full"
                              >
                                {imageAnalyses.map((analysis) => (
                                  <AccordionItem
                                    value={analysis.id}
                                    key={analysis.id}
                                  >
                                    <AccordionTrigger className="text-sm py-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">
                                          {analysis.analysis_type_display}
                                        </span>
                                        {analysis.severity && (
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-xs ${getSeverityBadgeColor(
                                              analysis.severity
                                            )}`}
                                          >
                                            {analysis.severity_display}
                                          </span>
                                        )}
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-2 text-xs">
                                      <div className="grid grid-cols-2 gap-2">
                                        {analysis.confidence_score !== null && (
                                          <div className="flex items-center gap-1 text-muted-foreground">
                                            <TrendingUp className="h-3 w-3" />
                                            <span>
                                              Confidence:{" "}
                                              {(
                                                analysis.confidence_score * 100
                                              ).toFixed(1)}
                                              %
                                            </span>
                                          </div>
                                        )}
                                        {analysis.processing_time_seconds !==
                                          null && (
                                          <div className="flex items-center gap-1 text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            <span>
                                              {analysis.processing_time_seconds.toFixed(
                                                1
                                              )}
                                              s
                                            </span>
                                          </div>
                                        )}
                                        {analysis.anomalies_count > 0 && (
                                          <div className="flex items-center gap-1 text-muted-foreground col-span-2">
                                            <AlertTriangle className="h-3 w-3 text-orange-500" />
                                            <span>
                                              {analysis.anomalies_count} anomal
                                              {analysis.anomalies_count !== 1
                                                ? "ies"
                                                : "y"}{" "}
                                              detected
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      {Object.keys(analysis.results_json || {})
                                        .length > 0 && (
                                        <div className="mt-2 p-2 bg-muted rounded text-xs font-mono overflow-x-auto">
                                          <pre className="whitespace-pre-wrap wrap-break-words">
                                            {JSON.stringify(
                                              analysis.results_json,
                                              null,
                                              2
                                            )}
                                          </pre>
                                        </div>
                                      )}
                                    </AccordionContent>
                                  </AccordionItem>
                                ))}
                              </Accordion>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-6">
                                No analysis results. Run analysis to view
                                details.
                              </p>
                            );
                          })()
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-6">
                            Selected image not found.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Anomalies List */}
                  <Card className="shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Recent Anomalies
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                        {anomalies.slice(0, 10).map((anomaly) => (
                          <Tooltip key={anomaly.id}>
                            <TooltipTrigger asChild>
                              <div
                                className={`p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors ${
                                  anomaly.severity === "critical"
                                    ? "border-red-200 bg-red-50 dark:bg-red-900/20"
                                    : anomaly.severity === "high"
                                    ? "border-orange-200 bg-orange-50 dark:bg-orange-900/20"
                                    : "border-border bg-muted"
                                }`}
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex-1">
                                    <p className="font-medium">
                                      {anomaly.anomaly_type_display}
                                    </p>
                                    <p className="text-muted-foreground">
                                      {anomaly.severity_display}
                                    </p>
                                  </div>
                                  {anomaly.is_resolved ? (
                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <XCircle className="h-3 w-3 text-red-500" />
                                  )}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                Confidence:{" "}
                                {(anomaly.confidence_score * 100).toFixed(1)}%
                              </p>
                              <p>
                                Location: {anomaly.location_lat.toFixed(4)},{" "}
                                {anomaly.location_lon.toFixed(4)}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                        {anomalies.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No anomalies detected
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </aside>
          )}

          {/* Map Container */}
          <main className="flex-1 relative overflow-hidden">
            {isImageLoading && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-1000 bg-card border border-border rounded-lg shadow-lg px-4 py-2 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  Loading satellite image...
                </span>
              </div>
            )}
            {imageLoadingError && !isImageLoading && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-1000 bg-destructive/10 border border-destructive rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Failed to load image. Try again.
                </span>
              </div>
            )}
            <MapContainer
              center={[20, 0] as LatLngTuple}
              zoom={2}
              style={{ height: "100%", width: "100%" }}
              zoomControl={true}
              className="transition-all"
            >
              <MapBoundsUpdater geojson={pipelineGeoJSON} />
              <MapResizeHandler
                isSidebarOpen={isSidebarOpen}
                isStatsVisible={isStatsVisible}
              />
              <LayersControl position="topright">
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
                      <SatelliteImageLayer
                        image={displayedImage}
                        onLoadingStart={handleImageLoadingStart}
                        onLoadingEnd={handleImageLoadingEnd}
                        onError={handleImageError}
                      />
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
                            <div className="text-sm">
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
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
