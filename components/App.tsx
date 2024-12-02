"use client";
import { useState } from "react";
import { Mic, MicOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import useRealTime from "@/hooks/useRealtime";
import useAudioRecorder from "@/hooks/useAudioRecorder";
import useAudioPlayer from "@/hooks/useAudioPlayer";
import Image from "next/image";

import { GroundingFile, ToolResult } from "@/lib/types";

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [groundingFiles, setGroundingFiles] = useState<GroundingFile[]>([]);

  const { startSession, addUserAudio, inputAudioBufferClear } = useRealTime({
    onWebSocketOpen: () => console.log("WebSocket connection opened"),
    onWebSocketClose: () => console.log("WebSocket connection closed"),
    onWebSocketError: (event) => console.error("WebSocket error:", event),
    onReceivedError: (message) => console.error("error", message),
    onReceivedResponseAudioDelta: (message) => {
      isRecording && playAudio(message.delta);
    },
    onReceivedInputAudioBufferSpeechStarted: () => {
      stopAudioPlayer();
    },
    onReceivedExtensionMiddleTierToolResponse: (message) => {
      const result: ToolResult = JSON.parse(message.tool_result);

      const files: GroundingFile[] = result.sources.map((x) => {
        return { id: x.chunk_id, name: x.title, content: x.chunk };
      });

      setGroundingFiles((prev) => [...prev, ...files]);
    },
  });

  const {
    reset: resetAudioPlayer,
    play: playAudio,
    stop: stopAudioPlayer,
  } = useAudioPlayer();
  const { start: startAudioRecording, stop: stopAudioRecording } =
    useAudioRecorder({ onAudioRecorded: addUserAudio });

  const onToggleListening = async () => {
    if (!isRecording) {
      startSession();
      await startAudioRecording();
      resetAudioPlayer();

      setIsRecording(true);
    } else {
      await stopAudioRecording();
      stopAudioPlayer();
      inputAudioBufferClear();

      setIsRecording(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center h-full">
        <style jsx>{`
          @keyframes pulse {
            0% {
              transform: scale(0.95);
              box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
            }
            70% {
              transform: scale(1);
              box-shadow: 0 0 0 10px rgba(34, 197, 94, 0);
            }
            100% {
              transform: scale(0.95);
              box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
            }
          }
          @keyframes wave {
            0% {
              transform: scale(1);
              opacity: 1;
            }
            100% {
              transform: scale(1.5);
              opacity: 0;
            }
          }
          .pulse {
            animation: pulse 2s infinite;
          }
          .wave {
            animation: wave 2s infinite;
          }
        `}</style>
        <div className="relative">
          <div
            className={`w-48 h-48 rounded-full flex items-center justify-center transition-all duration-300 ${
              isRecording ? "bg-red-700/20" : "bg-red-700/10"
            }`}
          >
            <div
              className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 ${
                isRecording ? "bg-red-700/30" : "bg-red-700/20"
              }`}
            >
              <Button
                variant="ghost"
                size="icon"
                className={`w-32 h-32 rounded-full transition-all duration-300 ${
                  isRecording
                    ? "bg-white text-white pulse z-10 hover:bg-red-300"
                    : "bg-white text-red-400 hover:bg-red-700/40 z-0"
                }`}
                onClick={onToggleListening}
              >
                <Image
                  src="/images/logo.png"
                  alt="Logo"
                  width={30}
                  height={30}
                />
                <span className="sr-only">Toggle microphone</span>
              </Button>
            </div>
          </div>
          {isRecording && (
            <>
              <div className="z-[-1] absolute inset-0 rounded-full bg-red-700/10 wave"></div>
              <div
                className="absolute inset-0 rounded-full bg-red-700/10 wave"
                style={{ animationDelay: "0.5s" }}
              ></div>
            </>
          )}
          <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
            <Button
              variant="outline"
              className="text-red-400 bg-red-700/10 hover:bg-red-700/20 cursor-default transition-all duration-300 hover:scale-105 hover:text-red-200"
            >
              {isRecording ? "Stop Listening" : "Give it a try!"}
            </Button>
          </div>
        </div>
      </div>
      {groundingFiles.length > 0 && (
        <div>
          <h2>Grounding Files</h2>
          <ul>
            {groundingFiles.map((file) => (
              <li key={file.id}>
                <h3>{file.name}</h3>
                <p>{file.content}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
