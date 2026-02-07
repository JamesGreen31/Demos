const demoLinkClassName =
  'font-bold rounded-lg text-xl w-56 p-4 flex flex-col justify-center text-black hover:border-gray-300 border-2 border-transparent transition-all duration-300 ease-in-out bg-gradient-to-r from-transparent to-transparent hover:from-[#a8e6ed] hover:to-[#d1f1f5] hover:shadow-lg';

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
        className="absolute inset-0 bg-center bg-cover opacity-30 group-hover:opacity-70 transition-opacity duration-300"
        style={{ backgroundImage: `url('${getAssetPath(previewImage)}')` }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-white/55 group-hover:bg-white/25 transition-colors duration-300"
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
  return (
    <main className="flex min-h-screen flex-col items-center m-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">Ckplace demos</h1>
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <DemoCard
          route="A-star"
          title="A* Demo"
          description="Visualize the A* algorithm"
          previewImage="/astar-preview.svg"
        />

        <DemoCard
          route="minesweeper"
          title="Minesweeper Demo"
          description="Play a classic minesweeper board"
          previewImage="/minesweeper-preview.svg"
        />

        <DemoCard
          route="meta-tic-tac-toe"
          title="Meta Tic-Tac-Toe"
          description="Play a strategic ultimate tic-tac-toe variant"
          previewImage="/meta-tic-tac-toe-preview.svg"
        />

        <DemoCard
          route="dynamic-programming"
          title="Dynamic Programming Lab"
          description="Explore coin-change optimization with DP"
          previewImage="/dynamic-programming-preview.svg"
        />


        <DemoCard
          route="dead-center"
          title="Dead Center"
          description="Defend the cabin by sequencing card plays and zombie kills"
          previewImage="/dead-center-preview.svg"
        />

        <DemoCard
          route="loot-the-loop"
          title="Loot the Loop"
          description="Raid a looping temple, collect jewels, and dodge traps"
          previewImage="/loot-the-loop-preview.svg"
        />
      </div>
    </main>
  );
}
