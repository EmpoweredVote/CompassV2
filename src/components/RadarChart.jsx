import { animated, useSpring } from "@react-spring/web";
import { useRef, useEffect } from "react";

function RadarChart({
  data,
  invertedSpokes = {},
  onToggleInversion,
  onReplaceTopic,
}) {
  const size = 400;
  const radius = size / 2 - 40;
  const centerX = size / 2;
  const centerY = size / 2;

  const topics = Object.entries(data);
  const numSpokes = topics.length;

  const prevCountRef = useRef(numSpokes);
  const prevCount = prevCountRef.current;

  const countChanged = numSpokes !== prevCount;

  // Update previous count after render
  useEffect(() => {
    prevCountRef.current = numSpokes;
  }, [numSpokes]);

  const pointsArr = topics.map(([topic, value], index) => {
    const angle = (2 * Math.PI * index) / numSpokes;
    const adjusted = invertedSpokes[topic] ? 11 - value : value;
    const r = (adjusted / 10) * radius;
    const x = centerX + r * Math.sin(angle);
    const y = centerY - r * Math.cos(angle);
    return [x, y];
  });

  const targetPoints = pointsArr.map((p) => p.join(",")).join(" ");

  const spring = useSpring({
    points: targetPoints,
    config: { tension: 300, friction: 30 },
    immediate: countChanged,
  });

  const guidePolygons = [];
  for (let level = 1; level <= 5; level++) {
    const scale = level / 5;
    const ringPoints = [];
    for (let i = 0; i < numSpokes; i++) {
      const angle = (2 * Math.PI * i) / numSpokes;
      const x = centerX + radius * scale * Math.sin(angle);
      const y = centerY - radius * scale * Math.cos(angle);
      ringPoints.push(`${x},${y}`);
    }
    guidePolygons.push(
      <polygon
        key={level}
        points={ringPoints.join(" ")}
        fill="none"
        stroke="#ccc"
      />
    );
  }

  return (
    <svg width={650} height={size} viewBox={`0 0 ${size} ${size}`}>
      {guidePolygons}

      {topics.map(([topic], i) => {
        const angle = (2 * Math.PI * i) / numSpokes;
        const x = centerX + radius * Math.sin(angle);
        const y = centerY - radius * Math.cos(angle);
        return (
          <line
            key={`line-${topic}`}
            x1={centerX}
            y1={centerY}
            x2={x}
            y2={y}
            stroke="black"
          />
        );
      })}

      {topics.map(([topic], i) => {
        const angle = (2 * Math.PI * i) / numSpokes;
        const offset = radius + 20;
        const x = centerX + offset * Math.sin(angle);
        const y = centerY - offset * Math.cos(angle);
        const anchor =
          angle > Math.PI
            ? "end"
            : angle < Math.PI && angle > 0
            ? "start"
            : "middle";

        return (
          <text
            key={`label-${topic}`}
            x={x}
            y={y}
            textAnchor={anchor}
            onClick={() => onReplaceTopic(topic)}
            style={{ cursor: "pointer", userSelect: "none" }}
          >
            {topic}
          </text>
        );
      })}

      {countChanged ? (
        <polygon
          points={targetPoints}
          style={{
            fill: "rgba(245, 40, 145, 0.4)",
            stroke: "black",
            strokeWidth: 3,
          }}
        />
      ) : (
        <animated.polygon
          points={spring.points}
          style={{
            fill: "rgba(245, 40, 145, 0.4)",
            stroke: "black",
            strokeWidth: 3,
          }}
        />
      )}

      {topics.map(([topic], i) => {
        const angle = (2 * Math.PI * i) / numSpokes;
        const x = centerX + radius * Math.sin(angle);
        const y = centerY - radius * Math.cos(angle);

        return (
          <line
            key={`hitbox-${topic}`}
            x1={centerX}
            y1={centerY}
            x2={x}
            y2={y}
            stroke="transparent"
            strokeWidth={12}
            onClick={() => onToggleInversion(topic)}
            style={{ cursor: "pointer" }}
          />
        );
      })}
    </svg>
  );
}

export default RadarChart;
