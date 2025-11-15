// components/AnalysisCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, TrendingUp, FileText, Clock } from "lucide-react";
import type { EnhancedAnalysis } from "@/types";

interface AnalysisCardProps {
  analysis: EnhancedAnalysis;
}

function getSeverityVariant(
  severity: string
): "destructive" | "default" | "secondary" | "outline" {
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
}

export function AnalysisCard({ analysis }: AnalysisCardProps) {
  // If analysis_summary doesn't exist, create a default one
  const summary = analysis.analysis_summary || {
    header: analysis.analysis_type_display || "Unknown Analysis",
    date: analysis.created_at,
    confidence: analysis.confidence_score,
    severity: analysis.severity,
    location: null,
    coordinates: null,
    legends: [],
    specific_data: {},
  };

  return (
    <Card className="hover:shadow-lg transition-shadow border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold">
            {summary.header}
          </CardTitle>
          {analysis.severity && (
            <Badge variant={getSeverityVariant(analysis.severity)}>
              {analysis.severity_display}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Date */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {new Date(summary.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </div>

        {/* Coordinates */}
        {summary.coordinates && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            <span>
              {summary.coordinates.lat.toFixed(4)},{" "}
              {summary.coordinates.lon.toFixed(4)}
            </span>
          </div>
        )}

        {/* Legends */}
        {summary.legends && summary.legends.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              Legends:
            </p>
            <div className="flex flex-wrap gap-2">
              {summary.legends.map((legend, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-2 py-1 rounded-md border"
                  style={{ borderColor: legend.color }}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: legend.color }}
                  />
                  {legend.icon && <span>{legend.icon}</span>}
                  <span className="text-xs font-medium">{legend.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Specific Data based on Analysis Type */}
        {analysis.analysis_type === "oil_spill_detection" &&
          summary.specific_data?.spill_extent && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                Spill Extent: {summary.specific_data.spill_extent}
              </p>
              {summary.specific_data.num_spills && (
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.specific_data.num_spills} spill(s) detected
                </p>
              )}
            </div>
          )}

        {analysis.analysis_type === "pipeline_encroachment" &&
          summary.specific_data?.num_encroachments !== undefined && (
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                {summary.specific_data.num_encroachments} Encroachment(s)
                Detected
              </p>
              {summary.specific_data.total_area && (
                <p className="text-xs text-muted-foreground mt-1">
                  Total Area: {summary.specific_data.total_area.toFixed(2)} m²
                </p>
              )}
            </div>
          )}

        {analysis.analysis_type === "object_identification" &&
          summary.specific_data?.objects_identified && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                Objects Identified: {summary.specific_data.total_objects}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(summary.specific_data.objects_identified).map(
                  ([type, count]) => (
                    <div key={type} className="flex justify-between">
                      <span className="text-muted-foreground">{type}:</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

        {/* Confidence Score */}
        {analysis.confidence_score !== null && (
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span>
              Confidence: {(analysis.confidence_score * 100).toFixed(1)}%
            </span>
          </div>
        )}

        {/* Processing Time */}
        {analysis.processing_time_seconds !== null && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Processed in {analysis.processing_time_seconds.toFixed(2)}s
            </span>
          </div>
        )}

        {/* Additional Results JSON */}
        {Object.keys(analysis.results_json || {}).length > 0 && (
          <details className="mt-3">
            <summary className="text-xs font-semibold cursor-pointer flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <FileText className="h-3 w-3" />
              View Technical Details
            </summary>
            <div className="mt-2 p-3 bg-muted rounded-lg text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(analysis.results_json, null, 2)}
              </pre>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
