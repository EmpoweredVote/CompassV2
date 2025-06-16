import { useCompass } from "../components/CompassContext";
import { useNavigate } from "react-router";

function Compass() {
  const {
    topics,
    setTopics,
    selectedTopics,
    setSelectedTopics,
    categories,
    setCategories,
  } = useCompass();
  const navigate = useNavigate();
}
