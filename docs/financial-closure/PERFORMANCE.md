# Financial state performance evidence

Synthetic Desktop Node v24.19.0, three samples per operation. Initial exact implementation versus the optimized exact implementation; sampled heap/RSS are not isolated peaks. These timings do not qualify mobile performance. Exact financial arithmetic remains slower than the earlier floating-point baseline, intentionally preserving the financial contract.

| Rows | Exact balance before/after ms | Prewrite before/after ms | Two state copies after ms | Three verified filesystem snapshots after ms | Sampled RSS after MiB |
|---:|---:|---:|---:|---:|---:|
| 1000 | 10.8 / 6.4 | 10.4 / 3.5 | 4.5 | 1.7 | 48.9 |
| 22934 | 73.6 / 48.1 | 140.7 / 135.9 | 90.1 | 74.7 | 163.7 |
| 100000 | 302.9 / 272.6 | 501.1 / 359.7 | 492.5 | 173.7 | 335.4 |

At 22,934 rows, two full state copies and verified snapshots remain meaningful costs; WebView alone does not explain latency. The 9.2.7 browser CI records real IndexedDB mutation, rendering plus two frames, heartbeat gap and sampled heap at 22,934 rows. This is an after-only browser measurement. There is no measured before/after Android UI baseline or device peak-memory qualification.
