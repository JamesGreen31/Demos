export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <h1 className="text-4xl font-bold mb-8">Ckplace demos</h1>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <a
          href={process.env.NODE_ENV === 'production' ? '/Demos/A-star' : '/A-star'}
          target="_blank"
          className="group rounded-xl border border-transparent bg-white/80 p-6 text-black shadow transition-all duration-300 ease-in-out hover:-translate-y-1 hover:border-gray-300 hover:bg-gradient-to-r hover:from-[#a8e6ed] hover:to-[#d1f1f5] hover:shadow-lg"
        >
          <h2 className="text-left text-xl font-bold">A* Demo</h2>
          <p className="mt-2 text-sm font-normal">Visualize the A* algorithm</p>
        </a>
      </div>
    </main>
  );
}
