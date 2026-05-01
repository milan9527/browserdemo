import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  {
    label: "Web Crawl",
    to: "/demo/web-crawl",
    icon: "🌐",
    description: "Crawl & extract data",
  },
  {
    label: "Auth Login",
    to: "/demo/auth-login",
    icon: "🔐",
    description: "Authenticated browsing",
  },
  {
    label: "Persistent Session",
    to: "/demo/persistent-session",
    icon: "💾",
    description: "Browser profile reuse",
  },
  {
    label: "Custom Agent",
    to: "/demo/custom",
    icon: "🤖",
    description: "Free-form prompt",
  },
  { label: "Sessions", to: "/sessions", icon: "📡", description: "Manage sessions" },
  { label: "Profiles", to: "/profiles", icon: "👤", description: "Browser profiles" },
];

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-sm font-bold text-gray-900">
              AC
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">AgentCore Browser</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                DCV Live View Demo
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className="px-2 pt-2 pb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Demo Scenarios
          </p>
          {navItems.slice(0, 4).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                  isActive
                    ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              <div>
                <div className="font-medium">{item.label}</div>
                <div className="text-[10px] text-gray-500">{item.description}</div>
              </div>
            </NavLink>
          ))}

          <p className="px-2 pt-4 pb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Management
          </p>
          {navItems.slice(4).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                  isActive
                    ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              <div>
                <div className="font-medium">{item.label}</div>
                <div className="text-[10px] text-gray-500">{item.description}</div>
              </div>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <div className="text-[10px] text-gray-600 space-y-1">
            <p>Powered by Amazon Bedrock AgentCore</p>
            <p>DCV protocol for live streaming</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
