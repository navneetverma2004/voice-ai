
import React, { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Home from "./views/Home";
import Analytics from "./views/Analytics";
import CallDetail from "./views/CallDetail";
import { ViewState, CallInteraction, CallFromAPI } from "./types";
import { api } from "./services/api";
function generateCustomerId() {
  return "CUST-" + Math.floor(100000 + Math.random() * 900000);
}

// function mapApiCallToInteraction(apiCall: CallFromAPI): CallInteraction {
//   return {
//     id: apiCall.call_id,

//     // ⭐ FIX HERE
//     // customerId: apiCall.customer_id || "NA",
//     // customerName: apiCall.customer_id || "NA",
//       customerId: customerId,
//       customerName: customerId,

//     agentName: "Agent",
//     date: apiCall.created_at || "",
//     duration: "unknown",
//     sentiment: apiCall.sentiment || "neutral",
//     tags: apiCall.tags || [],
//     summary: apiCall.summary || "",
//     transcript: apiCall.transcript || "",
//     emotion: apiCall.emotion || "",
//     analysis: apiCall.analysis,
//   };
// }
function mapApiCallToInteraction(apiCall: CallFromAPI): CallInteraction {
  const customerId =
    apiCall.customer_id && apiCall.customer_id.trim() !== ""
      ? apiCall.customer_id
      : generateCustomerId();

  return {
    id: apiCall.call_id,

    // ✅ FIXED: random customer id if missing
    customerId: customerId,
    customerName: customerId,

    agentName: "Agent",
    date: apiCall.created_at || "",
    duration: "unknown",
    sentiment: apiCall.sentiment || "neutral",
    tags: apiCall.tags || [],
    summary: apiCall.summary || "",
    transcript: apiCall.transcript || "",
    emotion: apiCall.emotion || "",
    analysis: apiCall.analysis,
  };
}


function App() {
  const [currentView, setCurrentView] = useState<ViewState>("HOME");
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<CallInteraction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load all calls from backend
  const loadCalls = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await api.getAllCalls();
      const mapped = data.map(mapApiCallToInteraction);
      setInteractions(mapped);
    } catch (err) {
      console.error(err);
      setError("Failed to load call data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalls();
  }, []);

  const navigateTo = (view: ViewState) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setCurrentView(view);
  };

  const handleSelectCall = (callId: string) => {
    setSelectedCallId(callId);
    navigateTo("CALL_DETAIL");
  };

  // ----------------------------------------------
  // ✅ FIXED: Refresh calls FIRST, then re-render Analytics
  // ----------------------------------------------
  const handleNewAnalysis = async () => {
    await loadCalls();            // reload fresh call data
    setCurrentView("ANALYTICS");  // ensures updated interactions appear immediately
  };

  const renderView = () => {
    if (loading) return <div className="p-10 text-center">Loading...</div>;
    if (error) return <div className="p-10 text-center text-red-500">{error}</div>;

    switch (currentView) {
      case "HOME":
        return <Home onNavigate={navigateTo} />;

      case "ANALYTICS":
        return (
          <Analytics
            interactions={interactions}
            onSelectCall={handleSelectCall}
            onAnalysisComplete={handleNewAnalysis}
          />
        );

      case "CALL_DETAIL":
        return (
          <CallDetail
            callId={selectedCallId || ""}
            interactions={interactions}
            onBack={() => navigateTo("ANALYTICS")}
          />
        );

      default:
        return <Home onNavigate={navigateTo} />;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar currentView={currentView} onNavigate={navigateTo} />
      <main>{renderView()}</main>
    </div>
  );
}

export default App;
