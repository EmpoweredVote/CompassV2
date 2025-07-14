import Sidebar from "./Sidebar";

function Layout({ children }) {
  return (
    <div className="md:flex md:min-h-screen">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <main className="md:flex-1 md:ml-16 md:px-4">{children}</main>
    </div>
  );
}

export default Layout;
