# SANAD V2.4 local test

- First bank SMS sync scans all financial SMS once; later refreshes pull only new/overlap messages.
- Manual Refresh button + 60s auto refresh while Bank tab is open.
- Bank message date/time parsed from message text first, SMS received time second.
- Local calendar grouping avoids UTC day shifts.
- More merchant/category keywords and raw SMS/date preview in bank review.
- Continuous on-device voice session until Finish, with RMS voice activity UI and recognizer restart/backoff.
- Android 13+ probes installed on-device languages before declaring Arabic unsupported.
