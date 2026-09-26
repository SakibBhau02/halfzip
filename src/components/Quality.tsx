import { site } from "@/lib/site";

function Icon({ name }: { name: string }) {
  const common = "w-7 h-7 stroke-[1.6]";
  switch (name) {
    case "snow":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}>
          <path d="M12 2v20M4 6l16 12M20 6L4 18M2 12h20" strokeLinecap="round" />
        </svg>
      );
    case "stitch":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}>
          <path d="M4 12h16M4 12l3-3m-3 3l3 3M20 12l-3-3m3 3l-3 3" strokeLinecap="round" strokeDasharray="2 3" />
          <path d="M12 4v16" strokeLinecap="round" />
        </svg>
      );
    case "yarn":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M7 8c4 2 6 6 10 8M6 13c3-1 4-6 8-8M9 19c1-4 5-5 7-9" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={common}>
          <rect x="3" y="8" width="18" height="8" rx="1" />
          <path d="M7 8V5m5 3V5m5 3V5M7 16v3m5-3v3m5-3v3" strokeLinecap="round" />
        </svg>
      );
  }
}

export default function Quality() {
  return (
    <section id="quality" className="bg-ink text-cream py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="uppercase tracking-[0.35em] text-xs text-gold mb-4">
            Fabric & Craft
          </p>
          <h2 className="font-display text-4xl md:text-5xl text-balance">
            কোয়ালিটি যা আপনি <span className="text-gold italic">অনুভব করবেন</span>
          </h2>
          <p className="mt-4 text-warmgray max-w-xl mx-auto">
            প্রতিটি {site.productName} তৈরি হয় যত্ন নিয়ে — শুধু দেখতে সুন্দর নয়, শীতে
            আরাম দেওয়ার জন্যই।
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-y-14 gap-x-20">
          {[
            {
              t: "ফ্লিস লাইনিং",
              b: "ভিতরে নরম brushed flece — শীতের সকালে আরামদায়ক উষ্ণতা ধরে রাখে।",
              i: "snow",
            },
            {
              t: "ডাবল স্টিচিং",
              b: "কাঁধ, কলার ও জিপারে ডাবল স্টিচ — বারবার ধোলার পরেও টিকে থাকে।",
              i: "stitch",
            },
            {
              t: "হাই-কোয়ালিটি ইয়ার্ন",
              b: "রঙ ধোঁয়া যায় না, লিন্ট পড়ে না — মৌসুমের পর মৌসুম ফ্রেশ থাকে।",
              i: "yarn",
            },
            {
              t: "পারফেক্ট সাইজ",
              b: "M, L, XL, XXL — সঠিক মাপে শরীরে ফিট হয়, ঢিলেও লাগে না।",
              i: "ruler",
            },
          ].map((p, idx) => (
            <div key={idx} className="flex gap-5 items-start">
              <div className="shrink-0 w-14 h-14 rounded-full border border-gold/40 flex items-center justify-center text-gold">
                <Icon name={p.i} />
              </div>
              <div>
                <h3 className="font-display text-2xl mb-2">{p.t}</h3>
                <p className="text-warmgray leading-relaxed">{p.b}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 border-t border-white/10 pt-10">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-8">
            {[
              { label: "ফ্যাব্রিক", value: "Premium Cotton Blend Fleece" },
              { label: "ইনসুলেশন", value: "Soft Brushed Inner Fleece" },
              { label: "জিপার", value: "Heavy-duty Metal Half Zipper" },
              { label: "কলার", value: "Stand Collar / Mock Neck" },
              { label: "সিজন", value: "Winter / Late Autumn" },
              { label: "সাইজ", value: "M / L / XL / XXL" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-xs uppercase tracking-widest text-gold/80 mb-1">
                  {s.label}
                </p>
                <p className="text-sm text-cream/90">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
