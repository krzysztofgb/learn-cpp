| # | Answer | Technique / reasoning |
| --- | --- | --- |
| 1 | 6 | Geometric with p = 1/6. |
| 2 | 14.7 | Sum of geometric waits: 6(1 + 1/2 + ... + 1/6) = 14.7. |
| 3 | 161/36 ≈ 4.47 | P(max ≤ k) = (k/6)²; sum over k, or enumerate. |
| 4 | 12.25 | Independence: E\[XY\] = E\[X\]E\[Y\] = 3.5 × 3.5. |
| 5 | 1 | Indicators: each item is fixed with probability 1/n, and there are n items. |
| 6 | 53/5 = 10.6 | Symmetry: the 4 aces split the 48 other cards into 5 equal gaps of 9.6 on average; add 1 for the ace. |
| 7 | 2/3 and 1/3 | The max of two uniforms has density 2x; by symmetry the two points and the endpoints split \[0, 1\] into three equal expected gaps. |
| 8 | HH: 6, HT: 4 | First-step analysis. After an H, a T restarts the HH search from scratch, but for HT, after an H, more H's still leave you one T away. |
| 9 | b / (a + b) | A fair walk is a martingale: a · P + (−b)(1 − P) = 0. |
| 10 | 1/3 | Equally likely families: BB, BG, GB (GG excluded). |
| 11 | 1/6 ≈ 16.7% | Of 10,000 people: 99 true positives, 495 false positives; 99 / 594. |
| 12 | Switch; 2/3 | Your first pick is right 1/3 of the time; switching wins whenever it was wrong. |
| 13 | 2/3 | After one head the posterior for p is Beta(2, 1) with mean 2/3 (Laplace's rule of succession). |
| 14 | Keep 4, 5 or 6; reroll 1, 2 or 3; value 4.25 | Rerolling is worth 3.5, so keep anything above it: (4 + 5 + 6)/6 + (3/6)(3.5) = 4.25. |
| 15 | 1/4 | The pieces form a triangle when every piece is shorter than 1/2; that region is a quarter of the sample space. |
| 16 | 23 | P(no shared birthday among 23) ≈ 0.493. |
| 17 | 10 | Locker n is toggled once per divisor; only perfect squares have an odd number of divisors (1, 4, ..., 100). |
| 18 | 2496 | 50² − 2². |
| 19 | 391 | 20² − 3². |
| 20 | About 1.63 | ln(1.05) ≈ 0.049, × 10 ≈ 0.49, e^0.49 ≈ 1.63 (or the rule of 72: doubling takes \~14.4 periods). |
| 21 | About 7.07 | 5√2. |
