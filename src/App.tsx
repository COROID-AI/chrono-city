import { Route, Routes } from 'react-router-dom';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { AboutPage } from '@/pages/about';
import { ContactPage } from '@/pages/contact';
import { HomePage } from '@/pages/home';
import { ProjectsPage } from '@/pages/projects';

export function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
