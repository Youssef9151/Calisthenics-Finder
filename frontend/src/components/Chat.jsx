import React, { useState, useEffect, useRef } from 'react';
import { Send, MapPin, Calendar, Clock, Smile, MessageSquare, CalendarCheck, Search, Check, UserPlus, UserX } from 'lucide-react';

const WORKOUT_EMOJIS = ['💪', '🤸', '🏋️', '🏃', '🔥', '👍', '🙌', '👏', '🎯', '🥇', '🥗', '🥤', '😎', '💥', '👊', '📈'];

export default function Chat({ socket, user, inviteDraft, setInviteDraft, setSelectedSpot, setActiveTab }) {
  const [friends, setFriends] = useState([]);
  const [activeFriend, setActiveFriend] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteTime, setInviteTime] = useState('18:00');

  // Friends Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);

  // Emoji Picker States
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // Fetch Friends List
  const fetchFriends = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/friends/list?username=${user.username}`);
      if (res.ok) {
        const data = await res.json();
        setFriends(data);
        // Default active friend to first if none selected yet
        if (data.length > 0 && !activeFriend) {
          setActiveFriend(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch friends:', err);
    }
  };

  // Fetch Pending Requests
  const fetchPendingRequests = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/friends/pending?username=${user.username}`);
      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data);
      }
    } catch (err) {
      console.error('Failed to fetch pending requests:', err);
    }
  };

  // Search Users
  const handleSearchUsers = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchAttempted(false);
      return;
    }
    setIsSearchingUsers(true);
    setSearchAttempted(true);
    try {
      const res = await fetch(`http://localhost:5000/api/users/search?q=${searchQuery}&username=${user.username}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error('Failed to search users:', err);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  // Clear Search
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchAttempted(false);
  };

  // Send Friend Request
  const handleSendFriendRequest = async (targetUsername) => {
    try {
      const res = await fetch('http://localhost:5000/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: user.username, recipient: targetUsername })
      });
      if (res.ok) {
        // Refresh search results to show pending state
        setSearchResults(prev =>
          prev.map(item => item.username === targetUsername ? { ...item, status: 'sent' } : item)
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Accept Friend Request
  const handleAcceptRequest = async (requesterName) => {
    try {
      const res = await fetch('http://localhost:5000/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, friendName: requesterName })
      });
      if (res.ok) {
        fetchPendingRequests();
        fetchFriends();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Decline Friend Request
  const handleDeclineRequest = async (requesterName) => {
    try {
      const res = await fetch('http://localhost:5000/api/friends/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, friendName: requesterName })
      });
      if (res.ok) {
        fetchPendingRequests();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load initial lists
  useEffect(() => {
    fetchFriends();
    fetchPendingRequests();
  }, [user]);

  // Generate unique room name
  const getRoomName = (user1, user2) => {
    if (!user1 || !user2) return '';
    return [user1, user2].sort().join('_');
  };

  const currentRoom = activeFriend ? getRoomName(user.username, activeFriend.name) : '';

  // Connect to room & load history
  useEffect(() => {
    if (socket && activeFriend && currentRoom) {
      socket.emit('join_room', { userId: user.id, room: currentRoom });

      socket.emit('get_history', currentRoom, (history) => {
        setMessages(history);
        scrollToBottom();
      });

      setIsTyping(false);
    }
  }, [activeFriend, socket, currentRoom]);

  // Real-time Socket listeners for chat & friend requests
  useEffect(() => {
    if (socket) {
      const handleMessage = (message) => {
        if (message.room === currentRoom) {
          setMessages(prev => [...prev, message]);
          scrollToBottom();
        }
      };

      const handleTyping = ({ username, isTyping: typing }) => {
        if (activeFriend && username === activeFriend.name) {
          setIsTyping(typing);
          scrollToBottom();
        }
      };

      const handleFriendRequestEvent = (event) => {
        // If request received is for me, update requests list
        if (event.type === 'request_received' && event.to === user.username) {
          fetchPendingRequests();
          // Create visual alert notification
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav');
          audio.play().catch(() => {});
        }
        
        // If request accepted and I am involved, update friends list
        if (event.type === 'request_accepted' && (event.to === user.username || event.from === user.username)) {
          fetchFriends();
          fetchPendingRequests();
        }
      };

      socket.on('message_received', handleMessage);
      socket.on('typing_status', handleTyping);
      socket.on('friend_request_event', handleFriendRequestEvent);

      return () => {
        socket.off('message_received', handleMessage);
        socket.off('typing_status', handleTyping);
        socket.off('friend_request_event', handleFriendRequestEvent);
      };
    }
  }, [socket, currentRoom, activeFriend, user]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !socket || !activeFriend) return;

    const messageData = {
      senderId: user.id,
      senderName: user.username,
      receiverName: activeFriend.name,
      content: inputText,
      room: currentRoom,
      isInvite: false
    };

    socket.emit('send_message', messageData);
    setInputText('');
    setShowEmojiPicker(false);
  };

  const handleSendInvite = () => {
    if (!inviteDraft || !socket || !activeFriend) return;

    const messageData = {
      senderId: user.id,
      senderName: user.username,
      receiverName: activeFriend.name,
      content: `Hey! I invite you to train at ${inviteDraft.name} at ${inviteTime}.`,
      room: currentRoom,
      isInvite: true,
      spotName: inviteDraft.name,
      inviteTime: inviteTime
    };

    socket.emit('send_message', messageData);
    setShowInviteModal(false);
    setInviteDraft(null);
  };

  const handleInviteSpotClick = (spotName) => {
    fetch('http://localhost:5000/api/spots')
      .then(res => res.json())
      .then(spots => {
        const found = spots.find(s => s.name === spotName);
        if (found) {
          setSelectedSpot(found);
          setActiveTab('map');
        }
      })
      .catch(err => console.error(err));
  };

  // Handle Emoji Selection
  const handleEmojiSelect = (emoji) => {
    setInputText(prev => prev + emoji);
    if (chatInputRef.current) {
      chatInputRef.current.focus();
    }
  };

  // Handle invite modal opening
  useEffect(() => {
    if (inviteDraft) {
      setShowInviteModal(true);
    }
  }, [inviteDraft]);

  return (
    <div className="chat-view-container">
      {/* Friends Sidebar */}
      <div className="friends-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        
        {/* Search Users form */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-darker)' }}>
          <form onSubmit={handleSearchUsers} style={{ display: 'flex', gap: '8px', position: 'relative' }}>
            <div style={{ flexGrow: 1, position: 'relative' }}>
              <input
                type="text"
                placeholder="Search users to add..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '32px', fontSize: '0.85rem', paddingVertical: '8px' }}
              />
              <Search size={14} color="var(--text-secondary)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  ✕
                </button>
              )}
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '8px 12px', fontSize: '0.85rem' }}>
              Search
            </button>
          </form>

          {/* Search Results Drawer */}
          {(searchResults.length > 0 || searchAttempted) && (
            <div style={{ position: 'absolute', left: '16px', right: '16px', top: '65px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-cyan)', borderRadius: '8px', zIndex: 100, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', padding: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>Search Results ({searchResults.length})</span>
                <span onClick={handleClearSearch} style={{ cursor: 'pointer', color: 'var(--accent-cyan)' }}>Close</span>
              </div>
              
              {searchResults.length > 0 ? (
                searchResults.map(result => (
                  <div key={result.username} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '4px', background: 'var(--bg-primary)', marginBottom: '4px', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: '600' }}>@{result.username}</span>
                    
                    {result.status === 'none' && (
                      <button
                        onClick={() => handleSendFriendRequest(result.username)}
                        style={{ background: 'var(--accent-cyan)', border: 'none', borderRadius: '4px', color: 'var(--bg-darker)', padding: '4px 8px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <UserPlus size={12} /> Add
                      </button>
                    )}
                    {result.status === 'sent' && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>Pending</span>
                    )}
                    {result.status === 'incoming' && (
                      <button
                        onClick={() => handleAcceptRequest(result.username)}
                        style={{ background: 'var(--accent-green)', border: 'none', borderRadius: '4px', color: 'var(--bg-darker)', padding: '4px 8px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                      >
                        Accept
                      </button>
                    )}
                    {result.status === 'friends' && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Friends</span>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>
                  {searchQuery.toLowerCase() === user.username.toLowerCase() || searchQuery.toLowerCase() === 'joe18' ? (
                    "You cannot search for or add yourself."
                  ) : (
                    <>No users found. Try searching for <b>King</b> or <b>Queen</b>!</>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Friends list */}
        <div style={{ padding: '16px 20px 8px 20px' }}>
          <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Friends List ({friends.length})</h4>
        </div>
        
        <div className="friends-list" style={{ flexGrow: 1 }}>
          {friends.length > 0 ? (
            friends.map(friend => (
              <div
                key={friend.id}
                className={`friend-card ${activeFriend?.id === friend.id ? 'active' : ''}`}
                onClick={() => setActiveFriend(friend)}
              >
                <div className="friend-avatar-wrap">
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', border: '1px solid var(--border-color)', color: 'var(--accent-cyan)' }}>
                    {friend.name.charAt(0)}
                  </div>
                  <div className={`status-dot status-${friend.status}`}></div>
                </div>
                <div className="friend-info">
                  <div className="friend-name">{friend.name}</div>
                  <div className="friend-status-text">{friend.statusText}</div>
                </div>
              </div>
            ))
          ) : (
            <p style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              No friends added yet. Use the search bar above to find workout buddies!
            </p>
          )}
        </div>

        {/* Pending Friend Requests Panel */}
        {pendingRequests.length > 0 && (
          <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-darker)' }}>
            <h4 style={{ fontSize: '0.75rem', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⚠️ Pending Invites ({pendingRequests.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '120px', overflowY: 'auto' }}>
              {pendingRequests.map(reqName => (
                <div key={reqName} style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', padding: '8px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                  <span style={{ fontWeight: '600' }}>@{reqName}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleAcceptRequest(reqName)}
                      style={{ background: 'var(--accent-green)', border: 'none', borderRadius: '4px', color: 'var(--bg-darker)', padding: '2px 8px', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDeclineRequest(reqName)}
                      style={{ background: 'none', border: '1px solid var(--accent-red)', borderRadius: '4px', color: 'var(--accent-red)', padding: '2px 6px', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="chat-window">
        {activeFriend ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', border: '1px solid var(--border-color)', color: 'var(--accent-cyan)' }}>
                {activeFriend.name.charAt(0)}
              </div>
              <div>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: '700', marginBottom: '2px' }}>{activeFriend.name}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{activeFriend.statusText}</span>
              </div>
            </div>

            {/* Chat Messages Log */}
            <div className="chat-messages-container">
              {messages.length > 0 ? (
                messages.map((msg) => {
                  const isSent = msg.senderName === user.username;
                  return (
                    <div key={msg.id} className={`msg-wrapper ${isSent ? 'sent' : 'received'}`}>
                      <div className="msg-bubble">
                        {msg.isInvite ? (
                          <div className="invite-card">
                            <div className="invite-title">
                              <CalendarCheck size={16} /> Training Invitation
                            </div>
                            <div className="invite-details">
                              <p style={{ margin: '4px 0 8px 0', fontWeight: '500', color: 'white' }}>
                                Let's meet at **{msg.spotName}**
                              </p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                <Clock size={12} color="var(--accent-cyan)" /> Time: **{msg.inviteTime}**
                              </div>
                              <button
                                onClick={() => handleInviteSpotClick(msg.spotName)}
                                style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--accent-cyan)', padding: '6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                              >
                                View Spot on Map
                              </button>
                            </div>
                          </div>
                        ) : (
                          msg.content
                        )}
                      </div>
                      <div className="msg-info">
                        <span>{new Date(msg.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                  <MessageSquare size={40} style={{ marginBottom: '12px' }} />
                  <p>No messages here yet. Say hello to {activeFriend.name}!</p>
                </div>
              )}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              )}
              
              <div ref={messagesEndRef}></div>
            </div>

            {/* Chat Input Area */}
            <form onSubmit={handleSendMessage} className="chat-input-area" style={{ position: 'relative' }}>
              
              {/* Custom Emoji Picker Overlay */}
              {showEmojiPicker && (
                <div style={{ position: 'absolute', bottom: '80px', left: '20px', background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)', border: '1px solid var(--glass-border)', boxShadow: 'var(--glass-shadow)', borderRadius: '12px', padding: '12px', zIndex: 1000, width: '220px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center' }}>
                    {WORKOUT_EMOJIS.map(emoji => (
                      <span
                        key={emoji}
                        onClick={() => handleEmojiSelect(emoji)}
                        style={{ fontSize: '1.5rem', cursor: 'pointer', padding: '4px', borderRadius: '6px', transition: '0.1s', display: 'inline-block' }}
                        onMouseEnter={(e) => e.target.style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={(e) => e.target.style.background = 'none'}
                      >
                        {emoji}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                style={{ background: 'none', border: 'none', color: showEmojiPicker ? 'var(--accent-cyan)' : 'var(--text-secondary)', cursor: 'pointer', transition: 'var(--transition-fast)' }}
              >
                <Smile size={20} />
              </button>
              
              <div className="chat-input-wrapper">
                <input
                  type="text"
                  placeholder={`Message ${activeFriend.name}...`}
                  className="chat-input"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  ref={chatInputRef}
                  onClick={() => setShowEmojiPicker(false)} // hide picker on input click
                />
              </div>
              <button type="submit" className="btn-send">
                <Send size={18} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <MessageSquare size={50} style={{ marginBottom: '16px' }} />
            <h3>Your Chat Board</h3>
            <p>Select a friend from the left sidebar to start chatting!</p>
          </div>
        )}
      </div>

      {/* Invite Modal Overlay */}
      {showInviteModal && inviteDraft && activeFriend && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Invite {activeFriend.name} to Train</h3>
              <button className="btn-close-modal" onClick={() => {
                setShowInviteModal(false);
                setInviteDraft(null);
              }}>✕</button>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Gym Spot:</p>
              <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={16} color="var(--accent-cyan)" />
                <span style={{ fontWeight: '600' }}>{inviteDraft.name}</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="invite-time">Select Meeting Time</label>
              <input
                type="time"
                id="invite-time"
                className="input-field"
                value={inviteTime}
                onChange={(e) => setInviteTime(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1 }}
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteDraft(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                onClick={handleSendInvite}
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
