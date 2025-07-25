// stock/src/composables/charts/useWeeklyChart.js
import { parseYYMMDD } from "@/utils/date.js";

function getWeeklyFontSize(itemCount, deviceType, type = "default") {
  let baseSize = 18;
  if (type === "total") baseSize = 24;
  if (type === "axis") baseSize = 15;

  let finalSize;
  if (itemCount <= 5) finalSize = baseSize + 6;
  else if (itemCount <= 10) finalSize = baseSize + 3;
  else if (itemCount <= 15) finalSize = baseSize;
  else if (itemCount <= 30) finalSize = baseSize - 2;
  else if (itemCount <= 52)
    finalSize = baseSize - 4; // 52주(1년) 데이터에 대응
  else finalSize = baseSize - 4; // 그 이상

  if (deviceType === "tablet") finalSize *= 0.5;
  if (deviceType === "mobile") finalSize *= 0.4;

  return Math.max(5, Math.round(finalSize));
}

export function useWeeklyChart(options) {
  const { data, deviceType, theme } = options;
  const { textColor, textColorSecondary, surfaceBorder, zoomOptions } = theme;

  const barLabelSize = getWeeklyFontSize(data.length, deviceType, "default");
  const totalLabelSize = getWeeklyFontSize(data.length, deviceType, "total");
  const tickFontSize = getWeeklyFontSize(data.length, deviceType, "axis");

  const monthlyAggregated = data.reduce((acc, item) => {
    const date = parseYYMMDD(item["배당락"]);
    if (!date) return acc;
    const yearMonth = `${date.getFullYear().toString().slice(-2)}.${(date.getMonth() + 1).toString().padStart(2, "0")}`;
    const amount = parseFloat(item["배당금"]?.replace("$", "") || 0);
    const weekOfMonth = Math.floor((date.getDate() - 1) / 7) + 1;
    if (!acc[yearMonth]) {
      acc[yearMonth] = { total: 0, weeks: {} };
    }
    if (!acc[yearMonth].weeks[weekOfMonth]) {
      acc[yearMonth].weeks[weekOfMonth] = 0;
    }
    acc[yearMonth].weeks[weekOfMonth] += amount;
    acc[yearMonth].total += amount;
    return acc;
  }, {});

  const labels = Object.keys(monthlyAggregated);
  const weekColors = {
    1: "#4285F4",
    2: "#EA4335",
    3: "#FBBC04",
    4: "#34A853",
    5: "#FF6D01",
  };
  const existingWeeks = [
    ...new Set(
      Object.values(monthlyAggregated).flatMap((m) => Object.keys(m.weeks))
    ),
  ]
    .map(Number)
    .sort();

  const datasets = existingWeeks.map((week) => ({
    type: "bar",
    label: `${week}주차`,
    backgroundColor: weekColors[week],
    data: labels.map((label) => monthlyAggregated[label].weeks[week] || 0),
    datalabels: {
      display: (context) =>
        (context.dataset.data[context.dataIndex] || 0) > 0.0001,
      formatter: (value) => `$${value.toFixed(4)}`,
      color: "#fff",
      font: { size: barLabelSize, weight: "bold" },
      align: "center",
      anchor: "center",
    },
  }));

  datasets.push({
    type: "bar",
    label: "Total",
    data: new Array(labels.length).fill(0),
    backgroundColor: "transparent",
    datalabels: {
      display: true,
      formatter: (value, context) => {
        const total = monthlyAggregated[labels[context.dataIndex]]?.total || 0;
        return total > 0 ? `$${total.toFixed(4)}` : "";
      },
      color: textColor,
      anchor: "end",
      align: "end",
      offset: (context) => {
        const size =
          context.chart.options.plugins.datalabels.font.size || totalLabelSize;
        return -size / 2 + 2;
      },
      font: { size: totalLabelSize, weight: "bold" },
    },
  });

  const weeklyChartData = { labels, datasets };
  const maxTotal = Math.max(
    0,
    ...Object.values(monthlyAggregated).map((m) => m.total)
  );
  const yAxisMax = maxTotal * 1.25;

  const weeklyChartOptions = {
    maintainAspectRatio: false,
    aspectRatio: (() => {
      switch (deviceType) {
        case "desktop":
          return 16 / 10;
        case "tablet":
          return 3 / 2;
        case "mobile":
          return 4 / 3;
        default:
          return 16 / 10;
      }
    })(),
    plugins: {
      title: { display: false },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: function (tooltipItem) {
            if (tooltipItem.raw > 0 && tooltipItem.dataset.label !== "Total") {
              return `${tooltipItem.dataset.label}: $${Number(
                tooltipItem.raw
              ).toFixed(4)}`;
            }
            return null;
          },
          footer: function (tooltipItems) {
            const validItems = tooltipItems.filter(
              (item) => item.raw > 0 && item.dataset.label !== "Total"
            );
            if (validItems.length === 0) return "";
            const sum = validItems.reduce(
              (total, currentItem) => total + currentItem.raw,
              0
            );
            return "Total: $" + sum.toFixed(4);
          },
        },
      },
      legend: { display: false },
      zoom: zoomOptions,
    },
    scales: {
      x: {
        stacked: true,
        ticks: { color: textColorSecondary, font: { size: tickFontSize } },
        grid: { color: surfaceBorder },
      },
      y: {
        stacked: true,
        ticks: { color: textColorSecondary, font: { size: tickFontSize } },
        grid: { color: surfaceBorder },
        max: yAxisMax,
      },
    },
  };

  return { weeklyChartData, weeklyChartOptions };
}
