import type { Metadata } from "next";

// The 10 DJs pilot article for ANDY'K Music Lab (owner-authorised publication, 18 Nov 2026), by Alexander Reed.
const TITLE = "Complimentary Creative Access: ANDY\u2019K Music Lab and a Proposed Pilot for Ten Artists";
const SUMMARY = "ANDY\u2019K Music Lab is proposed to offer ten DJs and producers complimentary individual access as part of a pilot with CEP Agency and DISTANCE // ZERO. The exact access terms are still to be agreed.";

export const metadata: Metadata = {
  title: TITLE,
  description: SUMMARY,
  alternates: { canonical: "https://lab.djandykofficial.com/news/10-djs-10-opportunities" },
  openGraph: { type: "article", title: TITLE, description: SUMMARY, url: "https://lab.djandykofficial.com/news/10-djs-10-opportunities", images: [{ url: "/news/10djs-ticket-concept.jpg", width: 1774, height: 887 }] },
};

export default function TenDjsPilot() {
  return (
    <div className="tool-page-bg min-h-screen py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <article className="glass-card p-8 md:p-12">
          <p className="font-mono text-xs text-[#111111] tracking-widest uppercase mb-4">News · 18 November 2026 · Pilot</p>
          <h1 className="text-3xl font-bold mb-3">{TITLE}</h1>
          <p className="text-base opacity-70 mb-4">{SUMMARY}</p>
          <p className="text-xs font-mono opacity-50 mb-8">By Alexander Reed · PR &amp; Communications Director, REED PR &amp; COMMUNICATIONS</p>
          <figure className="mb-8">
            <img src="/news/10djs-ticket-concept.jpg" width={1774} height={887} alt="Access ticket concept: DJ Andy'K Official, ANDY'K Music Lab × CEP Creative Events Promoter, in collaboration with DISTANCE // ZERO, 10 DJs, 10 opportunities, complimentary access" className="w-full h-auto rounded-lg" />
            <figcaption className="text-xs font-mono opacity-50 mt-2">Ticket concept — personal access codes are issued securely, one by one, once accounts exist.</figcaption>
          </figure>
          <div className="prose-legal">
            <p>ANDY’K Music Lab is a web-based platform for music production and mastering that runs in the browser. In a proposed pilot with Creative Events Promoter (CEP Agency) and DISTANCE // ZERO, it would provide ten complimentary, individually set-up accesses for DJs and producers selected by CEP Agency.</p>
            <h2>What artists could do with it</h2>
            <p>Each participant would be invited to create one short DJ mix Reel for Instagram. Where a featured track really was mastered with ANDY’K Music Lab, the post would say so — and only then.</p>
            <h2>What is not decided yet</h2>
            <p>How long each access runs, who is eligible, which features are included and how accesses are activated are still to be agreed. No access codes have been issued; personal codes will only ever be sent securely, one by one, once accounts exist.</p>
            <h2>A first step</h2>
            <p>The pilot is a complimentary trial to explore how creative technology can support artist development — not a signed long-term programme.</p>
            <p>Read the full story on <a href="https://distancezeroshow.com/news/10-djs-10-opportunities">DISTANCE // ZERO</a>.</p>
          </div>
          <p className="text-xs font-mono opacity-50 mt-10">Prepared by an AI PR representative (Alexander Reed) and approved by DJ Andy&apos;K.</p>
        </article>
      </div>
    </div>
  );
}
