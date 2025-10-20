import os
import json
import yfinance as yf
from tqdm import tqdm
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from utils import load_json_file, save_json_file

ROOT_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
NAV_DIR = os.path.join(PUBLIC_DIR, "nav")

EXCHANGE_MAP = {
    "NYSE Arca": "NYSE",
    "NASDAQ": "NASDAQ",
    "NYSE": "NYSE",
    "BATS": "NASDAQ",
    "AMEX": "NYSE",
}
DEFAULT_US_MARKET = "NYSE"  # 대부분의 ETF는 NYSE Arca에 상장

# 제공해주신 데이터를 파싱하여 Python 리스트로 변환
PREDEFINED_ETF_TEXT = """
VOO	Vanguard S&P 500 ETF	Equity	765.31B
IVV	iShares Core S&P 500 ETF	Equity	696.21B
SPY	SPDR S&P 500 ETF Trust	Equity	671.53B
VTI	Vanguard Total Stock Market ETF	Equity	549.61B
QQQ	Invesco QQQ Trust Series I	Equity	388.02B
VUG	Vanguard Growth ETF	Equity	193.76B
VEA	Vanguard FTSE Developed Markets ETF	Equity	180.14B
IEFA	iShares Core MSCI EAFE ETF	Equity	156.61B
VTV	Vanguard Value ETF	Equity	148.13B
GLD	SPDR Gold Shares	Commodity	143.47B
BND	Vanguard Total Bond Market ETF	Fixed Income	142.10B
AGG	iShares Core U.S. Aggregate Bond ETF	Fixed Income	134.46B
IWF	iShares Russell 1000 Growth ETF	Equity	120.14B
IEMG	iShares Core MSCI Emerging Markets ETF	Equity	111.81B
VGT	Vanguard Information Technology ETF	Equity	110.37B
VXUS	Vanguard Total International Stock ETF	Equity	108.97B
VWO	Vanguard FTSE Emerging Markets ETF	Equity	102.77B
IJH	iShares Core S&P Mid-Cap ETF	Equity	98.52B
VIG	Vanguard Dividend Appreciation ETF	Equity	97.66B
SPLG	SPDR Portfolio S&P 500 ETF	Equity	91.26B
XLK	Technology Select Sector SPDR Fund	Equity	91.13B
VO	Vanguard Mid-Cap ETF	Equity	88.55B
IBIT	iShares Bitcoin Trust ETF	Currency	87.03B
IJR	iShares Core S&P Small Cap ETF	Equity	85.17B
ITOT	iShares Core S&P Total U.S. Stock Market ETF	Equity	77.34B
BNDX	Vanguard Total International Bond ETF	Fixed Income	72.14B
RSP	Invesco S&P 500 Equal Weight ETF	Equity	72.11B
SCHD	Schwab US Dividend Equity ETF	Equity	69.07B
IWM	iShares Russell 2000 ETF	Equity	68.80B
EFA	iShares MSCI EAFE ETF	Equity	67.91B
VB	Vanguard Small-Cap ETF	Equity	67.82B
IAU	iShares Gold Trust	Commodity	66.75B
VYM	Vanguard High Dividend Yield Index ETF	Equity	65.30B
IVW	iShares S&P 500 Growth ETF	Equity	65.12B
QQQM	Invesco NASDAQ 100 ETF	Equity	63.95B
IWD	iShares Russell 1000 Value ETF	Equity	63.58B
SCHX	Schwab U.S. Large-Cap ETF	Equity	60.65B
SGOV	iShares 0-3 Month Treasury Bond ETF	Fixed Income	59.22B
VCIT	Vanguard Intermediate-Term Corporate Bond ETF	Fixed Income	57.17B
VT	Vanguard Total World Stock ETF	Equity	55.44B
SCHF	Schwab International Equity ETF	Equity	52.44B
QUAL	iShares MSCI USA Quality Factor ETF	Equity	52.06B
XLF	Financial Select Sector SPDR Fund	Equity	51.77B
VEU	Vanguard FTSE All-World ex-US Index Fund	Equity	51.23B
IXUS	iShares Core MSCI Total International Stock ETF	Equity	50.53B
SCHG	Schwab U.S. Large-Cap Growth ETF	Equity	50.44B
TLT	iShares 20+ Year Treasury Bond ETF	Fixed Income	49.83B
VV	Vanguard Large-Cap ETF	Equity	45.88B
IWR	iShares Russell Midcap ETF	Equity	44.44B
IWB	iShares Russell 1000 ETF	Equity	43.30B
SPYG	SPDR Portfolio S&P 500 Growth ETF	Equity	43.24B
BIL	SPDR Bloomberg 1-3 Month T-Bill ETF	Fixed Income	42.56B
MBB	iShares MBS ETF	Fixed Income	42.46B
IVE	iShares S&P 500 Value ETF	Equity	41.53B
VTEB	Vanguard Tax-Exempt Bond ETF	Fixed Income	40.95B
JEPI	JPMorgan Equity Premium Income ETF	Equity	40.65B
VCSH	Vanguard Short-Term Corporate Bond ETF	Fixed Income	40.18B
MUB	iShares National Muni Bond ETF	Fixed Income	40.08B
DIA	SPDR Dow Jones Industrial Average ETF Trust	Equity	39.91B
BSV	Vanguard Short-Term Bond ETF	Fixed Income	39.74B
IEF	iShares 7-10 Year Treasury Bond ETF	Fixed Income	39.17B
DFAC	Dimensional U.S. Core Equity 2 ETF	Equity	38.10B
SCHB	Schwab U.S. Broad Market ETF	Equity	37.08B
XLV	Health Care Select Sector SPDR Fund	Equity	35.91B
VGIT	Vanguard Intermediate-Term Treasury ETF	Fixed Income	34.64B
JPST	JPMorgan Ultra-Short Income ETF	Fixed Income	34.19B
DGRO	iShares Core Dividend Growth ETF	Equity	34.18B
VNQ	Vanguard Real Estate ETF	Equity	34.14B
SMH	VanEck Semiconductor ETF	Equity	33.86B
IUSB	iShares Core Total USD Bond Market ETF	Fixed Income	33.34B
VONG	Vanguard Russell 1000 Growth ETF	Equity	32.41B
LQD	iShares iBoxx $ Investment Grade Corporate Bond ETF	Fixed Income	32.29B
GOVT	iShares U.S. Treasury Bond ETF	Fixed Income	31.44B
SPDW	SPDR Portfolio Developed World ex-US ETF	Equity	31.21B
MGK	Vanguard Mega Cap Growth ETF	Equity	31.07B
VBR	Vanguard Small Cap Value ETF	Equity	30.94B
JEPQ	JPMorgan NASDAQ Equity Premium Income ETF	Equity	30.74B
SPYV	SPDR Portfolio S&P 500 Value ETF	Equity	29.48B
OEF	iShares S&P 100 ETF	Equity	27.80B
VGK	Vanguard FTSE Europe ETF	Equity	27.65B
DYNF	iShares U.S. Equity Factor Rotation Active ETF	Equity	27.63B
TQQQ	ProShares UltraPro QQQ	Equity	27.57B
EFV	iShares MSCI EAFE Value ETF	Equity	26.68B
SLV	iShares Silver Trust	Commodity	26.41B
XLC	Communication Services Select Sector SPDR Fund	Equity	26.14B
BIV	Vanguard Intermediate-Term Bond ETF	Fixed Income	26.12B
USHY	iShares Broad USD High Yield Corporate Bond ETF	Fixed Income	25.73B
JAAA	Janus Henderson AAA CLO ETF	Fixed Income	25.48B
IUSG	iShares Core S&P U.S. Growth ETF	Equity	25.10B
XLE	Energy Select Sector SPDR Fund	Equity	25.06B
GDX	VanEck Gold Miners ETF	Equity	24.67B
VXF	Vanguard Extended Market ETF	Equity	24.55B
GLDM	SPDR Gold Minishares Trust of beneficial interest	Commodity	24.44B
SHY	iShares 1-3 Year Treasury Bond ETF	Fixed Income	24.28B
XLY	Consumer Discretionary Select Sector SPDR Fund	Equity	23.84B
VGSH	Vanguard Short-Term Treasury ETF	Fixed Income	23.59B
XLI	Industrial Select Sector SPDR Fund	Equity	23.29B
IDEV	iShares Core MSCI International Developed Markets ETF	Equity	23.11B
MDY	SPDR S&P Midcap 400 ETF Trust	Equity	23.05B
IUSV	iShares Core S&P US Value ETF	Equity	22.96B
CGDV	Capital Group Dividend Value ETF	Equity	22.91B
XLU	Utilities Select Sector SPDR Fund	Equity	22.89B
ACWI	iShares MSCI ACWI ETF	Equity	22.81B
USMV	iShares MSCI USA Min Vol Factor ETF	Equity	22.78B
FBTC	Fidelity Wise Origin Bitcoin Fund	Currency	22.32B
FBND	Fidelity Total Bond ETF	Fixed Income	21.82B
IGSB	iShares 1-5 Year Investment Grade Corporate Bond ETF	Fixed Income	21.67B
IYW	iShares U.S. Technology ETF	Equity	20.98B
VOOG	Vanguard S&P 500 Growth ETF	Equity	20.73B
IWP	iShares Russell Mid-Cap Growth ETF	Equity	20.64B
EEM	iShares MSCI Emerging Markets ETF	Equity	20.60B
VBK	Vanguard Small-Cap Growth ETF	Equity	20.60B
SHV	iShares Short Treasury Bond ETF	Fixed Income	20.58B
FNDX	Schwab Fundamental U.S. Large Company ETF	Equity	20.55B
DVY	iShares Select Dividend ETF	Equity	20.42B
SDY	SPDR S&P Dividend ETF	Equity	19.93B
MTUM	iShares MSCI USA Momentum Factor ETF	Equity	19.41B
HYG	iShares iBoxx $ High Yield Corporate Bond ETF	Fixed Income	19.04B
VOE	Vanguard Mid-Cap Value ETF	Equity	18.91B
SCHA	Schwab U.S. Small-Cap ETF	Equity	18.87B
GBTC	Grayscale Bitcoin Trust ETF	Currency	18.78B
AVUV	Avantis U.S. Small Cap Value ETF	Equity	18.32B
COWZ	Pacer US Cash Cows 100 ETF	Equity	18.17B
VOT	Vanguard Mid-Cap Growth ETF	Equity	18.14B
FNDF	Schwab Fundamental International Equity ETF	Equity	18.08B
USFR	WisdomTree Floating Rate Treasury Fund	Fixed Income	17.73B
DFUS	Dimensional U.S. Equity Market ETF	Equity	17.45B
IEI	iShares 3-7 Year Treasury Bond ETF	Fixed Income	17.41B
CGGR	Capital Group Growth ETF	Equity	17.04B
RDVY	First Trust Rising Dividend Achievers ETF	Equity	17.03B
IWV	iShares Russell 3000 ETF	Equity	16.96B
IGIB	iShares 5-10 Year Investment Grade Corporate Bond ETF	Fixed Income	16.73B
FTEC	Fidelity MSCI Information Technology Index ETF	Equity	16.41B
VTIP	Vanguard Short-Term Inflation-Protected Securities ETF	Fixed Income	16.38B
IWY	iShares Russell Top 200 Growth ETF	Equity	16.27B
DGRW	WisdomTree US Quality Dividend Growth Fund	Equity	15.97B
XLP	Consumer Staples Select Sector SPDR Fund	Equity	15.93B
VHT	Vanguard Health Care ETF	Equity	15.87B
ETHA	iShares Ethereum Trust ETF	Currency	15.71B
EMB	iShares JP Morgan USD Emerging Markets Bond ETF	Fixed Income	15.35B
SOXX	iShares Semiconductor ETF	Equity	15.30B
USIG	iShares Broad USD Investment Grade Corporate Bond ETF	Fixed Income	15.21B
VMBS	Vanguard Mortgage-Backed Securities ETF	Fixed Income	15.15B
EWJ	iShares MSCI Japan ETF	Equity	15.07B
SPHQ	Invesco S&P 500 Quality ETF	Equity	14.88B
SCHP	Schwab US TIPS ETF	Fixed Income	14.73B
ESGU	iShares ESG Aware MSCI USA ETF	Equity	14.66B
PFF	iShares Preferred & Income Securities ETF	Fixed Income	14.55B
SPEM	SPDR Portfolio Emerging Markets ETF	Equity	14.52B
GSLC	TR Activebeta US Large Cap Equity ETF	Equity	14.45B
BBJP	JPMorgan BetaBuilders Japan ETF	Equity	14.34B
MINT	PIMCO Enhanced Short Maturity Active Exchange-Traded Fund	Fixed Income	14.26B
VONV	Vanguard Russell 1000 Value ETF	Equity	14.20B
SPMD	SPDR Portfolio S&P 400 Mid Cap ETF	Equity	14.13B
TIP	iShares TIPS Bond ETF	Fixed Income	14.09B
DFIV	Dimensional International Value ETF	Equity	13.98B
AVEM	Avantis Emerging Markets Equity ETF	Equity	13.89B
IWS	iShares Russell Mid-Cap Value ETF	Equity	13.78B
SCHV	Schwab U.S. Large-Cap Value ETF	Equity	13.60B
BINC	iShares Flexible Income Active ETF	Fixed Income	13.31B
VTWO	Vanguard Russell 2000 ETF	Equity	13.29B
IWO	iShares Russell 2000 Growth ETF	Equity	13.21B
STIP	iShares 0-5 Year TIPS Bond ETF	Fixed Income	13.14B
SOXL	Direxion Daily Semiconductor Bull 3x Shares	Equity	13.09B
SPMO	Invesco S&P 500 Momentum ETF	Equity	13.05B
EMXC	iShares MSCI Emerging Markets ex China ETF	Equity	13.01B
PULS	PGIM Ultra Short Bond ETF	Fixed Income	12.99B
TLH	iShares 10-20 Year Treasury Bond ETF	Fixed Income	12.93B
VYMI	Vanguard International High Dividend Yield ETF	Equity	12.82B
SPTL	SPDR Portfolio Long Term Treasury ETF	Fixed Income	12.68B
AVDV	Avantis International Small Cap Value ETF	Equity	12.68B
MOAT	VanEck Morningstar Wide Moat ETF	Equity	12.64B
VFH	Vanguard Financials ETF	Equity	12.62B
IQLT	iShares MSCI Intl Quality Factor ETF	Equity	12.61B
SPSM	SPDR Portfolio S&P 600 Small Cap ETF	Equity	12.49B
DFUV	Dimensional US Marketwide Value ETF	Equity	12.11B
SCHM	Schwab U.S. Mid-Cap ETF	Equity	12.06B
ITA	iShares U.S. Aerospace & Defense ETF	Equity	11.90B
DFAI	Dimensional International Core Equity Market ETF	Equity	11.88B
IWN	iShares Russell 2000 Value ETF	Equity	11.82B
SCHR	Schwab Intermediate-Term US Treasury ETF	Fixed Income	11.79B
SCHE	Schwab Emerging Markets Equity ETF	Equity	11.47B
SCHO	Schwab Short-Term US Treasury ETF	Fixed Income	11.45B
ESGV	Vanguard ESG U.S. Stock ETF	Equity	11.43B
HDV	iShares Core High Dividend ETF	Equity	11.41B
SPTM	SPDR Portfolio S&P 1500 Composite Stock Market ETF	Equity	11.37B
DFAS	Dimensional U.S. Small Cap ETF	Equity	11.33B
IAGG	iShares Core International Aggregate Bond ETF	Fixed Income	11.29B
DFAT	Dimensional U.S. Targeted Value ETF	Equity	11.28B
NOBL	ProShares S&P 500 Dividend Aristocrats ETF	Equity	11.17B
CIBR	First Trust NASDAQ Cybersecurity ETF	Equity	11.07B
XLG	Invesco S&P 500 Top 50 ETF	Equity	11.00B
DFIC	Dimensional International Core Equity 2 ETF	Equity	10.81B
SPIB	SPDR Portfolio Intermediate Term Corporate Bond ETF	Fixed Income	10.77B
SCZ	iShares MSCI EAFE Small-Cap ETF	Equity	10.68B
ESGD	iShares ESG Aware MSCI EAFE ETF	Equity	10.32B
MGV	Vanguard Mega Cap Value ETF	Equity	10.18B
AVDE	Avantis International Equity ETF	Equity	10.13B
VGLT	Vanguard Long-Term Treasury ETF	Fixed Income	10.12B
SUB	iShares Short-Term National Muni Bond ETF	Fixed Income	10.08B
AMLP	Alerian MLP ETF	Equity	9.99B
QLD	ProShares Ultra QQQ	Equity	9.94B
DUHP	Dimensional US High Profitability ETF	Equity	9.82B
VSS	Vanguard FTSE All-World ex-US Small-Cap ETF	Equity	9.77B
AVUS	Avantis U.S. Equity ETF	Equity	9.71B
EFG	iShares MSCI EAFE Growth ETF	Equity	9.69B
SPTI	SPDR Portfolio Intermediate Term Treasury ETF	Fixed Income	9.67B
IGV	iShares Expanded Tech-Software Sector ETF	Equity	9.66B
PAVE	Global X U.S. Infrastructure Development ETF	Equity	9.63B
DFAX	Dimensional World ex U.S. Core Equity 2 ETF	Equity	9.62B
SPHY	SPDR Portfolio High Yield Bond ETF	Fixed Income	9.59B
INDA	iShares MSCI India ETF	Equity	9.51B
GDXJ	VanEck Junior Gold Miners ETF	Equity	9.49B
DFAU	Dimensional US Core Equity Market ETF	Equity	9.47B
IGM	iShares Expanded Tech Sector ETF	Equity	9.43B
SCHI	Schwab 5-10 Year Corporate Bond ETF	Fixed Income	9.42B
KWEB	KraneShares CSI China Internet ETF	Equity	9.35B
SCHZ	Schwab US Aggregate Bond ETF	Fixed Income	9.20B
PBUS	Invesco MSCI USA ETF	Equity	9.10B
FLOT	iShares Floating Rate Bond ETF	Fixed Income	9.05B
JIRE	JPMorgan International Research Enhanced Equity ETF	Equity	9.02B
SPAB	SPDR Portfolio Aggregate Bond ETF	Fixed Income	8.97B
ONEQ	Fidelity Nasdaq Composite Index ETF	Equity	8.96B
IJK	iShares S&P Mid-Cap 400 Growth ETF	Equity	8.92B
VIGI	Vanguard International Dividend Appreciation ETF	Equity	8.90B
BBCA	JPMorgan BetaBuilders Canada ETF	Equity	8.87B
SDVY	First Trust SMID Cap Rising Dividend Achievers ETF	Equity	8.82B
FVD	First Trust Value Line Dividend Index Fund	Equity	8.72B
FNDA	Schwab Fundamental U.S. Small Company ETF	Equity	8.70B
PYLD	PIMCO Multisector Bond Active Exchange-Traded Fund	Fixed Income	8.53B
IGF	iShares Global Infrastructure ETF	Equity	8.51B
MGC	Vanguard Mega Cap ETF	Equity	8.50B
EZU	iShares MSCI Eurozone ETF	Equity	8.46B
BOXX	Alpha Architect 1-3 Month Box ETF	Fixed Income	8.44B
ARKK	ARK Innovation ETF	Equity	8.36B
SCHH	Schwab U.S. REIT ETF	Equity	8.35B
DFCF	Dimensional Core Fixed Income ETF	Fixed Income	8.34B
JNK	SPDR Bloomberg High Yield Bond ETF	Fixed Income	8.28B
JCPB	JPMorgan Core Plus Bond ETF	Fixed Income	8.28B
FTCS	First Trust Capital Strength ETF	Equity	8.25B
AVLV	Avantis U.S. Large Cap Value ETF	Equity	8.24B
VPU	Vanguard Utilities ETF	Equity	8.23B
DBEF	Xtrackers MSCI EAFE Hedged Equity ETF	Equity	8.20B
SPSB	SPDR Portfolio Short Term Corporate Bond ETF	Fixed Income	8.15B
MCHI	iShares MSCI China ETF	Equity	8.14B
VLUE	iShares MSCI USA Value Factor ETF	Equity	8.14B
PRF	Invesco RAFI US 1000 ETF	Equity	8.12B
QYLD	Global X NASDAQ 100 Covered Call ETF	Equity	8.11B
VCLT	Vanguard Long-Term Corporate Bond ETF	Fixed Income	8.09B
VPL	Vanguard FTSE Pacific ETF	Equity	8.08B
XLRE	Real Estate Select Sector SPDR Fund	Equity	7.90B
FNDE	Schwab Fundamental Emerging Markets Equity ETF	Equity	7.85B
FDN	First Trust Dow Jones Internet Index Fund	Equity	7.82B
IJJ	iShares S&P Mid-Cap 400 Value ETF	Equity	7.79B
JGRO	JPMorgan Active Growth ETF	Equity	7.71B
SPLV	Invesco S&P 500 Low Volatility ETF	Equity	7.68B
BUFR	FT Vest Laddered Buffer ETF	Equity	7.65B
CGGO	Capital Group Global Growth Equity ETF	Equity	7.58B
TSLL	Direxion Daily TSLA Bull 2X Shares	Equity	7.55B
SHYG	iShares 0-5 Year High Yield Corporate Bond ETF	Fixed Income	7.52B
CGUS	Capital Group Core Equity ETF	Equity	7.48B
IOO	iShares Global 100 ETF	Equity	7.38B
JQUA	JPMorgan U.S. Quality Factor ETF	Equity	7.32B
VDC	Vanguard Consumer Staples ETF	Equity	7.25B
JGLO	JPMorgan Global Select Equity ETF Global Select Equity ETF	Equity	7.22B
SPYD	SPDR Portfolio S&P 500 High Dividend ETF	Equity	7.21B
FDVV	Fidelity High Dividend ETF	Equity	7.17B
SSO	ProShares Ultra S&P 500	Equity	7.17B
SGOL	abrdn Physical Gold Shares ETF	Commodity	7.15B
DFAE	Dimensional Emerging Core Equity Market ETF	Equity	7.08B
BAI	iShares A.I. Innovation and Tech Active ETF	Equity	6.96B
ACWX	iShares MSCI ACWI ex U.S. ETF	Equity	6.94B
VONE	Vanguard Russell 1000 ETF	Equity	6.87B
VDE	Vanguard Energy ETF	Equity	6.85B
EWT	iShares MSCI Taiwan ETF	Equity	6.79B
FXI	iShares China Large-Cap ETF	Equity	6.78B
XBI	SPDR S&P BIOTECH ETF	Equity	6.76B
IEUR	iShares Core MSCI Europe ETF	Equity	6.75B
RWL	Invesco S&P 500 Revenue ETF	Equity	6.72B
PPA	Invesco Aerospace & Defense ETF	Equity	6.62B
TFLO	iShares Treasury Floating Rate Bond ETF	Fixed Income	6.60B
JMBS	Janus Henderson Mortgage-Backed Securities ETF	Fixed Income	6.58B
SRLN	SPDR Blackstone Senior Loan ETF	Fixed Income	6.58B
IBB	iShares Biotechnology ETF	Equity	6.57B
AIQ	Global X Artificial Intelligence & Technology ETF	Equity	6.56B
IJS	iShares S&P Small-Cap 600 Value ETF	Equity	6.54B
DFEM	Dimensional Emerging Markets Core Equity 2 ETF	Equity	6.52B
HEFA	iShares Currency Hedged MSCI EAFE ETF	Equity	6.49B
SPMB	SPDR Portfolio Mortgage Backed Bond ETF	Fixed Income	6.48B
ICSH	iShares Ultra Short Duration Bond Active ETF	Fixed Income	6.41B
GBIL	ACCESS TREASURY 0-1 YEAR ETF	Fixed Income	6.40B
IXN	iShares Global Tech ETF	Equity	6.36B
FPE	First Trust Preferred Securities & Income ETF	Fixed Income	6.28B
THRO	iShares U.S. Thematic Rotation Active ETF	Equity	6.24B
VIS	Vanguard Industrials ETF	Equity	6.24B
VCR	Vanguard Consumer Discretionary ETF	Equity	6.23B
IJT	iShares S&P Small-Cap 600 Growth ETF	Equity	6.22B
JMTG	JPMorgan Mortgage-Backed Securities ETF	Fixed Income	6.20B
FTSM	First Trust Enhanced Short Maturity ETF	Fixed Income	6.20B
EWY	iShares MSCI South Korea ETF	Equity	6.19B
BOND	PIMCO Active Bond Exchange-Traded Fund	Fixed Income	6.18B
TBIL	US Treasury 3 Month Bill ETF	Fixed Income	6.10B
BKLN	Invesco Senior Loan ETF	Fixed Income	6.10B
URA	Global X Uranium ETF	Equity	6.05B
URTH	iShares MSCI World ETF	Equity	6.02B
VUSB	Vanguard Ultra-Short Bond ETF	Fixed Income	5.97B
IDV	iShares International Select Dividend ETF	Equity	5.93B
CGCP	Capital Group Core Plus Income ETF	Fixed Income	5.91B
BBUS	JPMorgan BetaBuilders U.S. Equity ETF	Equity	5.91B
BBIN	JPMorgan BetaBuilders International Equity ETF	Equity	5.87B
BBEU	JPMorgan BetaBuilders Europe ETF	Equity	5.87B
BLV	Vanguard Long-Term Bond ETF	Fixed Income	5.85B
TCAF	T. Rowe Price Capital Appreciation Equity ETF	Equity	5.85B
SPTS	SPDR Portfolio Short Term Treasury ETF	Fixed Income	5.83B
AIRR	First Trust RBA American Industrial Renaissance ETF	Equity	5.80B
SPYI	NEOS S&P 500 High Income ETF	Equity	5.72B
FDL	First Trust Morningstar Dividend Leaders Index Fund	Equity	5.69B
VOOV	Vanguard S&P 500 Value ETF	Equity	5.67B
QQQI	NEOS Nasdaq 100 High Income ETF	Equity	5.66B
EWZ	iShares MSCI Brazil ETF	Equity	5.66B
IAUM	iShares Gold Trust Micro ETF of Benef Interest	Commodity	5.66B
VOX	Vanguard Communication Services ETF	Equity	5.65B
SMBS	Schwab Mortgage-Backed Securities ETF	Fixed Income	5.63B
JPIE	JPMorgan Income ETF	Fixed Income	5.61B
XLB	Materials Select Sector SPDR Fund	Equity	5.56B
ESGE	iShares ESG Aware MSCI EM ETF	Equity	5.54B
LMBS	First Trust Low Duration Opportunities ETF	Fixed Income	5.50B
DFSD	Dimensional Short-Duration Fixed Income ETF	Fixed Income	5.50B
KBWB	Invesco KBW Bank ETF	Equity	5.50B
BBAX	JPMorgan BetaBuilders Developed Asia Pacific ex-Japan ETF	Equity	5.45B
SPXL	Direxion Daily S&P 500 Bull 3x Shares	Equity	5.43B
DLN	WisdomTree U.S. LargeCap Dividend Fund	Equity	5.39B
FELC	Fidelity Enhanced Large Cap Core ETF	Equity	5.38B
GUNR	FlexShares Morningstar Global Upstream Natural Resources Index Fund	Equity	5.34B
DFSV	Dimensional US Small Cap Value ETF	Equity	5.32B
VSGX	Vanguard ESG International Stock ETF	Equity	5.29B
DIVO	Amplify CWP Enhanced Dividend Income ETF	Equity	5.24B
EFAV	iShares MSCI EAFE Min Vol Factor ETF	Equity	5.22B
BTC	Grayscale Bitcoin Mini Trust ETF	Currency	5.20B
XMHQ	Invesco S&P MidCap Quality ETF	Equity	5.20B
VWOB	Vanguard Emerging Markets Government Bond ETF	Fixed Income	5.17B
SHLD	Global X Defense Tech ETF	Equity	5.08B
JMST	JPMorgan Ultra-Short Municipal Income ETF	Fixed Income	5.03B
FBCG	Fidelity Blue Chip Growth ETF	Equity	4.99B
SJNK	SPDR Bloomberg Short Term High Yield Bond ETF	Fixed Income	4.97B
SCHC	Schwab International Small-Cap Equity ETF	Equity	4.94B
DSI	iShares ESG MSCI KLD 400 ETF	Equity	4.93B
VFLO	VictoryShares Free Cash Flow ETF	Equity	4.86B
OMFL	Invesco Russell 1000 Dynamic Multifactor ETF	Equity	4.85B
TMF	Direxion Daily 20+ Year Treasury Bull 3X Shares	Fixed Income	4.79B
CWB	SPDR Bloomberg Convertible Securities ETF	Fixed Income	4.76B
PAAA	PGIM AAA CLO ETF	Fixed Income	4.76B
FEZ	SPDR EURO STOXX 50 ETF	Equity	4.75B
FENI	Fidelity Enhanced International ETF	Equity	4.73B
PVAL	Putnam Focused Large Cap Value ETF	Equity	4.72B
DIHP	Dimensional International High Profitability ETF	Equity	4.71B
XMMO	Invesco S&P MidCap Momentum ETF	Equity	4.67B
SCHK	Schwab 1000 Index ETF	Equity	4.66B
GSIE	Goldman Sachs ActiveBeta International Equity ETF	Equity	4.60B
ISTB	iShares Core 1-5 Year USD Bond ETF	Fixed Income	4.59B
ARKB	ARK 21Shares Bitcoin ETF	Currency	4.59B
XAR	SPDR S&P Aerospace & Defense ETF	Equity	4.57B
BKLC	BNY Mellon US Large Cap Core Equity ETF	Equity	4.53B
NVDL	GraniteShares 2x Long NVDA Daily ETF	Equity	4.47B
EEMV	iShares MSCI Emerging Markets Min Vol Factor ETF	Equity	4.45B
BITB	Bitwise Bitcoin ETF Trust	Currency	4.44B
FELG	Fidelity Enhanced Large Cap Growth ETF	Equity	4.41B
EUFN	iShares MSCI Europe Financials ETF	Equity	4.41B
GRID	First Trust Nasdaq Clean Edge Smart GRID Infrastructure Index	Equity	4.40B
UPRO	ProShares UltraPro S&P500	Equity	4.38B
JHMM	John Hancock Multifactor Mid Cap ETF	Equity	4.37B
PDBC	Invesco Optimum Yield Diversified Commodity Strategy No K-1 ETF	Commodity	4.36B
DFLV	Dimensional US Large Cap Value ETF	Equity	4.30B
CGXU	Capital Group International Focus Equity ETF	Equity	4.28B
EAGG	iShares ESG Aware US Aggregate Bond ETF	Fixed Income	4.28B
SIL	Global X Silver Miners ETF	Equity	4.28B
CGMU	Capital Group Municipal Income ETF	Fixed Income	4.27B
VCRB	Vanguard Core Bond ETF	Fixed Income	4.26B
BSCQ	Invesco BulletShares 2026 Corporate Bond ETF	Fixed Income	4.26B
FSEC	Fidelity Investment Grade Securitized ETF	Fixed Income	4.23B
BSCR	Invesco BulletShares 2027 Corporate Bond ETF	Fixed Income	4.23B
DXJ	WisdomTree Japan Hedged Equity Fund	Equity	4.22B
NLR	VanEck Uranium and Nuclear ETF	Equity	4.18B
JAVA	JPMorgan Active Value ETF	Equity	4.17B
JMUB	JPMorgan Municipal ETF	Fixed Income	4.11B
IHI	iShares U.S. Medical Devices ETF	Equity	4.10B
TECL	Direxion Daily Technology Bull 3x Shares	Equity	4.09B
EDV	Vanguard Extended Duration Treasury ETF	Fixed Income	4.09B
RECS	Columbia Research Enhanced Core ETF	Equity	4.07B
EMLC	VanEck J. P. Morgan EM Local Currency Bond ETF	Fixed Income	4.05B
IXJ	iShares Global Healthcare ETF	Equity	4.04B
DFIS	Dimensional International Small Cap ETF	Equity	4.04B
SLYV	SPDR S&P 600 Small Cap Value ETF	Equity	4.03B
RSPT	Invesco S&P 500 Equal Weight Technology ETF	Equity	4.02B
IYF	iShares U.S. Financials ETF	Equity	4.02B
ETHE	Grayscale Ethereum Trust ETF	Currency	4.01B
REET	iShares Global REIT ETF	Equity	4.01B
TOTL	SPDR DoubleLine Total Return Tactical ETF	Fixed Income	3.99B
HYLB	Xtrackers USD High Yield Corporate Bond ETF	Fixed Income	3.94B
PGX	Invesco Preferred ETF	Fixed Income	3.93B
FMDE	Fidelity Enhanced Mid Cap ETF	Equity	3.91B
BILS	SPDR Bloomberg 3-12 Month T-Bill ETF	Fixed Income	3.87B
TDIV	First Trust NASDAQ Technology Dividend Index Fund	Equity	3.80B
NEAR	iShares Short Duration Bond Active ETF	Fixed Income	3.77B
GVI	iShares Intermediate Government/Credit Bond ETF	Fixed Income	3.77B
CALF	Pacer US Small Cap Cash Cows ETF	Equity	3.76B
DISV	Dimensional International Small Cap Value ETF	Equity	3.73B
JBND	JPMorgan Active Bond ETF	Fixed Income	3.68B
IYR	iShares U.S. Real Estate ETF	Equity	3.67B
XT	iShares Future Exponential Technologies ETF	Equity	3.66B
DON	WisdomTree U.S. MidCap Dividend Fund	Equity	3.65B
CGBL	Capital Group Core Balanced ETF	Asset Allocation	3.65B
VTHR	Vanguard Russell 3000 ETF	Equity	3.63B
FV	First Trust Dorsey Wright Focus 5 ETF	Equity	3.63B
SIVR	abrdn Physical Silver Shares ETF	Commodity	3.61B
VNQI	Vanguard Global ex-U.S. Real Estate ETF	Equity	3.59B
SUSA	iShares ESG Optimized MSCI USA ETF	Equity	3.59B
KNG	FT Vest S&P 500 Dividend Aristocrats Target Income ETF	Equity	3.58B
HYD	VanEck High Yield Muni ETF	Fixed Income	3.57B
XME	SPDR S&P Metals & Mining ETF	Equity	3.56B
SLYG	SPDR S&P 600 Small Cap Growth ETF	Equity	3.55B
VBIL	Vanguard 0-3 Month Treasury Bill ETF	Fixed Income	3.54B
SHM	SPDR Nuveen ICE Short Term Municipal Bond ETF	Fixed Income	3.51B
EVTR	Eaton Vance Total Return Bond ETF	Fixed Income	3.50B
CGDG	Capital Group Dividend Growers ETF	Equity	3.49B
SBIL	Simplify Government Money Market ETF	Fixed Income	3.49B
CGMS	Capital Group U.S. Multi-Sector Income ETF	Fixed Income	3.46B
HELO	JPMorgan Hedged Equity Laddered Overlay ETF	Equity	3.46B
GNR	SPDR S&P Global Natural Resources ETF	Equity	3.45B
CMF	iShares California Muni Bond ETF	Fixed Income	3.45B
EWC	iShares MSCI Canada ETF	Equity	3.44B
PZA	Invesco National AMT-Free Municipal Bond ETF	Fixed Income	3.43B
IBDR	iShares iBonds Dec 2026 Term Corporate ETF	Fixed Income	3.43B
FIXD	First Trust Smith Opportunistic Fixed Income ETF	Fixed Income	3.41B
USMC	Principal U.S. Mega-Cap ETF	Equity	3.41B
IBDS	iShares iBonds Dec 2027 Term Corporate ETF	Fixed Income	3.40B
MSTY	YieldMax MSTR Option Income Strategy ETF	Equity	3.39B
COPX	Global X Copper Miners ETF	Equity	3.38B
IMTM	iShares MSCI Intl Momentum Factor ETF	Equity	3.37B
PTLC	Pacer Trendpilot US Large Cap ETF	Equity	3.37B
MSLC	Morgan Stanley Pathway Large Cap Equity ETF	Equity	3.35B
TFI	SPDR Nuveen ICE Municipal Bond ETF	Fixed Income	3.35B
MAGS	Roundhill Magnificent Seven ETF	Equity	3.34B
EMLP	First Trust North American Energy Infrastructure Fund	Equity	3.34B
CGCB	Capital Group Core Bond ETF	Fixed Income	3.31B
GRNY	Fundstrat Granny Shots US Large Cap ETF	Equity	3.30B
LVHI	Franklin International Low Volatility High Dividend Index ETF	Equity	3.30B
ACWV	iShares MSCI Global Min Vol Factor ETF	Equity	3.26B
ULTY	YieldMax Ultra Option Income Strategy ETF	Equity	3.25B
EAGL	Eagle Capital Select Equity ETF	Equity	3.24B
SKYY	First Trust Cloud Computing ETF	Equity	3.23B
AAXJ	iShares MSCI All Country Asia ex Japan ETF	Equity	3.23B
DEM	WisdomTree Emerging Markets High Dividend Fund	Equity	3.22B
IBDT	iShares iBonds Dec 2028 Term Corporate ETF	Fixed Income	3.21B
SQQQ	ProShares UltraPro Short QQQ	Equity	3.20B
USCA	Xtrackers MSCI USA Climate Action Equity ETF	Equity	3.19B
ICVT	iShares Convertible Bond ETF	Fixed Income	3.17B
USRT	iShares Core U.S. REIT ETF	Equity	3.16B
IFRA	iShares U.S. Infrastructure ETF	Equity	3.12B
ANGL	VanEck Fallen Angel High Yield Bond ETF	Fixed Income	3.12B
UCON	First Trust Smith Unconstrained Bond ETF	Fixed Income	3.11B
SILJ	Amplify Junior Silver Miners ETF	Equity	3.10B
BOTZ	Global X Robotics & Artificial Intelligence ETF	Equity	3.09B
IMCG	iShares Morningstar Mid-Cap Growth ETF	Equity	3.09B
SPHD	Invesco S&P 500 High Dividend Low Volatility ETF	Equity	3.07B
IBDU	iShares iBonds Dec 2029 Term Corporate ETF	Fixed Income	3.06B
FETH	Fidelity Ethereum Fund ETF	Currency	3.05B
NFRA	FlexShares STOXX Global Broad Infrastructure Index Fund	Equity	3.04B
XYLD	Global X S&P 500 Covered Call ETF	Equity	3.03B
ILCG	iShares Morningstar Growth ETF	Equity	3.02B
GSY	Invesco Ultra Short Duration ETF	Fixed Income	3.00B
VIOO	Vanguard S&P Small-Cap 600 ETF	Equity	3.00B
FNDC	Schwab Fundamental International Small Equity ETF	Equity	2.98B
JPLD	JPMorgan Limited Duration Bond ETF	Fixed Income	2.97B
CQQQ	Invesco China Technology ETF	Equity	2.94B
QTUM	Defiance Quantum ETF	Equity	2.92B
QTEC	First Trust NASDAQ-100 Technology Sector Index Fund	Equity	2.92B
LRGF	iShares U.S. Equity Factor ETF	Equity	2.91B
BSCS	Invesco BulletShares 2028 Corporate Bond ETF	Fixed Income	2.90B
IWX	iShares Russell Top 200 Value ETF	Equity	2.87B
EPI	WisdomTree India Earnings Fund	Equity	2.86B
IYH	iShares U.S. Healthcare ETF	Equity	2.86B
JTEK	JPMorgan U.S. Tech Leaders ETF	Equity	2.85B
AOR	iShares Core 60/40 Balanced Allocation ETF	Asset Allocation	2.84B
ITB	iShares U.S. Home Construction ETF	Equity	2.84B
IVOO	Vanguard S&P Mid-Cap 400 ETF	Equity	2.83B
DFGR	Dimensional Global Real Estate ETF	Equity	2.83B
BSCP	Invesco Bulletshares 2025 Corporate Bond ETF	Fixed Income	2.82B
KRE	SPDR S&P Regional Banking ETF	Equity	2.82B
ETH	Grayscale Ethereum Mini Trust ETF	Currency	2.82B
FESM	Fidelity Enhanced Small Cap ETF	Equity	2.81B
GSUS	Goldman Sachs MarketBeta U.S. Equity ETF	Equity	2.80B
FLCB	Franklin U.S Core Bond ETF	Fixed Income	2.79B
NUGO	Nuveen Growth Opportunities ETF	Equity	2.78B
VNLA	Janus Henderson Short Duration Income ETF	Fixed Income	2.78B
VAW	Vanguard Materials ETF	Equity	2.78B
IBDQ	iShares iBonds Dec 2025 Term Corporate ETF	Fixed Income	2.77B
EWU	iShares MSCI United Kingdom ETF	Equity	2.77B
HYMB	SPDR Nuveen ICE High Yield Municipal Bond ETF	Fixed Income	2.75B
IGLB	iShares 10+ Year Investment Grade Corporate Bond ETF	Fixed Income	2.73B
BITO	ProShares Bitcoin ETF	Currency	2.72B
RING	iShares MSCI Global Gold Miners ETF	Equity	2.69B
IVLU	iShares MSCI Intl Value Factor ETF	Equity	2.69B
INTF	iShares International Equity Factor ETF	Equity	2.69B
FLRN	SPDR Bloomberg Investment Grade Floating Rate ETF	Fixed Income	2.67B
IYY	iShares Dow Jones U.S. ETF	Equity	2.64B
AOA	iShares Core 80/20 Aggressive Allocation ETF	Asset Allocation	2.63B
ETHU	2x Ether ETF	Currency	2.63B
USCL	iShares Climate Conscious & Transition MSCI USA ETF	Equity	2.61B
UITB	VictoryShares Core Intermediate Bond ETF	Fixed Income	2.61B
KLMN	Invesco MSCI North America Climate ETF	Equity	2.60B
KOMP	SPDR S&P Kensho New Economies Composite ETF	Equity	2.60B
SPGP	Invesco S&P 500 GARP ETF	Equity	2.59B
QLTY	GMO U.S. Quality ETF Shs	Equity	2.59B
FLTR	VanEck IG Floating Rate ETF	Fixed Income	2.57B
FHLC	Fidelity MSCI Health Care Index ETF	Equity	2.56B
TDTT	FlexShares iBoxx 3 Year Target Duration TIPS Index Fund	Fixed Income	2.56B
PRFZ	Invesco RAFI US 1500 Small-Mid ETF	Equity	2.55B
COWG	Pacer US Large Cap Cash Cows Growth Leaders ETF	Equity	2.52B
FLIN	Franklin FTSE India ETF	Equity	2.52B
SMLF	iShares U.S. SmallCap Equity Factor ETF	Equity	2.50B
GCOW	Pacer Global Cash Cows Dividend ETF	Equity	2.48B
MLPX	Global X MLP & Energy Infrastructure ETF	Equity	2.47B
OUNZ	VanEck Merk Gold ETF	Commodity	2.46B
SCMB	Schwab Municipal Bond ETF	Fixed Income	2.46B
ARKW	ARK Next Generation Internet ETF	Equity	2.42B
FELV	Fidelity Enhanced Large Cap Value ETF	Equity	2.41B
FAS	Direxion Daily Financial Bull 3x Shares	Equity	2.41B
MDYV	SPDR S&P 400 Mid Cap Value ETF	Equity	2.40B
FLJP	Franklin FTSE Japan ETF	Equity	2.40B
BSCT	Invesco BulletShares 2029 Corporate Bond ETF	Fixed Income	2.39B
MDYG	SPDR S&P 400 Mid Cap Growth ETF	Equity	2.39B
SPYX	SPDR S&P 500 Fossil Fuel Reserves Free ETF	Equity	2.37B
FTSL	First Trust Senior Loan Fund	Fixed Income	2.37B
AAAU	Goldman Sachs Physical Gold ETF	Commodity	2.37B
RDVI	FT Vest Rising Dividend Achievers Target Income ETF	Equity	2.35B
SLQD	iShares 0-5 Year Investment Grade Corporate Bond ETF	Fixed Income	2.35B
CGHM	Capital Group Municipal High-Income ETF	Fixed Income	2.35B
PFFD	Global X U.S. Preferred ETF	Fixed Income	2.33B
SECT	Main Sector Rotation ETF	Equity	2.33B
FNCL	Fidelity MSCI Financials Index ETF	Equity	2.32B
MUNI	PIMCO Intermediate Municipal Bond Active Exchange-Traded Fund	Fixed Income	2.31B
HACK	Amplify Cybersecurity ETF	Equity	2.28B
VRP	Invesco Variable Rate Preferred ETF	Fixed Income	2.28B
IHDG	WisdomTree International Hedged Quality Dividend Growth Fund	Equity	2.27B
HIMU	iShares High Yield Muni Active ETF	Fixed Income	2.26B
IBDV	iShares iBonds Dec 2030 Term Corporate ETF	Fixed Income	2.25B
TBLL	Invesco Short Term Treasury ETF	Fixed Income	2.24B
BITX	2x Bitcoin Strategy ETF	Currency	2.24B
FNGU	MicroSectors FANG+ 3 Leveraged ETNs	Equity	2.24B
EWW	iShares MSCI Mexico ETF	Equity	2.22B
PHO	Invesco Water Resources ETF	Equity	2.20B
FUTY	Fidelity MSCI Utilities Index ETF	Equity	2.20B
EBND	SPDR Bloomberg Emerging Markets Local Bond ETF	Fixed Income	2.20B
PABU	iShares Paris-Aligned Climate Optimized MSCI USA ETF	Equity	2.19B
SMTH	ALPS/SMITH Core Plus Bond ETF	Fixed Income	2.18B
DCOR	Dimensional US Core Equity 1 ETF	Equity	2.17B
CWI	SPDR MSCI ACWI ex-US ETF	Equity	2.17B
GLTR	abrdn Physical Precious Metals Basket Shares ETF	Commodity	2.16B
ACIO	Aptus Collared Investment Opportunity ETF	Equity	2.16B
TNA	Direxion Daily Small Cap Bull 3x Shares	Equity	2.14B
PXF	Invesco RAFI Developed Markets ex-U.S. ETF	Equity	2.14B
SNPE	Xtrackers S&P 500 Scored & Screened ETF	Equity	2.12B
FTGC	First Trust Global Tactical Commodity Strategy Fund	Commodity	2.12B
XSOE	WisdomTree Emerging Markets ex-State-Owned Enterprises Fund	Equity	2.12B
HDEF	Xtrackers MSCI EAFE High Dividend Yield Equity ETF	Equity	2.11B
PPLT	abrdn Physical Platinum Shares ETF	Commodity	2.10B
URNM	Sprott Uranium Miners ETF	Equity	2.10B
IBTG	iShares iBonds Dec 2026 Term Treasury ETF	Fixed Income	2.10B
FXO	First Trust Financials AlphaDEX Fund	Equity	2.10B
HTRB	Hartford Total Return Bond ETF	Fixed Income	2.09B
APUE	ActivePassive U.S. Equity ETF	Equity	2.08B
JPHY	JPMorgan Active High Yield ETF	Fixed Income	2.07B
GUSA	Goldman Sachs MarketBeta U.S. 1000 Equity ETF	Equity	2.07B
XHLF	BondBloxx Bloomberg Six Month Target Duration US Treasury ETF	Fixed Income	2.05B
QGRO	American Century U.S. Quality Growth ETF	Equity	2.05B
ITM	VanEck Intermediate Muni ETF	Fixed Income	2.04B
EWG	iShares MSCI Germany ETF	Equity	2.03B
JMEE	JPMorgan Small & Mid Cap Enhanced Equity ETF	Equity	2.03B
FLXR	TCW Flexible Income ETF	Fixed Income	2.02B
BKAG	BNY Mellon Core Bond ETF	Fixed Income	2.02B
TSPA	T. Rowe Price U.S. Equity Research ETF	Equity	2.01B
ESML	iShares ESG Aware MSCI USA Small-Cap ETF	Equity	2.01B
BSCU	Invesco BulletShares 2030 Corporate Bond ETF	Fixed Income	2.00B
IDMO	Invesco S&P International Developed Momentum ETF	Equity	2.00B
XSMO	Invesco S&P SmallCap Momentum ETF	Equity	1.99B
FTLS	First Trust Long/Short Equity ETF	Alternatives	1.98B
PFXF	VanEck Preferred Securities ex Financials ETF	Fixed Income	1.98B
FIW	First Trust Water ETF	Equity	1.97B
HODL	VanEck Bitcoin ETF	Currency	1.96B
GTO	Invesco Total Return Bond ETF	Fixed Income	1.95B
QDF	FlexShares Quality Dividend Index Fund	Equity	1.95B
AVSC	Avantis U.S Small Cap Equity ETF	Equity	1.95B
BBMC	JPMorgan BetaBuilders U.S. Mid Cap Equity ETF	Equity	1.94B
DFGP	Dimensional Global Core Plus Fixed Income ETF	Fixed Income	1.94B
ICF	iShares Select U.S. REIT ETF	Equity	1.93B
IBDW	iShares iBonds Dec 2031 Term Corporate ETF	Fixed Income	1.93B
FMB	First Trust Managed Municipal ETF	Fixed Income	1.92B
ILF	iShares Latin America 40 ETF	Equity	1.91B
DIVI	Franklin International Core Dividend Tilt Index Fund	Equity	1.91B
IPAC	iShares Core MSCI Pacific ETF	Equity	1.90B
GPIX	Goldman Sachs S&P 500 Premium Income ETF	Equity	1.88B
QQEW	First Trust Nasdaq-100 Equal Weighted Index Fund	Equity	1.88B
FDIS	Fidelity MSCI Consumer Discretionary Index ETF	Equity	1.88B
ARTY	iShares Future AI & Tech ETF	Equity	1.88B
NULG	Nuveen ESG Large-Cap Growth ETF	Equity	1.87B
IWL	iShares Russell Top 200 ETF	Equity	1.87B
IYG	iShares US Financial Services ETF	Equity	1.87B
IYC	iShares U.S. Consumer Discretionary ETF	Equity	1.86B
FALN	iShares Fallen Angels USD Bond ETF	Fixed Income	1.86B
QGRW	WisdomTree U.S. Quality Growth Fund	Equity	1.86B
PFFA	Virtus InfraCap U.S. Preferred Stock ETF	Fixed Income	1.85B
DBMF	iMGP DBi Managed Futures Strategy ETF	Alternatives	1.85B
GPIQ	Goldman Sachs Nasdaq-100 Premium Income ETF	Equity	1.84B
DES	WisdomTree U.S. SmallCap Dividend Fund	Equity	1.84B
ICLN	iShares Global Clean Energy ETF	Equity	1.83B
BALT	Innovator Defined Wealth Shield ETF	Equity	1.83B
IBTH	iShares iBonds Dec 2027 Term Treasury ETF	Fixed Income	1.83B
FXR	First Trust Industrials/Producer Durables AlphaDEX Fund	Equity	1.83B
WTV	WisdomTree US Value Fund of Benef Interest	Equity	1.81B
NULV	Nuveen ESG Large-Cap Value ETF	Equity	1.81B
DSTL	Distillate US Fundamental Stability & Value ETF	Equity	1.81B
BCI	abrdn Bloomberg All Commodity Strategy K-1 Free ETF	Commodity	1.81B
FCOM	Fidelity MSCI Communication Services Index ETF	Equity	1.80B
TILT	FlexShares Morningstar US Market Factor Tilt Index Fund	Equity	1.80B
TIPX	SPDR Bloomberg 1-10 Year TIPS ETF	Fixed Income	1.79B
XHB	SPDR S&P Homebuilders ETF	Equity	1.79B
REGL	ProShares S&P MidCap 400 Dividend Aristocrats ETF	Equity	1.79B
SMMD	iShares Russell 2500 ETF	Equity	1.79B
EQWL	Invesco S&P 100 Equal Weight ETF	Equity	1.79B
ZROZ	PIMCO 25+ Year Zero Coupon US Treasury Index Exchange-Traded Fund	Fixed Income	1.79B
FXU	First Trust Utilities AlphaDEX Fund	Equity	1.78B
FPEI	First Trust Institutional Preferred Securities & Income ETF	Fixed Income	1.78B
XSD	SPDR S&P Semiconductor ETF	Equity	1.78B
FSMD	Fidelity Small-Mid Multifactor ETF	Equity	1.78B
IBTF	iShares iBonds Dec 2025 Term Treasury ETF	Fixed Income	1.78B
SCYB	Schwab High Yield Bond ETF	Fixed Income	1.78B
TMFC	Motley Fool 100 Index ETF	Equity	1.77B
EPP	iShares MSCI Pacific ex-Japan ETF	Equity	1.77B
NVDY	YieldMax NVDA Option Income Strategy ETF	Equity	1.76B
MLPA	Global X MLP ETF	Equity	1.76B
IXC	iShares Global Energy ETF	Equity	1.76B
ASHR	Xtrackers Harvest CSI 300 China A-Shares ETF	Equity	1.75B
HEDJ	WisdomTree Europe Hedged Equity Fund	Equity	1.74B
DFNM	Dimensional National Municipal Bond ETF	Fixed Income	1.74B
FLQM	Franklin U.S. Mid Cap Multifactor Index ETF	Equity	1.73B
HYLS	First Trust Tactical High Yield ETF	Fixed Income	1.73B
SPBO	SPDR Portfolio Corporate Bond ETF	Fixed Income	1.73B
RWR	SPDR Dow Jones REIT ETF	Equity	1.72B
DFSU	Dimensional US Sustainability Core 1 ETF	Equity	1.72B
QLTA	iShares Aaa-A Rated Corporate Bond ETF	Fixed Income	1.70B
SPUS	SP Funds S&P 500 Sharia Industry Exclusions ETF	Equity	1.70B
JMOM	JPMorgan U.S. Momentum Factor ETF	Equity	1.68B
FTHI	First Trust BuyWrite Income ETF	Equity	1.68B
RPG	Invesco S&P 500 Pure Growth ETF	Equity	1.68B
BSVO	EA Bridgeway Omni Small-Cap Value ETF	Equity	1.68B
ARKQ	ARK Autonomous Technology & Robotics ETF	Equity	1.67B
HYDB	iShares High Yield Systematic Bond ETF	Fixed Income	1.67B
CGSD	Capital Group Short Duration Income ETF	Fixed Income	1.66B
XOP	SPDR S&P Oil & Gas Exploration & Production ETF	Equity	1.66B
IYJ	iShares U.S. Industrials ETF	Equity	1.64B
PXH	Invesco RAFI Emerging Markets ETF	Equity	1.64B
DGS	WisdomTree Emerging Markets SmallCap Dividend Fund	Equity	1.64B
USTB	VictoryShares Short-Term Bond ETF	Fixed Income	1.64B
AOM	iShares Core 40/60 Moderate Allocation ETF	Asset Allocation	1.61B
FLQL	Franklin U.S. Large Cap Multifactor Index ETF	Equity	1.61B
USD	ProShares Ultra Semiconductors	Equity	1.61B
JPEF	JPMorgan Equity Focus ETF	Equity	1.60B
TCHP	T. Rowe Price Blue Chip Growth ETF	Equity	1.59B
IEV	iShares Europe ETF	Equity	1.59B
FTCB	First Trust Core Investment Grade ETF	Fixed Income	1.57B
IAI	iShares U.S. Broker-Dealers & Securities Exchanges ETF	Equity	1.57B
USPX	Franklin U.S. Equity Index ETF	Equity	1.56B
EEMA	iShares MSCI Emerging Markets Asia ETF	Equity	1.56B
MTBA	Simplify MBS ETF	Fixed Income	1.55B
IDU	iShares U.S. Utilities ETF	Equity	1.54B
FRDM	Freedom 100 Emerging Markets ETF	Equity	1.54B
RWJ	Invesco S&P SmallCap 600 Revenue ETF	Equity	1.54B
DUSB	Dimensional Ultrashort Fixed Income ETF	Fixed Income	1.53B
TAGG	T. Rowe Price QM U.S. Bond ETF	Fixed Income	1.52B
CLIP	Global X 1-3 Month T-Bill ETF	Fixed Income	1.52B
YEAR	AB Ultra Short Income ETF	Fixed Income	1.51B
QUS	SPDR MSCI USA StrategicFactors ETF	Equity	1.51B
BLOK	Amplify Transformational Data Sharing ETF	Equity	1.50B
BUFD	FT Vest Laddered Deep Buffer ETF	Equity	1.50B
HYS	PIMCO 0-5 Year High Yield Corporate Bond Index Exchange-Traded Fund	Fixed Income	1.49B
BIZD	VanEck BDC Income ETF	Equity	1.48B
TLTW	iShares 20+ Year Treasury Bond BuyWrite Strategy ETF	Fixed Income	1.48B
EVLN	Eaton Vance Floating-Rate ETF	Fixed Income	1.48B
BNDW	Vanguard Total World Bond ETF	Fixed Income	1.47B
ILOW	AB International Low Volatility Equity ETF	Equity	1.47B
PKW	Invesco Buyback Achievers ETF	Equity	1.47B
FIDU	Fidelity MSCI Industrial Index ETF	Equity	1.46B
GLOV	Activebeta World Low Vol Plus Equity ETF	Equity	1.46B
VTES	Vanguard Short-Term Tax Exempt Bond ETF	Fixed Income	1.44B
FXL	First Trust Technology AlphaDEX Fund	Equity	1.43B
BAR	GraniteShares Gold Shares	Commodity	1.43B
UBND	VictoryShares Core Plus Intermediate Bond ETF	Fixed Income	1.43B
EWA	iShares MSCI Australia ETF	Equity	1.43B
EWP	iShares MSCI Spain ETF	Equity	1.43B
QVML	Invesco S&P 500 QVM Multi-factor ETF	Equity	1.42B
DRSK	Aptus Defined Risk ETF	Asset Allocation	1.42B
BAFE	Brown Advisory Flexible Equity ETF	Equity	1.42B
DTD	WisdomTree U.S. Total Dividend Fund	Equity	1.42B
XNTK	SPDR NYSE Technology ETF	Equity	1.42B
CLOA	iShares AAA CLO Active ETF	Fixed Income	1.42B
IGEB	iShares Investment Grade Systematic Bond ETF	Fixed Income	1.41B
KBE	SPDR S&P Bank ETF	Equity	1.41B
UNIY	WisdomTree Voya Yield Enhanced USD Universal Bond Fund ETF	Fixed Income	1.41B
VIOV	Vanguard S&P Small-Cap 600 Value ETF	Equity	1.41B
VTEC	Vanguard California Tax-Exempt Bond ETF	Fixed Income	1.40B
SCHY	Schwab International Dividend Equity ETF	Equity	1.40B
AVIG	Avantis Core Fixed Income ETF	Fixed Income	1.39B
DFAR	Dimensional US Real Estate ETF	Equity	1.39B
PWB	Invesco Large Cap Growth ETF	Equity	1.39B
REMX	VanEck Rare Earth and Strategic Metals ETF	Equity	1.39B
EWL	iShares MSCI Switzerland ETF	Equity	1.38B
KLMT	Invesco MSCI Global Climate 500 ETF	Equity	1.38B
FSIG	First Trust Limited Duration Investment Grade Corporate ETF	Fixed Income	1.38B
VTC	Vanguard Total Corporate Bond ETF	Fixed Income	1.38B
FDLO	Fidelity Low Volatility Factor ETF	Equity	1.37B
EUSA	iShares MSCI USA Equal Weighted ETF	Equity	1.37B
LCTU	BlackRock U.S. Carbon Transition Readiness ETF	Equity	1.37B
RAVI	FlexShares Ultra-Short Income Fund	Fixed Income	1.37B
GSEW	Goldman Sachs Equal Weight U.S. Large Cap Equity ETF	Equity	1.36B
CORP	PIMCO Investment Grade Corporate Bond Index ETF	Fixed Income	1.35B
AIA	iShares Asia 50 ETF	Equity	1.35B
FEX	First Trust Large Cap Core AlphaDEX Fund	Equity	1.35B
PDP	Invesco Dorsey Wright Momentum ETF	Equity	1.35B
ARKF	ARK Fintech Innovation ETF	Equity	1.35B
INFL	Horizon Kinetics Inflation Beneficiaries ETF	Equity	1.34B
IBDX	iShares iBonds Dec 2032 Term Corporate ETF	Fixed Income	1.34B
ARKG	ARK Genomic Revolution ETF	Equity	1.34B
PREF	Principal Spectrum Preferred Secs Active ETF	Fixed Income	1.34B
BWX	SPDR Bloomberg International Treasury Bond ETF	Fixed Income	1.34B
BSCV	Invesco BulletShares 2031 Corporate Bond ETF	Fixed Income	1.33B
IVOG	Vanguard S&P Mid-Cap 400 Growth ETF	Equity	1.33B
RPV	Invesco S&P 500 Pure Value ETF	Equity	1.33B
FSTA	Fidelity MSCI Consumer Staples Index ETF	Equity	1.32B
RSSL	Global X Russell 2000 ETF	Equity	1.32B
ICOW	Pacer Developed Markets International Cash Cows 100 ETF	Equity	1.31B
AGQ	ProShares Ultra Silver	Commodity	1.31B
JBBB	Janus Henderson B-BBB CLO ETF	Fixed Income	1.31B
LIT	Global X Lithium & Battery Tech ETF	Equity	1.30B
JPIB	JPMorgan International Bond Opportunities ETF of Benef Interest	Fixed Income	1.30B
SOXS	Direxion Daily Semiconductor Bear 3x Shares	Equity	1.29B
VRIG	Invesco Variable Rate Investment Grade ETF	Fixed Income	1.29B
UTES	Virtus Reaves Utilities ETF	Equity	1.29B
IYK	iShares U.S. Consumer Staples ETF	Equity	1.29B
SUSC	iShares ESG Aware USD Corporate Bond ETF	Fixed Income	1.29B
PCY	Invesco Emerging Markets Sovereign Debt ETF	Fixed Income	1.29B
BBAG	JPMorgan BetaBuilders U.S. Aggregate Bond ETF	Fixed Income	1.28B
XCEM	Columbia EM Core ex-China ETF	Equity	1.28B
EQTY	Kovitz Core Equity ETF	Equity	1.28B
QQQE	Direxion NASDAQ-100 Equal Weighted Index Shares	Equity	1.27B
DHS	WisdomTree U.S. High Dividend Fund	Equity	1.27B
FENY	Fidelity MSCI Energy Index ETF	Equity	1.27B
DBC	Invesco DB Commodity Index Tracking Fund	Commodity	1.27B
PTNQ	Pacer Trendpilot 100 ETF	Equity	1.27B
MEAR	iShares Short Maturity Municipal Bond Active ETF	Fixed Income	1.27B
TSLY	YieldMax TSLA Option Income Strategy ETF	Equity	1.26B
FTGS	First Trust Growth Strength ETF	Equity	1.26B
FTC	First Trust Large Cap Growth AlphaDEX Fund	Equity	1.26B
EPS	WisdomTree U.S. LargeCap Fund	Equity	1.26B
QDPL	Pacer Metaurus US Large Cap Dividend Multiplier 400 ETF	Equity	1.26B
RODM	Hartford Multifactor Developed Markets (ex-US) ETF	Equity	1.26B
NTSX	WisdomTree U.S. Efficient Core Fund	Asset Allocation	1.25B
RYLD	Global X Russell 2000 Covered Call ETF	Equity	1.25B
JEMA	JPMorgan ActiveBuilders Emerging Markets Equity ETF	Equity	1.25B
EMGF	iShares Emerging Markets Equity Factor ETF	Equity	1.25B
JSI	Janus Henderson Securitized Income ETF	Fixed Income	1.25B
CONY	YieldMax COIN Option Income Strategy ETF	Equity	1.25B
SPGM	SPDR Portfolio MSCI Global Stock Market ETF	Equity	1.24B
NUGT	Direxion Daily Gold Miners Index Bull 2x Shares	Equity	1.24B
FWD	AB Disruptors ETF	Equity	1.24B
CTA	Simplify Managed Futures Strategy ETF	Alternatives	1.23B
CLOI	VanEck CLO ETF	Fixed Income	1.23B
PPH	VanEck Pharmaceutical ETF	Equity	1.23B
NUSC	Nuveen ESG Small-Cap ETF	Equity	1.22B
SDOG	ALPS Sector Dividend Dogs ETF	Equity	1.22B
HYGV	FlexShares High Yield Value-Scored Bond Index Fund	Fixed Income	1.21B
PSC	Principal U.S. Small-Cap ETF	Equity	1.20B
ROBO	ROBO Global Robotics & Automation Index ETF	Equity	1.20B
DFGX	Dimensional Global ex US Core Fixed Income ETF	Fixed Income	1.20B
IMCB	iShares Morningstar Mid-Cap ETF	Equity	1.20B
DFEV	Dimensional Emerging Markets Value ETF	Equity	1.19B
PJUL	Innovator U.S. Equity Power Buffer ETF - July	Equity	1.19B
PJAN	Innovator U.S. Equity Power Buffer ETF - January	Equity	1.19B
VFMO	Vanguard U.S. Momentum Factor ETF	Equity	1.19B
PWV	Invesco Large Cap Value ETF	Equity	1.19B
MMIT	NYLI MacKay Muni Intermediate ETF	Fixed Income	1.19B
EUAD	Select STOXX Europe Aerospace & Defense ETF	Equity	1.18B
JFLX	JPMorgan Flexible Debt ETF	Fixed Income	1.18B
USXF	iShares ESG Advanced MSCI USA ETF	Equity	1.18B
CGIE	Capital Group International Equity ETF	Equity	1.18B
FPX	First Trust US Equity Opportunities ETF	Equity	1.17B
IBTI	iShares iBonds Dec 2028 Term Treasury ETF	Fixed Income	1.17B
BHYB	Xtrackers USD High Yield BB-B ex Financials ETF	Fixed Income	1.17B
CGGE	Capital Group Global Equity ETF	Equity	1.17B
BSJQ	Invesco BulletShares 2026 High Yield Corp Bond ETF	Fixed Income	1.17B
FNX	First Trust Mid Cap Core AlphaDEX Fund	Equity	1.16B
SFLR	Innovator Equity Managed Floor ETF	Equity	1.16B
GEM	Goldman Sachs ActiveBeta Emerging Markets Equity ETF	Equity	1.16B
SMIG	Bahl & Gaynor Small/Mid Cap Income Growth ETF	Equity	1.16B
RWO	SPDR Dow Jones Global Real Estate ETF	Equity	1.15B
UYLD	Angel Oak UltraShort Income ETF	Fixed Income	1.14B
FBT	First Trust NYSE Arca Biotechnology Index Fund	Equity	1.14B
EFIV	SPDR S&P 500 ESG ETF	Equity	1.14B
FLBL	Franklin Senior Loan ETF Franklin Liberty Senior Loan Fund	Fixed Income	1.14B
HFXI	NYLI FTSE International Equity Currency Neutral ETF	Equity	1.13B
ILCB	iShares Morningstar U.S. Equity ETF	Equity	1.13B
FJUL	FT Vest U.S. Equity Buffer ETF - July	Equity	1.13B
VTWG	Vanguard Russell 2000 Growth ETF	Equity	1.12B
HGER	Harbor All-Weather Inflation Focus ETF	Commodity	1.12B
FTA	First Trust Large Cap Value AlphaDEX Fund	Equity	1.12B
FQAL	Fidelity Quality Factor ETF	Equity	1.12B
IGRO	iShares International Dividend Growth ETF	Equity	1.12B
TDVG	T. Rowe Price Dividend Growth ETF	Equity	1.12B
FFEB	FT Vest U.S. Equity Buffer Fund - February	Equity	1.11B
GSST	Goldman Sachs Ultra Short Bond ETF	Fixed Income	1.11B
FJAN	FT Vest US Equity Buffer ETF - January	Equity	1.11B
SH	ProShares Short S&P500	Equity	1.11B
PWZ	Invesco California AMT-Free Municipal Bond ETF	Fixed Income	1.10B
CAM	AB California Intermediate Municipal ETF	Fixed Income	1.10B
GARP	iShares MSCI USA Quality GARP ETF	Equity	1.10B
ILCV	iShares Morningstar Value ETF	Equity	1.10B
USVM	VictoryShares US Small Mid Cap Value Momentum ETF	Equity	1.10B
BSCW	Invesco BulletShares 2032 Corporate Bond ETF	Fixed Income	1.10B
BUG	Global X Cybersecurity ETF	Equity	1.09B
UGL	ProShares Ultra Gold	Commodity	1.09B
IYE	iShares U.S. Energy ETF	Equity	1.09B
GOVI	Invesco Equal Weight 0-30 Year Treasury ETF	Fixed Income	1.09B
FLGV	Franklin U.S. Treasury Bond ETF	Fixed Income	1.08B
FAUG	FT Vest U.S. Equity Buffer ETF - August	Equity	1.08B
FLDR	Fidelity Low Duration Bond Factor ETF	Fixed Income	1.08B
QQXT	First Trust Nasdaq-100 Ex-Technology Sector Index Fund	Equity	1.08B
LGLV	SPDR SSgA US Large Cap Low Volatility Index ETF	Equity	1.07B
PEY	Invesco High Yield Equity Dividend Achievers ETF	Equity	1.07B
FDEC	FT Vest US Equity Buffer ETF - December	Equity	1.07B
FREL	Fidelity MSCI Real Estate Index ETF	Equity	1.07B
FSEP	FT Vest U.S. Equity Buffer ETF - September	Equity	1.07B
DIVB	iShares Core Dividend ETF	Equity	1.07B
CATH	Global X S&P 500 Catholic Values Custom ETF	Equity	1.07B
IVOV	Vanguard S&P Mid-Cap 400 Value ETF	Equity	1.07B
BUFQ	FT Vest Laddered Nasdaq Buffer ETF	Equity	1.06B
IGOV	iShares International Treasury Bond ETF	Fixed Income	1.05B
GSG	iShares S&P GSCI Commodity Indexed Trust	Commodity	1.05B
FVAL	Fidelity Value Factor ETF	Equity	1.05B
BITU	ProShares Ultra Bitcoin ETF	Currency	1.05B
EXI	iShares Global Industrials ETF	Equity	1.05B
WINN	Harbor Long-Term Growers ETF	Equity	1.05B
FLMI	Franklin Dynamic Municipal Bond ETF	Fixed Income	1.05B
SUSB	iShares ESG Aware 1-5 Year USD Corporate Bond ETF	Fixed Income	1.05B
ISPY	ProShares S&P 500 High Income ETF	Equity	1.04B
BKIE	BNY Mellon International Equity ETF	Equity	1.03B
POCT	Innovator U.S. Equity Power Buffer ETF - October	Equity	1.03B
IWC	iShares Micro-Cap ETF	Equity	1.02B
DFIP	Dimensional Inflation-Protected Securities ETF	Fixed Income	1.02B
FJUN	FT Vest U.S. Equity Buffer ETF - June	Equity	1.02B
JHML	John Hancock Multifactor Large Cap ETF	Equity	1.01B
CCMG	CCM Global Equity ETF	Equity	1.01B
SPIP	SPDR Portfolio TIPS ETF	Fixed Income	1.01B
DLS	WisdomTree International SmallCap Dividend Fund	Equity	1.01B
PIEQ	Principal International Equity ETF	Equity	1.00B
TMSL	T. Rowe Price Small-Mid Cap ETF	Equity	1.00B
CGW	Invesco S&P Global Water Index ETF	Equity	999.31M
CHAT	Roundhill Generative AI & Technology ETF	Equity	996.04M
FNDB	Schwab Fundamental U.S. Broad Market ETF	Equity	995.98M
MSTU	T-Rex 2X Long MSTR Daily Target ETF	Equity	994.61M
RWK	Invesco S&P MidCap 400 Revenue ETF	Equity	994.42M
STRV	Strive 500 ETF	Equity	993.27M
SCCR	Schwab Core Bond ETF	Fixed Income	991.80M
SDIV	Global X Superdividend ETF	Equity	989.95M
LDUR	PIMCO Enhanced Low Duration Active ETF	Fixed Income	988.73M
YMAX	YieldMax Universe Fund of Option Income ETFs	Equity	986.05M
FMAY	FT Vest U.S. Equity Buffer Fund - May	Equity	985.26M
IBHF	iShares iBonds 2026 Term High Yield and Income ETF	Fixed Income	985.01M
SMMU	PIMCO Short Term Municipal Bond Active ETF	Fixed Income	984.52M
PAUG	Innovator U.S. Equity Power Buffer ETF - August	Equity	984.20M
CGCV	Capital Group Conservative Equity ETF	Equity	983.24M
YINN	Direxion Daily FTSE China Bull 3X Shares	Equity	982.54M
CGNG	Capital Group New Geography Equity ETF	Equity	981.05M
NYF	iShares New York Muni Bond ETF	Fixed Income	974.96M
VTEI	Vanguard Intermediate-Term Tax-Exempt Bond ETF	Fixed Income	974.95M
CRBN	iShares MSCI ACWI Low Carbon Target ETF	Equity	974.29M
TAFI	AB Tax-Aware Short Duration Municipal ETF	Fixed Income	966.56M
DDWM	WisdomTree Dynamic International Equity Fund	Equity	953.29M
BBRE	JPMorgan BetaBuilders MSCI US REIT ETF	Equity	950.67M
VCEB	Vanguard ESG U.S. Corporate Bond ETF	Fixed Income	950.50M
BAB	Invesco Taxable Municipal Bond ETF	Fixed Income	946.89M
QEFA	SPDR MSCI EAFE StrategicFactors ETF	Equity	946.30M
BUFC	AB Conservative Buffer ETF	Equity	943.40M
DVYE	iShares Emerging Markets Dividend ETF	Equity	940.92M
MSOS	AdvisorShares Pure US Cannabis ETF	Equity	940.16M
APIE	ActivePassive International Equity ETF	Equity	939.96M
OUSM	ALPS O'Shares US Small-Cap Quality Dividend ETF	Equity	938.78M
PDEC	Innovator U.S. Equity Power Buffer ETF - December	Equity	938.39M
OIH	VanEck Oil Services ETF	Equity	936.56M
SPLB	SPDR Portfolio Long Term Corporate Bond ETF	Fixed Income	935.47M
SEIM	SEI Enhanced U.S. Large Cap Momentum Factor ETF	Equity	935.23M
PSEP	Innovator U.S. Equity Power Buffer ETF - September	Equity	934.58M
IETC	iShares U.S. Tech Independence Focused ETF	Equity	933.24M
QDTE	Roundhill Innovation-100 0DTE Covered Call Strategy ETF	Equity	927.36M
EIPI	FT Energy Income Partners Enhanced Income ETF	Equity	927.05M
SUSL	iShares ESG MSCI USA Leaders ETF	Equity	925.12M
FNOV	FT Vest U.S. Equity Buffer ETF - November	Equity	922.57M
TOUS	T. Rowe Price International Equity ETF	Equity	919.60M
SMIN	iShares MSCI India Small Cap ETF	Equity	919.09M
HAUZ	DBX ETF Trust - Xtrackers International Real Estate ETF	Equity	917.69M
IHAK	iShares Cybersecurity & Tech ETF	Equity	915.77M
FGD	First Trust Dow Jones Global Select Dividend Index Fund	Equity	915.34M
JSCP	JPMorgan Short Duration Core Plus ETF	Fixed Income	913.26M
FXH	First Trust Health Care AlphaDEX Fund	Equity	910.46M
VOTE	TCW Transform 500 ETF	Equity	910.24M
INCM	Franklin Income Focus ETF Income Focus ETF	Asset Allocation	909.85M
SEIV	SEI Enhanced U.S. Large Cap Value Factor ETF	Equity	908.47M
PALL	abrdn Physical Palladium Shares ETF	Commodity	907.77M
TAN	Invesco Solar ETF	Equity	907.09M
IBDY	iShares iBonds Dec 2033 Term Corporate ETF	Fixed Income	906.20M
FOCT	FT Vest U.S. Equity Buffer ETF - October	Equity	905.48M
VPLS	Vanguard Core Plus Bond ETF	Fixed Income	902.52M
TDTF	FlexShares iBoxx 5 Year Target Duration TIPS Index Fund	Fixed Income	899.64M
APCB	ActivePassive Core Bond ETF	Fixed Income	898.83M
PSI	Invesco Semiconductors ETF	Equity	898.66M
EDIV	SPDR S&P Emerging Markets Dividend ETF	Equity	898.46M
IVES	Dan IVES Wedbush AI Revolution ETF	Equity	894.66M
DFAW	Dimensional World Equity ETF	Equity	892.70M
AVIV	Avantis International Large Cap Value ETF	Equity	890.42M
USO	United States Oil Fund LP	Commodity	889.36M
FMAR	FT Vest US Equity Buffer ETF - March	Equity	888.31M
FFLC	Fidelity Fundamental Large Cap Core ETF	Equity	887.17M
FYX	First Trust Small Cap Core AlphaDEX Fund	Equity	887.12M
TGRW	T. Rowe Price Growth Stock ETF	Equity	886.48M
KXI	iShares Global Consumer Staples ETF	Equity	886.24M
FAPR	FT Vest U.S. Equity Buffer ETF - April	Equity	882.03M
BUYW	Main BuyWrite ETF	Equity	880.86M
PICK	iShares MSCI Global Metals & Mining Producers ETF	Equity	878.49M
SYLD	Cambria Shareholder Yield ETF	Equity	876.61M
BILZ	PIMCO Ultra Short Government Active Exchange-Traded Fund	Fixed Income	876.42M
CGSM	Capital Group Short Duration Municipal Income ETF	Fixed Income	873.69M
TGRT	T. Rowe Price Growth ETF	Equity	869.62M
FLGB	Franklin FTSE United Kingdom ETF	Equity	869.03M
PID	Invesco International Dividend Achievers ETF	Equity	867.75M
GSID	Marketbeta INTL Equity ETF	Equity	862.98M
ROM	ProShares Ultra Technology	Equity	862.04M
EWS	iShares MSCI Singapore ETF	Equity	861.90M
PCRB	Putnam ESG Core Bond ETF	Fixed Income	859.67M
DFSI	Dimensional International Sustainability Core 1 ETF	Equity	856.60M
PCEF	Invesco CEF Income Composite ETF	Asset Allocation	855.58M
IXP	iShares Global Comm Services ETF	Equity	848.46M
IMCV	iShares Morningstar Mid-Cap Value ETF	Equity	846.76M
XLSR	SPDR SSgA U.S. Sector Rotation ETF	Equity	845.87M
IQDF	FlexShares International Quality Dividend Index Fund	Equity	841.84M
VTWV	Vanguard Russell 2000 Value ETF	Equity	840.67M
FMHI	First Trust Municipal High Income ETF	Fixed Income	836.23M
CLOZ	Eldridge BBB-B CLO ETF	Fixed Income	834.77M
AGGY	WisdomTree Yield Enhanced U.S. Aggregate Bond Fund	Fixed Income	831.31M
SYFI	AB Short Duration High Yield ETF	Fixed Income	829.12M
QAI	NYLI Hedge Multi-Strategy Tracker ETF	Alternatives	828.60M
JETS	U.S. Global Jets ETF	Equity	827.76M
VIOG	Vanguard S&P Small-Cap 600 Growth ETF	Equity	827.32M
SCHQ	Schwab Long-Term U.S. Treasury ETF	Fixed Income	826.54M
RDIV	Invesco S&P Ultra Dividend Revenue ETF	Equity	826.12M
PMBS	PIMCO Mortgage-Backed Securities Active Exchange-Traded Fund	Fixed Income	825.29M
DUSA	Davis Select U.S. Equity ETF	Equity	825.26M
PSK	SPDR ICE Preferred Securities ETF	Fixed Income	817.69M
JHMD	John Hancock Multifactor Developed International ETF	Equity	814.16M
UYG	ProShares Ultra Financials	Equity	812.58M
CGMM	Capital Group U.S. Small and Mid Cap ETF	Equity	811.17M
BTCI	NEOS Bitcoin High Income ETF	Currency	809.22M
ONEY	SPDR Russell 1000 Yield Focus ETF	Equity	808.84M
AVES	Avantis Emerging Markets Value ETF	Equity	808.80M
OUSA	ALPS O'Shares U.S. Quality Dividend ETF	Equity	807.67M
IHF	iShares U.S. Healthcare Providers ETF	Equity	806.54M
PLDR	Putnam Sustainable Leaders ETF	Equity	802.26M
JIVE	JPMorgan International Value ETF	Equity	801.84M
LABU	Direxion Daily S&P Biotech Bull 3X Shares	Equity	797.25M
IBTJ	iShares iBonds Dec 2029 Term Treasury ETF	Fixed Income	796.61M
JCPI	JPMorgan Inflation Managed Bond ETF	Fixed Income	795.27M
PGF	Invesco Financial Preferred ETF	Fixed Income	794.63M
PAPR	Innovator U.S. Equity Power Buffer ETF - April	Equity	794.02M
XBIL	US Treasury 6 Month Bill ETF	Fixed Income	791.99M
GWX	SPDR S&P International Small Cap ETF	Equity	790.71M
CONL	GraniteShares 2x Long COIN Daily ETF	Equity	790.28M
AMDL	GraniteShares 2x Long AMD Daily ETF	Equity	788.98M
PFEB	Innovator U.S. Equity Power Buffer ETF - February	Equity	787.64M
PNQI	Invesco NASDAQ Internet ETF	Equity	785.52M
REZ	iShares Residential and Multisector Real Estate ETF	Equity	783.90M
AVLC	Avantis U.S. Large Cap Equity ETF	Equity	782.89M
THYF	T. Rowe Price U.S. High Yield ETF	Fixed Income	782.79M
XTEN	BondBloxx Bloomberg Ten Year Target Duration US Treasury ETF	Fixed Income	781.56M
EZM	WisdomTree U.S. MidCap Fund	Equity	779.68M
DBA	Invesco DB Agriculture Fund	Commodity	778.63M
BSCX	Invesco BulletShares 2033 Corporate Bond ETF	Fixed Income	777.19M
EMCS	Xtrackers MSCI Emerging Markets Climate Selection ETF	Equity	772.99M
ECH	iShares MSCI Chile ETF	Equity	772.15M
NUKZ	Range Nuclear Renaissance Index ETF	Equity	769.13M
ISCG	iShares Morningstar Small-Cap Growth ETF	Equity	766.92M
XMLV	Invesco S&P MidCap Low Volatility ETF	Equity	766.26M
KAT	Scharf ETF	Equity	764.58M
BITO	ProShares Bitcoin ETF	Currency	2.72B
RING	iShares MSCI Global Gold Miners ETF	Equity	2.69B
IVLU	iShares MSCI Intl Value Factor ETF	Equity	2.69B
INTF	iShares International Equity Factor ETF	Equity	2.69B
FLRN	SPDR Bloomberg Investment Grade Floating Rate ETF	Fixed Income	2.67B
IYY	iShares Dow Jones U.S. ETF	Equity	2.64B
AOA	iShares Core 80/20 Aggressive Allocation ETF	Asset Allocation	2.63B
ETHU	2x Ether ETF	Currency	2.63B
USCL	iShares Climate Conscious & Transition MSCI USA ETF	Equity	2.61B
UITB	VictoryShares Core Intermediate Bond ETF	Fixed Income	2.61B
KLMN	Invesco MSCI North America Climate ETF	Equity	2.60B
KOMP	SPDR S&P Kensho New Economies Composite ETF	Equity	2.60B
SPGP	Invesco S&P 500 GARP ETF	Equity	2.59B
QLTY	GMO U.S. Quality ETF Shs	Equity	2.59B
FLTR	VanEck IG Floating Rate ETF	Fixed Income	2.57B
FHLC	Fidelity MSCI Health Care Index ETF	Equity	2.56B
TDTT	FlexShares iBoxx 3 Year Target Duration TIPS Index Fund	Fixed Income	2.56B
PRFZ	Invesco RAFI US 1500 Small-Mid ETF	Equity	2.55B
COWG	Pacer US Large Cap Cash Cows Growth Leaders ETF	Equity	2.52B
FLIN	Franklin FTSE India ETF	Equity	2.52B
SMLF	iShares U.S. SmallCap Equity Factor ETF	Equity	2.50B
GCOW	Pacer Global Cash Cows Dividend ETF	Equity	2.48B
MLPX	Global X MLP & Energy Infrastructure ETF	Equity	2.47B
OUNZ	VanEck Merk Gold ETF	Commodity	2.46B
SCMB	Schwab Municipal Bond ETF	Fixed Income	2.46B
ARKW	ARK Next Generation Internet ETF	Equity	2.42B
FELV	Fidelity Enhanced Large Cap Value ETF	Equity	2.41B
FAS	Direxion Daily Financial Bull 3x Shares	Equity	2.41B
MDYV	SPDR S&P 400 Mid Cap Value ETF	Equity	2.40B
FLJP	Franklin FTSE Japan ETF	Equity	2.40B
BSCT	Invesco BulletShares 2029 Corporate Bond ETF	Fixed Income	2.39B
MDYG	SPDR S&P 400 Mid Cap Growth ETF	Equity	2.39B
SPYX	SPDR S&P 500 Fossil Fuel Reserves Free ETF	Equity	2.37B
FTSL	First Trust Senior Loan Fund	Fixed Income	2.37B
AAAU	Goldman Sachs Physical Gold ETF	Commodity	2.37B
RDVI	FT Vest Rising Dividend Achievers Target Income ETF	Equity	2.35B
SLQD	iShares 0-5 Year Investment Grade Corporate Bond ETF	Fixed Income	2.35B
CGHM	Capital Group Municipal High-Income ETF	Fixed Income	2.35B
PFFD	Global X U.S. Preferred ETF	Fixed Income	2.33B
SECT	Main Sector Rotation ETF	Equity	2.33B
FNCL	Fidelity MSCI Financials Index ETF	Equity	2.32B
MUNI	PIMCO Intermediate Municipal Bond Active Exchange-Traded Fund	Fixed Income	2.31B
HACK	Amplify Cybersecurity ETF	Equity	2.28B
VRP	Invesco Variable Rate Preferred ETF	Fixed Income	2.28B
IHDG	WisdomTree International Hedged Quality Dividend Growth Fund	Equity	2.27B
HIMU	iShares High Yield Muni Active ETF	Fixed Income	2.26B
IBDV	iShares iBonds Dec 2030 Term Corporate ETF	Fixed Income	2.25B
TBLL	Invesco Short Term Treasury ETF	Fixed Income	2.24B
BITX	2x Bitcoin Strategy ETF	Currency	2.24B
FNGU	MicroSectors FANG+ 3 Leveraged ETNs	Equity	2.24B
EWW	iShares MSCI Mexico ETF	Equity	2.22B
PHO	Invesco Water Resources ETF	Equity	2.20B
FUTY	Fidelity MSCI Utilities Index ETF	Equity	2.20B
EBND	SPDR Bloomberg Emerging Markets Local Bond ETF	Fixed Income	2.20B
PABU	iShares Paris-Aligned Climate Optimized MSCI USA ETF	Equity	2.19B
SMTH	ALPS/SMITH Core Plus Bond ETF	Fixed Income	2.18B
DCOR	Dimensional US Core Equity 1 ETF	Equity	2.17B
CWI	SPDR MSCI ACWI ex-US ETF	Equity	2.17B
GLTR	abrdn Physical Precious Metals Basket Shares ETF	Commodity	2.16B
ACIO	Aptus Collared Investment Opportunity ETF	Equity	2.16B
TNA	Direxion Daily Small Cap Bull 3x Shares	Equity	2.14B
PXF	Invesco RAFI Developed Markets ex-U.S. ETF	Equity	2.14B
SNPE	Xtrackers S&P 500 Scored & Screened ETF	Equity	2.12B
FTGC	First Trust Global Tactical Commodity Strategy Fund	Commodity	2.12B
XSOE	WisdomTree Emerging Markets ex-State-Owned Enterprises Fund	Equity	2.12B
HDEF	Xtrackers MSCI EAFE High Dividend Yield Equity ETF	Equity	2.11B
PPLT	abrdn Physical Platinum Shares ETF	Commodity	2.10B
URNM	Sprott Uranium Miners ETF	Equity	2.10B
IBTG	iShares iBonds Dec 2026 Term Treasury ETF	Fixed Income	2.10B
FXO	First Trust Financials AlphaDEX Fund	Equity	2.10B
HTRB	Hartford Total Return Bond ETF	Fixed Income	2.09B
APUE	ActivePassive U.S. Equity ETF	Equity	2.08B
JPHY	JPMorgan Active High Yield ETF	Fixed Income	2.07B
GUSA	Goldman Sachs MarketBeta U.S. 1000 Equity ETF	Equity	2.07B
XHLF	BondBloxx Bloomberg Six Month Target Duration US Treasury ETF	Fixed Income	2.05B
QGRO	American Century U.S. Quality Growth ETF	Equity	2.05B
ITM	VanEck Intermediate Muni ETF	Fixed Income	2.04B
EWG	iShares MSCI Germany ETF	Equity	2.03B
JMEE	JPMorgan Small & Mid Cap Enhanced Equity ETF	Equity	2.03B
FLXR	TCW Flexible Income ETF	Fixed Income	2.02B
BKAG	BNY Mellon Core Bond ETF	Fixed Income	2.02B
TSPA	T. Rowe Price U.S. Equity Research ETF	Equity	2.01B
ESML	iShares ESG Aware MSCI USA Small-Cap ETF	Equity	2.01B
BSCU	Invesco BulletShares 2030 Corporate Bond ETF	Fixed Income	2.00B
IDMO	Invesco S&P International Developed Momentum ETF	Equity	2.00B
XSMO	Invesco S&P SmallCap Momentum ETF	Equity	1.99B
FTLS	First Trust Long/Short Equity ETF	Alternatives	1.98B
PFXF	VanEck Preferred Securities ex Financials ETF	Fixed Income	1.98B
FIW	First Trust Water ETF	Equity	1.97B
HODL	VanEck Bitcoin ETF	Currency	1.96B
GTO	Invesco Total Return Bond ETF	Fixed Income	1.95B
QDF	FlexShares Quality Dividend Index Fund	Equity	1.95B
AVSC	Avantis U.S Small Cap Equity ETF	Equity	1.95B
BBMC	JPMorgan BetaBuilders U.S. Mid Cap Equity ETF	Equity	1.94B
DFGP	Dimensional Global Core Plus Fixed Income ETF	Fixed Income	1.94B
ICF	iShares Select U.S. REIT ETF	Equity	1.93B
IBDW	iShares iBonds Dec 2031 Term Corporate ETF	Fixed Income	1.93B
FMB	First Trust Managed Municipal ETF	Fixed Income	1.92B
ILF	iShares Latin America 40 ETF	Equity	1.91B
DIVI	Franklin International Core Dividend Tilt Index Fund	Equity	1.91B
IPAC	iShares Core MSCI Pacific ETF	Equity	1.90B
GPIX	Goldman Sachs S&P 500 Premium Income ETF	Equity	1.88B
QQEW	First Trust Nasdaq-100 Equal Weighted Index Fund	Equity	1.88B
FDIS	Fidelity MSCI Consumer Discretionary Index ETF	Equity	1.88B
ARTY	iShares Future AI & Tech ETF	Equity	1.88B
NULG	Nuveen ESG Large-Cap Growth ETF	Equity	1.87B
IWL	iShares Russell Top 200 ETF	Equity	1.87B
IYG	iShares US Financial Services ETF	Equity	1.87B
IYC	iShares U.S. Consumer Discretionary ETF	Equity	1.86B
FALN	iShares Fallen Angels USD Bond ETF	Fixed Income	1.86B
QGRW	WisdomTree U.S. Quality Growth Fund	Equity	1.86B
PFFA	Virtus InfraCap U.S. Preferred Stock ETF	Fixed Income	1.85B
DBMF	iMGP DBi Managed Futures Strategy ETF	Alternatives	1.85B
GPIQ	Goldman Sachs Nasdaq-100 Premium Income ETF	Equity	1.84B
DES	WisdomTree U.S. SmallCap Dividend Fund	Equity	1.84B
ICLN	iShares Global Clean Energy ETF	Equity	1.83B
BALT	Innovator Defined Wealth Shield ETF	Equity	1.83B
IBTH	iShares iBonds Dec 2027 Term Treasury ETF	Fixed Income	1.83B
FXR	First Trust Industrials/Producer Durables AlphaDEX Fund	Equity	1.83B
WTV	WisdomTree US Value Fund of Benef Interest	Equity	1.81B
NULV	Nuveen ESG Large-Cap Value ETF	Equity	1.81B
DSTL	Distillate US Fundamental Stability & Value ETF	Equity	1.81B
BCI	abrdn Bloomberg All Commodity Strategy K-1 Free ETF	Commodity	1.81B
FCOM	Fidelity MSCI Communication Services Index ETF	Equity	1.80B
TILT	FlexShares Morningstar US Market Factor Tilt Index Fund	Equity	1.80B
TIPX	SPDR Bloomberg 1-10 Year TIPS ETF	Fixed Income	1.79B
XHB	SPDR S&P Homebuilders ETF	Equity	1.79B
REGL	ProShares S&P MidCap 400 Dividend Aristocrats ETF	Equity	1.79B
SMMD	iShares Russell 2500 ETF	Equity	1.79B
EQWL	Invesco S&P 100 Equal Weight ETF	Equity	1.79B
ZROZ	PIMCO 25+ Year Zero Coupon US Treasury Index Exchange-Traded Fund	Fixed Income	1.79B
FXU	First Trust Utilities AlphaDEX Fund	Equity	1.78B
FPEI	First Trust Institutional Preferred Securities & Income ETF	Fixed Income	1.78B
XSD	SPDR S&P Semiconductor ETF	Equity	1.78B
FSMD	Fidelity Small-Mid Multifactor ETF	Equity	1.78B
IBTF	iShares iBonds Dec 2025 Term Treasury ETF	Fixed Income	1.78B
SCYB	Schwab High Yield Bond ETF	Fixed Income	1.78B
TMFC	Motley Fool 100 Index ETF	Equity	1.77B
EPP	iShares MSCI Pacific ex-Japan ETF	Equity	1.77B
NVDY	YieldMax NVDA Option Income Strategy ETF	Equity	1.76B
MLPA	Global X MLP ETF	Equity	1.76B
IXC	iShares Global Energy ETF	Equity	1.76B
ASHR	Xtrackers Harvest CSI 300 China A-Shares ETF	Equity	1.75B
HEDJ	WisdomTree Europe Hedged Equity Fund	Equity	1.74B
DFNM	Dimensional National Municipal Bond ETF	Fixed Income	1.74B
FLQM	Franklin U.S. Mid Cap Multifactor Index ETF	Equity	1.73B
HYLS	First Trust Tactical High Yield ETF	Fixed Income	1.73B
SPBO	SPDR Portfolio Corporate Bond ETF	Fixed Income	1.73B
RWR	SPDR Dow Jones REIT ETF	Equity	1.72B
DFSU	Dimensional US Sustainability Core 1 ETF	Equity	1.72B
QLTA	iShares Aaa-A Rated Corporate Bond ETF	Fixed Income	1.70B
SPUS	SP Funds S&P 500 Sharia Industry Exclusions ETF	Equity	1.70B
JMOM	JPMorgan U.S. Momentum Factor ETF	Equity	1.68B
FTHI	First Trust BuyWrite Income ETF	Equity	1.68B
RPG	Invesco S&P 500 Pure Growth ETF	Equity	1.68B
BSVO	EA Bridgeway Omni Small-Cap Value ETF	Equity	1.68B
ARKQ	ARK Autonomous Technology & Robotics ETF	Equity	1.67B
HYDB	iShares High Yield Systematic Bond ETF	Fixed Income	1.67B
CGSD	Capital Group Short Duration Income ETF	Fixed Income	1.66B
XOP	SPDR S&P Oil & Gas Exploration & Production ETF	Equity	1.66B
IYJ	iShares U.S. Industrials ETF	Equity	1.64B
PXH	Invesco RAFI Emerging Markets ETF	Equity	1.64B
DGS	WisdomTree Emerging Markets SmallCap Dividend Fund	Equity	1.64B
USTB	VictoryShares Short-Term Bond ETF	Fixed Income	1.64B
AOM	iShares Core 40/60 Moderate Allocation ETF	Asset Allocation	1.61B
FLQL	Franklin U.S. Large Cap Multifactor Index ETF	Equity	1.61B
USD	ProShares Ultra Semiconductors	Equity	1.61B
JPEF	JPMorgan Equity Focus ETF	Equity	1.60B
TCHP	T. Rowe Price Blue Chip Growth ETF	Equity	1.59B
IEV	iShares Europe ETF	Equity	1.59B
FTCB	First Trust Core Investment Grade ETF	Fixed Income	1.57B
IAI	iShares U.S. Broker-Dealers & Securities Exchanges ETF	Equity	1.57B
USPX	Franklin U.S. Equity Index ETF	Equity	1.56B
EEMA	iShares MSCI Emerging Markets Asia ETF	Equity	1.56B
MTBA	Simplify MBS ETF	Fixed Income	1.55B
IDU	iShares U.S. Utilities ETF	Equity	1.54B
FRDM	Freedom 100 Emerging Markets ETF	Equity	1.54B
RWJ	Invesco S&P SmallCap 600 Revenue ETF	Equity	1.54B
DUSB	Dimensional Ultrashort Fixed Income ETF	Fixed Income	1.53B
TAGG	T. Rowe Price QM U.S. Bond ETF	Fixed Income	1.52B
CLIP	Global X 1-3 Month T-Bill ETF	Fixed Income	1.52B
YEAR	AB Ultra Short Income ETF	Fixed Income	1.51B
QUS	SPDR MSCI USA StrategicFactors ETF	Equity	1.51B
BLOK	Amplify Transformational Data Sharing ETF	Equity	1.50B
BUFD	FT Vest Laddered Deep Buffer ETF	Equity	1.50B
HYS	PIMCO 0-5 Year High Yield Corporate Bond Index Exchange-Traded Fund	Fixed Income	1.49B
BIZD	VanEck BDC Income ETF	Equity	1.48B
TLTW	iShares 20+ Year Treasury Bond BuyWrite Strategy ETF	Fixed Income	1.48B
EVLN	Eaton Vance Floating-Rate ETF	Fixed Income	1.48B
BNDW	Vanguard Total World Bond ETF	Fixed Income	1.47B
ILOW	AB International Low Volatility Equity ETF	Equity	1.47B
PKW	Invesco Buyback Achievers ETF	Equity	1.47B
FIDU	Fidelity MSCI Industrial Index ETF	Equity	1.46B
GLOV	Activebeta World Low Vol Plus Equity ETF	Equity	1.46B
VTES	Vanguard Short-Term Tax Exempt Bond ETF	Fixed Income	1.44B
FXL	First Trust Technology AlphaDEX Fund	Equity	1.43B
BAR	GraniteShares Gold Shares	Commodity	1.43B
UBND	VictoryShares Core Plus Intermediate Bond ETF	Fixed Income	1.43B
EWA	iShares MSCI Australia ETF	Equity	1.43B
EWP	iShares MSCI Spain ETF	Equity	1.43B
QVML	Invesco S&P 500 QVM Multi-factor ETF	Equity	1.42B
DRSK	Aptus Defined Risk ETF	Asset Allocation	1.42B
BAFE	Brown Advisory Flexible Equity ETF	Equity	1.42B
DTD	WisdomTree U.S. Total Dividend Fund	Equity	1.42B
XNTK	SPDR NYSE Technology ETF	Equity	1.42B
CLOA	iShares AAA CLO Active ETF	Fixed Income	1.42B
IGEB	iShares Investment Grade Systematic Bond ETF	Fixed Income	1.41B
KBE	SPDR S&P Bank ETF	Equity	1.41B
UNIY	WisdomTree Voya Yield Enhanced USD Universal Bond Fund ETF	Fixed Income	1.41B
VIOV	Vanguard S&P Small-Cap 600 Value ETF	Equity	1.41B
VTEC	Vanguard California Tax-Exempt Bond ETF	Fixed Income	1.40B
SCHY	Schwab International Dividend Equity ETF	Equity	1.40B
AVIG	Avantis Core Fixed Income ETF	Fixed Income	1.39B
DFAR	Dimensional US Real Estate ETF	Equity	1.39B
PWB	Invesco Large Cap Growth ETF	Equity	1.39B
REMX	VanEck Rare Earth and Strategic Metals ETF	Equity	1.39B
EWL	iShares MSCI Switzerland ETF	Equity	1.38B
KLMT	Invesco MSCI Global Climate 500 ETF	Equity	1.38B
FSIG	First Trust Limited Duration Investment Grade Corporate ETF	Fixed Income	1.38B
VTC	Vanguard Total Corporate Bond ETF	Fixed Income	1.38B
FDLO	Fidelity Low Volatility Factor ETF	Equity	1.37B
EUSA	iShares MSCI USA Equal Weighted ETF	Equity	1.37B
LCTU	BlackRock U.S. Carbon Transition Readiness ETF	Equity	1.37B
RAVI	FlexShares Ultra-Short Income Fund	Fixed Income	1.37B
GSEW	Goldman Sachs Equal Weight U.S. Large Cap Equity ETF	Equity	1.36B
CORP	PIMCO Investment Grade Corporate Bond Index ETF	Fixed Income	1.35B
AIA	iShares Asia 50 ETF	Equity	1.35B
FEX	First Trust Large Cap Core AlphaDEX Fund	Equity	1.35B
PDP	Invesco Dorsey Wright Momentum ETF	Equity	1.35B
ARKF	ARK Fintech Innovation ETF	Equity	1.35B
INFL	Horizon Kinetics Inflation Beneficiaries ETF	Equity	1.34B
IBDX	iShares iBonds Dec 2032 Term Corporate ETF	Fixed Income	1.34B
ARKG	ARK Genomic Revolution ETF	Equity	1.34B
PREF	Principal Spectrum Preferred Secs Active ETF	Fixed Income	1.34B
BWX	SPDR Bloomberg International Treasury Bond ETF	Fixed Income	1.34B
BSCV	Invesco BulletShares 2031 Corporate Bond ETF	Fixed Income	1.33B
IVOG	Vanguard S&P Mid-Cap 400 Growth ETF	Equity	1.33B
RPV	Invesco S&P 500 Pure Value ETF	Equity	1.33B
FSTA	Fidelity MSCI Consumer Staples Index ETF	Equity	1.32B
RSSL	Global X Russell 2000 ETF	Equity	1.32B
ICOW	Pacer Developed Markets International Cash Cows 100 ETF	Equity	1.31B
AGQ	ProShares Ultra Silver	Commodity	1.31B
JBBB	Janus Henderson B-BBB CLO ETF	Fixed Income	1.31B
LIT	Global X Lithium & Battery Tech ETF	Equity	1.30B
JPIB	JPMorgan International Bond Opportunities ETF of Benef Interest	Fixed Income	1.30B
SOXS	Direxion Daily Semiconductor Bear 3x Shares	Equity	1.29B
VRIG	Invesco Variable Rate Investment Grade ETF	Fixed Income	1.29B
UTES	Virtus Reaves Utilities ETF	Equity	1.29B
IYK	iShares U.S. Consumer Staples ETF	Equity	1.29B
SUSC	iShares ESG Aware USD Corporate Bond ETF	Fixed Income	1.29B
PCY	Invesco Emerging Markets Sovereign Debt ETF	Fixed Income	1.29B
BBAG	JPMorgan BetaBuilders U.S. Aggregate Bond ETF	Fixed Income	1.28B
XCEM	Columbia EM Core ex-China ETF	Equity	1.28B
EQTY	Kovitz Core Equity ETF	Equity	1.28B
QQQE	Direxion NASDAQ-100 Equal Weighted Index Shares	Equity	1.27B
DHS	WisdomTree U.S. High Dividend Fund	Equity	1.27B
FENY	Fidelity MSCI Energy Index ETF	Equity	1.27B
DBC	Invesco DB Commodity Index Tracking Fund	Commodity	1.27B
PTNQ	Pacer Trendpilot 100 ETF	Equity	1.27B
MEAR	iShares Short Maturity Municipal Bond Active ETF	Fixed Income	1.27B
TSLY	YieldMax TSLA Option Income Strategy ETF	Equity	1.26B
FTGS	First Trust Growth Strength ETF	Equity	1.26B
FTC	First Trust Large Cap Growth AlphaDEX Fund	Equity	1.26B
EPS	WisdomTree U.S. LargeCap Fund	Equity	1.26B
QDPL	Pacer Metaurus US Large Cap Dividend Multiplier 400 ETF	Equity	1.26B
RODM	Hartford Multifactor Developed Markets (ex-US) ETF	Equity	1.26B
NTSX	WisdomTree U.S. Efficient Core Fund	Asset Allocation	1.25B
RYLD	Global X Russell 2000 Covered Call ETF	Equity	1.25B
JEMA	JPMorgan ActiveBuilders Emerging Markets Equity ETF	Equity	1.25B
EMGF	iShares Emerging Markets Equity Factor ETF	Equity	1.25B
JSI	Janus Henderson Securitized Income ETF	Fixed Income	1.25B
CONY	YieldMax COIN Option Income Strategy ETF	Equity	1.25B
SPGM	SPDR Portfolio MSCI Global Stock Market ETF	Equity	1.24B
NUGT	Direxion Daily Gold Miners Index Bull 2x Shares	Equity	1.24B
FWD	AB Disruptors ETF	Equity	1.24B
CTA	Simplify Managed Futures Strategy ETF	Alternatives	1.23B
CLOI	VanEck CLO ETF	Fixed Income	1.23B
PPH	VanEck Pharmaceutical ETF	Equity	1.23B
NUSC	Nuveen ESG Small-Cap ETF	Equity	1.22B
SDOG	ALPS Sector Dividend Dogs ETF	Equity	1.22B
HYGV	FlexShares High Yield Value-Scored Bond Index Fund	Fixed Income	1.21B
PSC	Principal U.S. Small-Cap ETF	Equity	1.20B
ROBO	ROBO Global Robotics & Automation Index ETF	Equity	1.20B
DFGX	Dimensional Global ex US Core Fixed Income ETF	Fixed Income	1.20B
IMCB	iShares Morningstar Mid-Cap ETF	Equity	1.20B
DFEV	Dimensional Emerging Markets Value ETF	Equity	1.19B
PJUL	Innovator U.S. Equity Power Buffer ETF - July	Equity	1.19B
PJAN	Innovator U.S. Equity Power Buffer ETF - January	Equity	1.19B
VFMO	Vanguard U.S. Momentum Factor ETF	Equity	1.19B
PWV	Invesco Large Cap Value ETF	Equity	1.19B
MMIT	NYLI MacKay Muni Intermediate ETF	Fixed Income	1.19B
EUAD	Select STOXX Europe Aerospace & Defense ETF	Equity	1.18B
JFLX	JPMorgan Flexible Debt ETF	Fixed Income	1.18B
USXF	iShares ESG Advanced MSCI USA ETF	Equity	1.18B
CGIE	Capital Group International Equity ETF	Equity	1.18B
FPX	First Trust US Equity Opportunities ETF	Equity	1.17B
IBTI	iShares iBonds Dec 2028 Term Treasury ETF	Fixed Income	1.17B
BHYB	Xtrackers USD High Yield BB-B ex Financials ETF	Fixed Income	1.17B
CGGE	Capital Group Global Equity ETF	Equity	1.17B
BSJQ	Invesco BulletShares 2026 High Yield Corp Bond ETF	Fixed Income	1.17B
FNX	First Trust Mid Cap Core AlphaDEX Fund	Equity	1.16B
SFLR	Innovator Equity Managed Floor ETF	Equity	1.16B
GEM	Goldman Sachs ActiveBeta Emerging Markets Equity ETF	Equity	1.16B
SMIG	Bahl & Gaynor Small/Mid Cap Income Growth ETF	Equity	1.16B
RWO	SPDR Dow Jones Global Real Estate ETF	Equity	1.15B
UYLD	Angel Oak UltraShort Income ETF	Fixed Income	1.14B
FBT	First Trust NYSE Arca Biotechnology Index Fund	Equity	1.14B
EFIV	SPDR S&P 500 ESG ETF	Equity	1.14B
FLBL	Franklin Senior Loan ETF Franklin Liberty Senior Loan Fund	Fixed Income	1.14B
HFXI	NYLI FTSE International Equity Currency Neutral ETF	Equity	1.13B
ILCB	iShares Morningstar U.S. Equity ETF	Equity	1.13B
FJUL	FT Vest U.S. Equity Buffer ETF - July	Equity	1.13B
VTWG	Vanguard Russell 2000 Growth ETF	Equity	1.12B
HGER	Harbor All-Weather Inflation Focus ETF	Commodity	1.12B
FTA	First Trust Large Cap Value AlphaDEX Fund	Equity	1.12B
FQAL	Fidelity Quality Factor ETF	Equity	1.12B
IGRO	iShares International Dividend Growth ETF	Equity	1.12B
TDVG	T. Rowe Price Dividend Growth ETF	Equity	1.12B
FFEB	FT Vest U.S. Equity Buffer Fund - February	Equity	1.11B
GSST	Goldman Sachs Ultra Short Bond ETF	Fixed Income	1.11B
FJAN	FT Vest US Equity Buffer ETF - January	Equity	1.11B
SH	ProShares Short S&P500	Equity	1.11B
PWZ	Invesco California AMT-Free Municipal Bond ETF	Fixed Income	1.10B
CAM	AB California Intermediate Municipal ETF	Fixed Income	1.10B
GARP	iShares MSCI USA Quality GARP ETF	Equity	1.10B
ILCV	iShares Morningstar Value ETF	Equity	1.10B
USVM	VictoryShares US Small Mid Cap Value Momentum ETF	Equity	1.10B
BSCW	Invesco BulletShares 2032 Corporate Bond ETF	Fixed Income	1.10B
BUG	Global X Cybersecurity ETF	Equity	1.09B
UGL	ProShares Ultra Gold	Commodity	1.09B
IYE	iShares U.S. Energy ETF	Equity	1.09B
GOVI	Invesco Equal Weight 0-30 Year Treasury ETF	Fixed Income	1.09B
FLGV	Franklin U.S. Treasury Bond ETF	Fixed Income	1.08B
FAUG	FT Vest U.S. Equity Buffer ETF - August	Equity	1.08B
FLDR	Fidelity Low Duration Bond Factor ETF	Fixed Income	1.08B
QQXT	First Trust Nasdaq-100 Ex-Technology Sector Index Fund	Equity	1.08B
LGLV	SPDR SSgA US Large Cap Low Volatility Index ETF	Equity	1.07B
PEY	Invesco High Yield Equity Dividend Achievers ETF	Equity	1.07B
FDEC	FT Vest US Equity Buffer ETF - December	Equity	1.07B
FREL	Fidelity MSCI Real Estate Index ETF	Equity	1.07B
FSEP	FT Vest U.S. Equity Buffer ETF - September	Equity	1.07B
DIVB	iShares Core Dividend ETF	Equity	1.07B
CATH	Global X S&P 500 Catholic Values Custom ETF	Equity	1.07B
IVOV	Vanguard S&P Mid-Cap 400 Value ETF	Equity	1.07B
BUFQ	FT Vest Laddered Nasdaq Buffer ETF	Equity	1.06B
IGOV	iShares International Treasury Bond ETF	Fixed Income	1.05B
GSG	iShares S&P GSCI Commodity Indexed Trust	Commodity	1.05B
FVAL	Fidelity Value Factor ETF	Equity	1.05B
BITU	ProShares Ultra Bitcoin ETF	Currency	1.05B
EXI	iShares Global Industrials ETF	Equity	1.05B
WINN	Harbor Long-Term Growers ETF	Equity	1.05B
FLMI	Franklin Dynamic Municipal Bond ETF	Fixed Income	1.05B
SUSB	iShares ESG Aware 1-5 Year USD Corporate Bond ETF	Fixed Income	1.05B
ISPY	ProShares S&P 500 High Income ETF	Equity	1.04B
BKIE	BNY Mellon International Equity ETF	Equity	1.03B
POCT	Innovator U.S. Equity Power Buffer ETF - October	Equity	1.03B
IWC	iShares Micro-Cap ETF	Equity	1.02B
DFIP	Dimensional Inflation-Protected Securities ETF	Fixed Income	1.02B
FJUN	FT Vest U.S. Equity Buffer ETF - June	Equity	1.02B
JHML	John Hancock Multifactor Large Cap ETF	Equity	1.01B
CCMG	CCM Global Equity ETF	Equity	1.01B
SPIP	SPDR Portfolio TIPS ETF	Fixed Income	1.01B
DLS	WisdomTree International SmallCap Dividend Fund	Equity	1.01B
PIEQ	Principal International Equity ETF	Equity	1.00B
TMSL	T. Rowe Price Small-Mid Cap ETF	Equity	1.00B
CGW	Invesco S&P Global Water Index ETF	Equity	999.31M
CHAT	Roundhill Generative AI & Technology ETF	Equity	996.04M
FNDB	Schwab Fundamental U.S. Broad Market ETF	Equity	995.98M
MSTU	T-Rex 2X Long MSTR Daily Target ETF	Equity	994.61M
RWK	Invesco S&P MidCap 400 Revenue ETF	Equity	994.42M
STRV	Strive 500 ETF	Equity	993.27M
SCCR	Schwab Core Bond ETF	Fixed Income	991.80M
SDIV	Global X Superdividend ETF	Equity	989.95M
LDUR	PIMCO Enhanced Low Duration Active ETF	Fixed Income	988.73M
YMAX	YieldMax Universe Fund of Option Income ETFs	Equity	986.05M
FMAY	FT Vest U.S. Equity Buffer Fund - May	Equity	985.26M
IBHF	iShares iBonds 2026 Term High Yield and Income ETF	Fixed Income	985.01M
SMMU	PIMCO Short Term Municipal Bond Active ETF	Fixed Income	984.52M
PAUG	Innovator U.S. Equity Power Buffer ETF - August	Equity	984.20M
CGCV	Capital Group Conservative Equity ETF	Equity	983.24M
YINN	Direxion Daily FTSE China Bull 3X Shares	Equity	982.54M
CGNG	Capital Group New Geography Equity ETF	Equity	981.05M
NYF	iShares New York Muni Bond ETF	Fixed Income	974.96M
VTEI	Vanguard Intermediate-Term Tax-Exempt Bond ETF	Fixed Income	974.95M
CRBN	iShares MSCI ACWI Low Carbon Target ETF	Equity	974.29M
TAFI	AB Tax-Aware Short Duration Municipal ETF	Fixed Income	966.56M
DDWM	WisdomTree Dynamic International Equity Fund	Equity	953.29M
BBRE	JPMorgan BetaBuilders MSCI US REIT ETF	Equity	950.67M
VCEB	Vanguard ESG U.S. Corporate Bond ETF	Fixed Income	950.50M
BAB	Invesco Taxable Municipal Bond ETF	Fixed Income	946.89M
QEFA	SPDR MSCI EAFE StrategicFactors ETF	Equity	946.30M
BUFC	AB Conservative Buffer ETF	Equity	943.40M
DVYE	iShares Emerging Markets Dividend ETF	Equity	940.92M
MSOS	AdvisorShares Pure US Cannabis ETF	Equity	940.16M
APIE	ActivePassive International Equity ETF	Equity	939.96M
OUSM	ALPS O'Shares US Small-Cap Quality Dividend ETF	Equity	938.78M
PDEC	Innovator U.S. Equity Power Buffer ETF - December	Equity	938.39M
OIH	VanEck Oil Services ETF	Equity	936.56M
SPLB	SPDR Portfolio Long Term Corporate Bond ETF	Fixed Income	935.47M
SEIM	SEI Enhanced U.S. Large Cap Momentum Factor ETF	Equity	935.23M
PSEP	Innovator U.S. Equity Power Buffer ETF - September	Equity	934.58M
IETC	iShares U.S. Tech Independence Focused ETF	Equity	933.24M
QDTE	Roundhill Innovation-100 0DTE Covered Call Strategy ETF	Equity	927.36M
EIPI	FT Energy Income Partners Enhanced Income ETF	Equity	927.05M
SUSL	iShares ESG MSCI USA Leaders ETF	Equity	925.12M
FNOV	FT Vest U.S. Equity Buffer ETF - November	Equity	922.57M
TOUS	T. Rowe Price International Equity ETF	Equity	919.60M
SMIN	iShares MSCI India Small Cap ETF	Equity	919.09M
HAUZ	DBX ETF Trust - Xtrackers International Real Estate ETF	Equity	917.69M
IHAK	iShares Cybersecurity & Tech ETF	Equity	915.77M
FGD	First Trust Dow Jones Global Select Dividend Index Fund	Equity	915.34M
JSCP	JPMorgan Short Duration Core Plus ETF	Fixed Income	913.26M
FXH	First Trust Health Care AlphaDEX Fund	Equity	910.46M
VOTE	TCW Transform 500 ETF	Equity	910.24M
INCM	Franklin Income Focus ETF Income Focus ETF	Asset Allocation	909.85M
SEIV	SEI Enhanced U.S. Large Cap Value Factor ETF	Equity	908.47M
PALL	abrdn Physical Palladium Shares ETF	Commodity	907.77M
TAN	Invesco Solar ETF	Equity	907.09M
IBDY	iShares iBonds Dec 2033 Term Corporate ETF	Fixed Income	906.20M
FOCT	FT Vest U.S. Equity Buffer ETF - October	Equity	905.48M
VPLS	Vanguard Core Plus Bond ETF	Fixed Income	902.52M
TDTF	FlexShares iBoxx 5 Year Target Duration TIPS Index Fund	Fixed Income	899.64M
APCB	ActivePassive Core Bond ETF	Fixed Income	898.83M
PSI	Invesco Semiconductors ETF	Equity	898.66M
EDIV	SPDR S&P Emerging Markets Dividend ETF	Equity	898.46M
IVES	Dan IVES Wedbush AI Revolution ETF	Equity	894.66M
DFAW	Dimensional World Equity ETF	Equity	892.70M
AVIV	Avantis International Large Cap Value ETF	Equity	890.42M
USO	United States Oil Fund LP	Commodity	889.36M
FMAR	FT Vest US Equity Buffer ETF - March	Equity	888.31M
FFLC	Fidelity Fundamental Large Cap Core ETF	Equity	887.17M
FYX	First Trust Small Cap Core AlphaDEX Fund	Equity	887.12M
TGRW	T. Rowe Price Growth Stock ETF	Equity	886.48M
KXI	iShares Global Consumer Staples ETF	Equity	886.24M
FAPR	FT Vest U.S. Equity Buffer ETF - April	Equity	882.03M
BUYW	Main BuyWrite ETF	Equity	880.86M
PICK	iShares MSCI Global Metals & Mining Producers ETF	Equity	878.49M
SYLD	Cambria Shareholder Yield ETF	Equity	876.61M
BILZ	PIMCO Ultra Short Government Active Exchange-Traded Fund	Fixed Income	876.42M
CGSM	Capital Group Short Duration Municipal Income ETF	Fixed Income	873.69M
TGRT	T. Rowe Price Growth ETF	Equity	869.62M
FLGB	Franklin FTSE United Kingdom ETF	Equity	869.03M
PID	Invesco International Dividend Achievers ETF	Equity	867.75M
GSID	Marketbeta INTL Equity ETF	Equity	862.98M
ROM	ProShares Ultra Technology	Equity	862.04M
EWS	iShares MSCI Singapore ETF	Equity	861.90M
PCRB	Putnam ESG Core Bond ETF	Fixed Income	859.67M
DFSI	Dimensional International Sustainability Core 1 ETF	Equity	856.60M
PCEF	Invesco CEF Income Composite ETF	Asset Allocation	855.58M
IXP	iShares Global Comm Services ETF	Equity	848.46M
IMCV	iShares Morningstar Mid-Cap Value ETF	Equity	846.76M
XLSR	SPDR SSgA U.S. Sector Rotation ETF	Equity	845.87M
IQDF	FlexShares International Quality Dividend Index Fund	Equity	841.84M
VTWV	Vanguard Russell 2000 Value ETF	Equity	840.67M
FMHI	First Trust Municipal High Income ETF	Fixed Income	836.23M
CLOZ	Eldridge BBB-B CLO ETF	Fixed Income	834.77M
AGGY	WisdomTree Yield Enhanced U.S. Aggregate Bond Fund	Fixed Income	831.31M
SYFI	AB Short Duration High Yield ETF	Fixed Income	829.12M
QAI	NYLI Hedge Multi-Strategy Tracker ETF	Alternatives	828.60M
JETS	U.S. Global Jets ETF	Equity	827.76M
VIOG	Vanguard S&P Small-Cap 600 Growth ETF	Equity	827.32M
SCHQ	Schwab Long-Term U.S. Treasury ETF	Fixed Income	826.54M
RDIV	Invesco S&P Ultra Dividend Revenue ETF	Equity	826.12M
PMBS	PIMCO Mortgage-Backed Securities Active Exchange-Traded Fund	Fixed Income	825.29M
DUSA	Davis Select U.S. Equity ETF	Equity	825.26M
PSK	SPDR ICE Preferred Securities ETF	Fixed Income	817.69M
JHMD	John Hancock Multifactor Developed International ETF	Equity	814.16M
UYG	ProShares Ultra Financials	Equity	812.58M
CGMM	Capital Group U.S. Small and Mid Cap ETF	Equity	811.17M
BTCI	NEOS Bitcoin High Income ETF	Currency	809.22M
ONEY	SPDR Russell 1000 Yield Focus ETF	Equity	808.84M
AVES	Avantis Emerging Markets Value ETF	Equity	808.80M
OUSA	ALPS O'Shares U.S. Quality Dividend ETF	Equity	807.67M
IHF	iShares U.S. Healthcare Providers ETF	Equity	806.54M
PLDR	Putnam Sustainable Leaders ETF	Equity	802.26M
JIVE	JPMorgan International Value ETF	Equity	801.84M
LABU	Direxion Daily S&P Biotech Bull 3X Shares	Equity	797.25M
IBTJ	iShares iBonds Dec 2029 Term Treasury ETF	Fixed Income	796.61M
JCPI	JPMorgan Inflation Managed Bond ETF	Fixed Income	795.27M
PGF	Invesco Financial Preferred ETF	Fixed Income	794.63M
PAPR	Innovator U.S. Equity Power Buffer ETF - April	Equity	794.02M
XBIL	US Treasury 6 Month Bill ETF	Fixed Income	791.99M
GWX	SPDR S&P International Small Cap ETF	Equity	790.71M
CONL	GraniteShares 2x Long COIN Daily ETF	Equity	790.28M
AMDL	GraniteShares 2x Long AMD Daily ETF	Equity	788.98M
PFEB	Innovator U.S. Equity Power Buffer ETF - February	Equity	787.64M
PNQI	Invesco NASDAQ Internet ETF	Equity	785.52M
REZ	iShares Residential and Multisector Real Estate ETF	Equity	783.90M
AVLC	Avantis U.S. Large Cap Equity ETF	Equity	782.89M
THYF	T. Rowe Price U.S. High Yield ETF	Fixed Income	782.79M
XTEN	BondBloxx Bloomberg Ten Year Target Duration US Treasury ETF	Fixed Income	781.56M
EZM	WisdomTree U.S. MidCap Fund	Equity	779.68M
DBA	Invesco DB Agriculture Fund	Commodity	778.63M
BSCX	Invesco BulletShares 2033 Corporate Bond ETF	Fixed Income	777.19M
EMCS	Xtrackers MSCI Emerging Markets Climate Selection ETF	Equity	772.99M
ECH	iShares MSCI Chile ETF	Equity	772.15M
NUKZ	Range Nuclear Renaissance Index ETF	Equity	769.13M
ISCG	iShares Morningstar Small-Cap Growth ETF	Equity	766.92M
XMLV	Invesco S&P MidCap Low Volatility ETF	Equity	766.26M
KAT	Scharf ETF	Equity	764.58M

"""


def parse_predefined_list():
    etfs = []
    lines = PREDEFINED_ETF_TEXT.strip().split("\n")
    for line in lines:
        parts = line.split("\t")
        if len(parts) >= 2:
            symbol = parts[0].strip()
            # 운용사 이름 추출 (Vanguard, iShares, SPDR, Schwab 등)
            name = parts[1].strip()
            company = name.split(" ")[0]
            if company in [
                "SPDR",
                "Invesco",
                "Schwab",
                "Global",
                "VanEck",
                "Direxion",
                "ProShares",
                "WisdomTree",
                "iShares",
                "Vanguard",
                "State Street",
                "First Trust",
                "Global X",
                "PIMCO",
                "Roundhill",
                "YieldMax",
                "JPMorgan",
                "Fidelity",
                "REX",
            ]:
                pass  # 그대로 사용
            elif "iShares" in name:
                company = "iShares"
            else:
                company = name.split(" ")[0]  # 기본적으로 첫 단어를 운용사로 가정

            etfs.append({"symbol": symbol, "company": company, "longName": name})
    return etfs


def enrich_with_yfinance(etf_list):
    """yfinance를 사용하여 ETF 목록에 거래소 정보를 추가합니다."""
    print("Enriching ETF data with yfinance for exchange info...")

    enriched_etfs = []
    symbols = [etf["symbol"] for etf in etf_list]

    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_symbol = {
            executor.submit(lambda s: yf.Ticker(s).info, symbol): symbol
            for symbol in symbols
        }

        for future in tqdm(
            as_completed(future_to_symbol),
            total=len(symbols),
            desc="Fetching yfinance details",
        ):
            symbol = future_to_symbol[future]
            original_etf = next(
                (etf for etf in etf_list if etf["symbol"] == symbol), None
            )
            if not original_etf:
                continue

            try:
                info = future.result()
                exchange = info.get("exchange")
                original_etf["market"] = EXCHANGE_MAP.get(exchange, DEFAULT_US_MARKET)
                # yfinance의 longName이 더 정확할 수 있으므로 업데이트
                if info.get("longName"):
                    original_etf["longName"] = info.get("longName")
                enriched_etfs.append(original_etf)
            except Exception:
                original_etf["market"] = DEFAULT_US_MARKET
                enriched_etfs.append(original_etf)

    return enriched_etfs


def save_new_etfs_to_nav(new_etf_list):
    if not new_etf_list:
        print("  -> No new ETFs to add.")
        return

    print(f"Updating nav source files with {len(new_etf_list)} new ETFs...")
    files_to_update = {}
    total_added_count = 0

    for etf in tqdm(new_etf_list, desc="Processing ETFs"):
        symbol, market = etf.get("symbol"), etf.get("market")
        if not symbol or not market:
            continue

        first_char = symbol.split(".")[0][0].lower()
        if not ("a" <= first_char <= "z" or "0" <= first_char <= "9"):
            first_char = "etc"

        file_path = os.path.join(NAV_DIR, market, f"{first_char}.json")
        if file_path not in files_to_update:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    files_to_update[file_path] = {
                        ticker["symbol"]: ticker for ticker in json.load(f)
                    }
            except (FileNotFoundError, json.JSONDecodeError):
                files_to_update[file_path] = {}

        if symbol not in files_to_update[file_path]:
            new_ticker_info = {"symbol": symbol, "market": market, "currency": "USD"}
            if etf.get("company"):
                new_ticker_info["company"] = etf["company"]
            if etf.get("koName"):
                new_ticker_info["koName"] = etf["koName"]
                new_ticker_info["longName"] = etf["koName"]

            files_to_update[file_path][symbol] = new_ticker_info
            total_added_count += 1

    if total_added_count == 0:
        print("  -> No new ETFs to add.")
        return

    for file_path, tickers_dict in files_to_update.items():
        sorted_tickers = sorted(tickers_dict.values(), key=lambda x: x["symbol"])
        save_json_file(file_path, sorted_tickers)
        print(f"  -> Updated file: {os.path.relpath(file_path, ROOT_DIR)}")


def main():
    print("\n--- Starting to Fetch Top US ETFs from Predefined List ---")

    existing_symbols = {
        t["symbol"]
        for m in os.listdir(NAV_DIR)
        if os.path.isdir(os.path.join(NAV_DIR, m))
        for f in os.listdir(os.path.join(NAV_DIR, m))
        if f.endswith(".json")
        if (d := load_json_file(os.path.join(NAV_DIR, m, f)))
        for t in d
    }
    print(f"Found {len(existing_symbols)} existing symbols in nav directories.")

    # 1. 내장된 리스트 파싱
    us_etfs_base = parse_predefined_list()
    print(f"  -> Parsed {len(us_etfs_base)} ETFs from the predefined list.")

    if us_etfs_base:
        # 2. yfinance로 정보 보강
        us_etfs_enriched = enrich_with_yfinance(us_etfs_base)

        # 3. 새로운 ETF만 필터링
        new_us_etfs = [
            etf for etf in us_etfs_enriched if etf["symbol"] not in existing_symbols
        ]
        print(f"  -> Found {len(new_us_etfs)} new US ETFs to add.")

        if new_us_etfs:
            save_new_etfs_to_nav([{**etf, "currency": "USD"} for etf in new_us_etfs])

    print("\n🎉 Finished fetching and updating top US ETFs.")
    print("Please run 'npm run generate-nav' to apply changes.")


if __name__ == "__main__":
    main()
