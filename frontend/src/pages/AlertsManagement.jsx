import React, { useState, useEffect } from "react";
import { FaExclamationTriangle, FaBell, FaClock, FaBolt } from "react-icons/fa";

const INACTIVITY_ALERTS_API = "https://ratilalsons-backend-api.onrender.com/api/alerts/inactivity";
const ANOMALY_ALERTS_API = "https://ratilalsons-backend-api.onrender.com/api/alerts/anomaly/detect";

function StatusBadge({ status }) {
  let color = "bg-gray-200 text-gray-600";
  if (["Critical", "open"].includes(status)) color = "bg-red-100 text-red-700 font-bold";
  if (["Unresolved", "Under Investigation"].includes(status))
    color = "bg-yellow-100 text-yellow-700 font-bold";
  if (["Resolved", "closed"].includes(status)) color = "bg-green-100 text-green-700 font-semibold";
  return <span className={`px-4 py-1 rounded text-sm ${color}`}>{status}</span>;
}

export default function Alerts() {
  const [view, setView] = useState("inactivity");
  const [inactivityAlerts, setInactivityAlerts] = useState([]);
  const [anomalyAlerts, setAnomalyAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateParams, setDateParams] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  });

  const fetchAlerts = () => {
    setLoading(true);
    Promise.all([
      fetch(INACTIVITY_ALERTS_API).then((res) => res.json()).catch(() => []),
      fetch(
        `${ANOMALY_ALERTS_API}?start=${dateParams.start}&end=${dateParams.end}`
      )
        .then((res) => res.json())
        .catch(() => []),
    ])
      .then(([ina, ano]) => {
        setInactivityAlerts(Array.isArray(ina) ? ina : []);
        setAnomalyAlerts(Array.isArray(ano) ? ano : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(fetchAlerts, [dateParams.start, dateParams.end]);

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-blue-600 mb-1">Alerts & Notifications</h1>
          <p className="text-gray-600">
            All system alerts for inactivity, overtime, anomalies, and performance issues.
          </p>
        </div>
        <div>
          <FaBell className="text-3xl text-indigo-500" />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg mb-6 border shadow-sm flex overflow-hidden">
        <button
          onClick={() => setView("inactivity")}
          className={`flex-1 flex items-center justify-center px-8 py-4 font-medium space-x-2 ${
            view === "inactivity" ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <FaClock className="mr-2" /> Inactivity & Overtime
        </button>
        <button
          onClick={() => setView("anomaly")}
          className={`flex-1 flex items-center justify-center px-8 py-4 font-medium space-x-2 ${
            view === "anomaly" ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <FaBolt className="mr-2" /> Reading/Performance Anomalies
        </button>
      </div>

      <div className="space-y-10 max-w-8xl mx-auto">
        {view === "inactivity" && (
          <div className="bg-white rounded-lg shadow border p-10">
            <h3 className="text-lg font-semibold mb-8 text-gray-900 flex items-center">
              <FaClock className="mr-2 text-yellow-500" />
              Inactivity & Overtime Alerts
            </h3>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : inactivityAlerts.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <FaExclamationTriangle className="inline mr-2 text-yellow-500" />
                No inactivity or overtime alerts.
              </div>
            ) : (
              <table className="w-full text-base">
                <thead>
                  <tr className="bg-blue-50 text-gray-800 uppercase">
                    <th className="py-3 px-2 text-center font-semibold">Site</th>
                    <th className="py-3 px-2 text-center font-semibold">Generator</th>
                    <th className="py-3 px-2 text-center font-semibold">Alert</th>
                    <th className="py-3 px-2 text-center font-semibold">Since</th>
                    <th className="py-3 px-2 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inactivityAlerts.map((a, idx) => (
                    <tr key={a.id || idx} className={idx % 2 === 1 ? "bg-gray-50" : ""}>
                      <td className="py-4 px-2 text-center font-semibold">{a.site}</td>
                      <td className="py-4 px-2 text-center">{a.generator || a.subject}</td>
                      <td className="py-4 px-2 text-center">{a.issue}</td>
                      <td className="py-4 px-2 text-center">{a.start}</td>
                      <td className="py-4 px-2 text-center">
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {view === "anomaly" && (
          <div className="bg-white rounded-lg shadow border p-10">
            <h3 className="text-lg font-semibold mb-8 text-gray-900 flex items-center">
              <FaBolt className="mr-2 text-red-500" />
              Reading/Performance Anomalies
            </h3>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : anomalyAlerts.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <FaExclamationTriangle className="inline mr-2 text-yellow-500" />
                No reading anomalies detected.
              </div>
            ) : (
              <table className="w-full text-base">
                <thead>
                  <tr className="bg-blue-50 text-gray-800 uppercase">
                    <th className="py-3 px-2 text-center font-semibold">Site</th>
                    <th className="py-3 px-2 text-center font-semibold">Device</th>
                    <th className="py-3 px-2 text-center font-semibold">Anomaly</th>
                    <th className="py-3 px-2 text-center font-semibold">Detected</th>
                    <th className="py-3 px-2 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalyAlerts.map((a, idx) => (
                    <tr key={a.id || idx} className={idx % 2 === 1 ? "bg-gray-50" : ""}>
                      <td className="py-4 px-2 text-center font-semibold">{a.site}</td>
                      <td className="py-4 px-2 text-center">{a.device}</td>
                      <td className="py-4 px-2 text-center text-red-700 font-semibold">{a.anomaly}</td>
                      <td className="py-4 px-2 text-center">{a.detected}</td>
                      <td className="py-4 px-2 text-center">
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
