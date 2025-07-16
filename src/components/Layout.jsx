import Sidebar from "./Sidebar";

function Layout({ children }) {
  return (
    <div className="md:flex md:min-h-screen">
      <div className="">
        <Sidebar />
      </div>
      <main className="mb-20 md:flex-1 md:ml-16 md:px-4 md:mb-5">
        {children}
      </main>
    </div>
  );
}

export default Layout;
