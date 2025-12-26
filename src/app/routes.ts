import { Route, Routes } from "react-router-dom"
import { DashboardLayout } from "@/app/(dashboard-2)/layout"

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/dashboard-2" element={<DashboardLayout />}>
        <Route index element={<div>Dashboard Index</div>} />
        <Route path="calendar" element={<div>Calendar</div>} />
        <Route path="mail" element={<div>Mail</div>} />
        <Route path="tasks" element={<div>Tasks</div>} />
      </Route>
    </Routes>
  )
}
