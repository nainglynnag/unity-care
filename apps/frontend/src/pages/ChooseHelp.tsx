import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import PhoneIcon from "@mui/icons-material/Phone";
import VideocamIcon from "@mui/icons-material/Videocam";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";

function ChooseHelp() {
  const [silentMode, setSilentMode] = useState(false);
  const navigate = useNavigate();

  const handleOptionClick = (option: string) => {
    if (option === "text") navigate("/chat");
    else console.log(`Selected: ${option}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Header />
      
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl flex flex-col items-center gap-10">
          {/* Main Title */}
          <h1 className="text-white text-4xl md:text-5xl font-bold text-center">
            How do you need help?
          </h1>

          {/* Communication Options */}
          <div className="w-full flex flex-col gap-5">
            {/* Text Option */}
            <button
              onClick={() => handleOptionClick("text")}
              className="w-full bg-gray-800 rounded-xl px-6 py-5 flex items-center gap-5 hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
            >
              {/* Blue Speech Bubble Icon */}
              <div className="flex-shrink-0 text-blue-500">
                <ChatBubbleOutlineIcon sx={{ fontSize: 32 }} />
              </div>
              
              {/* Text Content */}
              <div className="flex-1 text-left">
                <div className="text-white font-medium text-lg">Text</div>
                <div className="text-gray-400 text-base">Chat with emergency coordinator</div>
              </div>

              {/* Chevron Icon */}
              <ChevronRightIcon className="text-gray-400 flex-shrink-0" sx={{ fontSize: 24 }} />
            </button>

            {/* Voice Call Option */}
            <button
              onClick={() => handleOptionClick("voice")}
              className="w-full bg-gray-800 rounded-xl px-6 py-5 flex items-center gap-5 hover:bg-gray-700 transition-colors duration-200 cursor-pointer relative"
            >
              {/* Red Phone Icon */}
              <div className="flex-shrink-0 text-red-500">
                <PhoneIcon sx={{ fontSize: 32 }} />
              </div>
              
              {/* Text Content */}
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <div className="text-white font-medium text-lg">Voice Call</div>
                  {/* Recommended Badge */}
                  <span className="bg-red-500 text-white text-sm font-medium px-2.5 py-1 rounded">
                    Recommended
                  </span>
                </div>
                <div className="text-gray-400 text-base">Speak directly with responder</div>
              </div>

              {/* Chevron Icon */}
              <ChevronRightIcon className="text-gray-400 flex-shrink-0" sx={{ fontSize: 24 }} />
            </button>

            {/* Video Call Option */}
            <button
              onClick={() => handleOptionClick("video")}
              className="w-full bg-gray-800 rounded-xl px-6 py-5 flex items-center gap-5 hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
            >
              {/* Purple Video Camera Icon */}
              <div className="flex-shrink-0 text-purple-500">
                <VideocamIcon sx={{ fontSize: 32 }} />
              </div>
              
              {/* Text Content */}
              <div className="flex-1 text-left">
                <div className="text-white font-medium text-lg">Video Call</div>
                <div className="text-gray-400 text-base">Visual communication for clarity</div>
              </div>

              {/* Chevron Icon */}
              <ChevronRightIcon className="text-gray-400 flex-shrink-0" sx={{ fontSize: 24 }} />
            </button>
          </div>

          {/* Silent Mode Toggle */}
          <div className="w-full bg-gray-800 rounded-xl px-6 py-5 flex items-center gap-5">
            {/* Muted Speaker Icon */}
            <div className="flex-shrink-0 text-gray-400">
              <VolumeOffIcon sx={{ fontSize: 32 }} />
            </div>
            
            {/* Text Content */}
            <div className="flex-1 text-left">
              <div className="text-white font-medium text-lg">Silent Mode</div>
              <div className="text-gray-400 text-base">No sounds or vibrations</div>
            </div>

            {/* Toggle Switch */}
            <button
              onClick={() => setSilentMode(!silentMode)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 ${
                silentMode ? "bg-red-500" : "bg-gray-700"
              }`}
            >
              <span
                className={`inline-block h-7 w-7 transform rounded-full bg-white transition-transform duration-200 ${
                  silentMode ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ChooseHelp;