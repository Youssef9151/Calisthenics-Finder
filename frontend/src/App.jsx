import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Map, MessageSquare, PlusCircle, User, LogOut, Lock, UserCheck } from 'lucide-react';
import MapView from './components/Map';
import ChatView from './components/Chat';
import RegisterSpotView from './components/RegisterSpot';
import ProfileView from './components/Profile';

export default function App() {
  // Global States
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('map');
  const [spots, setSpots] = useState([]);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [prefilledCoords, setPrefilledCoords] = useState(null);
  const [inviteDraft, setInviteDraft] = useState(null);
  
  // Auth Form States
  const [isLoginView, setIsLoginView] = useState(true);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Socket State
  const [socket, setSocket] = useState(null);

  // Load user session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('calisthenics_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    // Attempt to grab initial geolocation silently
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        () => {
          console.log('Geolocation permission denied or unavailable on startup.');
        }
      );
    }
  }, []);

  // Fetch Calisthenics spots
  const fetchSpots = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/spots');
      if (response.ok) {
        const data = await response.json();
        setSpots(data);
      }
    } catch (err) {
      console.error('Failed to fetch spots:', err);
    }
  };

  useEffect(() => {
    fetchSpots();
  }, []);

  // Connect/Disconnect Socket.io based on User Session
  useEffect(() => {
    if (user) {
      const newSocket = io('http://localhost:5000');
      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    } else {
      setSocket(null);
    }
  }, [user]);

  // Auth Operations
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    if (!authForm.username.trim() || !authForm.password.trim()) {
      setAuthError('All fields are required.');
      setAuthLoading(false);
      return;
    }

    const endpoint = isLoginView ? 'login' : 'register';

    try {
      const response = await fetch(`http://localhost:5000/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });

      const data = await response.json();

      if (response.ok) {
        if (isLoginView) {
          // Logged in
          localStorage.setItem('calisthenics_user', JSON.stringify(data.user));
          setUser(data.user);
          setAuthForm({ username: '', password: '' });
        } else {
          // Registered successfully, switch to login view
          setIsLoginView(true);
          setAuthForm({ username: '', password: '' });
          alert('Registration successful! Please log in.');
        }
      } else {
        setAuthError(data.error || 'Authentication failed.');
      }
    } catch (err) {
      setAuthError('Connection error: Make sure the backend server is running.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('calisthenics_user');
    setUser(null);
    setActiveTab('map');
  };

  // Navigation callbacks
  const handleMapClickRegister = (coords) => {
    setPrefilledCoords(coords);
    setActiveTab('register');
  };

  const handleInviteFriends = (spot) => {
    setInviteDraft(spot);
    setActiveTab('chat');
  };

  const handleRegisterSuccess = (newSpot) => {
    fetchSpots(); // reload spots
    setPrefilledCoords(null);
    setSelectedSpot(newSpot); // highlight the new spot
    setActiveTab('map'); // switch back to map
  };

  // If user is not logged in, render Authentication Screen
  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>CALISTHENICS FINDER</h1>
            <p>{isLoginView ? 'Welcome back! Log in to find workout spots' : 'Join the community and start training'}</p>
          </div>

          <form onSubmit={handleAuthSubmit}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                className="input-field"
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                placeholder="Enter your username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                className="input-field"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                placeholder="Enter your password"
                required
              />
            </div>

            {authError && <div className="error-msg">{authError}</div>}

            <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }} disabled={authLoading}>
              {authLoading ? 'Processing...' : (isLoginView ? 'Log In' : 'Sign Up')}
            </button>
          </form>

          <div className="auth-toggle">
            {isLoginView ? (
              <>Don't have an account? <span onClick={() => { setIsLoginView(false); setAuthError(''); }}>Sign Up</span></>
            ) : (
              <>Already have an account? <span onClick={() => { setIsLoginView(true); setAuthError(''); }}>Log In</span></>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If user is logged in, render Main Application Layout
  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">C</div>
          <span className="logo-text">BARS FINDER</span>
        </div>

        <nav style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <ul className="sidebar-menu">
            <li 
              className={`menu-item ${activeTab === 'map' ? 'active' : ''}`}
              onClick={() => setActiveTab('map')}
            >
              <Map />
              <span>Explore Map</span>
            </li>
            <li 
              className={`menu-item ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare />
              <span>Friend Zone</span>
            </li>
            <li 
              className={`menu-item ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('register');
                setPrefilledCoords(null); // clear prefill if entering directly
              }}
            >
              <PlusCircle />
              <span>Add Spot</span>
            </li>
            <li 
              className={`menu-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User />
              <span>Profile</span>
            </li>
          </ul>
        </nav>

        {/* User profile footer */}
        <div className="sidebar-user">
          <div className="user-info">
            <div className="user-avatar">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span className="username-display">{user.username}</span>
          </div>
          <button onClick={handleLogout} className="btn-logout" title="Log Out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main content display pane */}
      <main className="main-content">
        <div className="view-container">
          {activeTab === 'map' && (
            <MapView
              spots={spots}
              selectedSpot={selectedSpot}
              setSelectedSpot={setSelectedSpot}
              userLocation={userLocation}
              setUserLocation={setUserLocation}
              onMapClickRegister={handleMapClickRegister}
              onInviteFriends={handleInviteFriends}
            />
          )}

          {activeTab === 'chat' && (
            <ChatView
              socket={socket}
              user={user}
              inviteDraft={inviteDraft}
              setInviteDraft={setInviteDraft}
              setSelectedSpot={setSelectedSpot}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'register' && (
            <RegisterSpotView
              prefilledCoords={prefilledCoords}
              onSuccess={handleRegisterSuccess}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              user={user}
              spots={spots}
            />
          )}
        </div>
      </main>
    </div>
  );
}
