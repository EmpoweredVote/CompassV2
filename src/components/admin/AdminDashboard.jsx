import { useState, useEffect, Suspense, lazy } from "react";
import { useCompass } from "../CompassContext";

const TopicAdminPanel = lazy(() => import("./TopicAdminPanel"));
const UserAdminPanel = lazy(() => import("./UserAdminPanel"));

function AdminDashboard() {
  const {
    topics,
    setTopics,
    selectedTopics,
    setSelectedTopics,
    answers,
    setAnswers,
    compareAnswers,
    setCompareAnswers,
  } = useCompass();

  const [currentTab, setCurrentTab] = useState("Topics");
  const [allCategories, setAllCategories] = useState([]);
  const [users, setUsers] = useState([]);
  console.log("Topics: ", topics);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/compass/categories`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then(setAllCategories)
      .catch((err) => console.error("Failed to fetch categories:", err));
  }, []);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/auth/empowered-accounts`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then(setUsers)
      .catch((err) => console.error("Failed to fetch users:", err));
  }, []);

  const changeTab = (tabName) => {
    setCurrentTab(tabName);
  };

  return (
    <div className="mx-6">
      <h1 className="text-center text-2xl font-bold">Admin Dashboard</h1>

      <div className="w-1/2 m-auto">
        <div className="flex flex-row justify-center gap-8 my-4">
          {["Topics", "Users"].map((tab) => (
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
        {currentTab === "Topics" ? (
          <TopicAdminPanel allCategories={allCategories} />
        ) : (
          <UserAdminPanel users={users} topics={topics} />
        )}
      </Suspense>
    </div>
  );
}

export default AdminDashboard;
