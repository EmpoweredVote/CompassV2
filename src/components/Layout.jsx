import { SiteHeader } from "@chrisandrewsedu/ev-ui";
import Sidebar from "./Sidebar";

function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader logoSrc="/EVLogo.png" />
      <div className="flex-1 md:flex">
        <div className="">
          <Sidebar />
        </div>
        <main className="flex-1 md:ml-20 pb-20 md:pb-5">{children}</main>
      </div>
    </div>
  );
}

export default Layout;
