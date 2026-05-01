import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import DemoPage from "./pages/DemoPage";
import SessionsPage from "./pages/SessionsPage";
import ProfilesPage from "./pages/ProfilesPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/demo/web-crawl" replace />} />
        <Route path="/demo/:demoId" element={<DemoPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/profiles" element={<ProfilesPage />} />
      </Route>
    </Routes>
  );
}
