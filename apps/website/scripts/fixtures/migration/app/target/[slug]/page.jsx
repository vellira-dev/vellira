import Navigation from '../../navigation';
export function generateStaticParams() {
  return ['prefetched', 'fresh', 'expired'].map((slug) => ({ slug }));
}
export default async function Target({ params }) {
  const { slug } = await params;
  return (
    <main>
      <h1>Target {slug} __GENERATION__</h1>
      <Navigation />
    </main>
  );
}
