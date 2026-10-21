:::exercise{#E1 level=standard title="Timed whiteboard"}
Pick a prompt, set a 35-minute timer, and talk through it aloud (record yourself). Then compare against the model outline and the rubric.
:::

:::exercise{#E2 level=standard title="Latency budget"}
For Prompt 1, write a stage-by-stage budget totaling 5 µs from packet arrival to strategy callback, and justify each number with measurements from earlier modules.
:::

:::exercise{#E3 level=interview-hard title="Build a slice"}
Implement a minimal version of Prompt 1 end to end using your :mod[networking] multicast simulator, :mod[trading-domain] decoder and book, and :mod[lock-free-programming] SPSC queues, with per-stage histograms.
:::

:::exercise{#E4 level=standard title="Failure drill"}
For Prompt 2, list ten failure scenarios (exchange disconnect mid-order, duplicate ack, out-of-order fills, gateway crash after sending but before journaling, and so on) and the exact handling for each.
:::
