import { useNavigate } from "react-router";

function Unauthorized() {
  const navigate = useNavigate();
  const redirect = () => {
    navigate("/");
  };

  return (
    <div className="flex flex flex-col items-center justify-center h-screen">
      <h1 className="text-4xl md:text-4xl font-semibold mb-6 text-center">
        401 Unauthorized
      </h1>
      <button
        onClick={redirect}
        className="mt-4 px-6 py-2 bg-black text-white rounded-full hover:bg-opacity-80 transition-all cursor-pointer"
      >
        Go back
      </button>
    </div>
  );
}

export default Unauthorized;
