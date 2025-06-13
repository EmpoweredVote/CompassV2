import { useNavigate } from "react-router";

function Unauthorized() {
  const navigate = useNavigate();
  const redirect = () => {
    navigate("/");
  };

  return (
    <>
      <h1>401 Unauthorized</h1>
      <button onClick={redirect}>Go back</button>
    </>
  );
}

export default Unauthorized;
