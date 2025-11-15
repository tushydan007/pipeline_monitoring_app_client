// components/MapLegend.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LegendData } from "@/types";

interface MapLegendProps {
  legends: LegendData[];
}

export function MapLegend({ legends }: MapLegendProps) {
  if (legends.length === 0) return null;

  return (
    <Card className="absolute bottom-6 left-6 z-1000 max-w-xs bg-card/95 backdrop-blur-sm shadow-xl border-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold">Map Legend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {legends.map((legend, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full shrink-0 border border-border"
                style={{ backgroundColor: legend.color }}
              />
              {legend.icon && <span className="text-sm">{legend.icon}</span>}
              <span className="text-xs font-medium">{legend.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
