import { parseYYMMDD } from "@/utils/date.js";

function getDataLabelFontSize(itemCount, deviceType, type = "default") {
  let baseSize = 18;
  if (type === "total") baseSize = 18;
  let finalSize;
  if (itemCount == 1) finalSize = baseSize + 12;
  else if (itemCount == 2) finalSize = baseSize + 6;
  else if (itemCount == 3) finalSize = baseSize + 6;
  else if (itemCount == 4) finalSize = baseSize + 5;
  else if (itemCount == 5) finalSize = baseSize + 5;
  else if (itemCount == 6) finalSize = baseSize + 3;
  else if (itemCount == 7) finalSize = baseSize + 2;
  else if (itemCount == 8) finalSize = baseSize + 1;
  else if (itemCount == 9) finalSize = baseSize + 0;
  else if (itemCount == 10) finalSize = baseSize - 4;
  else if (itemCount == 11) finalSize = baseSize - 5;
  else if (itemCount == 12) finalSize = baseSize - 5;
  else if (itemCount == 13) finalSize = baseSize - 6;
  else if (itemCount == 14) finalSize = baseSize - 6;
  else if (itemCount <= 15) finalSize = baseSize;
  else finalSize = baseSize - 7;
  if (deviceType === "tablet") finalSize *= 0.75;
  if (deviceType === "mobile") finalSize *= 0.6;
  return Math.max(5, Math.round(finalSize));
}

function getAxisFontSize(itemCount, deviceType) {
  let baseSize = 12;
  let finalSize;
  if (itemCount <= 3) finalSize = baseSize + 12;
  else if (itemCount <= 5) finalSize = baseSize + 5;
  else if (itemCount <= 7) finalSize = baseSize + 4;
  else if (itemCount <= 10) finalSize = baseSize + 3;
  else if (itemCount <= 12) finalSize = baseSize + 2;
  else if (itemCount <= 15) finalSize = baseSize;
  else if (itemCount <= 20) finalSize = baseSize - 1;
  else if (itemCount <= 30) finalSize = baseSize - 2;
  else if (itemCount <= 40) finalSize = baseSize - 3;
  else if (itemCount <= 52) finalSize = baseSize - 4;
  else finalSize = baseSize - 5;
  if (deviceType === "tablet") finalSize *= 0.8;
  if (deviceType === "mobile") finalSize *= 0.7;
  return Math.max(8, Math.round(finalSize));
}

function getDynamicChartWidth(itemCount, deviceType) {
  if (deviceType !== 'mobile') return '100%';
  if (itemCount <= 6) return '100%';
  const calculatedWidth = itemCount * 60;
  return `${calculatedWidth}px`;
}

export function useWeeklyChart(options) {
  const { data, deviceType, theme } = options;
  const { textColor, textColorSecondary, surfaceBorder, zoomOptions } = theme;

  const monthlyAggregated = data.reduce((acc, item) => {
    const date = parseYYMMDD(item["배당락"]);
    if (!date) return acc;
    const yearMonth = `${date.getFullYear().toString().slice(-2)}.${(date.getMonth() + 1).toString().padStart(2, "0")}`;
    const amount = parseFloat(item["배당금"]?.replace("$", "") || 0);
    const weekOfMonth = Math.floor((date.getDate() - 1) / 7) + 1;
    if (!acc[yearMonth]) acc[yearMonth] = { total: 0, weeks: {} };
    if (!acc[yearMonth].weeks[weekOfMonth]) acc[yearMonth].weeks[weekOfMonth] = 0;
    acc[yearMonth].weeks[weekOfMonth] += amount;
    acc[yearMonth].total += amount;
    return acc;
  }, {});

  const labels = Object.keys(monthlyAggregated);
  const chartContainerWidth = getDynamicChartWidth(labels.length, deviceType);
  const barLabelSize = getDataLabelFontSize(labels.length, deviceType, "default");
  const totalLabelSize = getDataLabelFontSize(labels.length, deviceType, "total");
  const tickFontSize = getAxisFontSize(labels.length, deviceType);

  const weekColors = { 1: "#4285F4", 2: "#EA4335", 3: "#FBBC04", 4: "#34A853", 5: "#FF6D01" };
  const existingWeeks = [...new Set(Object.values(monthlyAggregated).flatMap((m) => Object.keys(m.weeks)))].map(Number).sort();

  const datasets = existingWeeks.map((week) => ({
    type: "bar", label: `${week}주차`, backgroundColor: weekColors[week],
    data: labels.map((label) => monthlyAggregated[label].weeks[week] || 0),
    datalabels: {
      display: (context) => (context.dataset.data[context.dataIndex] || 0) > 0.0001 && labels.length <= 15,
      formatter: (value) => `$${value.toFixed(4)}`, color: "#fff",
      font: { size: barLabelSize, weight: "bold" }, align: "center", anchor: "center",
    },
  }));

  datasets.push({
    type: "bar", label: "Total", data: new Array(labels.length).fill(0), backgroundColor: "transparent",
    datalabels: {
      display: labels.length <= 15,
      formatter: (value, context) => {
        const total = monthlyAggregated[labels[context.dataIndex]]?.total || 0;
        return total > 0 ? `$${total.toFixed(4)}` : "";
      },
      color: textColor, anchor: "end", align: "end",
      offset: (context) => (context.chart.options.plugins.datalabels.font.size || totalLabelSize) / -2 + 2,
      font: { size: totalLabelSize, weight: "bold" },
    },
  });

  const weeklyChartData = { labels, datasets };
  const maxTotal = Math.max(0, ...Object.values(monthlyAggregated).map((m) => m.total));
  const yAxisMax = maxTotal * 1.25;

  const weeklyChartOptions = {
    maintainAspectRatio: false,
    aspectRatio: deviceType === "desktop" ? 16 / 10 : (deviceType === "tablet" ? 3 / 2 : 4 / 3),
    plugins: {
      title: { display: false },
      tooltip: {
        mode: "index", intersect: false,
        callbacks: {
          label: (item) => item.raw > 0 && item.dataset.label !== "Total" ? `${item.dataset.label}: $${Number(item.raw).toFixed(4)}` : null,
          footer: (items) => {
            const valid = items.filter((i) => i.raw > 0 && i.dataset.label !== "Total");
            if (valid.length === 0) return "";
            const sum = valid.reduce((t, c) => t + c.raw, 0);
            return "Total: $" + sum.toFixed(4);
          },
        },
      },
      legend: { display: false },
      zoom: zoomOptions,
    },
    scales: {
      x: { stacked: true, ticks: { color: textColorSecondary, font: { size: tickFontSize } }, grid: { color: surfaceBorder } },
      y: { stacked: true, ticks: { color: textColorSecondary, font: { size: tickFontSize } }, grid: { color: surfaceBorder }, max: yAxisMax },
    },
  };

  return { weeklyChartData, weeklyChartOptions, chartContainerWidth };
}