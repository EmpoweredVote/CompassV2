import { useCompass } from "./CompassContext";
import { useState, useEffect } from "react";

function CompareModal({ onCompare, onClose }) {
  // What is the functionality of the compare modal?
  //    1. On compare button click, open a compare modal with all the empowered users listed. Get compare user with GET /empowered-accounts
  //    2. Select a user to compare with
  //    3. Return selected user's username and ID
  const [users, setUsers] = useState([]); // array of {user_id, username}
  const [selected, setSelected] = useState(null); // single selected user object

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/auth/empowered-accounts`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then(setUsers);
  }, []);

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">
          Select an empowered user:
        </h2>

        <div className="max-h-72 overflow-y-auto space-y-2">
          {users.length ? (
            users.map((u) => (
              <div
                key={u.user_id}
                onClick={() => setSelected(u)}
                className={`flex items-center justify-between border rounded px-3 py-2 cursor-pointer ${
                  selected?.user_id === u.user_id
                    ? "bg-gray-100 border-black"
                    : "hover:bg-gray-50"
                }`}
              >
                <span>{u.username}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">Loading…</p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            disabled={!selected}
            onClick={() => {
              onCompare(selected);
              onClose();
            }}
            className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
          >
            Compare
          </button>
        </div>
      </div>
    </div>
  );
}

export default CompareModal;
