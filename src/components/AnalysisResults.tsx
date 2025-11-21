import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Droplet,
  Construction,
  Box,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import type {
  OilSpillDetectionResult,
  PipelineEncroachmentResult,
  ObjectDetectionResult,
  LegendData,
} from "@/types";

interface AnalysisResultsCardProps {
  type: "oil_spill" | "pipeline_encroachment" | "object_detection";
  data:
    | OilSpillDetectionResult
    | PipelineEncroachmentResult
    | ObjectDetectionResult
    | null;
}

const AnalysisResultsCard = ({ type, data }: AnalysisResultsCardProps) => {
  if (!data || !data.detected) {
    return null;
  }

  const getSeverityColor = (severity: string) => {
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const renderLegends = (legends: LegendData[]) => {
    if (!legends || legends.length === 0) return null;

    return (
      <div className="mt-3 pt-3 border-t">
        <p className="text-xs font-semibold text-muted-foreground mb-2">
          Map Legends:
        </p>
        <div className="flex flex-wrap gap-2">
          {legends.map((legend, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded-md"
            >
              <div
                className="w-3 h-3 rounded-full border"
                style={{ backgroundColor: legend.color }}
              />
              <span className="text-xs font-medium">{legend.name}</span>
              {legend.icon && <span className="text-xs">{legend.icon}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Oil Spill Detection Card
  if (type === "oil_spill") {
    const oilSpillData = data as OilSpillDetectionResult;
    return (
      <Card className="shadow-lg border-2 hover:border-red-500/50 transition-colors bg-linear-to-br from-red-50/50 to-card dark:from-red-950/20">
        <CardHeader className="pb-3 bg-linear-to-r from-red-500/10 to-transparent rounded-t-lg">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 font-bold">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Droplet className="h-4 w-4 text-red-500" />
              </div>
              Oil Spill Detection
            </CardTitle>
            {oilSpillData.severity && (
              <Badge variant={getSeverityColor(oilSpillData.severity)}>
                {oilSpillData.severity.toUpperCase()}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Date</span>
              </div>
              <p className="text-sm font-semibold">
                {formatDate(oilSpillData.date)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Droplet className="h-3 w-3" />
                <span>Spills Detected</span>
              </div>
              <p className="text-sm font-semibold">{oilSpillData.num_spills}</p>
            </div>

            <div className="space-y-1 col-span-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                <span>Total Spill Extent</span>
              </div>
              <p className="text-sm font-semibold">
                {oilSpillData.spill_extent}
              </p>
            </div>

            <div className="space-y-1 col-span-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3" />
                <span>Confidence Score</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${(oilSpillData.confidence_score * 100).toFixed(
                        0
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-semibold">
                  {(oilSpillData.confidence_score * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {oilSpillData.locations && oilSpillData.locations.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Locations ({oilSpillData.locations.length}):
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                {oilSpillData.locations.slice(0, 5).map((loc, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2 bg-muted/50 rounded-md text-xs"
                  >
                    <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-red-500" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {loc.lat.toFixed(6)}, {loc.lon.toFixed(6)}
                      </p>
                      {loc.area_m2 && (
                        <p className="text-muted-foreground">
                          Area: {loc.area_m2.toFixed(2)} m²
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {oilSpillData.locations.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{oilSpillData.locations.length - 5} more locations
                  </p>
                )}
              </div>
            </div>
          )}

          {renderLegends(oilSpillData.legends)}
        </CardContent>
      </Card>
    );
  }

  // Pipeline Encroachment Card
  if (type === "pipeline_encroachment") {
    const encroachmentData = data as PipelineEncroachmentResult;
    return (
      <Card className="shadow-lg border-2 hover:border-orange-500/50 transition-colors bg-linear-to-br from-orange-50/50 to-card dark:from-orange-950/20">
        <CardHeader className="pb-3 bg-linear-to-r from-orange-500/10 to-transparent rounded-t-lg">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 font-bold">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Construction className="h-4 w-4 text-orange-500" />
              </div>
              Pipeline Encroachment
            </CardTitle>
            {encroachmentData.severity && (
              <Badge variant={getSeverityColor(encroachmentData.severity)}>
                {encroachmentData.severity.toUpperCase()}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Date</span>
              </div>
              <p className="text-sm font-semibold">
                {formatDate(encroachmentData.date)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3 w-3" />
                <span>Encroachments</span>
              </div>
              <p className="text-sm font-semibold">
                {encroachmentData.num_encroachments}
              </p>
            </div>

            <div className="space-y-1 col-span-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3" />
                <span>Confidence Score</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${(
                        encroachmentData.confidence_score * 100
                      ).toFixed(0)}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-semibold">
                  {(encroachmentData.confidence_score * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {encroachmentData.locations &&
            encroachmentData.locations.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  Locations ({encroachmentData.locations.length}):
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {encroachmentData.locations.slice(0, 5).map((loc, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-2 bg-muted/50 rounded-md text-xs"
                    >
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-orange-500" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {loc.lat.toFixed(6)}, {loc.lon.toFixed(6)}
                        </p>
                        {loc.type && (
                          <p className="text-muted-foreground">
                            Type: {loc.type}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {encroachmentData.locations.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{encroachmentData.locations.length - 5} more locations
                    </p>
                  )}
                </div>
              </div>
            )}

          {renderLegends(encroachmentData.legends)}
        </CardContent>
      </Card>
    );
  }

  // Object Detection Card
  if (type === "object_detection") {
    const objectData = data as ObjectDetectionResult;
    return (
      <Card className="shadow-lg border-2 hover:border-blue-500/50 transition-colors bg-linear-to-br from-blue-50/50 to-card dark:from-blue-950/20">
        <CardHeader className="pb-3 bg-linear-to-r from-blue-500/10 to-transparent rounded-t-lg">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 font-bold">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Box className="h-4 w-4 text-blue-500" />
              </div>
              Object Detection
            </CardTitle>
            <Badge variant="default">{objectData.total_objects} Objects</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Date</span>
              </div>
              <p className="text-sm font-semibold">
                {formatDate(objectData.date)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Box className="h-3 w-3" />
                <span>Total Objects</span>
              </div>
              <p className="text-sm font-semibold">
                {objectData.total_objects}
              </p>
            </div>

            <div className="space-y-1 col-span-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3" />
                <span>Confidence Score</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${(objectData.confidence_score * 100).toFixed(
                        0
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-semibold">
                  {(objectData.confidence_score * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {objectData.objects_by_type &&
            Object.keys(objectData.objects_by_type).length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  Objects Identified:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(objectData.objects_by_type).map(
                    ([type, count]) => (
                      <div
                        key={type}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                      >
                        <span className="text-xs font-medium capitalize">
                          {type.replace("_", " ")}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {count}
                        </Badge>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

          {objectData.locations && objectData.locations.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Sample Locations ({Math.min(objectData.locations.length, 3)}):
              </p>
              <div className="space-y-2">
                {objectData.locations.slice(0, 3).map((loc, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2 bg-muted/50 rounded-md text-xs"
                  >
                    <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {loc.name || `Object ${idx + 1}`}
                      </p>
                      <p className="text-muted-foreground truncate">
                        {loc.lat.toFixed(6)}, {loc.lon.toFixed(6)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {renderLegends(objectData.legends)}
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default AnalysisResultsCard;
