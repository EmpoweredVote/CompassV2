import { useCompass } from "../components/CompassContext";
import { RadarChartCore } from "@chrisandrewsedu/ev-ui";

export default function RadarChart(props) {
  const { topics } = useCompass();
  return <RadarChartCore topics={topics} padding={70} {...props} />;
}
