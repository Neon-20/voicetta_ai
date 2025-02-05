import Link from "next/link";

export default function SupportPage() {
  return (
    <div className="flex flex-col bg-[#0e0e0e] min-h-[95vh]">
      <main className="flex-1 bg-[#ffffff07] text-white p-8 m-8 rounded-2xl mr-5 min-h-[70vh]">
        <h2 className="text-2xl font-bold mb-8"> Contact Us </h2>
        <div className="grid grid-cols-2 gap-8">
          <div className="bg-[#ffffff08] hover:bg-[#ffffff0e] duration-200 border border-white/5 rounded-2xl shadow-lg shadow-black/10 p-6 flex flex-col justify-between">
            <Link href="mailto:pranav.rajveer@alterdomus.com">
              <p className="text-xl font-bold">
                Email: Automation.CoE@alterdomus.com
              </p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
