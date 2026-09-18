# SANAD / سند — V2.4 Test Build

V2.4 builds on the reviewed V2.3 source and targets the issues found during real-device testing.

## V2.4 changes
- First bank SMS sync scans the historical inbox once.
- Later refreshes are incremental and only merge new/changed SMS records.
- Bank screen includes a manual refresh action and automatic refresh while the screen is open.
- Transaction date/time prefers the explicit date/time inside the bank SMS, falling back to SMS receive time.
- Local-day grouping is used instead of UTC-day slicing.
- Merchant/category hints expanded for UAE supermarkets, fuel, transport, telecom/utilities, pharmacies/health, travel, subscriptions, education and home spending.
- Bank review rows show the original SMS excerpt and parsed date/time so ambiguous records are identifiable.
- Voice mode stays logically active until the user presses Finish.
- Voice UI reports silence / speech / processing and uses microphone RMS callbacks for live activity bars.
- Android on-device recognition support is checked against installed Arabic locales on supported Android versions.
- Busy/disconnected recognition cycles are recreated with backoff instead of stacking recognizers.
- No cloud voice fallback.
- No INTERNET permission.

V2.4 patch SHA-256:
`55d5fb2e2621051a38c14a0fda78f6870e3e11e054a3487e3b295b52c0f0ee42`

GitHub Actions produces:
- `SANAD-V2.4-APK`
- `SANAD-V2.4-FULL-PROJECT`
