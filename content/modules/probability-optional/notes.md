## Notes

### The toolkit

- **Linearity of expectation:** E\[X + Y\] = E\[X\] + E\[Y\] even when X and Y are dependent. Break a count into indicator variables and sum their probabilities. This solves a surprising fraction of interview problems.
- **Products need independence:** E\[XY\] = E\[X\] E\[Y\] holds when X and Y are independent, not in general.
- **Tail sums and maxima:** for a variable taking values 0, 1, 2, …, E\[X\] = Σ over k ≥ 1 of P(X ≥ k). For independent variables, P(max ≤ k) is the product of the individual P(Xᵢ ≤ k), and P(min > k) the product of the P(Xᵢ > k); differencing the first gives the distribution of the maximum.
- **Conditioning on the first step:** write the expected value (or probability) from the current state in terms of the states one step later, then solve the equations. Works for coin-pattern waiting times, random walks and dice games.
- **Geometric distribution:** waiting for an event of probability p takes 1/p trials on average. A wait made of successive stages with probabilities p₁, p₂, … (such as collecting every face of a die) takes 1/p₁ + 1/p₂ + … on average, by linearity.
- **Fair games (martingales):** if every step has expected gain zero, your expected fortune when you stop equals your starting fortune, provided your fortune stays bounded until you stop (for example, a walk stopped on reaching either of two barriers). Setting the expected final value equal to the start gives gambler's-ruin probabilities in one line.
- **Conditional probability by counting:** list equally likely outcomes, cross out those the condition rules out, and count what's left. Be precise about what the condition is: "at least one is X" and "this particular one is X" remove different outcomes.
- **Bayes' rule:** P(A | B) = P(B | A) P(A) / P(B). Write out the four cells (true/false positive/negative) with a concrete population, like 10,000 people.
- **Updating an unknown probability:** with a uniform prior on a coin's p, after k heads in n flips the posterior is Beta(k + 1, n − k + 1), and the probability that the next flip is heads is its mean, (k + 1)/(n + 2) (Laplace's rule of succession).
- **Symmetry:** if outcomes are interchangeable, they're equally likely. Positions of special cards in a shuffled deck split it into equal gaps on average; likewise n independent uniform points split \[0, 1\] into n + 1 pieces of expected length 1/(n + 1) each.
- **Geometric probability:** for independent uniform continuous variables, a probability is the area (or volume) of the favorable region divided by the area of the whole sample space. Draw the region.
- **Complement:** P(at least one) = 1 − P(none). For many small, nearly independent chances, P(none) ≈ e^(−expected count): the birthday problem's P(no match among n) is about e^(−n(n − 1)/(2 · 365)).
- **Pairing and parity:** divisors of n come in pairs (d, n/d), which coincide only when d = √n. Counting arguments that pair things up often reduce a puzzle to a parity question.
- **Optimal stopping:** compute the value of continuing, then stop when the current outcome beats it; work backward from the last decision.
- **Check by simulation:** a few lines of C++ with `<random>` and a million trials confirm an answer to two or three digits.

*Further reading:* [Generating random numbers using Mersenne Twister](https://www.learncpp.com/cpp-tutorial/generating-random-numbers-using-mersenne-twister/)

### Mental math habits

Interviewers sometimes ask for fast arithmetic or estimates. Useful tricks: (a + b)(a − b) = a² − b² (so 48 × 52 = 2500 − 4), multiplying near round numbers, (1 + r)ⁿ ≈ e^(nr) for small r with eˣ ≈ 1 + x + x²/2, the rule of 72 (something growing r% per period doubles in about 72/r periods), square roots by pulling out a perfect square (√8 = 2√2), 1/7 ≈ 0.142857, √2 ≈ 1.414, ln 2 ≈ 0.693, and e ≈ 2.718. Say your approximation and refine it rather than going silent.

## Problems

Work each one on paper, aiming for under 5 minutes. State the technique you're using before calculating.

**Expectation**

1. How many rolls of a fair die does it take, on average, to roll a 6?
2. How many rolls, on average, until you've seen all six faces?
3. What is the expected maximum of two fair dice?
4. What is the expected product of two independent fair dice?
5. On average, how many fixed points does a uniformly random permutation of n items have?
6. You draw cards from a shuffled 52-card deck until the first ace. How many cards do you draw on average (including the ace)?
7. X and Y are independent uniform(0, 1). What are E\[max(X, Y)\] and E\[|X − Y|\]?

**Waiting times and walks**

8. Flipping a fair coin, what is the expected number of flips to see HH? To see HT? Why do they differ?
9. A fair random walk starts at 0 and moves ±1 each step. What is the probability it hits +a before −b?

**Conditional probability**

10. A family has two children and at least one is a boy. What is the probability both are boys?
11. A disease affects 1% of people. A test detects it 99% of the time and gives false positives 5% of the time. Given a positive test, what is the probability of having the disease?
12. Monty Hall: you pick one of three doors; the host, who knows where the car is, opens a different door showing a goat and offers a switch. Should you switch, and what is your win probability?
13. A coin's heads probability p is uniform on \[0, 1\]. You flip it once and see heads. What is the probability the next flip is heads?

**Games and puzzles**

14. You roll a die and may either take the face value in dollars or reroll once and take the second result. What's the optimal strategy and its expected value?
15. A stick is broken at two uniformly random points. What is the probability the three pieces form a triangle?
16. How many people are needed for a better than 50% chance that two share a birthday?
17. 100 lockers start closed. Person k toggles every kth locker, for k = 1 to 100. How many lockers end open?

**Mental math (no calculator, under 30 seconds each)**

18. 48 × 52
19. 17 × 23
20. Roughly 1.05¹⁰
21. Roughly √50
