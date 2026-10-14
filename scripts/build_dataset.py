"""FinSight dataset builder.

Pipeline:  generate raw data  ->  inject realistic defects  ->  clean  ->  validate  ->  write CSVs + report

Run from the repo root:  python scripts/build_dataset.py
Seeded, so the output is identical on every run. All data is synthetic.
"""
from pathlib import Path

import numpy as np
import pandas as pd

SEED = 42
ROOT = Path(__file__).resolve().parents[1]
DATA, DOCS = ROOT / "data", ROOT / "docs"
START, END = np.datetime64("2024-10-01"), np.datetime64("2026-09-30")
N_CUST, TARGET_TXN, N_MONTHS = 3000, 20500, 24

# ---------------------------------------------------------------- dimensions
REGIONS = ["North", "South", "East", "West", "Central"]
REGION_W = [0.24, 0.27, 0.13, 0.28, 0.08]
REGION_GROWTH = [0.004, 0.006, None, 0.008, 0.005]  # East gets a custom curve (decline after month 11)

SEGMENTS = ["Premium", "High Value", "Standard"]
SEG_W = [0.10, 0.22, 0.68]
SEG_RATE = np.array([0.50, 0.40, 0.25])        # transactions per customer-month
SEG_MEDIAN = np.array([3600, 2800, 1300])      # median ticket size (INR)
SEG_CHURN = np.array([0.004, 0.008, 0.016])    # monthly churn hazard
SEG_FAIL = np.array([0.7, 0.9, 1.1])           # failure-rate multiplier
SEG_FUNDS = np.array([0.4, 0.7, 1.2])          # insufficient-funds multiplier
AGE_BANDS = ["18-24", "25-34", "35-44", "45-54", "55+"]
AGE_W = [[.02, .18, .32, .30, .18], [.06, .30, .32, .20, .12], [.18, .36, .24, .14, .08]]

PRODUCTS = pd.DataFrame({
    "product_id": [f"P0{i}" for i in range(1, 7)],
    "product_name": ["Instant Credit", "Platinum Card", "Everyday Debit", "Savings Plus", "Legacy Wallet", "Forex & Remittance"],
    "product_category": ["Lending", "Cards", "Cards", "Deposits", "Payments", "Remittance"],
    "fee_rate_pct": [2.0, 1.2, 0.5, 0.25, 1.1, 1.4],
    "min_fee": [10, 15, 2, 1, 2, 25],
})
PROD_MULT = np.array([1.3, 1.8, 0.8, 1.2, 0.9, 1.6])  # ticket-size multiplier by product
# Product mix by segment (rows: Premium, High Value, Standard)
PROD_W = np.array([[.12, .38, .10, .18, .03, .19],
                   [.20, .12, .28, .18, .10, .12],
                   [.14, .02, .44, .20, .16, .04]])
ms = np.arange(N_MONTHS)
PROD_TREND = np.stack([0.6 + 1.0 * ms / 23,      # Instant Credit: fast growth
                       np.ones(N_MONTHS),        # Platinum Card: flat
                       1 + 0.005 * ms,           # Everyday Debit: slight growth
                       1 + 0.010 * ms,           # Savings Plus: steady growth
                       1 - 0.75 * ms / 23,       # Legacy Wallet: decline
                       1 + 0.008 * ms], axis=1)  # Forex: slight growth

CHANNELS = ["Mobile App", "Web Banking", "POS", "ATM", "Auto-Debit"]
CH_MIX = np.array([[.62, .15, 0, 0, .23],        # by product: Instant Credit
                   [.28, .12, .55, .05, 0],      # Platinum Card
                   [.25, .08, .40, .22, .05],    # Everyday Debit
                   [.42, .28, 0, .15, .15],      # Savings Plus
                   [.55, .05, .40, 0, 0],        # Legacy Wallet
                   [.35, .60, 0, 0, .05]])       # Forex & Remittance
TYPES = ["Purchase", "Transfer", "Bill Payment", "Cash Withdrawal", "EMI Payment"]
TYPE_MIX = np.array([[.25, .45, .25, 0, .05], [.20, .40, .30, 0, .10], [1, 0, 0, 0, 0],
                     [0, 0, 0, 1, 0], [0, 0, .45, 0, .55]])  # by channel
TYPE_MULT = np.array([1.0, 1.6, 0.7, 0.6, 1.2])

REASONS = ["Insufficient Funds", "Authentication Failure", "Technical Error", "Network Timeout",
           "Fraud / Risk Block", "Merchant Issue"]
CH_FAIL = np.array([0.042, 0.038, 0.032, 0.044, 0.046])  # baseline failure rate by channel
REASON_MIX = np.array([[.15, .25, .20, .25, .08, .07],   # by channel
                       [.20, .30, .25, .15, .06, .04],
                       [.25, .05, .10, .25, .05, .30],
                       [.25, .05, .35, .30, .05, 0],
                       [.70, .05, .10, .05, .02, .08]])

SEAS = np.array([.97, .90, 1.08, .98, 1.00, .96, .98, 1.00, 1.04, 1.12, 1.15, 1.08])  # Jan..Dec
SEAS_M = SEAS[(9 + ms) % 12]                      # month index 0 = Oct 2024
MOBILE_AUTH_EXTRA = np.zeros(N_MONTHS)
MOBILE_AUTH_EXTRA[20:] = [0.03, 0.045, 0.055, 0.06]  # authentication problems on mobile, Jun-Sep 2026


def pick(rng, probs):
    """Vectorised categorical sample: one row of probabilities per item."""
    cdf = np.cumsum(probs / probs.sum(axis=1, keepdims=True), axis=1)
    return np.minimum((rng.random(len(cdf))[:, None] > cdf).sum(axis=1), probs.shape[1] - 1)


# ---------------------------------------------------------------- generation
def generate(rng):
    # Customers: 72% existing base, 28% signed up during the window at an increasing rate
    n_old = int(N_CUST * 0.72)
    signup = np.concatenate([
        START - rng.integers(1, 640, n_old).astype("timedelta64[D]"),
        START + (rng.random(N_CUST - n_old) * (END - START).astype(int)).astype(int).astype("timedelta64[D]"),
    ])
    seg = rng.choice(3, N_CUST, p=SEG_W)
    reg = rng.choice(5, N_CUST, p=REGION_W)
    age = np.array([rng.choice(AGE_BANDS, p=AGE_W[s]) for s in seg])
    activity = rng.gamma(1.5, 1 / 1.5, N_CUST)                      # some customers far more active than others
    churn = np.maximum(signup, START) + (rng.geometric(SEG_CHURN[seg]) * 30).astype("timedelta64[D]")

    # Monthly activity rates per customer
    mstart = pd.date_range(START, periods=N_MONTHS, freq="MS").values.astype("datetime64[D]")
    mend = (pd.date_range(START, periods=N_MONTHS, freq="MS") + pd.offsets.MonthEnd(0)).values.astype("datetime64[D]")
    one = np.timedelta64(1, "D")
    s = np.maximum(signup[:, None], mstart[None, :])
    e = np.minimum(churn[:, None] - one, mend[None, :])
    span = np.clip((e - s).astype(int) + 1, 0, None)
    frac = span / ((mend - mstart).astype(int) + 1)[None, :]

    reg_trend = np.zeros((5, N_MONTHS))
    for r, g in enumerate(REGION_GROWTH):
        reg_trend[r] = 1 + g * ms if g is not None else np.where(ms <= 11, 1 + 0.005 * ms, 1.055 * (1 - 0.035 * (ms - 11)))
    rate = SEG_RATE[seg][:, None] * activity[:, None] * SEAS_M[None, :] * reg_trend[reg] * frac * (1 + 0.002 * ms)
    counts = rng.poisson(rate * TARGET_TXN / rate.sum())

    # Expand to one row per transaction
    ci, mi = np.nonzero(counts)
    reps = counts[ci, mi]
    ci, mi = np.repeat(ci, reps), np.repeat(mi, reps)
    n = len(ci)
    date = s[ci, mi] + (rng.random(n) * span[ci, mi]).astype(int).astype("timedelta64[D]")
    sg, rg = seg[ci], reg[ci]

    prod_p = PROD_W[:, None, :] * PROD_TREND[None, :, :]            # (seg, month, product)
    prod = pick(rng, prod_p[sg, mi])
    ch = pick(rng, CH_MIX[prod])
    typ = pick(rng, TYPE_MIX[ch])

    median = SEG_MEDIAN[sg] * TYPE_MULT[typ] * PROD_MULT[prod]
    amount = np.clip(np.round(median * np.exp(0.8 * rng.standard_normal(n))), 50, 300000)
    amount = np.where(ch == 3, np.minimum(amount, 40000), amount)

    # Failures: baseline by channel/segment, plus two planted problems (mobile auth, East network)
    base = CH_FAIL[ch] * SEG_FAIL[sg]
    extra_auth = np.where(ch == 0, MOBILE_AUTH_EXTRA[mi], 0.0)
    extra_net = np.where((rg == 2) & (mi >= 14), 0.0015 * (mi - 13), 0.0)
    p_fail = base + extra_auth + extra_net
    failed = rng.random(n) < p_fail
    mix = REASON_MIX[:, None, :] * np.array([[1, 1, 1, 1, 1, 1]]) * np.where(np.arange(6) == 0, SEG_FUNDS[None, :, None], 1)
    reason = pick(rng, mix[ch, sg])                                   # baseline reason mix
    roll = rng.random(n) * p_fail
    reason = np.where(roll >= base, np.where(roll < base + extra_auth, 1, 3), reason)
    reason_txt = np.where(failed, np.array(REASONS)[reason], "")
    fee = np.round(np.clip(np.maximum(PRODUCTS.min_fee.values[prod], amount * PRODUCTS.fee_rate_pct.values[prod] / 100), 0, 2500), 2)

    txn = pd.DataFrame({
        "customer_id": np.char.add("C", np.char.zfill((ci + 1).astype(str), 4)),
        "product_id": PRODUCTS.product_id.values[prod],
        "channel_id": np.char.add("CH", (ch + 1).astype(str)),
        "txn_date": date.astype(str),
        "txn_type": np.array(TYPES)[typ],
        "amount": amount, "fee": np.where(failed, 0.0, fee),
        "status": np.where(failed, "failed", "success"),
        "failure_reason": reason_txt,
    }).sort_values(["txn_date", "customer_id"], kind="stable").reset_index(drop=True)
    txn.insert(0, "transaction_id", [f"T{i:06d}" for i in range(1, len(txn) + 1)])

    cust = pd.DataFrame({"customer_id": [f"C{i:04d}" for i in range(1, N_CUST + 1)],
                         "region_id": [f"R{r + 1}" for r in reg], "segment": np.array(SEGMENTS)[seg],
                         "signup_date": signup.astype(str), "age_band": age})
    regions = pd.DataFrame({"region_id": [f"R{i}" for i in range(1, 6)], "region_name": REGIONS})
    channels = pd.DataFrame({"channel_id": [f"CH{i}" for i in range(1, 6)], "channel_name": CHANNELS})
    return cust, txn, regions, channels


# ---------------------------------------------------------------- defects
def inject_defects(rng, cust, txn):
    """Plant ~0.5% realistic data-entry / pipeline defects so the cleaning step has real work to do."""
    txn, cust = txn.copy(), cust.copy()
    pick_rows = lambda k, mask=None: rng.choice(txn.index[mask] if mask is not None else txn.index, k, replace=False)
    txn.loc[pick_rows(12), "amount"] *= -1
    txn.loc[pick_rows(15, (txn.status == "failed").values), "failure_reason"] = ""
    txn.loc[pick_rows(8, (txn.status == "success").values), "failure_reason"] = "Technical Error"
    txn.loc[pick_rows(10), "customer_id"] = [f"C9{i:03d}" for i in range(10)]
    bad = pick_rows(8)
    txn.loc[bad[:4], "txn_date"] = ["2025-13-40", "31/02/2025", "not a date", "2025-00-10"]
    txn.loc[bad[4:], "txn_date"] = ["2027-02-14", "2027-05-03", "2027-01-20", "2026-12-25"]
    txn.loc[pick_rows(20), "txn_type"] = rng.choice([" transfer", "BILL PAYMENT", "purchase ", "emi payment"], 20)
    txn = pd.concat([txn, txn.loc[pick_rows(20)]], ignore_index=True)          # exact duplicate rows
    cust.loc[rng.choice(cust.index, int(N_CUST * 0.03), replace=False), "age_band"] = np.nan
    return cust, txn


# ---------------------------------------------------------------- cleaning
def clean(cust, txn):
    log, raw_n = [], len(txn)
    txn = txn.copy()

    def step(check, found, action):
        log.append({"check": check, "rows": int(found), "action": action})

    canon = {t.lower(): t for t in TYPES}
    norm = txn.txn_type.str.strip().str.lower().map(canon)
    step("Inconsistent transaction_type casing/whitespace", (norm != txn.txn_type).sum(), "Standardised to canonical labels")
    txn["txn_type"] = norm

    dup = txn.duplicated("transaction_id")
    step("Duplicate transaction_id", dup.sum(), "Dropped (kept first occurrence)")
    txn = txn[~dup]

    d = pd.to_datetime(txn.txn_date, errors="coerce", format="%Y-%m-%d")
    step("Unparseable transaction date", d.isna().sum(), "Dropped")
    out = d.notna() & ((d > pd.Timestamp(END)) | (d < pd.Timestamp(START)))
    step("Date outside the dataset window (future / pre-launch)", out.sum(), "Dropped")
    txn = txn[d.notna() & ~out]

    neg = txn.amount <= 0
    step("Non-positive amount", neg.sum(), "Dropped (cannot be inferred)")
    txn = txn[~neg]

    orphan = ~txn.customer_id.isin(cust.customer_id)
    step("Orphan customer_id (no matching customer)", orphan.sum(), "Dropped")
    txn = txn[~orphan]

    miss = (txn.status == "failed") & (txn.failure_reason.fillna("") == "")
    step("Failed transaction with no failure_reason", miss.sum(), "Labelled 'Unspecified' (kept: the failure is real)")
    txn.loc[miss, "failure_reason"] = "Unspecified"

    contra = (txn.status == "success") & (txn.failure_reason.fillna("") != "")
    step("Successful transaction carrying a failure_reason", contra.sum(), "Reason cleared (status is the source of truth)")
    txn.loc[contra, "failure_reason"] = ""

    cust = cust.copy()
    step("Missing age_band (customers)", cust.age_band.isna().sum(), "Labelled 'Unknown' (valid missingness, kept)")
    cust["age_band"] = cust.age_band.fillna("Unknown")
    return cust, txn.reset_index(drop=True), log, raw_n


# ---------------------------------------------------------------- validation
def validate(cust, txn, products, regions, channels):
    """Hard assertions on the cleaned data. Returns a list of passed checks; raises on any failure."""
    sd = pd.to_datetime(cust.set_index("customer_id").signup_date)
    td = pd.to_datetime(txn.txn_date)
    checks = {
        "transaction_id is unique": txn.transaction_id.is_unique,
        "customer_id is unique": cust.customer_id.is_unique,
        "All transactions reference an existing customer": txn.customer_id.isin(cust.customer_id).all(),
        "All transactions reference an existing product": txn.product_id.isin(products.product_id).all(),
        "All transactions reference an existing channel": txn.channel_id.isin(channels.channel_id).all(),
        "All customers reference an existing region": cust.region_id.isin(regions.region_id).all(),
        "All amounts are positive": (txn.amount > 0).all(),
        "All dates fall inside the dataset window": td.between(str(START), str(END)).all(),
        "No transaction occurs before the customer's signup date": (td.values >= sd.loc[txn.customer_id].values).all(),
        "status contains only success / failed": txn.status.isin(["success", "failed"]).all(),
        "Every failed transaction has a reason; no successful one does": ((txn.status == "failed") == (txn.failure_reason != "")).all(),
        "Failed transactions earn zero fee, successful ones earn a fee": ((txn.fee == 0) == (txn.status == "failed")).all(),
        "No missing values outside failure_reason": txn.drop(columns="failure_reason").notna().all().all() and cust.notna().all().all(),
    }
    failed = [k for k, ok in checks.items() if not ok]
    if failed:
        raise AssertionError(f"Validation failed: {failed}")
    return list(checks)


# ---------------------------------------------------------------- output
def write_report(log, passed, raw_n, cust, txn):
    ok = txn[txn.status == "success"]
    lines = ["# Data Quality Report", "",
             "Generated by `scripts/build_dataset.py`. The raw data is synthetic and ~0.5% of rows were deliberately corrupted "
             "to mimic real pipeline defects; this report shows what the cleaning step found and how each issue was handled.", "",
             f"**Rows:** {raw_n:,} raw transactions -> {len(txn):,} clean ({raw_n - len(txn):,} removed). "
             f"{len(cust):,} customers.", "", "## Issues found and fixed", "",
             "| Check | Rows affected | Action |", "|---|---:|---|"]
    lines += [f"| {r['check']} | {r['rows']} | {r['action']} |" for r in log]
    lines += ["", "## Validation checks on the cleaned data (all pass)", ""] + [f"- {c}" for c in passed]
    lines += ["", "## Clean dataset summary", "",
              f"- Period: {txn.txn_date.min()} to {txn.txn_date.max()}",
              f"- Success rate: {len(ok) / len(txn):.2%}",
              f"- Revenue (sum of fees on successful transactions): INR {ok.fee.sum():,.0f}",
              f"- Transaction value (successful): INR {ok.amount.sum():,.0f}", ""]
    (DOCS / "data_quality_report.md").write_text("\n".join(lines), encoding="utf-8")


def main():
    rng = np.random.default_rng(SEED)
    cust, txn, regions, channels = generate(rng)
    raw_cust, raw_txn = inject_defects(rng, cust, txn)
    cust, txn, log, raw_n = clean(raw_cust, raw_txn)
    passed = validate(cust, txn, PRODUCTS, regions, channels)

    DATA.mkdir(exist_ok=True), DOCS.mkdir(exist_ok=True)
    cust.to_csv(DATA / "customers.csv", index=False)
    txn.to_csv(DATA / "transactions.csv", index=False)
    PRODUCTS.to_csv(DATA / "products.csv", index=False)
    regions.to_csv(DATA / "regions.csv", index=False)
    channels.to_csv(DATA / "channels.csv", index=False)
    write_report(log, passed, raw_n, cust, txn)
    print(f"customers={len(cust):,}  transactions={len(txn):,}  (raw {raw_n:,})  -> data/ and docs/data_quality_report.md")


if __name__ == "__main__":
    main()
