// Homepage component displayed at the root URL. It provides links to the
// individual demos contained in this project.
export default function Home() {
  return (
    // Center the content on the page using Tailwind utility classes
    <main className="flex min-h-screen flex-col items-center m-8">
      <div>
        {/* Main heading for the page */}
        <h1 className="text-4xl font-bold mb-4">Ckplace demos</h1>
      </div>
      {/* Link to the A* algorithm demonstration. The base path differs between
          development and production so we handle that here. */}
      <a
        href={process.env.NODE_ENV === 'production' ? '/Demos/A-star' : '/A-star'}
        target="_blank"
        className="font-bold rounded-lg text-xl w-48 p-4 flex flex-col justify-center text-black hover:border-gray-300 border-2 border-transparent transition-all duration-300 ease-in-out bg-gradient-to-r from-transparent to-transparent hover:from-[#a8e6ed] hover:to-[#d1f1f5] hover:shadow-lg"
      >
        {/* Title of the demo */}
        <h2 className="text-left">A* Demo</h2>
        {/* Short description underneath the title */}
        <p className="text-sm font-normal mt-2">Visualize the A* algorithm</p>
      </a>
    </main>
  );
}