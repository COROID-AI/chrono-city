import type { FormEvent } from 'react';
import { useState } from 'react';
import { Mail, MapPin } from 'lucide-react';

interface ContactForm {
  name: string;
  email: string;
  message: string;
}

const initialForm: ContactForm = {
  name: '',
  email: '',
  message: '',
};

export function ContactPage() {
  const [formData, setFormData] = useState<ContactForm>(initialForm);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1fr_22rem]">
      <section>
        <p className="font-mono text-sm uppercase tracking-[0.2em] text-primary">Contact</p>
        <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Start a conversation</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          Have a project in mind or want to compare notes? Send a short message.
        </p>

        {submitted ? (
          <div className="mt-10 border border-border bg-secondary p-8">
            <h2 className="text-2xl font-semibold">Thanks for reaching out.</h2>
            <p className="mt-3 text-muted-foreground">This demo form is ready to connect to your backend.</p>
            <button
              className="mt-6 text-primary"
              onClick={() => {
                setSubmitted(false);
                setFormData(initialForm);
              }}
              type="button"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form className="mt-10 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium">Name</span>
              <input
                className="form-field"
                required
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                className="form-field"
                required
                type="email"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Message</span>
              <textarea
                className="form-field min-h-36 resize-y"
                required
                value={formData.message}
                onChange={(event) => setFormData({ ...formData, message: event.target.value })}
              />
            </label>
            <button className="button-primary" type="submit">
              Send message
            </button>
          </form>
        )}
      </section>

      <aside className="space-y-6">
        <a className="flex gap-4 border border-border p-6" href="mailto:{{authorEmail}}">
          <Mail className="h-5 w-5 text-primary" />
          <span>
            <span className="block text-sm text-muted-foreground">Email</span>
            {{authorEmail}}
          </span>
        </a>
        <div className="flex gap-4 border border-border p-6">
          <MapPin className="h-5 w-5 text-primary" />
          <span>
            <span className="block text-sm text-muted-foreground">Location</span>
            Available remotely
          </span>
        </div>
      </aside>
    </div>
  );
}
