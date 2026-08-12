import { NextRequest, NextResponse } from "next/server";
import { sanityWriteClient } from "@/lib/sanity";

// One-time seeder for Playbook articles. Hit once, then delete this route.
// Auth: Authorization: Bearer <CRON_SECRET>

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function textToPortableText(text: string): unknown[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const blocks: unknown[] = [];
  let key = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let style = "normal";
    let content = trimmed;

    if (trimmed.startsWith("## ")) { style = "h2"; content = trimmed.slice(3); }
    else if (trimmed.startsWith("### ")) { style = "h3"; content = trimmed.slice(4); }
    else if (trimmed.startsWith("# ")) { style = "h2"; content = trimmed.slice(2); }

    const children: unknown[] = [];
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    for (const part of parts) {
      if (part.startsWith("**") && part.endsWith("**")) {
        children.push({ _type: "span", _key: String(key++), text: part.slice(2, -2), marks: ["strong"] });
      } else if (part) {
        children.push({ _type: "span", _key: String(key++), text: part, marks: [] });
      }
    }

    blocks.push({ _type: "block", _key: String(key++), style, children, markDefs: [] });
  }

  return blocks;
}

const ARTICLES = [
  {
    title: "Kelly Criterion: The Math Behind Optimal Bet Sizing",
    slug: "kelly-criterion-optimal-bet-sizing",
    excerpt: "Flat betting is leaving money on the table. Here's the formula that tells you exactly how much to risk on every play.",
    category: "Strategy",
    readTime: 7,
    body: `Most bettors do one of two things: they either bet the same flat amount on every play regardless of edge, or they follow their gut and size up when they "feel good." Both approaches are wrong, and the math can prove it.

The Kelly Criterion is a formula developed by mathematician John Kelly in 1956. It tells you exactly what percentage of your bankroll to wager on any given bet to maximize long-run growth while avoiding blowing up your account. It's used by professional gamblers, hedge funds, and anyone who takes the math seriously.

## The Formula

**f* = (bp - q) / b**

Where: f* is the fraction of your bankroll to bet. b is your net odds (what you win per dollar risked). p is your estimated true probability of winning. q is 1 - p (probability of losing).

For prediction markets trading in cents, it simplifies to this: **f* = (true probability - implied probability) / (1 - implied probability)**

That's it. Your edge divided by what you stand to lose if wrong.

## A Real Example

Say a Kalshi market is pricing YES at **42¢** — the market implies a 42% probability. You've done your research and think the true probability is closer to **58%**. That's a 16-point edge.

Kelly says: f* = (0.58 - 0.42) / (1 - 0.42) = 0.16 / 0.58 = **27.6% of your bankroll**

That's a massive bet. Which is why most pros use a fraction of Kelly.

## Full, Half, and Quarter Kelly

**Full Kelly** maximizes long-run bankroll growth in theory. In practice, it produces gut-wrenching variance. You'll be right on the math and still watch your bankroll cut in half before it recovers.

**Half Kelly** is the professional standard. Same expected long-run growth rate, roughly half the variance. If you're unsure, default here.

**Quarter Kelly** is the conservative play — useful when your edge estimate is shaky or the market is less liquid. It sacrifices some growth for significantly lower drawdowns.

FadeMe's picks page shows Kelly sizing at all three fractions automatically once you enter your bankroll.

## When to Ignore Kelly

Kelly assumes your probability estimate is accurate. The bigger your uncertainty, the more you should shade down. If you're guessing at the true probability rather than deriving it from data, use Quarter Kelly at most.

Also: Kelly says nothing about correlation. If five of your picks all resolve on the same news event, don't bet full Kelly on all five simultaneously.

## The Hard Part Isn't the Math

The formula is simple. A calculator can do it in two seconds. The hard part is actually following it when your gut says to size up on a "sure thing" or size way down on a pick that mathematically deserves a real bet.

Discipline is the edge. The math just tells you where it goes.`,
  },
  {
    title: "Polymarket vs Kalshi: Which Platform Has Better Edge?",
    slug: "polymarket-vs-kalshi-which-platform-has-better-edge",
    excerpt: "Both platforms are legit. The question is where the lines are softer — and where sharp money actually flows.",
    category: "Platform Guides",
    readTime: 6,
    body: `You can make money on both Polymarket and Kalshi. The question isn't which is "better" — it's which one has softer pricing on the markets you want to trade. That answer depends on the market type, the liquidity, and who's on the other side of your bet.

Here's the breakdown.

## Kalshi

Kalshi is a CFTC-regulated exchange based in the US. That means it's legal for US residents without needing a VPN, crypto wallet, or offshore accounts. It also means their market selection skews toward things regulators are comfortable with: economic indicators, weather, financial benchmarks, political events, and sports.

**Where Kalshi lines are tight:** Sports (high-volume, large institutional participation), major political elections (huge retail interest = efficient pricing).

**Where Kalshi lines can be soft:** Macro economic events (CPI, Fed rate decisions, unemployment figures), niche political markets, and newer market categories where the crowd hasn't fully priced in base rates. These are where sharp research pays off.

The platform runs on a simple YES/NO binary structure. Prices are in cents (0–100¢ = 0–100% probability). The vig is embedded in the spread between YES and NO prices.

## Polymarket

Polymarket runs on the Polygon blockchain. Decentralized, global, and not restricted to US regulation the same way Kalshi is. Prices are settled via a decentralized oracle (UMA protocol), and resolution can occasionally be contested — something to understand before trading large positions.

**Where Polymarket lines are tight:** Presidential elections and major political events (billions of dollars in volume mean these are among the most efficiently priced markets on earth), crypto prices and news.

**Where Polymarket lines can be soft:** International events with low US media coverage, long-tail outcomes with sparse trading volume, and markets that opened recently before the crowd arrives.

Polymarket has no explicit fee structure — liquidity providers earn the spread. For traders, the effective cost is the bid-ask spread, which is wider in thin markets and tighter in liquid ones.

## The Practical Answer

Trade Kalshi for US-centric macro events where you have a genuine informational edge — you follow the Fed more closely than the average retail trader, you understand how economic data gets revised, you can read a jobs report faster than the market reprices.

Trade Polymarket for international political events, emerging markets, and niche outcomes where the US-heavy Kalshi crowd is slower to price in relevant information.

Use both. When you find a market on one platform that isn't available on the other, you often find the best value — no competing prices means softer lines by default.

## One More Thing

FadeMe scans both platforms daily. When the AI flags an edge on Kalshi, it means it found a divergence between the market price and its own probability estimate. Same for Polymarket. The platform matters less than the edge — trade where the math says to trade.`,
  },
  {
    title: "How to Read Implied Probability Like a Sharp",
    slug: "how-to-read-implied-probability-like-a-sharp",
    excerpt: "The price is the probability. Once you understand that, you see every prediction market completely differently.",
    category: "Beginner Tips",
    readTime: 5,
    body: `Here's the most important thing to understand about prediction markets: **the price is the probability.**

When you see a YES contract trading at 45¢, the market is saying there's a 45% chance this event happens. That's the implied probability. Everything else in your analysis flows from there.

## From Price to Probability

On Kalshi and Polymarket, prices range from 0¢ to 100¢. The math is direct:

**42¢ YES = 42% implied probability**

If you buy YES at 42¢ and you're right, you collect $1.00. Your net profit is 58¢. If you're wrong, you lose your 42¢ stake. The break-even point — where you're indifferent about making the trade — is exactly 42%.

## The Vig Problem

Here's where it gets tricky. The YES price and the NO price don't add up to exactly 100¢. They typically add up to 96¢–98¢ or so. The remaining 2–4¢ is the spread, which benefits whoever is providing liquidity.

If YES is at 42¢ and NO is at 56¢, those add up to 98¢. You need YES to be more likely than 42% just to break even. This is the vig — the house's cut baked into the structure of the market.

The existence of vig means that for a bet to be profitable, your **true probability must exceed the implied probability by more than zero.** You need positive edge.

## Finding Your True Probability

This is the real work. The implied probability is just what the crowd thinks. Your job is to estimate the actual probability better than the crowd.

Tools that help: base rates (how often does this type of event resolve YES historically?), current news and context (what's changed that the market hasn't priced in?), and models (can you build a simple quantitative estimate?).

FadeMe's AI does this for every pick — it estimates the true probability independently of the market price and shows you the gap. That gap is the edge.

## What Positive Edge Looks Like

If a market prices YES at 42% and you estimate the true probability at 58%, you have a **+16 percentage point edge**. That's a strong play.

If a market prices YES at 42% and you estimate true probability at 44%, you have a tiny edge — but the vig may eat it entirely. Not a play worth making.

If a market prices YES at 42% and you estimate true probability at 35%, the market is actually overpriced. The smart move is to **fade it** — buy NO instead.

## The Mental Model

Stop thinking of prediction market prices as just numbers. Every price is someone's embedded prediction, encoded in cents. Your job is to decide whether you agree with that prediction or not — and how confident you are in your disagreement.

Get good at translating prices to probabilities and you'll see mispricings the market misses. That's where the edge lives.`,
  },
  {
    title: "Why Markets Misprice Events (And How to Exploit It)",
    slug: "why-markets-misprice-events-how-to-exploit-it",
    excerpt: "Prediction markets are more efficient than polls. They're not as efficient as people think. Here's where the cracks are.",
    category: "Strategy",
    readTime: 7,
    body: `Prediction markets are efficient. More efficient than polls, pundit predictions, or your brother-in-law's hot take. The price is information-dense and updated in real time as the crowd processes new evidence.

But efficient doesn't mean perfect. The same psychological biases that cause people to make bad decisions in regular life show up in prediction markets — they're just muted and harder to exploit. Here's where to look.

## Recency Bias

When something dramatic happens — a candidate makes a gaffe, an economic number comes in hot, a team gets obliterated — markets overreact. Prices move more than the event warrants based on actual probability shifts.

The sharp play: identify overreactions within the first few hours of a market moving. Once the initial wave of retail traders has piled in, the next wave of information arrives and partially corrects the move. Getting in early on the correction is where the edge lives.

Watch for: major political events driving sentiment swings, economic data releases, and unexpected breaking news. Markets routinely overshoot in both directions.

## Narrative Bias

Certain outcomes have a compelling story attached to them. Underdog narratives, revenge games, political comebacks — the market prices these up because the narrative is emotionally resonant, not because the base rate supports it.

"Team X is due for a win" is a narrative. Base rates don't care about due. The market will often price a compelling narrative at 60¢ when base rates and math suggest it should be 45¢. That's a fade.

## Round Number Anchoring

Markets cluster around round numbers: 50%, 25%, 75%. Why? Because retail traders think in round numbers and place orders there, creating artificial support and resistance at those levels.

Watch for markets trading at exactly 50¢ on events where the true probability is clearly not 50-50. That's the market averaging two crowds rather than finding the true probability.

## Late-Resolving Markets

For events that resolve weeks or months in the future, markets frequently misprice based on whatever is happening in the news cycle right now. A candidate who had a bad week three months out doesn't deserve a permanent discount — but the market might give them one anyway.

Long-duration markets tend to oscillate based on news and revert to base rates as resolution approaches. Buying the dip in a long-duration market where the news is temporarily bad — but the underlying fundamentals are unchanged — is a repeatable edge.

## Thin Market Mispricing

Low-volume markets haven't been efficiently arbitraged. One retail trader who happened to arrive first can set a price that persists because no one else shows up to correct it. These are the easiest edges to find and the least reliable to trade at scale (not enough liquidity to get size in).

FadeMe focuses on markets with enough volume to be tradeable but not so efficient that the edge has been ground down to zero. The sweet spot.

## When NOT to Fade the Market

Here's the important part. The market is right more often than you are. The cases above are exceptions, not the default.

Before you fade: Can you specifically articulate why the crowd is wrong? Do you have information or analysis they don't? Or do you just disagree because it feels overpriced?

Feeling that a market is too high is not an edge. A reasoned argument for why the market misprices the true probability is an edge. Know which one you have before you place the trade.`,
  },
  {
    title: "Bankroll Management for Prediction Market Traders",
    slug: "bankroll-management-prediction-market-traders",
    excerpt: "The fastest way to go broke isn't bad picks — it's bad sizing. Here's the framework that keeps you in the game.",
    category: "Strategy",
    readTime: 6,
    body: `Most people who blow up their prediction market accounts don't do it by making consistently bad picks. They do it by sizing one or two plays too large and taking a hit they can't recover from.

Bankroll management isn't about being conservative. It's about staying in the game long enough for your edge to compound.

## Set a Dedicated Bankroll

Your prediction market bankroll should be money you can afford to lose entirely without it affecting your life. Not money you need next month. Not money earmarked for rent. Separate funds, separate mental account.

Why does this matter? Because when you're playing with money you need, your psychology changes. You size up trying to get even. You take plays you don't have a real edge on. You make fear-based decisions instead of math-based ones. Mixing life money with trading bankroll is how you get both wrong.

**Start smaller than you think you need.** You can always add money as you build confidence and a track record. You can't add more months of experience after blowing up.

## The Maximum Risk Per Play Rule

As a hard rule: **never risk more than 5% of your bankroll on a single play.** That's the absolute ceiling. Kelly might tell you 25% sometimes — use a fraction of Kelly (half or quarter) and still cap individual plays.

At 5% max exposure, you can take 20 consecutive losses before losing your entire bankroll. That's highly unlikely if you're picking spots with genuine edge. But it means a bad run doesn't end your trading.

## Don't Overweight Correlated Picks

Five plays that all resolve on the same election or economic data release are not five independent bets. They're effectively one concentrated position. If you lose, you lose on all of them at once.

When your picks are correlated, size each one down. If you'd normally bet 2% on each, bet 0.5-1% when five picks are correlated. The math of independence doesn't apply when they're not independent.

## Keep Records

This is non-negotiable. Track every trade: market, platform, position, entry price, size, exit price, profit/loss, and your edge estimate at time of entry.

Why? Because you need to know if you're actually profitable over time, and if not, where the losses are coming from. Are you losing on high-edge plays (variance) or on low-edge plays where you shouldn't have been betting at all? Records tell you. Vibes don't.

FadeMe's portfolio section does this automatically for any picks you log or paper-trade.

## Review and Recalibrate

Every month, review your track record:

Is your win rate consistent with your average edge? If you're finding 10-point edge plays and winning 60% of them, that tracks. If you're losing 55% of 10-point edge plays, either your edge estimates are off or you're running into variance — and you need to know which.

Are you tilting? Taking plays outside your normal criteria? Sizing up after losses?

The best traders treat this like a business review, not a highlight reel. Fix what's broken. Keep what works.

## The Compound Effect of Staying Alive

Here's the thing about bankroll management: it's not glamorous. You won't go viral on fintwit for half-Kelly sizing a Kalshi play. But the bettors who are still playing and profitable after three years all have one thing in common: they never let a single bad run wipe them out.

Edge compounds over time. But only if you're still in the game.`,
  },
  {
    title: "The Beginner's Guide to Prediction Markets",
    slug: "beginners-guide-prediction-markets",
    excerpt: "What they are, how they work, and why they're often more accurate than polls, pundits, and pretty much everyone on Twitter.",
    category: "Beginner Tips",
    readTime: 8,
    body: `Prediction markets are financial markets where people trade on the outcomes of real-world events. Instead of buying shares in Apple, you're buying contracts that resolve at $1 if something happens and $0 if it doesn't.

That's the whole thing. Everything else is details.

## How Contracts Work

On a prediction market, every event has at least two outcomes: YES and NO (or equivalent). Each outcome has a corresponding contract that trades between 0¢ and 100¢.

If a YES contract is trading at **62¢**, that means the collective wisdom of the market thinks there's a **62% probability** of the event happening. If you buy YES at 62¢ and the event happens, your contract settles at 100¢ — you profit 38¢. If it doesn't happen, you lose your 62¢.

The math is that simple. The skill is in figuring out whether 62% is the right number.

## The Two Main Platforms

**Kalshi** is a CFTC-regulated US exchange. It's legal for US residents without any crypto setup. You fund it like a brokerage account, and it covers markets across politics, economics, sports, and current events. If you want to trade without dealing with crypto wallets or regulatory gray areas, start here.

**Polymarket** runs on the Polygon blockchain and is globally accessible. It requires a crypto wallet (MetaMask or similar) to get started. The markets are broader, the volume on major events is enormous, and it's particularly active around political elections. The tradeoff is more setup friction and a decentralized resolution process.

Both are legitimate. Many active traders use both.

## Placing Your First Trade

The flow on Kalshi:

1. Create an account, verify identity (it's a regulated exchange)
2. Fund with bank transfer or card
3. Browse markets, find one you have a view on
4. Click YES or NO, enter your dollar amount
5. Your order fills at the current market price (or you can set a limit order)
6. Wait for resolution — the platform settles the contract automatically when the event concludes

Polymarket is similar but requires connecting a crypto wallet first.

## Why Prediction Markets Are Often Accurate

The reason prediction markets beat polls and pundits isn't magic. It's incentives.

When you express a view on Twitter, you pay no price for being wrong. When you buy a contract on Kalshi, you lose real money if you're wrong. This skin-in-the-game filter means the people who participate tend to be better-informed and more calibrated than the average opinion-haver.

Studies consistently show that liquid prediction markets outperform polling averages, expert forecasters, and media narratives in predicting election outcomes, economic events, and other measurable outcomes. That's not marketing — it's documented.

## Where Beginners Go Wrong

**Mistake 1: Betting on what they want to happen.** The market doesn't care about your team, your politics, or your vibes. You're making a probability estimate, not expressing loyalty.

**Mistake 2: No bankroll management.** Putting 20% of their bankroll on a single play because it "feels certain." See our bankroll management guide for why this is how accounts go to zero.

**Mistake 3: Trading without edge.** Just because a market exists doesn't mean you have an informational advantage in it. Stick to areas where your knowledge is genuinely better than the average participant. Skip the rest.

**Mistake 4: Ignoring the vig.** YES + NO prices don't add up to 100¢. The gap is the market's fee. You need to beat implied probability by more than that gap to be profitable over time.

## Finding Your First Edge

Start with what you know. If you follow macroeconomics closely, the Fed rate decision markets on Kalshi might have soft pricing around the edges. If you watch sports obsessively, niche proposition markets might be mispriced. If you understand a specific geopolitical region better than the average US-based trader, international political markets on Polymarket can have genuine inefficiencies.

Your job is to find the overlap between what you know better than the crowd and where the crowd is actually wrong.

FadeMe's AI does this systematically across hundreds of markets daily — scanning for gaps between market implied probabilities and estimated true probabilities. But your own domain knowledge is still a genuine edge, and it's one no algorithm can replicate.

Start small. Keep records. Refine your process. The market will teach you what you get right and what you get wrong — if you're honest enough to learn from it.`,
  },
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SANITY_WRITE_TOKEN) {
    return NextResponse.json({ error: "SANITY_WRITE_TOKEN not set" }, { status: 503 });
  }

  const results: { title: string; slug: string; status: "created" | "skipped" | "error"; id?: string; error?: string }[] = [];

  for (const article of ARTICLES) {
    // Skip if already exists
    try {
      const existing = await sanityWriteClient.fetch(
        `*[_type == "post" && slug.current == $slug][0]._id`,
        { slug: article.slug }
      );
      if (existing) {
        results.push({ title: article.title, slug: article.slug, status: "skipped" });
        continue;
      }
    } catch {
      // proceed
    }

    try {
      const doc = await sanityWriteClient.create({
        _type: "post",
        title: article.title,
        slug: { _type: "slug", current: article.slug },
        excerpt: article.excerpt,
        publishedAt: new Date().toISOString(),
        category: article.category,
        readTime: article.readTime,
        section: "playbook",
        body: textToPortableText(article.body),
      });
      results.push({ title: article.title, slug: article.slug, status: "created", id: doc._id });
    } catch (err) {
      results.push({ title: article.title, slug: article.slug, status: "error", error: String(err) });
    }
  }

  return NextResponse.json({ results, total: results.length });
}
