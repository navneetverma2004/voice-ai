import React, { useState, useMemo, useEffect } from "react";
import {
  UploadCloud,
  Users,
  ArrowUpRight,
  Clock,
  BarChart3,
} from "lucide-react";

import {
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
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

const downloadAudio = (callId: string) => {
  window.open(`http://localhost:8000/download/audio/${callId}`, "_blank");
};

const Analytics: React.FC<AnalyticsProps> = ({
  onSelectCall,
  interactions,
  onAnalysisComplete,
}) => {
  const [viewState, setViewState] = useState<"ANALYZING" | "DASHBOARD">("DASHBOARD");
  const [totalCalls, setTotalCalls] = useState<number>(0);

  // ===============================
  // FILE UPLOAD
  // ===============================
  const processFile = async (file: File) => {
    setViewState("ANALYZING");
    try {
      await api.uploadAudio(file);
      await onAnalysisComplete();
    } finally {
      setViewState("DASHBOARD");
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
  };

  useEffect(() => {
    setTotalCalls(interactions.length);
  }, [interactions]);

  // ===============================
  // KPIs
  // ===============================
  const avgDuration = totalCalls > 0 ? "4m 32s" : "0m 00s";

  const conversionRate = useMemo(() => {
    if (!interactions.length) return 0;
    const positives = interactions.filter(i =>
      (i.sentiment || "").toLowerCase().includes("positive")
    ).length;
    return Math.round((positives / interactions.length) * 100);
  }, [interactions]);

  // ===============================
  // SENTIMENT PIE
  // ===============================
  const sentimentData = useMemo(() => {
    const c = { positive: 0, neutral: 0, negative: 0 };
    interactions.forEach(i => {
      const s = (i.sentiment || "neutral").toLowerCase();
      if (s.includes("positive")) c.positive++;
      else if (s.includes("negative")) c.negative++;
      else c.neutral++;
    });
    return [
      { name: "Positive", value: c.positive },
      { name: "Neutral", value: c.neutral },
      { name: "Negative", value: c.negative },
    ];
  }, [interactions]);

  // ===============================
  // TRENDING TOPICS
  // ===============================
  const trendingTopics = useMemo(() => {
    const topicCount: Record<string, number> = {};
    interactions.forEach(call => {
      if (Array.isArray(call.tags)) {
        call.tags.forEach(tag => {
          topicCount[tag] = (topicCount[tag] || 0) + 1;
        });
      }
    });

    return Object.entries(topicCount).map(([name, value]) => ({
      name,
      value,
    }));
  }, [interactions]);

  // =====================================================
  // ✅ NEW: WEEKLY CALLS (DAY-WISE PIE CHART DATA)
  // =====================================================
  const weeklyCallsPieData = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const map: Record<string, number> = {
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0,
      Sat: 0,
      Sun: 0,
    };

    interactions.forEach(call => {
      if (!call.date) return;
      const d = new Date(call.date);
      if (!isNaN(d.getTime())) {
        const day = d.toLocaleString("en-US", { weekday: "short" });
        if (map[day] !== undefined) map[day]++;
      }
    });

    return days.map(day => ({
      name: day,
      value: map[day],
    }));
  }, [interactions]);

  if (viewState === "ANALYZING") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <h3 className="text-xl font-semibold">Processing with AI…</h3>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4">

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Total Calls" value={totalCalls} icon={<Users />} />
          <StatCard title="Connection Rate" value="100%" icon={<ArrowUpRight />} />
          <StatCard title="Avg Duration" value={avgDuration} icon={<Clock />} />
          <StatCard title="Conversion Rate" value={`${conversionRate}%`} icon={<BarChart3 />} />
        </div>

        {/* DOWNLOADS */}
        <Card className="p-4 flex gap-3 flex-wrap mb-4">
          <Button onClick={() => api.downloadOverallExcel()}>Download Overall Calls</Button>
          <Button onClick={() => api.downloadWeeklyCallsExcel()}>Download Weekly Calls</Button>
          <Button onClick={() => api.downloadWeeklySalesExcel()}>Download Weekly Sales</Button>
        </Card>

        {/* UPLOAD */}
        <Card className="p-4 mb-6">
          <Button onClick={() => document.getElementById("file-upload")?.click()}>
            <UploadCloud size={16} className="mr-2" />
            Upload New Audio
          </Button>
          <input
            id="file-upload"
            type="file"
            hidden
            accept="audio/*"
            onChange={handleFileInput}
          />
        </Card>

        {/* CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* TRENDING TOPICS */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Trending Topics</h3>
            <ResponsiveContainer height={300}>
              <PieChart>
                <Pie data={trendingTopics} dataKey="value" nameKey="name" outerRadius={100} label>
                  {trendingTopics.map((_, i) => (
                    <Cell key={i} fill={["#2563eb", "#22c55e", "#f97316", "#ef4444", "#8b5cf6"][i % 5]} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* SENTIMENT */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Sentiment Distribution</h3>
            <ResponsiveContainer height={300}>
              <PieChart>
                <Pie data={sentimentData} dataKey="value" nameKey="name" outerRadius={90} label>
                  <Cell fill="#22c55e" />
                  <Cell fill="#94a3b8" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* ✅ NEW: WEEKLY CALLS (DAY-WISE) */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Weekly Calls (Day-wise)</h3>
            <ResponsiveContainer height={300}>
              <PieChart>
                <Pie data={weeklyCallsPieData} dataKey="value" nameKey="name" outerRadius={100} label>
                  {weeklyCallsPieData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={[
                        "#2563eb",
                        "#22c55e",
                        "#f97316",
                        "#ef4444",
                        "#8b5cf6",
                        "#14b8a6",
                        "#eab308",
                      ][i % 7]}
                    />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* TABLE */}
        <Card className="mt-10 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left">Customer</th>
                <th className="px-6 py-3 text-left">Sentiment</th>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {interactions.map(call => (
                <tr key={call.id}>
                  <td className="px-6 py-3">{call.customerId || `CUST-${call.id.slice(-4)}`}</td>
                  <td className="px-6 py-3"><SentimentBadge sentiment={call.sentiment} /></td>
                  <td className="px-6 py-3">{call.date}</td>
                  <td className="px-6 py-3 text-right flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => onSelectCall(call.id)}>View</Button>
                    <Button size="sm" variant="outline" onClick={() => downloadAudio(call.id)}>Download Audio</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon }: any) => (
  <Card className="p-5 flex justify-between">
    <div>
      <p className="text-sm text-slate-500">{title}</p>
      <h4 className="text-2xl font-bold">{value}</h4>
    </div>
    <div className="p-2 bg-slate-100 rounded">{icon}</div>
  </Card>
);

const SentimentBadge = ({ sentiment }: { sentiment: string }) => {
  const s = sentiment.toLowerCase();
  const map: any = {
    positive: "bg-green-100 text-green-700",
    negative: "bg-red-100 text-red-700",
    neutral: "bg-gray-100 text-gray-700",
  };
  return <span className={`px-3 py-1 rounded-full text-xs ${map[s]}`}>{sentiment}</span>;
};

export default Analytics;
