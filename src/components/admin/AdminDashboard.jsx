import { useState, useEffect, Suspense, lazy } from "react";
import { useCompass } from "../CompassContext";
import { apiFetch } from "../../lib/auth";
import GreenLensCoverage from "./GreenLensCoverage";

const PoliticianAdminPanel = lazy(() => import("./PoliticianAdminPanel"));
const AttachAnswers = lazy(() => import("./AttachAnswers"));
const TopicAdminPanel = lazy(() => import("./TopicAdminPanel"));
const TopicRewriteWorkflow = lazy(() => import("./TopicRewriteWorkflow"));

function AdminDashboard() {
  const { topics } = useCompass();

  const [currentTab, setCurrentTab] = useState("Topics");
  const [allCategories, setAllCategories] = useState([]);
  const [politicians, setPoliticians] = useState([]);
  const [filteredPol, setFilteredPol] = useState([]);
  const [defaultPolitician, setDefaultPolitician] = useState(null);

  useEffect(() => {
    apiFetch('/compass/categories')
      .then((res) => res ? res.json() : [])
      .then(setAllCategories)
      .catch((err) => console.error("Failed to fetch categories:", err));
  }, []);

  useEffect(() => {
    apiFetch('/essentials/politicians')
      .then((res) => res ? res.json() : [])
      .then(setPoliticians)
      .catch((err) => console.error("Failed to fetch politicians:", err));
  }, []);

  useEffect(() => {
    setFilteredPol(politicians.filter((p) => p.first_name != "VACANT"));
  }, [politicians]);

  const handleAttachPolitician = (pol) => {
    setDefaultPolitician(pol);
    setCurrentTab("Answers");
  };

  let page;

  switch (currentTab) {
    case "Topics":
      page = <TopicAdminPanel allCategories={allCategories} />;
      break;

    case "Context":
      page = <PoliticianAdminPanel politicians={filteredPol} topics={topics} />;
      break;

    case "Answers":
      page = (
        <AttachAnswers
          topics={topics}
          politicians={filteredPol}
          defaultPolitician={defaultPolitician}
        />
      );
      break;

    case "Green Lens":
      page = (
        <GreenLensCoverage
          politicians={filteredPol}
          topics={topics}
          onAttachPolitician={handleAttachPolitician}
        />
      );
      break;

    case "Rewrite Workflow":
      page = <TopicRewriteWorkflow />;
  }

  const changeTab = (tabName) => {
    if (tabName !== "Answers") setDefaultPolitician(null);
    setCurrentTab(tabName);
  };

  return (
    <div className="mx-6 mt-6">
      <h1 className="text-center text-2xl font-bold">Admin Dashboard</h1>

      <div className="w-3/4 m-auto">
        <div className="flex flex-row justify-center gap-8 my-4">
          {["Topics", "Context", "Answers", "Green Lens", "Rewrite Workflow"].map((tab) => (
            <button
              key={tab}
              className={`py-2 px-8 border rounded-md cursor-pointer font-semibold hover:bg-gray-200 ${
                currentTab === tab ? "bg-gray-100" : ""
              }`}
              onClick={() => changeTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <Suspense fallback={<p className="text-center mt-10">Loading...</p>}>
        {page}
      </Suspense>
    </div>
  );
}

export default AdminDashboard;
