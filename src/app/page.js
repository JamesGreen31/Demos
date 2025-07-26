export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center m-8 bg-slate-900">
      <div>
        <h1 className="text-4xl font-bold mb-4 text-white">Ckplace demos</h1>
      </div>
      <a
        href={process.env.NODE_ENV === 'production' ? '/Demos/A-star' : '/A-star'}
        target="_blank"
        className="font-bold rounded-lg text-xl w-48 p-4 flex flex-col justify-center text-white border-2 border-transparent bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 hover:shadow-xl transition-all duration-300 ease-in-out"
      >
        <h2 className="text-left">A* Demo</h2>
        <p className="text-sm font-normal mt-2">Visualize the A* algorithm</p>
      </a>
    </main>
  );
}