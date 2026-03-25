import { GitBranch, Layers3, Orbit, Sparkles } from "lucide-react";
import type { WorkflowStats } from "@/lib/workflow-types";
import { Card, CardContent } from "@/components/ui/card";

interface WorkflowMetricsProps {
  stats: WorkflowStats;
}

const metricCards = [
  {
    key: "totalNodes",
    label: "Total Nodes",
    icon: Layers3,
    accent: "from-[#1a6670] to-[#2e8b95]",
  },
  {
    key: "parallelStages",
    label: "Parallel Lanes",
    icon: GitBranch,
    accent: "from-[#b66331] to-[#d6824f]",
  },
  {
    key: "loopStages",
    label: "Loop Orbits",
    icon: Orbit,
    accent: "from-[#617929] to-[#8ca646]",
  },
  {
    key: "uniqueModels",
    label: "Model Voices",
    icon: Sparkles,
    accent: "from-[#3b5f67] to-[#67949f]",
  },
] as const;

export function WorkflowMetrics({ stats }: WorkflowMetricsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {metricCards.map((item) => {
        const Icon = item.icon;
        const value =
          item.key === "totalNodes"
            ? stats.totalNodes
            : item.key === "parallelStages"
              ? stats.parallelStages
              : item.key === "loopStages"
                ? stats.loopStages
                : stats.uniqueModels.length;

        return (
          <Card className="metric-plate" key={item.key}>
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div>
                <div className="section-kicker">{item.label}</div>
                <div className="metric-value mt-3 text-foreground">{value}</div>
              </div>

              <div className={`flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-gradient-to-br ${item.accent} text-white shadow-[0_18px_35px_rgba(25,41,44,0.18)]`}>
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
