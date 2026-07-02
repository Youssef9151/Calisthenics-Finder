import React, { useState, useEffect, useRef } from 'react';
import { Send, MapPin, Calendar, Clock, Smile, MessageSquare, CalendarCheck, Search, Check, UserPlus, UserX, Users, PlusCircle, Camera, Mic, Square, Volume2 } from 'lucide-react';
import { CustomTimePicker } from './Map';

const WORKOUT_EMOJIS = ['💪', '🤸', '🏋️', '🏃', '🔥', '👍', '🙌', '👏', '🎯', '🥇', '🥗', '🥤', '😎', '💥', '👊', '📈'];

export default function Chat({ 
  socket, 
  user, 
  inviteDraft, 
  setInviteDraft, 
  setSelectedSpot, 
  setActiveTab,
  activeChat,
  setActiveChat,
  unreadCounts,
  setUnreadCounts
}) {
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  
  const [pendingRequests, setPendingRequests] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Group Modal States
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]); // friend names
  const [groupDesc, setGroupDesc] = useState('');
  const [groupPhoto, setGroupPhoto] = useState('');

  // Voice Recording States & Refs
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // Friends Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);

  // Emoji Picker States
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // User Profile Viewer State
  const [viewedProfileUser, setViewedProfileUser] = useState(null);

  // Message Editing States
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [editingInviteTime, setEditingInviteTime] = useState('');

  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // Fetch Friends List
  const fetchFriends = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/friends/list?username=${user.username}`);
      if (res.ok) {
        const data = await res.json();
        setFriends(data);
        // Default active chat to first friend if no chat active yet
        if (data.length > 0 && !activeChat) {
          setActiveChat({ type: 'private', data: data[0] });
        }
      }
    } catch (err) {
      console.error('Failed to fetch friends:', err);
    }
  };

  // Fetch Groups List
  const fetchGroups = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/groups?username=${user.username}`);
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  };

  const handleAcceptGroupInvite = async (groupId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/groups/${groupId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username })
      });

      if (res.ok) {
        const data = await res.json();
        fetchGroups();
        setActiveChat({ type: 'group', data: data.group });
      }
    } catch (err) {
      console.error('Failed to accept group invite:', err);
    }
  };

  const handleDeclineGroupInvite = async (groupId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/groups/${groupId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username })
      });

      if (res.ok) {
        fetchGroups();
        if (activeChat?.type === 'group' && activeChat.data.id === groupId) {
          setActiveChat(null);
        }
      }
    } catch (err) {
      console.error('Failed to decline group invite:', err);
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

  // Autocomplete search on typing
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
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
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, user.username]);

  // Send Friend Request
  const handleSendFriendRequest = async (targetUsername) => {
    try {
      const res = await fetch('http://localhost:5000/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: user.username, recipient: targetUsername })
      });
      if (res.ok) {
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

  // Create Group Chat
  const handleToggleGroupMember = (fName) => {
    setSelectedGroupMembers(prev => 
      prev.includes(fName) ? prev.filter(name => name !== fName) : [...prev, fName]
    );
  };

  const handleGroupPhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Photo size exceeds 2MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setGroupPhoto(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedGroupMembers.length === 0) return;

    const membersList = [user.username, ...selectedGroupMembers];

    try {
      const res = await fetch('http://localhost:5000/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName,
          members: membersList,
          creator: user.username,
          description: groupDesc,
          photo: groupPhoto
        })
      });

      if (res.ok) {
        const newGroup = await res.json();
        setGroupName('');
        setGroupDesc('');
        setGroupPhoto('');
        setSelectedGroupMembers([]);
        setShowGroupModal(false);
        fetchGroups();
        setActiveChat({ type: 'group', data: newGroup });
      }
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  // Load initial lists
  useEffect(() => {
    fetchFriends();
    fetchGroups();
    fetchPendingRequests();
  }, [user]);

  // Generate unique room name for private chats
  const getRoomName = (user1, user2) => {
    return `private_${[user1.toLowerCase(), user2.toLowerCase()].sort().join('_')}`;
  };

  // Determine active chat room string
  const currentRoom = activeChat
    ? (activeChat.type === 'private' 
        ? getRoomName(user.username, activeChat.data.name) 
        : activeChat.data.id)
    : '';

  // Connect to room & load history
  useEffect(() => {
    if (socket && activeChat && currentRoom) {
      socket.emit('join_room', { userId: user.id, room: currentRoom });

      socket.emit('get_history', currentRoom, (history) => {
        setMessages(history);
        scrollToBottom();
      });

      setIsTyping(false);
    }
  }, [activeChat, socket, currentRoom]);

  // Socket listeners for messaging & real-time invites
  useEffect(() => {
    if (socket) {
      const handleMessage = (message) => {
        if (message.room === currentRoom) {
          setMessages(prev => [...prev, message]);
          scrollToBottom();
        }
      };

      const handleMessageEdited = (updatedMsg) => {
        if (updatedMsg.room === currentRoom) {
          setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        }
      };

      const handleMessageDeleted = ({ id }) => {
        setMessages(prev => prev.filter(m => m.id !== id));
      };

      const handleFriendRequestEvent = (event) => {
        if (event.type === 'request_received' && event.to === user.username) {
          fetchPendingRequests();
        }
        if (event.type === 'request_accepted' && (event.to === user.username || event.from === user.username)) {
          fetchFriends();
          fetchPendingRequests();
        }
      };

      const handleGroupEvent = (event) => {
        if (event.type === 'group_created') {
          // If I am a member of the newly created group, refresh groups
          if (event.group.members.some(m => m.toLowerCase() === user.username.toLowerCase())) {
            fetchGroups();
          }
        }
      };

      socket.on('message_received', handleMessage);
      socket.on('message_edited', handleMessageEdited);
      socket.on('message_deleted', handleMessageDeleted);
      socket.on('friend_request_event', handleFriendRequestEvent);
      socket.on('group_event', handleGroupEvent);

      return () => {
        socket.off('message_received', handleMessage);
        socket.off('message_edited', handleMessageEdited);
        socket.off('message_deleted', handleMessageDeleted);
        socket.off('friend_request_event', handleFriendRequestEvent);
        socket.off('group_event', handleGroupEvent);
      };
    }
  }, [socket, currentRoom, activeChat, user]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const handleStartEdit = (msg) => {
    setEditingMessageId(msg.id);
    setEditingText(msg.content);
    setEditingInviteTime(msg.inviteTime || '18:00');
  };

  const handleSaveEdit = (msgId) => {
    if (!socket || !currentRoom) return;
    socket.emit('edit_message', {
      id: msgId,
      content: editingText,
      inviteTime: editingInviteTime,
      room: currentRoom
    });
    setEditingMessageId(null);
  };

  const handleDeleteMessage = (msgId) => {
    if (!socket || !currentRoom) return;
    if (window.confirm("Are you sure you want to delete this message?")) {
      socket.emit('delete_message', { id: msgId, room: currentRoom });
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !socket || !activeChat) return;

    const messageData = {
      senderId: user.id,
      senderName: user.username,
      receiverName: activeChat.type === 'private' ? activeChat.data.name : null,
      content: inputText,
      room: currentRoom,
      isInvite: false
    };

    socket.emit('send_message', messageData);
    setInputText('');
    setShowEmojiPicker(false);
  };

  // Handle sending a compressed photo
  const handleSendPhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file || !socket || !currentRoom) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Photo size exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

        socket.emit('send_message', {
          senderId: user.id,
          senderName: user.username,
          receiverName: activeChat.type === 'private' ? activeChat.data.name : null,
          content: '📷 Photo Attachment',
          room: currentRoom,
          photo: dataUrl
        });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Handle voice message recording toggle
  const handleToggleVoiceRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        const options = { mimeType: 'audio/webm' };
        
        let mediaRecorder;
        try {
          mediaRecorder = new MediaRecorder(stream, options);
        } catch (e) {
          mediaRecorder = new MediaRecorder(stream);
        }

        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
          stream.getTracks().forEach(track => track.stop());

          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result;

            socket.emit('send_message', {
              senderId: user.id,
              senderName: user.username,
              receiverName: activeChat.type === 'private' ? activeChat.data.name : null,
              content: '🎤 Voice Message',
              room: currentRoom,
              voice: base64Audio
            });
          };
          reader.readAsDataURL(audioBlob);
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingTime(0);

        recordingTimerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } catch (err) {
        console.error('Failed to start recording voice:', err);
        alert('Could not access microphone. Please check permissions.');
      }
    }
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // Handle Emoji Selection
  const handleEmojiSelect = (emoji) => {
    setInputText(prev => prev + emoji);
    if (chatInputRef.current) {
      chatInputRef.current.focus();
    }
  };

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
                    <span 
                      onClick={() => setViewedProfileUser(result.username)} 
                      style={{ fontWeight: '600', cursor: 'pointer', color: 'var(--accent-cyan)', textDecoration: 'underline' }}
                      title="View Profile"
                    >
                      @{result.username}
                    </span>
                    
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
                    <>No users found. Try searching for other profiles!</>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Group Creation Button */}
        <div style={{ padding: '12px 16px 4px 16px' }}>
          <button 
            onClick={() => setShowGroupModal(true)}
            className="btn btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <PlusCircle size={14} /> Create Group Chat
          </button>
        </div>

        {/* Dynamic Sidebar Lists */}
        <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Group Invitations list */}
          {groups.filter(g => g.isPending).length > 0 && (
            <div>
              <div style={{ padding: '12px 20px 6px 20px' }}>
                <h4 style={{ fontSize: '0.75rem', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={14} /> Crew Invitations ({groups.filter(g => g.isPending).length})
                </h4>
              </div>
              <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {groups.filter(g => g.isPending).map(group => (
                  <div
                    key={group.id}
                    style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {group.photo ? (
                        <img 
                          src={group.photo} 
                          alt={group.name} 
                          style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                        />
                      ) : (
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)', fontWeight: '700', fontSize: '0.85rem' }}>
                          {group.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.name}</div>
                        {group.description && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.description}</div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => handleAcceptGroupInvite(group.id)}
                        style={{ flex: 1, background: 'var(--accent-green)', border: 'none', borderRadius: '4px', color: 'var(--bg-darker)', padding: '4px 8px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                      >
                        Join
                      </button>
                      <button
                        onClick={() => handleDeclineGroupInvite(group.id)}
                        style={{ flex: 1, background: 'none', border: '1px solid var(--accent-red)', borderRadius: '4px', color: 'var(--accent-red)', padding: '4px 8px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Groups list */}
          {groups.filter(g => !g.isPending).length > 0 && (
            <div>
              <div style={{ padding: '12px 20px 6px 20px' }}>
                <h4 style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={14} /> Group Crews ({groups.filter(g => !g.isPending).length})
                </h4>
              </div>
              <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {groups.filter(g => !g.isPending).map(group => (
                  <div
                    key={group.id}
                    className={`friend-card ${activeChat?.type === 'group' && activeChat.data.id === group.id ? 'active' : ''}`}
                    onClick={() => setActiveChat({ type: 'group', data: group })}
                    style={{ padding: '8px 12px' }}
                  >
                    {group.photo ? (
                      <img 
                        src={group.photo} 
                        alt={group.name} 
                        style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                      />
                    ) : (
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--accent-cyan-glow)', border: '1px solid var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)', fontWeight: '700', fontSize: '0.85rem' }}>
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="friend-info">
                      <div className="friend-name" style={{ fontSize: '0.9rem' }}>{group.name}</div>
                      <div className="friend-status-text" style={{ fontSize: '0.75rem' }}>{group.members.length} Members</div>
                    </div>
                    {unreadCounts && unreadCounts[group.id] > 0 && (
                      <span className="request-badge" style={{ margin: '0 0 0 auto', background: 'var(--accent-red)' }}>
                        {unreadCounts[group.id]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends list */}
          <div>
            <div style={{ padding: '12px 20px 6px 20px' }}>
              <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Friends List ({friends.length})</h4>
            </div>
            
            <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {friends.length > 0 ? (
                friends.map(friend => (
                  <div
                    key={friend.id}
                    className={`friend-card ${activeChat?.type === 'private' && activeChat.data.id === friend.id ? 'active' : ''}`}
                    onClick={() => setActiveChat({ type: 'private', data: friend })}
                  >
                    <div 
                      className="friend-avatar-wrap"
                      onClick={(e) => { e.stopPropagation(); setViewedProfileUser(friend.name); }}
                      style={{ cursor: 'pointer' }}
                      title="View Profile"
                    >
                      {friend.photo ? (
                        <img 
                          src={friend.photo} 
                          alt={friend.name} 
                          style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                        />
                      ) : (
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', border: '1px solid var(--border-color)', color: 'var(--accent-cyan)' }}>
                          {friend.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className={`status-dot status-${friend.status}`}></div>
                    </div>
                    <div className="friend-info">
                      <div className="friend-name">{friend.name}</div>
                      <div className="friend-status-text">{friend.statusText}</div>
                    </div>
                    {(() => {
                      const room = getRoomName(user.username, friend.name);
                      return unreadCounts && unreadCounts[room] > 0 ? (
                        <span className="request-badge" style={{ margin: '0 0 0 auto', background: 'var(--accent-red)' }}>
                          {unreadCounts[room]}
                        </span>
                      ) : null;
                    })()}
                  </div>
                ))
              ) : (
                <p style={{ padding: '12px 20px', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
                  No friends yet. Search users above to add partners!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Pending Friend Requests Panel */}
        {pendingRequests.length > 0 && (
          <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-darker)' }}>
            <h4 style={{ fontSize: '0.75rem', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserPlus size={14} /> Pending Invites ({pendingRequests.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '120px', overflowY: 'auto' }}>
              {pendingRequests.map(reqName => (
                <div key={reqName} style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', padding: '8px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                  <span 
                    onClick={() => setViewedProfileUser(reqName)} 
                    style={{ fontWeight: '600', cursor: 'pointer', color: 'var(--accent-cyan)', textDecoration: 'underline' }}
                    title="View Profile"
                  >
                    @{reqName}
                  </span>
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
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              {activeChat.type === 'private' ? (
                <div 
                  onClick={() => setViewedProfileUser(activeChat.data.name)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                  title="View Profile"
                >
                  {activeChat.data.photo ? (
                    <img 
                      src={activeChat.data.photo} 
                      alt={activeChat.data.name} 
                      style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                    />
                  ) : (
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', border: '1px solid var(--border-color)', color: 'var(--accent-cyan)' }}>
                      {activeChat.data.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: '700', marginBottom: '2px' }}>{activeChat.data.name}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{activeChat.data.statusText}</span>
                  </div>
                </div>
              ) : (
                <>
                  {activeChat.data.photo ? (
                    <img 
                      src={activeChat.data.photo} 
                      alt={activeChat.data.name} 
                      style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--accent-cyan)' }}
                    />
                  ) : (
                    <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: 'var(--accent-cyan-glow)', border: '1px solid var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)', fontWeight: '700' }}>
                      {activeChat.data.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: '700', marginBottom: '2px' }}>{activeChat.data.name}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {activeChat.data.description ? `${activeChat.data.description} • ` : ''}
                      {activeChat.data.members.join(', ')}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Chat Messages Log */}
            <div className="chat-messages-container">
              {messages.length > 0 ? (
                messages.map((msg) => {
                  const isSent = msg.senderName === user.username;
                  return (
                    <div key={msg.id} className={`msg-wrapper ${isSent ? 'sent' : 'received'}`}>
                      {activeChat.type === 'group' && !isSent && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: '600', marginBottom: '2px', marginLeft: '4px' }}>
                          @{msg.senderName}
                        </span>
                      )}
                       {editingMessageId === msg.id ? (
                        <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '12px', border: '1px solid var(--accent-cyan)', display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '300px', width: '100%', alignSelf: isSent ? 'flex-end' : 'flex-start' }}>
                          {msg.isInvite ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>Edit Invitation Time</span>
                              <CustomTimePicker
                                value={editingInviteTime}
                                onChange={setEditingInviteTime}
                              />
                            </div>
                          ) : (
                            <textarea
                              className="input-field"
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              rows={2}
                              style={{ fontSize: '0.85rem', width: '100%', resize: 'none', padding: '8px' }}
                            />
                          )}
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button 
                              type="button" 
                              onClick={() => setEditingMessageId(null)} 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 10px', fontSize: '0.75rem', width: 'auto' }}
                            >
                              Cancel
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleSaveEdit(msg.id)} 
                              className="btn btn-primary" 
                              style={{ padding: '4px 10px', fontSize: '0.75rem', width: 'auto' }}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
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
                                  <Clock size={12} color="var(--accent-cyan)" /> Time: **{(() => {
                                    const tStr = msg.inviteTime;
                                    if (!tStr) return '';
                                    if (tStr.includes('AM') || tStr.includes('PM')) return tStr;
                                    const [hStr, mStr] = tStr.split(':');
                                    let h = parseInt(hStr);
                                    const m = mStr || '00';
                                    const period = h >= 12 ? 'PM' : 'AM';
                                    if (h > 12) h -= 12;
                                    if (h === 0) h = 12;
                                    return `${h.toString().padStart(2, '0')}:${m} ${period}`;
                                  })()}**
                                </div>
                                <button
                                  onClick={() => handleInviteSpotClick(msg.spotName)}
                                  style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--accent-cyan)', padding: '6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                                >
                                  View Spot on Map
                                </button>
                              </div>
                            </div>
                          ) : msg.photo ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <img 
                                src={msg.photo} 
                                alt="Attachment" 
                                style={{ maxWidth: '280px', maxHeight: '200px', borderRadius: '8px', objectFit: 'cover', display: 'block', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                                onClick={() => {
                                  const w = window.open();
                                  if (w) {
                                    w.document.write(`<img src="${msg.photo}" style="max-width:100%; max-height:100vh; display:block; margin:auto; background:#111;"/>`);
                                    w.document.title = "View Image Attachment";
                                  }
                                }}
                                title="View original image"
                              />
                            </div>
                          ) : msg.voice ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', minWidth: '220px' }}>
                              <Volume2 size={16} color="var(--accent-cyan)" />
                              <audio 
                                src={msg.voice} 
                                controls 
                                style={{ 
                                  height: '28px', 
                                  width: '180px',
                                  outline: 'none',
                                  background: 'none'
                                }} 
                              />
                            </div>
                          ) : (
                            msg.content
                          )}
                        </div>
                      )}
                      <div className="msg-info" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>
                          {new Date(msg.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          {msg.isEdited && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: '4px' }}>(edited)</span>}
                        </span>
                        {isSent && editingMessageId !== msg.id && (
                          <div style={{ display: 'flex', gap: '6px', marginLeft: '8px' }}>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(msg)}
                              style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', padding: 0, fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              edit
                            </button>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>•</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--accent-red)', padding: 0, fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                  <MessageSquare size={40} style={{ marginBottom: '12px' }} />
                  <p>No messages here yet. Say hello to start the chat!</p>
                </div>
              )}
              <div ref={messagesEndRef}></div>
            </div>

            {/* Chat Input Area */}
            <form onSubmit={handleSendMessage} className="chat-input-area" style={{ position: 'relative' }}>
              
              {/* Emoji Picker */}
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
                disabled={isRecording}
              >
                <Smile size={20} />
              </button>

              <input
                type="file"
                accept="image/*"
                id="chat-photo-file-input"
                style={{ display: 'none' }}
                onChange={handleSendPhotoChange}
              />
              <button
                type="button"
                onClick={() => document.getElementById('chat-photo-file-input').click()}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'var(--transition-fast)' }}
                title="Send Photo"
                disabled={isRecording}
              >
                <Camera size={20} />
              </button>

              <button
                type="button"
                onClick={handleToggleVoiceRecording}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: isRecording ? 'var(--accent-red)' : 'var(--text-secondary)', 
                  cursor: 'pointer', 
                  transition: 'var(--transition-fast)'
                }}
                title={isRecording ? "Stop & Send Recording" : "Record Voice Message"}
              >
                {isRecording ? <Square size={20} style={{ color: 'var(--accent-red)' }} /> : <Mic size={20} />}
              </button>
              
              {isRecording ? (
                <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-darker)', borderRadius: '24px', padding: '10px 20px', border: '1px solid var(--accent-red)' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-red)', boxShadow: '0 0 8px var(--accent-red-glow)', animation: 'pulseRed 1s infinite' }}></div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--accent-red)', fontWeight: '600' }}>Recording Voice: {formatRecordingTime(recordingTime)}</span>
                </div>
              ) : (
                <div className="chat-input-wrapper">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    className="chat-input"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    ref={chatInputRef}
                    onClick={() => setShowEmojiPicker(false)}
                  />
                </div>
              )}
              
              <button type="submit" className="btn-send" disabled={isRecording}>
                <Send size={18} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <MessageSquare size={50} style={{ marginBottom: '16px' }} />
            <h3>Your Chat Board</h3>
            <p>Select a friend or crew chat room from the sidebar to begin!</p>
          </div>
        )}
      </div>

      {/* Group Creation Modal */}
      {showGroupModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Create Group Crew</h3>
              <button className="btn-close-modal" onClick={() => setShowGroupModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label htmlFor="group-name-input">Crew Name *</label>
                <input 
                  type="text" 
                  id="group-name-input"
                  placeholder="e.g. Heliopolis Bars Crew"
                  className="input-field"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="group-desc-input">Description</label>
                <textarea 
                  id="group-desc-input"
                  placeholder="e.g. Heliopolis outdoor athletes community"
                  className="input-field"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  rows={2}
                  style={{ resize: 'none' }}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label>Crew Photo</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-darker)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  {groupPhoto ? (
                    <div style={{ position: 'relative' }}>
                      <img 
                        src={groupPhoto} 
                        alt="Group Preview" 
                        style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--accent-cyan)' }} 
                      />
                      <button 
                        type="button" 
                        onClick={() => setGroupPhoto('')} 
                        style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--accent-red)', color: 'white', border: 'none', borderRadius: '50%', width: '16px', height: '16px', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ width: '50px', height: '50px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                      G
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label 
                      htmlFor="group-photo-upload" 
                      className="btn btn-secondary" 
                      style={{ cursor: 'pointer', display: 'inline-flex', width: 'auto', padding: '6px 12px', fontSize: '0.8rem', margin: 0 }}
                    >
                      Choose Image
                    </label>
                    <input 
                      type="file" 
                      id="group-photo-upload" 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                      onChange={handleGroupPhotoChange} 
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Add Friends to Crew *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', padding: '4px' }}>
                  {friends.length > 0 ? (
                    friends.map(friend => (
                      <label key={friend.id} className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        <input 
                          type="checkbox"
                          checked={selectedGroupMembers.includes(friend.name)}
                          onChange={() => handleToggleGroupMember(friend.name)}
                          style={{ accentColor: 'var(--accent-cyan)' }}
                        />
                        <span>{friend.name}</span>
                      </label>
                    ))
                  ) : (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>You need to add friends first before creating a crew chat.</p>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowGroupModal(false)}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                  disabled={!groupName.trim() || selectedGroupMembers.length === 0}
                >
                  Create Crew
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {viewedProfileUser && (
        <UserProfileModal 
          username={viewedProfileUser} 
          onClose={() => setViewedProfileUser(null)} 
        />
      )}
    </div>
  );
}

function UserProfileModal({ username, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/users/profile?username=${username}`);
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        } else {
          setError('User profile not found.');
        }
      } catch (err) {
        setError('Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [username]);

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center', padding: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-15px', marginRight: '-15px' }}>
          <button className="btn-close-modal" onClick={onClose} style={{ fontSize: '1.2rem' }}>✕</button>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', color: 'var(--text-secondary)' }}>Loading profile...</div>
        ) : error ? (
          <div style={{ padding: '20px 0', color: 'var(--accent-red)' }}>{error}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            {profile.photo ? (
              <img 
                src={profile.photo} 
                alt={profile.username}
                style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-cyan)', boxShadow: '0 0 12px var(--accent-cyan-glow)' }}
              />
            ) : (
              <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-green) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: '800', color: 'var(--bg-darker)' }}>
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
            
            <div>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: '800', marginBottom: '4px' }}>@{profile.username}</h2>
              <p style={{ color: 'var(--accent-cyan)', fontWeight: '600', fontSize: '0.9rem' }}>{profile.level} Athlete</p>
            </div>

            <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '10px', margin: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Age</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{profile.age ? `${profile.age} Years` : 'Not specified'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Workout Streak</span>
                <span style={{ color: '#fbbf24', fontWeight: '600' }}>{profile.workoutStreak} days 🔥</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Joined</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{new Date(profile.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <button className="btn btn-secondary" onClick={onClose} style={{ width: '100%' }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
