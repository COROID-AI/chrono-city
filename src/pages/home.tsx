import { ArrowRight, Github, Linkedin, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

const specialties = [
  {
    title: 'Product interfaces',
    description: 'Responsive React experiences with clear flows, useful states, and accessible interaction patterns.',
  },
  {
    title: 'Backend systems',
    description: 'Practical APIs, data models, and integrations that are easy to operate and extend.',
  },
  {
    title: 'Delivery ownership',
    description: 'Planning, implementation, testing, and launch support without losing sight of product outcomes.',
  },
];

export function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.16),transparent_28%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--accent)))]" />
        <div className="relative mx-auto grid min-h-[72vh] max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-4 font-mono text-sm uppercase tracking-[0.2em] text-primary">
              Chrono city
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-tight md:text-7xl">
              {{authorName}}
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-8 text-muted-foreground">
              
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link className="button-primary" to="/projects">
                View work
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link className="button-secondary" to="/contact">
                Contact
              </Link>
            </div>
          </div>

          <div className="rounded-sm border border-border bg-card/70 p-6 shadow-2xl backdrop-blur">
            <div className="grid grid-cols-2 gap-3">
              {['React', 'TypeScript', 'APIs', 'Design systems'].map((item) => (
                <div key={item} className="border border-border bg-background p-4">
                  <span className="font-mono text-xs uppercase text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <a className="icon-link" href="https://github.com" aria-label="GitHub">
                <Github className="h-5 w-5" />
              </a>
              <a className="icon-link" href="https://linkedin.com" aria-label="LinkedIn">
                <Linkedin className="h-5 w-5" />
              </a>
              <a className="icon-link" href="mailto:{{authorEmail}}" aria-label="Email">
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {specialties.map((specialty) => (
            <article key={specialty.title} className="border border-border p-6">
              <h2 className="text-xl font-semibold">{specialty.title}</h2>
              <p className="mt-3 leading-7 text-muted-foreground">{specialty.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
