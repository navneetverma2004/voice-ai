
import React, { useState, useMemo, useEffect } from "react";

import {
  UploadCloud,
  Users,
  ArrowUpRight,
  Clock,
  BarChart3,
  Search,
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

import { CallInteraction } from "../types";
import { api } from "../services/api";

interface AnalyticsProps {
  onSelectCall: (callId: string) => void;
  interactions: CallInteraction[];
  onAnalysisComplete: () => void;
}

const Analytics: React.FC<AnalyticsProps> = ({
  onSelectCall,
  interactions,
  onAnalysisComplete,
}) => {

  // -------------------------------
  // ⭐ NEW: Topic selection state
  // -------------------------------
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const [viewState, setViewState] = useState<"ANALYZING" | "DASHBOARD">(
    "DASHBOARD"
  );
  const [error, setError] = useState<string | null>(null);

  const [totalCalls, setTotalCalls] = useState<number>(0);
  const [weeklyStats, setWeeklyStats] = useState<any>(null);

  const processFile = async (file: File) => {
    setViewState("ANALYZING");
    setError(null);

    try {
      await api.uploadAudio(file);
      await onAnalysisComplete();
      setViewState("DASHBOARD");
    } catch (err) {
      console.error(err);
      setError("Failed to process audio. Backend might be offline.");
      setViewState("DASHBOARD");
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
  };

  // ------------------------------------
  // Fetch weekly stats
  // ------------------------------------
  useEffect(() => {
    fetch("http://localhost:8000/stats/weekly")
      .then((res) => res.json())
      .then((data) => {
        setTotalCalls(data.total_calls || 0);
        setWeeklyStats(data);
      })
      .catch(() => {
        setTotalCalls(interactions.length);
        setWeeklyStats(null);
      });
  }, [interactions]);

  const avgDuration = totalCalls > 0 ? "4m 32s" : "0m 00s";

  // ------------------------------------
  // Conversion Rate
  // ------------------------------------
  const conversionRate = useMemo(() => {
    if (interactions.length === 0) return 0;

    let converted = 0;

    interactions.forEach((call) => {
      const intent = (call.intent || "").toLowerCase();
      const sentiment = (call.sentiment || "").toLowerCase();

      const conversionIntents = [
        "purchase",
        "lead_converted",
        "resolved",
        "upsell",
        "order_placed",
        "payment_done",
        "issue_resolved",
      ];

      const isConverted =
        call.converted === true ||
        conversionIntents.includes(intent) ||
        sentiment.includes("positive");

      if (isConverted) converted++;
    });

    return Math.round((converted / interactions.length) * 100);
  }, [interactions]);

  // ------------------------------------
  // Trending Topics mapping
  // ------------------------------------
  const trendingTopics = useMemo(() => {
    if (weeklyStats?.topics) {
      return weeklyStats.topics.map((t: any) => ({
        label: t._id,
        count: t.count,
      }));
    }
    return [];
  }, [weeklyStats]);

  // ------------------------------------
  // ⭐ FILTER CALLS WHEN TOPIC IS SELECTED
  // ------------------------------------
  const filteredCalls = useMemo(() => {
    if (!selectedTopic) return interactions;

    return interactions.filter(
      (call) => call.tags?.includes(selectedTopic) || call.intent === selectedTopic
    );
  }, [selectedTopic, interactions]);

  // ------------------------------------
  // Volume chart data
  // ------------------------------------
  const volumeData = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const map = days.reduce((acc, d) => ({ ...acc, [d]: 0 }), {});

    interactions.forEach((call) => {
      let dateStr = call.date;
      if (!dateStr) return;

      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        const weekday = parsed.toLocaleString("en-US", { weekday: "short" });
        if (map[weekday] !== undefined) map[weekday] += 1;
      }
    });

    return days.map((d) => ({ name: d, calls: map[d] }));
  }, [interactions]);

  const renderBars = () =>
    volumeData.map((entry, index) => (
      <Cell key={index} fill={entry.calls > 0 ? "#2563eb" : "transparent"} />
    ));

  // ------------------------------------
  // ANALYZING SCREEN
  // ------------------------------------
  if (viewState === "ANALYZING") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 pt-24">
        <h3 className="text-xl font-semibold">Processing with AI…</h3>
        <p className="text-slate-500 text-sm">Transcribing & analyzing your call.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4">

        {/* HEADER */}
        <div className="flex justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">Speech Analytics Dashboard</h1>
            <p className="text-slate-500 text-sm">Real-time insights</p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            <UploadCloud size={16} className="mr-2" /> Upload New
          </Button>

          <input
            id="file-upload"
            type="file"
            hidden
            accept="audio/*"
            onChange={handleFileInput}
          />
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard title="Total Calls" value={totalCalls} change="+0%" icon={<Users />} />
          <StatCard title="Connection Rate" value="100%" change="+0%" icon={<ArrowUpRight />} />
          <StatCard title="Avg Duration" value={avgDuration} change="+0%" icon={<Clock />} />
          <StatCard title="Conversion Rate" value={`${conversionRate}%`} change="+0%" icon={<BarChart3 />} />
        </div>

        {/* CHART + TRENDING TOPICS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* VOLUME CHART */}
          <Card className="col-span-2 p-6">
            <h3 className="font-semibold mb-4">Call Volume Trends</h3>
            <div className="h-[300px]">
              <ResponsiveContainer>
                <BarChart data={volumeData}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="calls">{renderBars()}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* ---------------------------- */}
          {/* ⭐ TRENDING TOPICS (Clickable) */}
          {/* ---------------------------- */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Trending Topics</h3>

            {selectedTopic && (
              <button
                className="mb-3 text-blue-600 underline text-sm"
                onClick={() => setSelectedTopic(null)}
              >
                Clear Filter (show all calls)
              </button>
            )}

            {trendingTopics.length === 0 ? (
              <p className="text-center text-slate-400">No topics available</p>
            ) : (
              trendingTopics.map((topic, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedTopic(topic.label)}
                  className="cursor-pointer hover:bg-slate-100 rounded p-1"
                >
                  <TopicBar
                    label={topic.label}
                    count={topic.count}
                    width={`${Math.min(100, topic.count * 10)}%`}
                  />
                </div>
              ))
            )}
          </Card>
        </div>

        {/* -------------------------------------- */}
        {/* ⭐ RECENT INTERACTIONS (Filtered Calls) */}
        {/* -------------------------------------- */}
        <Card className="mt-10 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex justify-between">
            <h3 className="font-semibold">
              {selectedTopic ? `Calls for: ${selectedTopic}` : "Recent Interactions"}
            </h3>

            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search interactions..." className="pl-10 pr-4 py-2 border rounded-lg w-64" />
            </div>
          </div>

          {filteredCalls.length === 0 ? (
            <p className="text-center py-10 text-slate-400">No calls found.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left w-40">Customer</th>
                  <th className="px-6 py-3 text-left w-32">Agent</th>
                  <th className="px-6 py-3 text-left w-44">Date</th>
                  <th className="px-6 py-3 text-left w-28">Duration</th>
                  <th className="px-6 py-3 text-left w-32">Sentiment</th>
                  <th className="px-6 py-3 text-left w-48">Tags</th>
                  <th className="px-6 py-3 text-right w-20">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredCalls.map((call) => (
                  <tr
                    key={call.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => onSelectCall(call.id)}
                  >
                    {/* <td className="px-6 py-3">{call.customerName}</td> */}
                    <td className="px-6 py-3">
                    {call.customerId || call.customerName || "NA"}
                    </td>
                    <td className="px-6 py-3">{call.agentName}</td>
                    <td className="px-6 py-3 text-slate-500">{call.date}</td>
                    <td className="px-6 py-3 text-slate-500">{call.duration}</td>
                    <td className="px-6 py-3">
                      <SentimentBadge sentiment={call.sentiment} />
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {call.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 bg-slate-100 border rounded text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button size="sm" variant="ghost">
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
};

// -----------------------------
const StatCard = ({ title, value, change, icon }: any) => (
  <Card className="p-5 flex items-start justify-between">
    <div>
      <p className="text-sm text-slate-500">{title}</p>
      <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
      <span className="text-xs text-slate-400">{change} vs last month</span>
    </div>
    <div className="p-2 bg-slate-100 rounded-lg">{icon}</div>
  </Card>
);

const TopicBar = ({ label, count, width }: any) => (
  <div className="flex items-center gap-3 text-sm mb-3">
    <div className="w-32 truncate text-slate-600">{label}</div>
    <div className="flex-1 h-2 bg-slate-200 rounded-full">
      <div className="h-full bg-blue-500 rounded-full" style={{ width }}></div>
    </div>
    <div className="w-10 text-right text-slate-500 text-xs">{count}</div>
  </div>
);

const SentimentBadge = ({ sentiment }: { sentiment: string }) => {
  const s = sentiment.toLowerCase();
  let style = "bg-gray-100 text-gray-700 border-gray-300";

  if (s.includes("positive"))
    style = "bg-green-50 text-green-700 border-green-300";
  else if (s.includes("negative"))
    style = "bg-red-50 text-red-700 border-red-300";

  return (
    <span className={`px-3 py-1 rounded-full text-xs border ${style}`}>
      {sentiment}
    </span>
  );
};

export default Analytics;
