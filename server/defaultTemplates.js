// ─── Built-in Templates ───────────────────────────────────────────────────────
// These are constants. They are NEVER written to disk.
// The JSON file only stores custom templates.

const DEFAULT_TEMPLATES = [
  {
    id: 'full-time',
    name: 'Full-time',
    subject: 'Application for Product Designer',
    body: `Hi,

I'm Uttam Singhal, a Product Designer with 3.5+ years of experience on B2B SaaS and enterprise products for web and mobile. I'm looking for a full-time Product Designer / UI/UX Designer role.

I currently work as a Product Designer at 8ByteSoft, where I design HRMS and ERP products and redesigned a procurement approval flow that cut approval steps from 7 to 4. I also built a 120+ component design system used across 4 client products. Earlier, I designed IoT monitoring dashboards and CRM and finance tools at E Software Solutions, a doctor portal at Sukrut Associates, and AI chatbot experiences at Urban-Chat.

My core skills are user research, usability testing, information architecture, wireframing, prototyping, design systems and dashboard design, mainly in Figma, with working knowledge of HTML, CSS and React.

My resume is attached, and my work is here: https://my-portfolio-rust-six-10.vercel.app/

Regards,
Uttam Singhal
+91 70624 67187 | uttamg61001@gmail.com`,
    isBuiltIn: true,
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'part-time',
    name: 'Part-time',
    subject: 'Part-time Product Designer – Uttam Singhal | 3.5+ Years (SaaS, ERP, HRMS)',
    body: `Hi,

I'm Uttam Singhal, a Product Designer with 3.5+ years of experience on SaaS and enterprise products. I'm interested in part-time design work and can give [X] hours a week, mainly [weekdays after 6 PM / weekends].

I currently design HRMS and ERP products at 8ByteSoft, and I've worked on IoT dashboards, CRM and finance tools, a healthcare doctor portal and AI chatbot products. I'm comfortable working on my own and sharing progress at a fixed schedule, so part-time work stays on track.

I can help with user research, wireframes, high-fidelity UI, prototypes and design systems in Figma, and I write clear handoff specs so developers can build without waiting on me.

My resume is attached, and my work is here: https://my-portfolio-rust-six-10.vercel.app/

Regards,
Uttam Singhal
+91 70624 67187 | uttamg61001@gmail.com`,
    isBuiltIn: true,
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'contract',
    name: 'Contract',
    subject: 'Contract Product Designer – Uttam Singhal | Available from [Start date]',
    body: `Hi,

I'm Uttam Singhal, a Product Designer with 3.5+ years of experience, and I'm open to contract roles. I can start from [Start date] for a [3 / 6 / 12]-month engagement, remote or hybrid.

I'm currently on a design contract with 8ByteSoft, where I handle HRMS, ERP and procurement products for multiple clients. There I cut approval steps in a procurement flow from 7 to 4 and built a design system used across 4 products. Before that, I worked on IoT dashboards, CRM and finance tools, a doctor portal and AI chatbot products.

Contract work suits me because I'm used to joining a product quickly, understanding the requirements, and delivering tested designs and dev-ready Figma files within a fixed timeline.

Skills: user research, usability testing, information architecture, prototyping, design systems, dashboard design (Figma, FigJam, Framer).

My resume is attached, and my work is here: https://my-portfolio-rust-six-10.vercel.app/

Regards,
Uttam Singhal
+91 70624 67187 | uttamg61001@gmail.com`,
    isBuiltIn: true,
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'freelance',
    name: 'Freelance',
    subject: 'Freelance UI/UX & Product Designer – Uttam Singhal | SaaS, Dashboards, Mobile Apps',
    body: `Hi,

I'm Uttam Singhal, a Product Designer with 3.5+ years of experience, and I take on freelance design projects for web apps, mobile apps and dashboards.

Some of my recent work includes HRMS and ERP products, a procurement approval system, IoT monitoring dashboards, a community marketplace (80+ screens), an AI bug detection platform and AI chatbot experiences. I've also built design systems so products stay consistent as they grow.

For a freelance project, I can handle the full design process: understanding requirements, user flows, wireframes, final UI, clickable prototypes and developer handoff in Figma. I share progress at agreed milestones so there are no surprises.

Rate: [Hourly / per-project rate, or "happy to discuss after understanding the scope"]

My resume is attached, and my work is here: https://my-portfolio-rust-six-10.vercel.app/

Regards,
Uttam Singhal
+91 70624 67187 | uttamg61001@gmail.com`,
    isBuiltIn: true,
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

const BUILT_IN_IDS = new Set(DEFAULT_TEMPLATES.map((t) => t.id));

module.exports = { DEFAULT_TEMPLATES, BUILT_IN_IDS };
