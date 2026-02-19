import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import PhoneIcon from "@mui/icons-material/Phone";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import FlipCameraIosIcon from "@mui/icons-material/FlipCameraIos";

function VideoCall() {
  const navigate = useNavigate();
  const locationState = useLocation().state as { silentMode?: boolean } | null;
  const silentMode = locationState?.silentMode ?? false;
  const [isMuted, setIsMuted] = useState(silentMode);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Handle microphone mute/unmute based on silent mode
  useEffect(() => {
    const controlMicrophone = async () => {
      try {
        if (isMuted) {
          // Request microphone access and mute it
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            
            // Mute all audio tracks
            stream.getAudioTracks().forEach((track) => {
              track.enabled = false;
            });
          }
        } else {
          // Unmute microphone if stream exists
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getAudioTracks().forEach((track) => {
              track.enabled = true;
            });
          }
        }
      } catch (error) {
        console.error("Error controlling microphone:", error);
        // Silently fail - microphone permission might not be granted yet
      }
    };

    controlMicrophone();

    // Cleanup: stop tracks when component unmounts
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        mediaStreamRef.current = null;
      }
    };
  }, [isMuted]);

  // Simulate call connection
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsConnected(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Call duration timer
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleEndCall = () => {
    navigate("/choosehelp");
  };

  const NavigateToChat = () => {
    navigate("/chat");
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col relative overflow-hidden">
      {/* Header */}
      <header className="shrink-0 px-6 py-4 border-b border-gray-800 z-10 relative">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-red-500"
            >
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-white text-xl font-bold">Unity Care</span>
        </div>
      </header>

      {/* Video Area */}
      <div className="flex-1 relative">
        {/* Remote Video (Full Screen) */}
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
          {!isConnected ? (
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center mb-4 border-2 border-red-500/30">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
                  <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-white text-xl font-semibold mb-1">Connecting...</h2>
              <p className="text-gray-400 text-sm">Please wait</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 rounded-full bg-gray-800 flex items-center justify-center mb-4 border-4 border-red-500/30">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
                  <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-white text-xl font-semibold mb-1">Sarah Martinez</h2>
              <p className="text-gray-400 text-xs mb-2">Certified First Responder</p>
            </div>
          )}
        </div>

        {/* Local Video Preview (Picture-in-Picture) */}
        {isConnected && (
          <div className="absolute top-4 right-4 w-32 h-48 rounded-lg overflow-hidden border-2 border-gray-700 bg-gray-800">
            {isVideoOff ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                <VideocamOffIcon className="text-gray-500" sx={{ fontSize: 32 }} />
              </div>
            ) : (
              <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                <VideocamIcon className="text-gray-500" sx={{ fontSize: 32 }} />
              </div>
            )}
          </div>
        )}

        {/* Call Duration Overlay */}
        {isConnected && (
          <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg">
            <p className="text-white text-sm font-medium">{formatTime(callDuration)}</p>
          </div>
        )}
      </div>

      {/* Call Controls */}
      <div className="shrink-0 px-6 py-6 border-t border-gray-800">
        <div className="flex items-center justify-center gap-4">
          {/* Camera Toggle */}
          <button
            onClick={() => setIsVideoOff(!isVideoOff)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isVideoOff
                ? "bg-red-500 hover:bg-red-600"
                : "bg-gray-800 hover:bg-gray-700"
            }`}
            aria-label={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoOff ? (
              <VideocamOffIcon className="text-white" sx={{ fontSize: 28 }} />
            ) : (
              <VideocamIcon className="text-white" sx={{ fontSize: 28 }} />
            )}
          </button>

          {/* Mute Button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isMuted
                ? "bg-red-500 hover:bg-red-600"
                : "bg-gray-800 hover:bg-gray-700"
            }`}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <MicOffIcon className="text-white" sx={{ fontSize: 28 }} />
            ) : (
              <MicIcon className="text-white" sx={{ fontSize: 28 }} />
            )}
          </button>

          {/* Speaker Button */}
          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isSpeakerOn
                ? "bg-gray-800 hover:bg-gray-700"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
            aria-label={isSpeakerOn ? "Turn off speaker" : "Turn on speaker"}
          >
            {isSpeakerOn ? (
              <VolumeUpIcon className="text-white" sx={{ fontSize: 28 }} />
            ) : (
              <VolumeOffIcon className="text-white" sx={{ fontSize: 28 }} />
            )}
          </button>

          {/* Flip Camera Button */}
          <button
            onClick={() => setIsFrontCamera(!isFrontCamera)}
            className="w-14 h-14 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
            aria-label="Flip camera"
          >
            <FlipCameraIosIcon className="text-white" sx={{ fontSize: 28 }} />
          </button>

          {/* End Call Button */}
          <button
            onClick={() => NavigateToChat()}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors rotate-135"
            aria-label="End call"
          >
            <PhoneIcon className="text-white" sx={{ fontSize: 32 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default VideoCall;
