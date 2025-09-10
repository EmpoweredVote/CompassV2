import { useState, useEffect, Suspense, lazy } from "react";
import { useCompass } from "../CompassContext";

const PoliticianAdminPanel = lazy(() => import("./PoliticianAdminPanel"));
const AttachAnswers = lazy(() => import("./AttachAnswers"));
const TopicAdminPanel = lazy(() => import("./TopicAdminPanel"));

function AdminDashboard() {
  const { topics } = useCompass();

  const [currentTab, setCurrentTab] = useState("Topics");
  const [allCategories, setAllCategories] = useState([]);
  const [politicians, setPoliticians] = useState([]);
  const [filteredPol, setFilteredPol] = useState([]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/compass/categories`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then(setAllCategories)
      .catch((err) => console.error("Failed to fetch categories:", err));
  }, []);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/essentials/politicians`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then(setPoliticians)
      .catch((err) => console.error("Failed to fetch politicians:", err));
  }, []);

  useEffect(() => {
    setFilteredPol(politicians.filter((p) => p.first_name != "VACANT"));
  }, [politicians]);

  let page;

  switch (currentTab) {
    case "Topics":
      page = <TopicAdminPanel allCategories={allCategories} />;
      break;

    case "Context":
      page = <PoliticianAdminPanel politicians={filteredPol} topics={topics} />;
      break;

    case "Answers":
      page = <AttachAnswers topics={topics} politicians={filteredPol} />;
  }

  const changeTab = (tabName) => {
    setCurrentTab(tabName);
  };

  return (
    <div className="mx-6 mt-6">
      <h1 className="text-center text-2xl font-bold">Admin Dashboard</h1>

      <div className="w-1/2 m-auto">
        <div className="flex flex-row justify-center gap-8 my-4">
          {["Topics", "Context", "Answers"].map((tab) => (
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
