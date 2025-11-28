import Sidebar from "./Sidebar";

function Layout({ children }) {
  return (
    <div className="md:flex md:min-h-screen">
      <div className="">
        <Sidebar />
      </div>
      <main className="flex-1 md:ml-20 pb-20 md:pb-5">{children}</main>
    </div>
  );
}

export default Layout;
