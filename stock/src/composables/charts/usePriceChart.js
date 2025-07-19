// stock/src/composables/charts/usePriceChart.js
import { getChartColorsByGroup } from '@/utils/chartColors.js';

function getPriceFontSize(itemCount, deviceType, type = 'default') {
  let baseSize = 14;
  if (type === 'line') baseSize = 13;
  if (type === 'axis') baseSize = 12;

  let finalSize;
  if (itemCount <= 7) finalSize = baseSize + 2;
  else if (itemCount <= 15) finalSize = baseSize;
  else if (itemCount <= 30) finalSize = baseSize - 2;
  else if (itemCount <= 60) finalSize = baseSize - 3;
  else finalSize = baseSize - 4;

  if (deviceType === 'tablet') finalSize *= 0.9;
  if (deviceType === 'mobile') finalSize *= 0.8;

  return Math.max(9, Math.round(finalSize));
}

export function usePriceChart(options) {
  const { data, deviceType, group, theme } = options;
  // 👇 [핵심 수정] theme 객체에서 필요한 모든 값을 구조 분해 할당합니다.
  const { textColor, textColorSecondary, surfaceBorder, zoomOptions } = theme;

  const {
    dividend: colorDividend,
    highlight: colorHighlight,
    lineDividend: LineDividend,
    prevPrice: colorPrevPrice,
    currentPrice: colorCurrentPrice,
    dividendText,
    highlightText,
    prevPriceText,
    currentPriceText
  } = getChartColorsByGroup(group);

  const barLabelSize = getPriceFontSize(data.length, deviceType, 'default');
  const lineLabelSize = getPriceFontSize(data.length, deviceType, 'line');
  const tickFontSize = getPriceFontSize(data.length, deviceType, 'axis');
  const lastDataIndex = data.length - 1;

  const prices = data
    .flatMap(item => [
      parseFloat(item['전일가']?.replace('$', '')),
      parseFloat(item['당일가']?.replace('$', ''))
    ])
    .filter(p => !isNaN(p));
  const priceMin = prices.length > 0 ? Math.min(...prices) * 0.98 : 0;
  const priceMax = prices.length > 0 ? Math.max(...prices) * 1.02 : 1;

  const priceChartData = {
    labels: data.map(item => item['배당락']),
    datasets: [
      {
        type: 'bar',
        label: '배당금',
        yAxisID: 'y',
        order: 2,
        backgroundColor: (context) =>
          context.dataIndex === lastDataIndex ? colorHighlight : colorDividend,
        borderColor: LineDividend,
        borderWidth: 1,
        data: data.map(item =>
          parseFloat(item['배당금']?.replace('$', '') || 0)
        ),
        datalabels: {
          display: true,
          align: "center",
          anchor: "center",
          color: (context) => context.dataIndex === lastDataIndex ? highlightText : dividendText,
          formatter: (value) => value > 0 ? `$${value.toFixed(2)}` : null,
          font: (context) => ({
            size:
              context.dataIndex === lastDataIndex
                ? barLabelSize + 2
                : barLabelSize,
            weight: context.dataIndex === lastDataIndex ? 'bold' : 'normal'
          })
        }
      },
      {
        type: 'line', label: '전일가', yAxisID: 'y1', order: 1,
        borderColor: colorPrevPrice,
        data: data.map(item => parseFloat(item['전일가']?.replace('$', ''))),
        tension: 0.4, borderWidth: 1, fill: false,
        datalabels: {
          display: true, align: 'top',
          color: prevPriceText,
          formatter: (value) => value ? `$${value.toFixed(2)}` : null,
          font: { size: lineLabelSize * .9 }
        }
      },
      {
        type: 'line', label: '당일가', yAxisID: 'y1', order: 1,
        borderColor: colorCurrentPrice,
        data: data.map(item => parseFloat(item['당일가']?.replace('$', ''))),
        tension: 0.4, borderWidth: 3, fill: false,
        datalabels: {
          display: true, align: 'bottom',
          color: currentPriceText,
          formatter: (value) => value ? `$${value.toFixed(2)}` : null,
          font: { size: lineLabelSize }
        }
      }
    ]
  };

  const priceChartOptions = {
    maintainAspectRatio: false,
    aspectRatio: (() => {
      switch (deviceType) {
        case "desktop": return 16 / 10;
        case "tablet": return 3 / 2;
        case "mobile": return 4 / 3;
        default: return 16 / 10;
      }
    })(),
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: (context) => `${context.dataset.label || ""}: ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(context.parsed.y)}`
        }
      },
      zoom: zoomOptions
    },
    scales: {
      x: {
        ticks: { color: textColorSecondary, font: { size: tickFontSize } },
        grid: { color: surfaceBorder }
      },
      y: {
        type: 'linear', display: true, position: 'left',
        ticks: { color: textColorSecondary, font: { size: tickFontSize } },
        grid: { color: surfaceBorder }
      },
      y1: {
        type: 'linear', display: true, position: 'right',
        min: priceMin, max: priceMax,
        ticks: { color: textColorSecondary, font: { size: tickFontSize } },
        grid: { drawOnChartArea: false, color: surfaceBorder }
      }
    }
  };

  return { priceChartData, priceChartOptions };
}