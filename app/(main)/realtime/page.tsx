import App from "@/components/App";
import RealtimeVoiceTranscription from "@/components/VoiceGPT";

export default function RealtimePage() {
  return (
    <div className="flex flex-col bg-[#0e0e0e]">
      <main className="flex-1 bg-[#ffffff07] text-white p-8 m-8 rounded-2xl mr-5 min-h-[90vh]">
        <h2 className="text-2xl font-bold mb-8">GPT-4o RealTime Voice</h2>
        <div className="bg-[#ffffff07] border border-white/5 rounded-2xl shadow-lg shadow-black/10 flex flex-col justify-center flex-1 min-w-[300px] p-4 gap-4 min-h-[70vh]">
          {/* <RealtimeVoiceTranscription /> */}
          <App />
        </div>
      </main>
    </div>
  );
}
