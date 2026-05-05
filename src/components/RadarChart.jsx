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
      lineColor={isDark ? "#6b7280" : "black"}
      ringColor={isDark ? "#3f4451" : "#ccc"}
      {...props}
    />
  );
}
