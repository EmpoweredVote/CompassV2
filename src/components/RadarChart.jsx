import { useCompass } from "../components/CompassContext";
import { useTheme } from "../ThemeProvider";
import { RadarChartCore } from "@empoweredvote/ev-ui";

export default function RadarChart(props) {
  const { topics } = useCompass();
  const { isDark } = useTheme();
  return (
    <RadarChartCore
      topics={topics}
      padding={90}
      lineColor={isDark ? "#9ca3af" : "black"}
      ringColor={isDark ? "#4b5563" : "#ccc"}
      {...props}
    />
  );
}
