# Clocked

A complete, mobile-friendly web application designed for an agreement where a sister owes **£60 GBP** and reduces that debt by working at **US$6 per hour**, converted at a confirmed exchange rate (such as `US$1 = £0.80`).

---

## Highlights & Accounting Principles

- **Dual-Currency Integrity**:
  - Hourly work credit is in **US Dollars** (`US$6.00/hr`).
  - Total debt is in **British Pounds** (`£60.00`).
  - `USD earned = active seconds worked × 6 ÷ 3600`.
  - `GBP credit = USD earned × agreed exchange rate`.
  - Test benchmark (with `US$1 = £0.80`):
    - 5 minutes (300s) = **US$0.50** earned, **£0.40** credit, **£59.60** remaining.
    - 30 minutes (1800s) = **US$3.00** earned, **£2.40** credit, **£57.20** remaining.
    - 1 hour (3600s) = **US$6.00** earned, **£4.80** credit, **£55.20** remaining.
- **Scaled Arithmetic & Decimal Precision**:
  - Fractional pennies are preserved internally to 8 decimal places.
  - Rounding occurs only for display.
  - Twelve 5-minute sessions produce exactly the same credit as one 60-minute session.
  - The debt never drops below zero. Excess work is tracked and explained separately.
  - Sub-penny balances (`0 < debt < £0.01`) explicitly display as **"Less than £0.01"** and are never declared cleared prematurely.
- **Resilient Time Tracking**:
  - Elapsed active time is derived directly from persisted epoch timestamps and accumulated active intervals.
  - Immune to tab backgrounding, phone locking, browser sleep, or page refresh.
  - Instant multi-tab synchronization via `BroadcastChannel` preventing conflicting timers.
  - Support for durations exceeding 24 hours without wrapping.
- **Definitive Visual Direction**:
  - Dark mode canvas (`#000000`), session surface (`#111114`), raised surfaces (`#19191F`), quiet borders (`#2D2B35`), and violet accent (`#B6A0E9`).
  - Custom 5×7 **dot-matrix numerals** for the primary debt reading with optical pound symbol alignment.
  - **Repayment Marks**: 60 circular marks in 3 rows of 20, displaying fractional progress and a 180ms punch response on each full pound cleared.
  - Compact bottom timer dock for mobile viewports when the main timer controls scroll out of view.
  - Seamless responsive adaptation between mobile (390px content column) and desktop (1040px 2-column layout).

---

## Getting Started

### Development
```bash
npm install
npm run dev
```

### Automated Testing
Run the comprehensive Vitest test suite verifying mathematical precision, storage integrity, and workflow calculations:
```bash
npm test
```

### Production Build
```bash
npm run build
npm run preview
```

---

## Keyboard Shortcuts

- `Space` or `k`: Clock in / Pause / Resume
- `s`: Save active session
- `Esc`: Dismiss sheets / modals
