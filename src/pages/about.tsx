const experience = [
  {
    title: 'Senior Developer',
    company: 'Product Studio',
    period: '2022 - Present',
    description: 'Lead application architecture, delivery planning, and mentoring for product-focused teams.',
  },
  {
    title: 'Full-Stack Developer',
    company: 'Startup Inc',
    period: '2020 - 2022',
    description: 'Built customer-facing web applications, internal tools, and service integrations.',
  },
];

const technologies = ['React', 'TypeScript', 'Node.js', 'Python', 'PostgreSQL', 'AWS'];

export function AboutPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1fr_22rem]">
      <section>
        <p className="font-mono text-sm uppercase tracking-[0.2em] text-primary">About</p>
        <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Focused software delivery</h1>
        <div className="mt-8 space-y-6 text-lg leading-8 text-muted-foreground">
          <p>
            Hello, I am {{authorName}}. I build practical software with a preference for clear
            product thinking, maintainable code, and systems that teams can keep improving.
          </p>
          <p>
            My work spans frontend interfaces, backend services, and launch operations. I like
            projects where the details matter and the outcome needs to survive real users.
          </p>
        </div>

        <div className="mt-12 space-y-6">
          {experience.map((item) => (
            <article key={`${item.company}-${item.title}`} className="border-l-2 border-primary pl-5">
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="text-primary">{item.company}</p>
              <p className="text-sm text-muted-foreground">{item.period}</p>
              <p className="mt-2 leading-7 text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <aside className="space-y-6">
        <div className="aspect-square border border-border bg-accent" />
        <div className="border border-border p-6">
          <h2 className="font-semibold">Quick info</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{{authorEmail}}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Availability</dt>
              <dd>Selected projects</dd>
            </div>
          </dl>
        </div>
        <div className="border border-border p-6">
          <h2 className="font-semibold">Technologies</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {technologies.map((technology) => (
              <span key={technology} className="bg-secondary px-3 py-1 text-sm">
                {technology}
              </span>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
