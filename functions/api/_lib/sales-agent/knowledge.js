// Mechanic Marketing sales-agent knowledge pack.
// Hand-compiled from the live /pricing page (read 2026-07-14). Keep in sync
// with what's actually published there when plans or pricing change.
//
// Exported as a plain JS object (not JSON) so it imports cleanly into the
// Cloudflare Functions bundle without relying on a non-default esbuild loader.

export const KNOWLEDGE = {
  company: {
    name: 'Mechanic Marketing',
    positioning:
      'Specialist digital marketing for Australian mechanic shops and auto repair workshops. We get more cars into your workshop. Month-to-month, no lock-in contracts, and you own everything we build.',
    bookingUrl: 'https://meet.reclaimai.com/e/686c0900-a513-4c74-8e6c-c728c72145e7',
    bookingLabel: 'Book a free call',
    proof: [
      '3,714+ leads generated',
      'Average 4.2x ROI across clients',
      'Over $5M+ in revenue for workshops',
      'Avg. $38 cost per lead',
      'Campaigns live in 7 days',
    ],
  },
  plans: [
    {
      id: 'ignite',
      name: 'Ignite',
      price: '$1,500/month + GST',
      priceModel: 'monthly, month-to-month, ad spend additional',
      tagline: 'Google Ads and Facebook Ads for workshops getting started with online marketing.',
      bestFor:
        'Workshops just getting started and wanting to test the water, or that only need one thing done well (for example a mobile mechanic who mainly needs a landing page and lead flow). One channel focus, lean setup.',
      included: [
        'Landing page (1)',
        'Google Ads management',
        'Facebook Ads management',
        'Job tracking system',
        'Monthly performance reports',
        'Live dashboard',
        'Full ownership of everything',
        'No lock-in contract',
      ],
      offer: null,
    },
    {
      id: 'accelerate',
      name: 'Accelerate',
      price: '$2,500/month + GST',
      priceModel: 'monthly, month-to-month, ad spend additional',
      tagline:
        'Full-service digital marketing for your workshop. SEO, Google Ads, Facebook Ads, landing pages and transparent reporting.',
      bestFor:
        'Most established workshops. You want both paid and organic growth (SEO plus Google Business Profile on top of ads), and want the whole marketing engine handled, not just one channel.',
      included: [
        'Multiple landing pages',
        'Google Ads management',
        'Facebook Ads management',
        'SEO (blogs plus optimised pages)',
        'Google Business Profile optimisation',
        'Job tracking system',
        'Monthly performance reports',
        'Live dashboard',
        'Full ownership of everything',
        'No lock-in contract',
      ],
      // Booking incentive: only surface this on an Accelerate recommendation.
      offer:
        'Book a call now and lock in Accelerate at $2,000/month + GST (normally $2,500/month + GST). Exclusive to workshops who book off the back of this chat.',
    },
    {
      id: 'custom',
      name: 'Custom',
      price: "Custom pricing, scoped on a call",
      priceModel: 'bespoke',
      tagline: 'A tailored program for national brands, franchises and multi-location groups.',
      bestFor:
        'Nationals, franchises, multi-location groups, or anyone whose needs go beyond a single workshop. Bespoke scope and pricing built around the goals and footprint.',
      included: [
        'Everything in Accelerate, scaled across locations',
        'Multi-location or franchise strategy',
        'Bespoke reporting and dashboards',
        'Dedicated senior support',
        'Full ownership of everything',
        'No lock-in contract',
      ],
      offer: null,
    },
  ],
  decisionGuide: [
    'Just getting started / testing the water, OR only really need one thing (e.g. a mobile mechanic who mainly needs a landing page and leads) -> Ignite.',
    'An established single-location workshop that wants the full engine (paid ads PLUS SEO and Google Business Profile) and wants it all handled -> Accelerate. When you land on Accelerate, surface the booking offer (lock in $2,000/month + GST if they book a call now).',
    'A national brand, franchise, or multi-location group, or needs clearly beyond a single workshop -> Custom (scope it on a call).',
    "Genuinely unsure / situation doesn't map cleanly -> set service to \"unsure\", lay out the two closest fits, and steer them to a free call.",
  ],
};
