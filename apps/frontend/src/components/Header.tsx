import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, authFetch, clearAuthTokens, getCurrentUser } from '../lib/api';

type CurrentUser = {
  sub?: string;
  role?: string;
  id?: string;
  name?: string;
  email?: string;
  profileImageUrl?: string | null;
};

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    let cancelled = false;

    const loadCurrentUser = async () => {
      const storedUser = getCurrentUser();
      if (storedUser && !cancelled) {
        setUser(storedUser);
      }

      try {
        const res = await authFetch(`${API_BASE}/auth/me`);
        if (!res.ok) {
          if (!cancelled) setUser(null);
          return;
        }

        const json = await res.json();
        if (!cancelled) {
          const me = json?.data ?? {};
          setUser({
            ...storedUser,
            ...me,
          });
        }
      } catch {
        if (!cancelled && !storedUser) setUser(null);
      }
    };

    loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  };

  const handleSignIn = () => {
    navigate('/login');
    closeMenu();
  };

  const handleSignUp = () => {
    navigate('/signup');
    closeMenu();
  };

  const handleSignOut = () => {
    clearAuthTokens();
    setUser(null);
    navigate('/login', { replace: true });
    closeMenu();
  };


  return (
    <header className="w-full bg-gray-900 px-6 py-4 flex items-center justify-between border-b border-gray-800 relative">
      {/* Left side - Logo */}
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

      {/* Right side - User icon with dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={toggleMenu}
          className="w-9 h-9 flex items-center justify-center hover:bg-gray-800 rounded-full transition-colors duration-200"
        >
          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center overflow-hidden">
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : user?.name ? (
              <span className="text-white text-xs font-semibold">{getInitials(user.name)}</span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="7" r="4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </button>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-gray-800 rounded-lg shadow-xl z-50 animate-slide-down overflow-hidden">
            {/* Profile Section */}
            <div className="px-4 py-4 bg-gray-700/50">
              <div className="flex flex-col items-center">
                {/* Profile Picture */}
                <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center mb-3 overflow-hidden">
                  {user?.profileImageUrl ? (
                    <img src={user?.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : user?.name ? (
                    <span className="text-white/70 text-base">{getInitials(user.name)}</span>
                  ) : (
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white/50">
                      <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                {/* Name */}
                <div className="text-white font-semibold text-base mb-1">
                  {user?.name ?? "Anonymous"}
                </div>
                {user?.email && (
                  <div className="text-white/70 text-xs">{user.email}</div>
                )}
              </div>
            </div>

            {/* Separator */}
            <div className="border-t border-gray-700"></div>

            {/* Auth Actions */}
            <div className="py-2">
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-2.5 flex items-center gap-3 text-white hover:bg-gray-700/50 text-sm transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white/70">
                    <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Sign Out</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSignIn}
                    className="w-full px-4 py-2.5 flex items-center gap-3 text-white hover:bg-gray-700/50 text-sm transition-colors"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white/70">
                      <path d="M15 3H6C5.46957 3 4.96086 3.21071 4.58579 3.58579C4.21071 3.96086 4 4.46957 4 5V19C4 19.5304 4.21071 20.0391 4.58579 20.4142C4.96086 20.7893 5.46957 21 6 21H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M18 8L21 11L18 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M21 11H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Sign In</span>
                  </button>
                  <button
                    onClick={handleSignUp}
                    className="w-full px-4 py-2.5 flex items-center gap-3 text-white hover:bg-gray-700/50 text-sm transition-colors"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white/70">
                      <path d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M8.5 11C10.7091 11 12.5 9.20914 12.5 7C12.5 4.79086 10.7091 3 8.5 3C6.29086 3 4.5 4.79086 4.5 7C4.5 9.20914 6.29086 11 8.5 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M23 11L16 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M20 8L23 11L20 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Sign Up</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
