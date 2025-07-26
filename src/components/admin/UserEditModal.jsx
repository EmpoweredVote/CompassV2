import { useState } from "react";

function UserEditModal({ user, onClose, onSave, deleteUser }) {
  const [updated, setUpdated] = useState({});
  const [showWarning, setShowWarning] = useState(false);

  const handleFieldChange = (field, value) => {
    setUpdated((prev) => ({ ...prev, [field]: value }));
  };

  console.log("Updated", updated);

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4 text-center">
          {user.username}
        </h2>
        <div className="flex flex-col gap-2 items-center">
          <h2 className="text-xl font-semibold">Update Username:</h2>
          <input
            className="border rounded p-1 w-1/2 bg-white"
            value={updated.username}
            onChange={(e) => handleFieldChange("username", e.target.value)}
          />
        </div>

        {showWarning && (
          <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
              <div className="flex flex-col gap-6 items-center">
                <h1 className="text-red-600 text-xl font-semibold text-center">
                  Are you sure you want to delete {user.username}?
                </h1>
                <div className="flex gap-4">
                  <button
                    className="px-4 py-2 bg-red-600 rounded hover:bg-red-500 text-white cursor-pointer"
                    onClick={() => deleteUser(user.user_id)}
                  >
                    Yes
                  </button>
                  <button
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300  text-black cursor-pointer"
                    onClick={() => setShowWarning(false)}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 mx-4 mt-12 justify-between">
          <div>
            <button
              className="px-4 py-2 bg-red-600 rounded hover:bg-red-500 text-white cursor-pointer"
              onClick={() => {
                setShowWarning(true);
              }}
            >
              Delete User
            </button>
          </div>
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={!updated}
              onClick={() => {
                onSave(user.user_id, updated);
                onClose();
              }}
              className="px-4 py-2 bg-black text-white rounded disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed justify-end"
            >
              Update
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserEditModal;
