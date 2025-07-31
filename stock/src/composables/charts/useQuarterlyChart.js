// composables/charts/useQuarterlyChart.js (새 파일)

import { parseYYMMDD } from "@/utils/date.js";

function getDataLabelFontSize(itemCount, deviceType, type = "default") {
  let baseSize = 18;
  if (type === "total") baseSize = 18;
  let finalSize;
  if (itemCount <= 3) finalSize = baseSize + 6;
  else if (itemCount <= 5) finalSize = baseSize;
  else if (itemCount <= 10) finalSize = baseSize - 4;
  else finalSize = baseSize - 6;
  if (deviceType === "tablet") finalSize *= 0.75;
  if (deviceType === "mobile") finalSize *= 0.6;
  return Math.max(5, Math.round(finalSize));
}

function getAxisFontSize(itemCount, deviceType) {
  let baseSize = 12;
  let finalSize;
  if (itemCount <= 3) finalSize = baseSize + 4;
  else if (itemCount <= 5) finalSize = baseSize + 2;
  else if (itemCount <= 10) finalSize = baseSize;
  else finalSize = baseSize - 2;
  if (deviceType === "tablet") finalSize *= 0.8;
  if (deviceType === "mobile") finalSize *= 0.7;
  return Math.max(8, Math.round(finalSize));
}

function getDynamicChartWidth(itemCount, deviceType) {
  if (deviceType !== 'mobile') return '100%';
  if (itemCount <= 4) return '100%';
  const calculatedWidth = itemCount * 90;
  return `${calculatedWidth}px`;
}

export function useQuarterlyChart(options) {
  const { data, deviceType, theme } = options;
  const { textColor, textColorSecondary, surfaceBorder, zoomOptions } = theme;

  const yearlyAggregated = data.reduce((acc, item) => {
    const date = parseYYMMDD(item["배당락"]);
    if (!date) return acc;
    const year = date.getFullYear().toString();
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    const amount = parseFloat(item["배당금"]?.replace("$", "") || 0);

    if (!acc[year]) acc[year] = { total: 0, quarters: {} };
    if (!acc[year].quarters[quarter]) acc[year].quarters[quarter] = 0;
    
    acc[year].quarters[quarter] += amount;
    acc[year].total += amount;
    return acc;
  }, {});

  const labels = Object.keys(yearlyAggregated);
  const chartContainerWidth = getDynamicChartWidth(labels.length, deviceType);
  const barLabelSize = getDataLabelFontSize(labels.length, deviceType, "default");
  const totalLabelSize = getDataLabelFontSize(labels.length, deviceType, "total");
  const tickFontSize = getAxisFontSize(labels.length, deviceType);

  const quarterColors = { 1: "#4285F4", 2: "#EA4335", 3: "#FBBC04", 4: "#34A853" };
  const existingQuarters = [...new Set(Object.values(yearlyAggregated).flatMap((y) => Object.keys(y.quarters)))].map(Number).sort();

  const datasets = existingQuarters.map((q) => ({
    type: "bar", label: `${q}분기`, backgroundColor: quarterColors[q],
    data: labels.map((label) => yearlyAggregated[label].quarters[q] || 0),
    datalabels: {
      display: (context) => (context.dataset.data[context.dataIndex] || 0) > 0.0001 && labels.length <= 10,
      formatter: (value) => `$${value.toFixed(2)}`, color: "#fff",
      font: { size: barLabelSize, weight: "bold" }, align: "center", anchor: "center",
    },
  }));

  datasets.push({
    type: "bar", label: "Total", data: new Array(labels.length).fill(0), backgroundColor: "transparent",
    datalabels: {
      display: labels.length <= 10,
      formatter: (value, context) => {
        const total = yearlyAggregated[labels[context.dataIndex]]?.total || 0;
        return total > 0 ? `$${total.toFixed(2)}` : "";
      },
      color: textColor, anchor: "end", align: "end",
      offset: (context) => (context.chart.options.plugins.datalabels.font.size || totalLabelSize) / -2 + 2,
      font: { size: totalLabelSize, weight: "bold" },
    },
  });

  const quarterlyChartData = { labels, datasets };
  const maxTotal = Math.max(0, ...Object.values(yearlyAggregated).map((y) => y.total));
  const yAxisMax = maxTotal * 1.25;

  const quarterlyChartOptions = {
    maintainAspectRatio: false,
    aspectRatio: deviceType === "desktop" ? 16/10 : (deviceType === "tablet" ? 3/2 : 4/3),
    plugins: {
        title: { display: false },
        tooltip: {
            mode: "index", intersect: false,
            callbacks: {
                label: (item) => item.raw > 0 && item.dataset.label !== "Total" ? `${item.dataset.label}: $${Number(item.raw).toFixed(2)}` : null,
                footer: (items) => {
                    const valid = items.filter(i => i.raw > 0 && i.dataset.label !== "Total");
                    if (valid.length === 0) return "";
                    const sum = valid.reduce((t, c) => t + c.raw, 0);
                    return "Total: $" + sum.toFixed(2);
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

  return { quarterlyChartData, quarterlyChartOptions, chartContainerWidth };
}