const demoLinkClassName =
  'font-bold rounded-lg text-xl w-56 p-4 flex flex-col justify-center text-black border-2 border-transparent bg-gradient-to-r from-transparent to-transparent transform-gpu transition-[transform,box-shadow,border-color,background-image] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-gray-300 hover:from-[#a8e6ed] hover:to-[#d1f1f5] hover:shadow-xl motion-reduce:transition-none motion-reduce:transform-none';

const previewCardClassName = `${demoLinkClassName} relative overflow-hidden group`;

function getDemoHref(route) {
  return process.env.NODE_ENV === 'production' ? `/Demos/${route}` : `/${route}`;
}

function getAssetPath(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return process.env.NODE_ENV === 'production' ? `/Demos${normalizedPath}` : normalizedPath;
}

function DemoCard({ route, title, description, previewImage }) {
  return (
    <a href={getDemoHref(route)} target="_blank" className={previewCardClassName}>
      <div
        className="absolute inset-0 bg-center bg-cover opacity-35 scale-[1.01] group-hover:opacity-70 group-hover:scale-[1.04] transform-gpu transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none motion-reduce:transform-none"
        style={{ backgroundImage: `url('${getAssetPath(previewImage)}')` }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-white/55 group-hover:bg-white/25 transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        aria-hidden="true"
      />
      <div className="relative z-10">
        <h2 className="text-left">{title}</h2>
        <p className="text-sm font-normal mt-2">{description}</p>
      </div>
    </a>
  );
}

export default function Home() {
  const demoPackages = [
    {
      route: 'A-star',
      title: 'A* Demo',
      description: 'Visualize the A* algorithm',
      previewImage: '/astar-preview.svg',
    },
    {
      route: 'dynamic-programming',
      title: 'Dynamic Programming Demo',
      description: 'Explore coin-change optimization with DP',
      previewImage: '/dynamic-programming-preview.svg',
    },
    {
      route: 'fibonacci-heap-dp',
      title: 'Fibonacci Heap DP Demo',
      description: 'Explore shortest-path DP powered by a Fibonacci heap',
      previewImage: '/fibonacci-heap-dp-preview.svg',
    },
    {
      route: 'wasm-vs-js',
      title: 'WASM vs JS',
      description: 'Visualize the speed of WASM with recursive Fibonacci',
      previewImage: '/wasm-vs-js-preview.svg',
    },
  ];


  const ckplaceTools = [
    {
      route: 'ckplace-tools',
      title: 'ARC Compression Tool',
      description: 'Upload item CSVs and optimize inventory compression by stack and value loss',
      previewImage: '/arc-compression-preview.svg',
    },
  ];

  const ckplaceGames = [
    {
      route: 'minesweeper',
      title: 'Minesweeper',
      description: 'Play a classic minesweeper board',
      previewImage: '/minesweeper-preview.svg',
    },
    {
      route: 'shikaku-dp',
      title: 'Shikaku',
      description: 'Play Shikaku with random puzzle generation and DP solve assist',
      previewImage: '/shikaku-dp-preview.svg',
    },
    {
      route: 'meta-tic-tac-toe',
      title: 'Meta Tic-Tac-Toe',
      description: 'Play a strategic ultimate tic-tac-toe variant',
      previewImage: '/meta-tic-tac-toe-preview.svg',
    },
    {
      route: 'dead-center',
      title: 'Dead Center',
      description: 'Defend the cabin by sequencing card plays and zombie kills',
      previewImage: '/dead-center-preview.svg',
    },
    {
      route: 'skyway',
      title: 'Skyway',
      description: 'Guide flights through layered lanes and avoid midair collisions',
      previewImage: '/skyway-preview.svg',
    },
    {
      route: 'loot-the-loop',
      title: 'Loot the Loop',
      description: 'Raid a looping temple, collect jewels, and dodge traps',
      previewImage: '/loot-the-loop-preview.svg',
    },
    {
      route: 'syndicate',
      title: 'Syndicate',
      description: 'Promote through ranks with strict digit-math replacements',
      previewImage: '/syndicate-preview.svg',
    },
    {
      route: 'crossword',
      title: 'Word Search',
      description: 'Find hidden words across the grid in multiple directions',
      previewImage: '/crossword-preview.svg',
    },
    {
      route: 'black-hole',
      title: 'Black Hole',
      description: 'Place rising values into circles and win with the lowest black-hole sum',
      previewImage: '/black-hole-preview.svg',
    },
  ];

  return (
    <main className="flex min-h-screen flex-col items-center m-8 gap-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">Ckplace demos</h1>
      </div>

      <section className="w-full max-w-6xl">
        <h2 className="text-2xl font-semibold mb-3">Demo Packages</h2>
        <div className="flex flex-wrap gap-3 justify-center md:justify-start">
          {demoPackages.map((demo) => (
            <DemoCard key={demo.route} {...demo} />
          ))}
        </div>
      </section>


      <section className="w-full max-w-6xl">
        <h2 className="text-2xl font-semibold mb-3">Ckplace Tools</h2>
        <div className="flex flex-wrap gap-3 justify-center md:justify-start">
          {ckplaceTools.map((tool) => (
            <DemoCard key={tool.route} {...tool} />
          ))}
        </div>
      </section>

      <section className="w-full max-w-6xl">
        <h2 className="text-2xl font-semibold mb-3">Ckplace Games</h2>
        <div className="flex flex-wrap gap-3 justify-center md:justify-start">
          {ckplaceGames.map((game) => (
            <DemoCard key={game.route} {...game} />
          ))}
        </div>
      </section>
    </main>
  );
}
