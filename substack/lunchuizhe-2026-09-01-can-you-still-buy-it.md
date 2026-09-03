---
title: "Six things I learned from OpenAI buying tens of thousands of Macs"
subtitle: "Five minutes: why a model company wants desktop computers, what Apple already admitted, and why waiting for a discount may not work this time."
slug: "lunchuizhe-2026-09-01-can-you-still-buy-it"
source_blog: "/en/blog/lunchuizhe-2026-09-01-can-you-still-buy-it/"
category: "investing"
paywall_after_insight: 1
---

![Surrealist oil painting: an empty electronics store with one small desktop left on the shelf, its shadow stretching into a row of server racks that runs out the door into the clouds](/covers/lunchuizhe-2026-09-01-can-you-still-buy-it-cover.png)

Source: a 13-minute video by Lunchuizhe, a Chinese-language YouTube channel about running AI at home (posted 2026-09-01), reacting to The Information's report that OpenAI bought tens of thousands of Mac minis and Mac Studios. I checked his claims against Apple's own earnings call and our memory-supply research. Six insights, four pictures, five minutes.

## 1. OpenAI isn't buying compute. It's buying a mouse.

A model company doesn't need desktop computers for training. It needs them so its agents can learn how a human uses graphical software: click through a spreadsheet, drag things around in a CAD program, cut a video. Today's agents live in the command line, and the command line is the efficient endpoint, but a whole professional ecosystem (CAD, 3D, video, colour grading) only exists behind a graphical interface. His own example: scripting his video edits gets him eighty percent of the way; the last twenty percent, the part that decides quality, only happens inside the editor.

![Two bars: a script-driven agent fills 80 percent of a video edit, the remaining 20 percent is labelled the part that decides quality and only reachable by driving the editor directly](/figures/eighty-twenty-editing-en.svg)

## 2. Why Macs and not cheap second-hand PCs: cost structure.

In the United States, labour, power and floor space are the expensive parts. Whatever you save buying old machines gets eaten by maintenance, so large buyers take the newest hardware and rack it by the thousand. And macOS sits on both sides at once: Unix underneath (full command line), the most complete catalogue of professional software on top.

## 3. Apple admitted the shortage a month before the OpenAI story.

On its July 30 earnings call, Apple's CEO called memory pricing "a 100-year flood," said the June price increases on Macs and iPads were reluctant, and warned of "very significant constraints" with "limited flexibility in the supply chain" for the September quarter. So OpenAI's orders landed on a chain that was already tight. (Apple fiscal Q3 2026 call, 2026-07-30.)

![A staircase going up, one step per month: June Apple price hike, July earnings call warns of tight supply, August OpenAI buys Macs; a dashed empty step at the top holds a question mark](/figures/three-steps-to-shortage-en.svg)

## 4. The numbers behind "shortages take years to ease."

Three figures from our device-side memory supply-chain work (as of 2026-07-28, sources: TrendForce, Micron investor documents): the contract price of a 12 GB low-power memory part rose 89% quarter on quarter in Q2 2026 (77 to 146 dollars); lead times for advanced memory stretched to 40–58 weeks; the three memory makers moved roughly seventy percent of advanced capacity to data-centre high-bandwidth memory, where one unit consumes about the wafer area of three ordinary units, and Micron's new fab won't produce before mid-2027. Capacity was moved; moving it back takes a year and a half.

## 5. "This time is different" has a track record in memory.

Memory is the most cyclical corner of semiconductors. Every shortage has been called structural, and every one has reverted once new capacity arrived. A red-team review of our own report put it bluntly: this is a temporary seller's market created by three firms reallocating capacity by margin at the top of the cycle, not a chokepoint anyone collects rent on forever. His "two to three years" is really "until the new fabs run." Write down the date instead of the forecast.

![Left a smooth downward curve marks fifty years of prices; right the same line is suddenly pulled up by a purchase order](/figures/moore-curve-meets-purchase-order-en.svg)

## 6. The belief he is attacking: "if you wait, electronics get cheaper."

That belief came from somewhere. In 1965 Gordon Moore wrote down his law, and for fifty years the same money bought twice the compute every year or two. Waiting was right because the main actor on the supply side was process technology, which only moves one way. This round the main actor is allocation: three firms decide who gets the wafers, and Moore's law has nothing to say about that. For the first time, whether waiting pays depends on someone else's purchase order.

## What it means if you invest

The same news item has two readings. The demand reading says AI companies want even desktop computers, so hardware demand is unbounded. The allocation reading says demand was already there; what changed is who gets served first. The second one is the better bet, because it only needs capacity to be bounded, and bounded capacity comes with hard numbers you can look up. It also carries its own expiry date: the day the new capacity arrives, the allocation power loosens. You don't have to guess when a bubble pops; you have to remember Micron's fab schedule.

![Two columns comparing readings of the same news: the demand reading needs unbounded demand and has no expiry date; the allocation reading needs bounded capacity, has hard numbers, and expires when new fabs arrive](/figures/two-readings-expiry-en.svg)

## One thing to take with you

Whether waiting makes something cheaper depends, this time, on purchase orders rather than technology curves. A small thing I tried: the next time you tell yourself "I'll wait a bit," write today's price of that thing and the price the first time you looked at it on the same piece of paper. Come back a week later. The direction of those two numbers is more honest than anyone's forecast, his included, mine included.

Full essay with sources: https://blog.getrealpha.com/en/blog/lunchuizhe-2026-09-01-can-you-still-buy-it/
