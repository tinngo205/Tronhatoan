"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";

interface ChartDataMember {
  name: string;
  "Đã trả": number;
  "Phải chịu": number;
}

interface ChartDataDaily {
  date: string;
  "Chi tiêu": number;
}

interface OverviewChartsProps {
  memberData: ChartDataMember[];
  dailyData: ChartDataDaily[];
}

export function OverviewCharts({ memberData, dailyData }: OverviewChartsProps) {
  // Format currency for chart tooltips/axes
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return `${value} ₫`;
  };

  const formatTooltipValue = (value: any) => {
    if (typeof value === "number") {
      return value.toLocaleString("vi-VN") + " ₫";
    }
    return String(value);
  };

  const hasMemberData = memberData.length > 0 && memberData.some(d => d["Đã trả"] > 0 || d["Phải chịu"] > 0);
  const hasDailyData = dailyData.length > 0 && dailyData.some(d => d["Chi tiêu"] > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Comparison Bar Chart: Paid vs Eaten */}
      <Card className="border-neutral-100 shadow-sm rounded-3xl overflow-hidden bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-neutral-500 uppercase tracking-wider">
            Đã Trả vs Phải Chịu theo thành viên
          </CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          {hasMemberData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={memberData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                <XAxis dataKey="name" tick={{ fill: "#888888", fontSize: 11 }} tickLine={false} />
                <YAxis
                  tickFormatter={formatCurrency}
                  tick={{ fill: "#888888", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={formatTooltipValue}
                  contentStyle={{ borderRadius: "16px", border: "1px solid #f0f0f0", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)" }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                <Bar dataKey="Đã trả" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Phải chịu" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-400 font-medium">
              Chưa có dữ liệu chi tiêu để hiển thị biểu đồ.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Spend Trend Area Chart */}
      <Card className="border-neutral-100 shadow-sm rounded-3xl overflow-hidden bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-neutral-500 uppercase tracking-wider">
            Xu hướng chi tiêu hàng ngày
          </CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          {hasDailyData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => val.split("-")[2]} // Only show day part (DD)
                  tick={{ fill: "#888888", fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatCurrency}
                  tick={{ fill: "#888888", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={formatTooltipValue}
                  contentStyle={{ borderRadius: "16px", border: "1px solid #f0f0f0", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)" }}
                />
                <Area type="monotone" dataKey="Chi tiêu" stroke="#0ea5e9" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSpend)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-400 font-medium">
              Chưa có chi tiêu nào trong tháng này.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
