import React, { useState, useRef, useEffect } from 'react';
import Header from '../components/Header';
import { useNavigate } from 'react-router-dom';
import { API_BASE, authFetch } from '../lib/api';

const EmergencyAlert: React.FC = () => {
  const [isAlerting, setIsAlerting] = useState(false);
  const navigate = useNavigate();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEmergencyClick = async () => {
    setIsAlerting(true);
    // TODO: Implement emergency alert API call
    console.log('Emergency alert triggered!');

    let targetPath = '/login';
    try {
      const res = await authFetch(`${API_BASE}/auth/me`);
      if (res.ok) {
        targetPath = '/choosehelp';
      }
    } catch {
      targetPath = '/login';
    }

    // Keep 3 second delay, then route based on auth state
    timeoutRef.current = setTimeout(() => {
      navigate(targetPath);
    }, 3000);
  };

  const handleCancel = () => {
    setIsAlerting(false);
    
    // Clear the timeout if cancel is clicked
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);


  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Header />
      
      <main className="flex-1 flex items-center justify-center relative">
        {/* Radial gradient background effect */}
        <div className="absolute inset-0 bg-gradient-radial from-gray-900 via-gray-950 to-gray-950"></div>
        
        <div className="relative z-10 flex flex-col items-center gap-6 px-4">
          {/* Large Emergency Button */}
          <button
            onClick={handleEmergencyClick}
            className={`
              w-64 h-64 rounded-full 
              flex items-center justify-center
              transition-all duration-300
              ${isAlerting 
                ? 'bg-red-600 animate-pulse-glow' 
                : 'bg-red-500 shadow-[0_0_30px_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_40px_20px_rgba(239,68,68,0.5)] hover:scale-105'
              }
              active:scale-95
            `}
          >
            <span className="text-white text-7xl font-bold uppercase tracking-wider drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] ">
              SOS
            </span>
          </button>

          {/* Click to Alert text */}
          <p className="text-white/30 text-lg font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] p-2 mt-4">
            Click to Alert
          </p>

          {/* Cancel Button */}
          {isAlerting && (
            <button
              onClick={handleCancel}
              className="px-12 py-3 bg-gray-800/80 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors duration-200 mt-10"
            >
              Cancel
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

export default EmergencyAlert;
