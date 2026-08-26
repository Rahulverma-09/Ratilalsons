// SuperAdminDashboard.jsx
import React, { useState } from "react";
import Sidebar from "./Sidebar";
import OrganizationsPanel from "./OrganizationsPanel";
import UsersPanel from "./UsersPanel";
import GlobalReports from "./GlobalReports";
import AlertsPanel from "./AlertsPanel";
import TenantCustomization from "./TenantCustomization";

export default function SuperAdminDashboard() {
  const [tab, setTab] = useState("organizations");
  return (
    <div className="superadmin-layout" style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar currentTab={tab} setTab={setTab} />
      <div style={{ flex: 1, padding: 24 }}>
        {tab === "organizations" && <OrganizationsPanel />}
        {tab === "users" && <UsersPanel />}
        {tab === "reports" && <GlobalReports />}
        {tab === "alerts" && <AlertsPanel />}
        {tab === "customization" && <TenantCustomization />}
      </div>
    </div>
  );
}
