export default function Home() {
  const demos = [
    {
      title: "A* Demo",
      description: "Visualize the A* algorithm",
      href: process.env.NODE_ENV === "production" ? "/Demos/A-star" : "/A-star",
    },
  ];

  return (
    <main className="flex min-h-screen flex-col items-center m-8">
      <div>
        <h1 className="text-4xl font-bold mb-8">Ckplace demos</h1>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {demos.map((demo) => (
          <a
            key={demo.title}
            href={demo.href}
            target="_blank"
            className="w-60 p-6 rounded-xl bg-white/60 border border-gray-300 shadow-md text-center transition-all duration-300 ease-in-out hover:scale-105 hover:bg-gradient-to-r hover:from-[#a8e6ed] hover:to-[#d1f1f5] hover:shadow-lg"
          >
            <h2 className="text-xl font-semibold mb-2">{demo.title}</h2>
            <p className="text-sm font-normal">{demo.description}</p>
          </a>
        ))}
      </div>
    </main>
  );
}