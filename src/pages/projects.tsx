import { ExternalLink, Github } from 'lucide-react';

interface Project {
  title: string;
  description: string;
  technologies: string[];
  liveUrl?: string;
  githubUrl?: string;
}

const projects: Project[] = [
  {
    title: 'Project One',
    description: 'A full-stack web application with authentication, collaborative workflows, and reporting.',
    technologies: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
    liveUrl: 'https://example.com',
    githubUrl: 'https://github.com',
  },
  {
    title: 'Project Two',
    description: 'A developer tool that automates repetitive release and quality checks for small teams.',
    technologies: ['Python', 'CLI', 'Docker'],
    githubUrl: 'https://github.com',
  },
  {
    title: 'Project Three',
    description: 'A commerce dashboard with payments, inventory, and operational analytics.',
    technologies: ['Next.js', 'Stripe', 'TailwindCSS'],
    liveUrl: 'https://example.com',
  },
];

export function ProjectsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <p className="font-mono text-sm uppercase tracking-[0.2em] text-primary">Projects</p>
      <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Selected work</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
        Replace these examples with shipped products, experiments, or case studies.
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {projects.map((project) => (
          <article key={project.title} className="flex min-h-80 flex-col border border-border bg-card">
            <div className="aspect-video border-b border-border bg-[linear-gradient(135deg,hsl(var(--accent)),hsl(var(--secondary)))]" />
            <div className="flex flex-1 flex-col p-6">
              <h2 className="text-xl font-semibold">{project.title}</h2>
              <p className="mt-3 flex-1 leading-7 text-muted-foreground">{project.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {project.technologies.map((technology) => (
                  <span key={technology} className="bg-secondary px-2 py-1 text-xs">
                    {technology}
                  </span>
                ))}
              </div>
              <div className="mt-6 flex gap-4 text-sm">
                {project.liveUrl ? (
                  <a className="inline-flex items-center gap-1 text-primary" href={project.liveUrl}>
                    <ExternalLink className="h-4 w-4" />
                    Live
                  </a>
                ) : null}
                {project.githubUrl ? (
                  <a className="inline-flex items-center gap-1 text-muted-foreground" href={project.githubUrl}>
                    <Github className="h-4 w-4" />
                    Source
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
