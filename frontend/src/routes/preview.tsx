import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useState, type CSSProperties } from "react";
import previewCss from "@/components/preview/preview.css?url";
import { NumberTicker } from "@/components/ui/number-ticker";
import { CREDITS, DEFAULT_BASKET, FOODS, PHOTOS, quantity, receipts, type Basket, type Photo, type Receipt } from "@/components/preview/data";

export const Route = createFileRoute("/preview")({
  head: () => ({
    meta: [
      { title: "NutriMind AI — Same protein. Smaller bill." },
      {
        name: "description",
        content:
          "NutriMind AI finds cheaper foods that give you the same protein, then plans your meals inside your budget.",
      },
    ],
    links: [
      { rel: "stylesheet", href: previewCss },
    ],
    scripts: [
      {
        // Enables the hidden start states before first paint; drops them again if the page script never runs.
        children:
          "document.documentElement.classList.add('np-js');setTimeout(function(){if(!window.__npReady)document.documentElement.classList.remove('np-js')},4000);",
      },
    ],
  }),
  component: PreviewPage,
});

const eur = (n: number) => `€${n.toFixed(2)}`;
const MAX_PACKS = 6;

// Every photo ships at 1920 and 3840 px wide; the browser picks by slot width and screen density.
function Img({ photo, sizes, lazy = true }: { photo: Photo; sizes: string; lazy?: boolean }) {
  return (
    <img
      src={`/media/1920/${photo.file}`}
      srcSet={`/media/1920/${photo.file} 1920w, /media/3840/${photo.file} 3840w`}
      sizes={sizes}
      width={photo.w}
      height={photo.h}
      alt={photo.alt}
      loading={lazy ? "lazy" : undefined}
      decoding="async"
    />
  );
}

function PreviewPage() {
  useEffect(() => {
    (window as unknown as { __npReady: boolean }).__npReady = true;
    // Entrances play a little before an element is fully in view; the reset waits until it has left the
    // screen entirely, so every pass replays the motion without anything flickering while it is visible.
    const enter = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("is-in")),
      { rootMargin: "0px 0px -8% 0px" },
    );
    const leave = new IntersectionObserver((entries) =>
      entries.forEach((e) => !e.isIntersecting && e.target.classList.remove("is-in")),
    );
    document.querySelectorAll(".np [data-reveal], .np .np-photo, .np .np-cta, .np .np-hero").forEach((el) => {
      enter.observe(el);
      leave.observe(el);
    });
    return () => {
      enter.disconnect();
      leave.disconnect();
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="np" id="top">
        <Hero />
        <main>
          <ReceiptSection />
          <HowItWorks />
          <Benefits />
          <Close />
        </main>
        <Footer />
      </div>
    </MotionConfig>
  );
}

function Hero() {
  return (
    <header className="np-hero">
      <div className="np-header">
        <div className="np-header-left">
          <a className="np-mark" href="#top">NutriMind</a>
          <nav className="np-tab" aria-label="Sections">
            <a className="np-link" href="#receipt">Your receipt</a>
            <a className="np-link" href="#how">How it works</a>
            <a className="np-link" href="#benefits">What you get</a>
          </nav>
        </div>
        <Link className="np-btn" to="/">Try it free</Link>
      </div>

      <div className="np-mast">
        <div className="m-a"><Img photo={PHOTOS.mastA} sizes="34vw" lazy={false} /></div>
        <div className="m-pink" />
        <div className="m-b"><Img photo={PHOTOS.mastB} sizes="17vw" lazy={false} /></div>
        <div className="m-orange" />
        <div className="m-c"><Img photo={PHOTOS.mastC} sizes="17vw" lazy={false} /></div>
        <div className="m-cyan" />
        <div className="m-d"><Img photo={PHOTOS.mastD} sizes="(max-width: 760px) 34vw, 17vw" lazy={false} /></div>
        <div className="m-e"><Img photo={PHOTOS.mastE} sizes="34vw" lazy={false} /></div>
        <div className="m-white" />
      </div>

      <div className="np-hero-text">
        <div className="np-side">
          <p className="np-standfirst" data-load style={{ "--d": "520ms" } as CSSProperties}>
            NutriMind finds cheaper foods that give you the same protein, then plans your meals inside your budget.
          </p>
          <p className="np-hero-actions" data-load style={{ "--d": "640ms" } as CSSProperties}>
            <a className="np-link" href="#receipt">See your receipt</a>
          </p>
        </div>
        <div className="np-main">
          <h1 className="np-h1">
            <span className="np-line"><span style={{ "--i": 0 } as CSSProperties}>Same protein.</span></span>
            <span className="np-line"><span style={{ "--i": 1 } as CSSProperties}>Smaller bill.</span></span>
          </h1>
        </div>
      </div>
    </header>
  );
}

function PaperReceipt({ title, receipt, showSwaps }: { title: string; receipt: Receipt; showSwaps?: boolean }) {
  return (
    <div className="np-paper" data-ui>
      <h3>{title}</h3>
      <ul className="np-rlines">
        <AnimatePresence initial={false}>
          {receipt.lines.map((l) => (
            <motion.li
              key={l.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="np-rline"
            >
              <span>
                {l.name}
                {showSwaps && l.swapped && <span className="np-swap">swap</span>}
              </span>
              <span className="num">{quantity(l)}</span>
              <span className="num">{eur(l.cost)}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="np-total">
        <span>Total</span>
        <span className="num">€<NumberTicker value={receipt.cost} decimalPlaces={2} className="text-inherit tracking-normal" /></span>
      </div>
      <div className="np-rmeta num">Protein {Math.round(receipt.protein).toLocaleString("en-GB")} g</div>
    </div>
  );
}

function ReceiptSection() {
  const [basket, setBasket] = useState<Basket>(DEFAULT_BASKET);
  const { before, after, saving } = receipts(basket);
  const set = (id: keyof Basket, n: number) => setBasket((b) => ({ ...b, [id]: Math.min(MAX_PACKS, Math.max(0, n)) }));

  return (
    <section className="np-layout np-receipt-sec" id="receipt" aria-labelledby="receipt-title">
      <div className="np-head">
        <h2 id="receipt-title" className="np-h2" data-reveal>Your receipt, rewritten</h2>
        <p className="np-intro" data-reveal style={{ "--d": "80ms" } as CSSProperties}>
          Set what you buy in a normal week. NutriMind moves half the protein from pricier foods to the best-value ones, so you get
          exactly the same protein for less.
        </p>
      </div>
      <div className="np-side">
        <p className="np-side-title" data-reveal>Your usual week</p>
        <ul className="np-basket" aria-label="Packs you buy in a week">
          {FOODS.map((f, i) => (
            <li key={f.id} data-reveal style={{ "--d": `${i * 50}ms` } as CSSProperties}>
              <span>
                {f.name}
                <span className="np-food-pack">{f.pack}, {eur(f.priceEur)}</span>
              </span>
              <span className="np-stepper">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  aria-label={`One less ${f.name.toLowerCase()}`}
                  onClick={() => set(f.id, basket[f.id] - 1)}
                  disabled={basket[f.id] === 0}
                >
                  −
                </motion.button>
                <span className="np-count num" aria-live="polite">{basket[f.id]}</span>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  aria-label={`One more ${f.name.toLowerCase()}`}
                  onClick={() => set(f.id, basket[f.id] + 1)}
                  disabled={basket[f.id] === MAX_PACKS}
                >
                  +
                </motion.button>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="np-body">
        <div className="np-receipts" data-reveal style={{ "--d": "160ms" } as CSSProperties}>
          <PaperReceipt title="Your usual week" receipt={before} />
          <PaperReceipt title="With NutriMind" receipt={after} showSwaps />
        </div>
        <p className="np-saving" aria-live="polite">
          {before.lines.length === 0 ? (
            "Add something you buy to see your receipt."
          ) : saving > 0.005 ? (
            <>
              You save €<NumberTicker value={saving} decimalPlaces={2} className="text-inherit tracking-normal" /> a week.
            </>
          ) : (
            "Your basket is already good value."
          )}
        </p>
        {saving > 0.005 && (
          <p className="np-saving-note num">
            That's about €{Math.round(saving * 52).toLocaleString("en-GB")} a year, for the same{" "}
            {Math.round(after.protein).toLocaleString("en-GB")} g of protein. Example prices from a typical European supermarket.
          </p>
        )}
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Add what you buy", text: "Search millions of products from Open Food Facts, or add your own with the price you pay.", photo: PHOTOS.howA },
  { title: "See the swaps", text: "NutriMind ranks every food by protein per euro and shows where a cheaper one does the same job.", photo: PHOTOS.howB },
  { title: "Get your plan", text: "Set a daily budget and a protein goal. You get a day of meals and a shopping list to take along.", photo: PHOTOS.howC },
];

function HowItWorks() {
  return (
    <section className="np-how" id="how" aria-labelledby="how-title">
      <div className="np-how-head">
        <h2 id="how-title" className="np-h2" data-reveal>Three steps to a smaller bill</h2>
        <p className="np-intro" data-reveal style={{ "--d": "80ms" } as CSSProperties}>
          Try it with a demo week already filled in. No sign-up, no card.
        </p>
      </div>
      <ol className="np-stairs">
        {STEPS.map((s, i) => (
          <li key={s.title} style={{ "--step": i } as CSSProperties}>
            <div className="np-photo"><Img photo={s.photo} sizes="(max-width: 760px) 100vw, 32vw" /></div>
            <h3 data-reveal>{s.title}</h3>
            <p data-reveal style={{ "--d": "80ms" } as CSSProperties}>{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const BENEFITS = [
  { title: "Spend less on food", lines: ["Every food priced per 100 g", "Swaps that keep your protein", "The saving shown before you shop"] },
  { title: "Hit your protein goal", lines: ["Today's protein and calories at a glance", "Low-protein days flagged early", "The best-value protein suggested"] },
  { title: "Plan a day in seconds", lines: ["Meals built around your budget", "Vegetarian and vegan options", "A shopping list to take along"] },
  { title: "Stay on track", lines: ["A short coach briefing each morning", "Streaks for steady weeks", "Next week's spend, forecast"] },
];

function Benefits() {
  return (
    <section className="np-layout np-benefits" id="benefits" aria-labelledby="benefits-title">
      <div className="np-head">
        <h2 id="benefits-title" className="np-h2" data-reveal>What you get</h2>
        <p className="np-intro" data-reveal style={{ "--d": "80ms" } as CSSProperties}>
          Everything NutriMind does comes back to one thing: more good food for the money you already spend.
        </p>
      </div>
      <div className="np-side">
        <div className="np-photo np-portrait"><Img photo={PHOTOS.benefits} sizes="(max-width: 760px) 100vw, 40vw" /></div>
      </div>
      <div className="np-body np-benefit-grid">
        {BENEFITS.map((b, i) => (
          <article key={b.title} data-reveal style={{ "--d": `${i * 70}ms` } as CSSProperties}>
            <h3>{b.title}</h3>
            <ul>
              {b.lines.map((l) => <li key={l}>{l}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function Close() {
  return (
    <section className="np-layout np-cta np-dark" aria-labelledby="close-title">
      <div className="np-head">
        <h2 id="close-title">
          <span className="np-line"><span style={{ "--i": 0 } as CSSProperties}>Smaller bill,</span></span>
          <span className="np-line"><span style={{ "--i": 1 } as CSSProperties}>same protein</span></span>
        </h2>
      </div>
      <div className="np-side">
        <p>Try NutriMind with a demo week already filled in, then add your own groceries and prices.</p>
        <Link className="np-btn" to="/">Try it free</Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="np-layout np-foot">
      <div className="np-side">
        <p className="np-wordmark">NutriMind</p>
        <ul className="np-places">
          <li><Link className="np-link" to="/">Try it free</Link></li>
          <li><a className="np-link" href="#receipt">See your receipt</a></li>
          <li><a className="np-link" href="https://github.com/harshbaee/nutrimind-ai">github.com/harshbaee</a></li>
        </ul>
      </div>
      <div className="np-head np-foot-cols">
        <div>
          <span className="np-foot-title">This page</span>
          <ul>
            <li><a className="np-link" href="#receipt">Your receipt</a></li>
            <li><a className="np-link" href="#how">How it works</a></li>
            <li><a className="np-link" href="#benefits">What you get</a></li>
          </ul>
        </div>
        <div>
          <span className="np-foot-title">Data</span>
          <ul>
            <li><a className="np-link" href="https://world.openfoodfacts.org">Open Food Facts</a></li>
            <li><a className="np-link" href="#credits">Picture credits</a></li>
          </ul>
        </div>
      </div>
      <div className="np-body">
        <p className="np-credits" id="credits">
          Photographs:{" "}
          {CREDITS.map((c, i) => (
            <span key={c.title}>
              <a className="np-link" href={c.page}>“{c.title}”</a> by {c.by}, {c.licence}{i < CREDITS.length - 1 ? "; " : "."}
            </span>
          ))}
        </p>
        <div className="np-legal">
          <span>© 2026 NutriMind AI. Prices on this page are examples.</span>
          <a className="np-link" href="#top">Back to top</a>
        </div>
      </div>
    </footer>
  );
}
