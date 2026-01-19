import { NavLink, Outlet } from "react-router-dom"
import { Sidebar } from "@/components/ui/sidebar"

export function DashboardLayout() {
  return (
    <div className="flex h-screen flex-col">
      <Sidebar
        className="fixed top-0 left-0 z-10 h-screen w-64 flex-shrink-0 bg-white p-4"
        state="expanded"
      >
        <NavLink
          to="/dashboard-2"
          className="block py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          Home
        </NavLink>
        <NavLink
          to="/dashboard-2/calendar"
          className="block py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          Calendar
        </NavLink>
        <NavLink
          to="/dashboard-2/mail"
          className="block py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          Mail
        </NavLink>
        <NavLink
          to="/dashboard-2/tasks"
          className="block py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          Tasks
        </NavLink>
      </Sidebar>
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
