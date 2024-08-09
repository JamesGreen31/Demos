export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center m-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">Ckplace demos</h1>
      </div>
      <a
        href={process.env.NODE_ENV === 'production' ? '/Demos/A-star' : '/A-star'}
        target="_blank" 
        className="font-bold rounded-lg text-xl w-48 p-4 flex flex-col justify-center text-black hover:border-gray-300 border-2 border-transparent transition-all duration-300 ease-in-out bg-gradient-to-r from-transparent to-transparent hover:from-[#a8e6ed] hover:to-[#d1f1f5] hover:shadow-lg"
      >
        <h2 className="text-left">A* Demo</h2>
        <p className="text-sm font-normal mt-2">Visualize the A* algorithm</p>
      </a>    
    </main>
  );
}