"""Official product-list endpoints used by the review-only discovery job.

Each source is an issuer-owned product catalogue.  A source returning no
parseable products is reported as an error; it must never be treated as proof
that the issuer has no new ETFs.
"""

PROVIDERS = {
    "amplify": {
        "company": "Amplify",
        "urls": ["https://amplifyetfs.com/etfs"],
    },
    "first-trust": {
        "company": "First Trust",
        "urls": ["https://www.ftportfolios.com/retail/etf/etfsummary.aspx"],
    },
    "ishares": {
        "company": "iShares",
        "urls": ["https://www.ishares.com/us/products/income-etfs"],
    },
    "spdr": {
        "company": "SPDR",
        "urls": ["https://www.ssga.com/us/en/intermediary/etfs"],
    },
    "invesco": {
        "company": "Invesco",
        "urls": ["https://www.invesco.com/us/en/financial-products/etfs.html"],
    },
    "vanguard": {
        "company": "Vanguard",
        "urls": ["https://investor.vanguard.com/investment-products/etfs"],
    },
    "wisdomtree": {
        "company": "WisdomTree",
        "urls": ["https://www.wisdomtree.com/investments/etfs"],
    },
    "jpmorgan": {
        "company": "JPMorgan",
        "urls": ["https://am.jpmorgan.com/us/en/asset-management/adv/investment-strategies/etf-investing/"],
    },
    "schwab": {
        "company": "Schwab",
        "urls": ["https://www.schwabassetmanagement.com/products/etfs"],
    },
    "proshares": {
        "company": "ProShares",
        "urls": ["https://www.proshares.com/our-etfs"],
    },
    "yieldmax": {
        "company": "YieldMax",
        "urls": ["https://yieldmaxetfs.com/our-etfs/"],
    },
    "defiance": {
        "company": "Defiance",
        "urls": ["https://www.defianceetfs.com/explore-our-etfs/"],
    },
    "roundhill": {
        "company": "Roundhill Investments",
        "urls": ["https://www.roundhillinvestments.com/etf/"],
    },
    "graniteshares": {
        "company": "GraniteShares",
        "urls": [
            "https://graniteshares.com/underlyings/distribution/",
            "https://graniteshares.com/underlyings/autocallable-distribution/",
        ],
    },
    "rex": {
        "company": "REX",
        "urls": ["https://www.rexshares.com/etfs/"],
    },
    "direxion": {
        "company": "Direxion",
        "urls": ["https://www.direxion.com/all-etfs"],
    },
    "kurv": {
        "company": "Kurv",
        "urls": ["https://www.kurvinvest.com/etfs"],
    },
    "t-rex": {
        "company": "T-Rex",
        "urls": ["https://www.rexshares.com/t-rex-leveraged-etfs/"],
    },
    "global-x": {
        "company": "Global X",
        "urls": ["https://www.globalxetfs.com/"],
    },
    "neos": {
        "company": "NEOS",
        "urls": ["https://neosfunds.com/etfs/"],
    },
}
