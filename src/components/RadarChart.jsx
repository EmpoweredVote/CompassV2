import { useCompass } from "../components/CompassContext";
import { RadarChartCore } from "@EmpoweredVote/ev-ui";

export default function RadarChart(props) {
  const { topics } = useCompass();
  return <RadarChartCore topics={topics} {...props} />;
}

// function RadarChart({
//   data,
//   compareData = {},
//   invertedSpokes = {},
//   onToggleInversion,
//   onReplaceTopic,
//   size = 400,
// }) {
//   const padding = 80;
//   const { topics } = useCompass();
//   const radius = size / 2 - 40;
//   const centerX = size / 2;
//   const centerY = size / 2;

//   const spokes = Object.entries(data); // Array of spokes [['topic shortTitle', answerValue], [], etc]
//   const numSpokes = spokes.length;

//   const prevCountRef = useRef(numSpokes);
//   const prevCount = prevCountRef.current;

//   const countChanged = numSpokes !== prevCount;

//   // Update previous count after render
//   useEffect(() => {
//     prevCountRef.current = numSpokes;
//   }, [numSpokes]);

//   const pointsArr = spokes.map(([answer, value], index) => {
//     const currentTopic = topics.find((topic) => topic.short_title == answer);
//     if (!currentTopic) {
//       console.warn("Missing topic for answer:", answer);
//     }
//     const maxLength = currentTopic.stances.length;
//     if (!maxLength) {
//       console.warn("Topic has no stances:", currentTopic);
//     }
//     const percentage = (value / maxLength) * 10;

//     const angle = (2 * Math.PI * index) / numSpokes;
//     //If value === 0 keep it 0, otherwise invert when needed
//     const adjusted =
//       value === 0 ? 0 : invertedSpokes[answer] ? 11 - percentage : percentage;
//     const r = (adjusted / 10) * radius;
//     const x = centerX + r * Math.sin(angle);
//     const y = centerY - r * Math.cos(angle);
//     return [x, y];
//   });

//   const targetPoints = pointsArr.map((p) => p.join(",")).join(" ");
//   const spring = useSpring({
//     to: { points: targetPoints },
//     immediate: countChanged,
//     reset: countChanged,
//     config: { tension: 300, friction: 30 },
//   });

//   let comparePoints = null;
//   if (Object.keys(compareData).length) {
//     const cmpArr = Object.entries(compareData).map(([answer, value], index) => {
//       const currentTopic = topics.find((topic) => topic.short_title == answer);
//       const maxLength = currentTopic.stances.length;
//       const percentage = (value / maxLength) * 10;

//       const angle = (2 * Math.PI * index) / numSpokes;
//       const adjusted =
//         value === 0 ? 0 : invertedSpokes[answer] ? 11 - percentage : percentage;
//       const r = (adjusted / 10) * radius;
//       const x = centerX + r * Math.sin(angle);
//       const y = centerY - r * Math.cos(angle);
//       return [x, y];
//     });

//     comparePoints = cmpArr.map((p) => p.join(",")).join(" ");
//   }

//   const compareSpring = useSpring({
//     to: { points: comparePoints },
//     config: { tension: 300, friction: 30 },
//     immediate: countChanged,
//     reset: countChanged,
//   });

//   const guidePolygons = [];
//   for (let level = 1; level <= 5; level++) {
//     const scale = level / 5;
//     const ringPoints = [];
//     for (let i = 0; i < numSpokes; i++) {
//       const angle = (2 * Math.PI * i) / numSpokes;
//       const x = centerX + radius * scale * Math.sin(angle);
//       const y = centerY - radius * scale * Math.cos(angle);
//       ringPoints.push(`${x},${y}`);
//     }
//     guidePolygons.push(
//       <polygon
//         key={level}
//         points={ringPoints.join(" ")}
//         fill="none"
//         stroke="#ccc"
//       />
//     );
//   }

//   return (
//     <svg
//       className="w-full h-auto"
//       viewBox={`-${padding} -${padding} ${size + padding * 2} ${
//         size + padding * 2
//       }`}
//       preserveAspectRatio="xMidYMid meet"
//     >
//       {guidePolygons}

//       {spokes.map(([answer], i) => {
//         const angle = (2 * Math.PI * i) / numSpokes;
//         const x = centerX + radius * Math.sin(angle);
//         const y = centerY - radius * Math.cos(angle);
//         return (
//           <line
//             key={`line-${answer}`}
//             x1={centerX}
//             y1={centerY}
//             x2={x}
//             y2={y}
//             stroke="black"
//           />
//         );
//       })}

//       {spokes.map(([answer], i) => {
//         const angle = (2 * Math.PI * i) / numSpokes;
//         const offset = radius + 20;
//         const x = centerX + offset * Math.sin(angle);
//         const y = centerY - offset * Math.cos(angle);
//         const anchor =
//           angle > Math.PI
//             ? "end"
//             : angle < Math.PI && angle > 0
//             ? "start"
//             : "middle";

//         return (
//           <text
//             key={`label-${answer}`}
//             x={x}
//             y={y == 20 ? y - 20 : y}
//             textAnchor={anchor}
//             onClick={() => onReplaceTopic(answer)}
//             className="text-xl font-medium mb-1 md:text-base md:font-normal"
//             style={{ cursor: "pointer", userSelect: "none" }}
//           >
//             {wrapLabel(answer, 10).map((ln, index) => (
//               <tspan key={index} x={x} dy={index === 0 ? "0" : "1.1em"}>
//                 {ln}
//               </tspan>
//             ))}
//           </text>
//         );
//       })}

//       {countChanged ? (
//         <polygon
//           points={targetPoints}
//           style={{
//             fill: "rgba(245, 40, 145, 0.4)",
//             stroke: "rgb(245, 40, 145)",
//             strokeWidth: 3,
//           }}
//         />
//       ) : (
//         <animated.polygon
//           points={spring.points}
//           style={{
//             fill: "rgba(245, 40, 145, 0.4)",
//             stroke: "rgb(245, 40, 145)",
//             strokeWidth: 3,
//           }}
//         />
//       )}

//       {comparePoints ? (
//         countChanged ? (
//           <polygon
//             points={comparePoints}
//             style={{
//               fill: "rgba(0,123,255,0.3)",
//               stroke: "rgb(0,123,255)",
//               strokeWidth: 2,
//             }}
//           />
//         ) : (
//           <animated.polygon
//             points={compareSpring.points}
//             style={{
//               fill: "rgba(0,123,255,0.3)",
//               stroke: "rgb(0,123,255)",
//               strokeWidth: 3,
//             }}
//           />
//         )
//       ) : null}

//       {spokes.map(([answer], i) => {
//         const angle = (2 * Math.PI * i) / numSpokes;
//         const x = centerX + radius * Math.sin(angle);
//         const y = centerY - radius * Math.cos(angle);

//         return (
//           <line
//             key={`hitbox-${answer}`}
//             x1={centerX}
//             y1={centerY}
//             x2={x}
//             y2={y}
//             stroke="transparent"
//             strokeWidth={12}
//             onClick={() => onToggleInversion(answer)}
//             style={{ cursor: "pointer" }}
//           />
//         );
//       })}
//     </svg>
//   );
// }

// export default RadarChart;

// function wrapLabel(label, maxChars = 10) {
//   const words = label.split(/\s+/);
//   const lines = [];
//   let line = "";

//   words.forEach((word) => {
//     if (word.length > maxChars) {
//       if (line) {
//         lines.push(line.trim());
//         line = "";
//       }
//       for (let i = 0; i < word.length; i += maxChars) {
//         lines.push(word.slice(i, i + maxChars));
//       }
//       return;
//     }

//     if ((line + word).length > maxChars) {
//       lines.push(line.trim());
//       line = word + " ";
//     } else {
//       line += word + " ";
//     }
//   });

//   if (line) lines.push(line.trim());
//   return lines;
// }
