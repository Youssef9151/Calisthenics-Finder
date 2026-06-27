import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import db from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins for dev simplicity
    methods: ['GET', 'POST']
  }
});

// Port configuration
const PORT = process.env.PORT || 5000;

// ==========================================
// Authentication & Profile Routes
// ==========================================

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const users = await db.getUsers();
    
    // Check if user already exists (case-insensitive)
    const exists = users.some(u => u.username.toLowerCase() === username.toLowerCase());
    if (exists) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: 'user-' + Date.now(),
      username,
      password: hashedPassword,
      friends: [],
      sentRequests: [],
      incomingRequests: [],
      photo: '',
      age: null,
      level: 'Beginner',
      place: '',
      workoutStreak: 0,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    await db.saveUsers(users);

    res.status(201).json({
      message: 'Registration successful',
      user: { 
        id: newUser.id, 
        username: newUser.username,
        photo: '',
        age: null,
        level: 'Beginner',
        place: '',
        workoutStreak: 0
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const users = await db.getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    res.status(200).json({
      message: 'Login successful',
      user: { 
        id: user.id, 
        username: user.username,
        photo: user.photo || '',
        age: user.age || null,
        level: user.level || 'Beginner',
        place: user.place || '',
        workoutStreak: user.workoutStreak || 0
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Update Profile
app.post('/api/profile/update', async (req, res) => {
  const { username, photo, age, level, place, workoutStreak } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const users = await db.getUsers();
    const idx = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());

    if (idx === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (photo !== undefined) users[idx].photo = photo;
    if (age !== undefined) users[idx].age = age !== null && age !== '' ? parseInt(age) : null;
    if (level !== undefined) users[idx].level = level;
    if (place !== undefined) users[idx].place = place;
    if (workoutStreak !== undefined) users[idx].workoutStreak = parseInt(workoutStreak) || 0;

    await db.saveUsers(users);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: users[idx].id,
        username: users[idx].username,
        photo: users[idx].photo || '',
        age: users[idx].age || null,
        level: users[idx].level || 'Beginner',
        place: users[idx].place || '',
        workoutStreak: users[idx].workoutStreak || 0
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ==========================================
// User Search & Friend Requests Routes
// ==========================================

// Search other registered users
app.get('/api/users/search', async (req, res) => {
  const { q, username } = req.query;
  if (!q || !username) {
    return res.status(400).json({ error: 'Search query and username are required' });
  }

  try {
    const users = await db.getUsers();
    const currentUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    
    // Filter matching users, exclude current user
    const results = users
      .filter(u => 
        u.username.toLowerCase() !== username.toLowerCase() &&
        u.username.toLowerCase().includes(q.toLowerCase())
      )
      .map(u => {
        let status = 'none'; // none, sent, incoming, friends
        if (currentUser) {
          currentUser.friends = currentUser.friends || [];
          currentUser.sentRequests = currentUser.sentRequests || [];
          currentUser.incomingRequests = currentUser.incomingRequests || [];

          if (currentUser.friends.includes(u.username)) {
            status = 'friends';
          } else if (currentUser.sentRequests.includes(u.username)) {
            status = 'sent';
          } else if (currentUser.incomingRequests.includes(u.username)) {
            status = 'incoming';
          }
        }
        return { username: u.username, status };
      });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Send Friend Request
app.post('/api/friends/request', async (req, res) => {
  const { sender, recipient } = req.body;

  if (!sender || !recipient) {
    return res.status(400).json({ error: 'Sender and recipient usernames are required' });
  }

  try {
    const users = await db.getUsers();
    const senderUser = users.find(u => u.username.toLowerCase() === sender.toLowerCase());
    const recipientUser = users.find(u => u.username.toLowerCase() === recipient.toLowerCase());

    if (!senderUser || !recipientUser) {
      return res.status(404).json({ error: 'Sender or recipient user not found' });
    }

    // Initialize arrays
    senderUser.friends = senderUser.friends || [];
    senderUser.sentRequests = senderUser.sentRequests || [];
    senderUser.incomingRequests = senderUser.incomingRequests || [];

    recipientUser.friends = recipientUser.friends || [];
    recipientUser.sentRequests = recipientUser.sentRequests || [];
    recipientUser.incomingRequests = recipientUser.incomingRequests || [];

    if (senderUser.sentRequests.includes(recipientUser.username)) {
      return res.status(400).json({ error: 'Friend request already sent' });
    }

    senderUser.sentRequests.push(recipientUser.username);
    recipientUser.incomingRequests.push(senderUser.username);

    await db.saveUsers(users);

    // Notify in real-time
    io.emit('friend_request_event', {
      type: 'request_received',
      from: senderUser.username,
      to: recipientUser.username
    });

    res.json({ success: true, message: 'Friend request sent' });
  } catch (error) {
    console.error('Request error:', error);
    res.status(500).json({ error: 'Failed to send request' });
  }
});

// Accept Friend Request
app.post('/api/friends/accept', async (req, res) => {
  const { username, friendName } = req.body;

  if (!username || !friendName) {
    return res.status(400).json({ error: 'Username and friendName are required' });
  }

  try {
    const users = await db.getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    const friend = users.find(u => u.username.toLowerCase() === friendName.toLowerCase());

    if (!user || !friend) {
      return res.status(404).json({ error: 'User or friend not found' });
    }

    user.friends = user.friends || [];
    user.incomingRequests = user.incomingRequests || [];
    friend.friends = friend.friends || [];
    friend.sentRequests = friend.sentRequests || [];

    if (!user.friends.includes(friend.username)) user.friends.push(friend.username);
    if (!friend.friends.includes(user.username)) friend.friends.push(user.username);

    user.incomingRequests = user.incomingRequests.filter(name => name !== friend.username);
    friend.sentRequests = friend.sentRequests.filter(name => name !== user.username);

    await db.saveUsers(users);

    // Notify both sockets in real-time
    io.emit('friend_request_event', {
      type: 'request_accepted',
      from: user.username,
      to: friend.username
    });

    res.json({ success: true, message: 'Friend request accepted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

// Decline Friend Request
app.post('/api/friends/decline', async (req, res) => {
  const { username, friendName } = req.body;

  if (!username || !friendName) {
    return res.status(400).json({ error: 'Username and friendName are required' });
  }

  try {
    const users = await db.getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    const friend = users.find(u => u.username.toLowerCase() === friendName.toLowerCase());

    if (!user || !friend) {
      return res.status(404).json({ error: 'User or friend not found' });
    }

    user.incomingRequests = user.incomingRequests || [];
    friend.sentRequests = friend.sentRequests || [];

    user.incomingRequests = user.incomingRequests.filter(name => name !== friend.username);
    friend.sentRequests = friend.sentRequests.filter(name => name !== user.username);

    await db.saveUsers(users);

    res.json({ success: true, message: 'Friend request declined' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to decline request' });
  }
});

// Get pending incoming requests for a user
app.get('/api/friends/pending', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const users = await db.getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return res.json([]);
    res.json(user.incomingRequests || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

// Get active friends list (user-specific list)
app.get('/api/friends/list', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const users = await db.getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    
    if (!user) return res.json([]);
    
    const dbFriendsNames = user.friends || [];
    
    // Create friend cards for db friends (mark as online for simplicity)
    const dbFriends = dbFriendsNames.map((fName, idx) => {
      const friendUser = users.find(u => u.username.toLowerCase() === fName.toLowerCase());
      return {
        id: `db-f-${idx}-${fName}`,
        name: fName,
        status: 'online',
        statusText: 'Online • Training Partner',
        photo: friendUser ? friendUser.photo : ''
      };
    });

    res.json(dbFriends);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch friends list' });
  }
});

// ==========================================
// Group Chats Routes
// ==========================================

// Create a new group
app.post('/api/groups', async (req, res) => {
  const { name, members, creator, description, photo } = req.body;

  if (!name || !Array.isArray(members) || members.length === 0 || !creator) {
    return res.status(400).json({ error: 'Group name, members list, and creator are required' });
  }

  try {
    const groups = await db.getGroups();
    const newGroup = {
      id: 'group-' + Date.now(),
      name,
      description: description || '',
      photo: photo || '',
      members: [creator], // Creator is active immediately
      pendingMembers: members.filter(m => m.toLowerCase() !== creator.toLowerCase()),
      createdAt: new Date().toISOString()
    };

    groups.push(newGroup);
    await db.saveGroups(groups);

    // Notify all members via socket to update their sidebar
    io.emit('group_event', {
      type: 'group_created',
      group: newGroup
    });

    res.status(201).json(newGroup);
  } catch (error) {
    console.error('Failed to create group:', error);
    res.status(500).json({ error: 'Failed to create group chat' });
  }
});

// Accept group invitation
app.post('/api/groups/:id/accept', async (req, res) => {
  const { id } = req.params;
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  try {
    const groups = await db.getGroups();
    const idx = groups.findIndex(g => g.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Group not found' });

    groups[idx].pendingMembers = groups[idx].pendingMembers || [];
    groups[idx].members = groups[idx].members || [];

    const isPending = groups[idx].pendingMembers.some(m => m.toLowerCase() === username.toLowerCase());
    if (!isPending) return res.status(400).json({ error: 'User is not invited or already a member' });

    // Move user
    groups[idx].pendingMembers = groups[idx].pendingMembers.filter(m => m.toLowerCase() !== username.toLowerCase());
    if (!groups[idx].members.some(m => m.toLowerCase() === username.toLowerCase())) {
      groups[idx].members.push(username);
    }

    await db.saveGroups(groups);

    // Notify other members
    io.emit('group_event', {
      type: 'group_joined',
      groupId: id,
      username,
      group: groups[idx]
    });

    res.json({ success: true, group: groups[idx] });
  } catch (error) {
    console.error('Accept group invite error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Decline group invitation
app.post('/api/groups/:id/decline', async (req, res) => {
  const { id } = req.params;
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  try {
    const groups = await db.getGroups();
    const idx = groups.findIndex(g => g.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Group not found' });

    groups[idx].pendingMembers = groups[idx].pendingMembers || [];
    groups[idx].pendingMembers = groups[idx].pendingMembers.filter(m => m.toLowerCase() !== username.toLowerCase());

    await db.saveGroups(groups);

    io.emit('group_event', {
      type: 'group_declined',
      groupId: id,
      username,
      group: groups[idx]
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Decline group invite error:', error);
    res.status(500).json({ error: 'Failed to decline invitation' });
  }
});

// Get user's groups
app.get('/api/groups', async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const groups = await db.getGroups();
    const userGroups = groups
      .filter(g => 
        (g.members && g.members.some(m => m.toLowerCase() === username.toLowerCase())) ||
        (g.pendingMembers && g.pendingMembers.some(m => m.toLowerCase() === username.toLowerCase()))
      )
      .map(g => {
        const isPending = g.pendingMembers && g.pendingMembers.some(m => m.toLowerCase() === username.toLowerCase());
        return {
          ...g,
          isPending
        };
      });
    res.json(userGroups);
  } catch (error) {
    console.error('Failed to fetch groups:', error);
    res.status(500).json({ error: 'Failed to retrieve groups' });
  }
});

// Get a user's public profile info
app.get('/api/users/profile', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const users = await db.getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      username: user.username,
      photo: user.photo || '',
      age: user.age || null,
      level: user.level || 'Beginner',
      place: user.place || '',
      workoutStreak: user.workoutStreak || 0,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Fetch user profile error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Register workout schedule for a spot (Mark as Going)
app.post('/api/spots/:id/going', async (req, res) => {
  const { id } = req.params;
  const { username, time } = req.body;

  if (!username || !time) {
    return res.status(400).json({ error: 'Username and time are required' });
  }

  try {
    const spots = await db.getSpots();
    const idx = spots.findIndex(s => s.id === id);

    if (idx === -1) {
      return res.status(404).json({ error: 'Spot not found' });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Initialize going array
    spots[idx].going = spots[idx].going || [];

    // Filter out previous entries for today from this user
    spots[idx].going = spots[idx].going.filter(g => 
      !(g.username.toLowerCase() === username.toLowerCase() && g.date === todayStr)
    );

    // Push new schedule
    spots[idx].going.push({
      username,
      time,
      date: todayStr
    });

    await db.saveSpots(spots);

    // Emit live update over socket to all clients
    io.emit('spot_going_update', { spotId: id, going: spots[idx].going });

    res.json({ success: true, going: spots[idx].going });
  } catch (error) {
    console.error('Update spot going error:', error);
    res.status(500).json({ error: 'Failed to register workout plan' });
  }
});

// Add photo to spot
app.post('/api/spots/:id/photos', async (req, res) => {
  const { id } = req.params;
  const { photo } = req.body;

  if (!photo) {
    return res.status(400).json({ error: 'Photo data is required' });
  }

  try {
    const spots = await db.getSpots();
    const idx = spots.findIndex(s => s.id === id);

    if (idx === -1) {
      return res.status(404).json({ error: 'Spot not found' });
    }

    if (!spots[idx].photos) {
      spots[idx].photos = [];
    }

    spots[idx].photos.push(photo);

    await db.saveSpots(spots);

    // Emit live update over socket to all clients
    io.emit('spot_photos_update', { spotId: id, photos: spots[idx].photos });

    res.json({ success: true, photos: spots[idx].photos });
  } catch (error) {
    console.error('Add spot photo error:', error);
    res.status(500).json({ error: 'Failed to add photo' });
  }
});

// ==========================================
// Spots Routes
// ==========================================

// Get all calisthenics spots
app.get('/api/spots', async (req, res) => {
  try {
    const spots = await db.getSpots();
    res.json(spots);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve spots' });
  }
});

// Add new unregistered spot
app.post('/api/spots', async (req, res) => {
  const { name, city, description, lat, lng, equipment } = req.body;

  if (!name || !lat || !lng) {
    return res.status(400).json({ error: 'Spot name, latitude, and longitude are required' });
  }

  try {
    const spots = await db.getSpots();
    const newSpot = {
      id: 'spot-' + Date.now(),
      name,
      city: city || 'Unknown City',
      description: description || 'No description provided.',
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      equipment: Array.isArray(equipment) ? equipment : [],
      image: '/assets/spots/placeholder.jpg',
      rating: 0,
      reviewsCount: 0
    };

    spots.push(newSpot);
    await db.saveSpots(spots);
    res.status(201).json(newSpot);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save spot' });
  }
});

// ==========================================
// Reviews Routes
// ==========================================

// Get reviews for a spot
app.get('/api/spots/:id/reviews', async (req, res) => {
  const { id } = req.params;
  try {
    const reviews = await db.getReviews();
    const spotReviews = reviews.filter(r => r.spotId === id);
    res.json(spotReviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve reviews' });
  }
});

// Add review to a spot
app.post('/api/spots/:id/reviews', async (req, res) => {
  const { id } = req.params;
  const { username, rating, comment } = req.body;

  if (!username || !rating) {
    return res.status(400).json({ error: 'Author username and rating (1-5) are required' });
  }

  try {
    const reviews = await db.getReviews();
    const newReview = {
      id: 'rev-' + Date.now(),
      spotId: id,
      username,
      rating: parseInt(rating),
      comment: comment || '',
      date: new Date().toISOString()
    };

    reviews.push(newReview);
    await db.saveReviews(reviews);

    // Recalculate average rating for the spot
    const spots = await db.getSpots();
    const spotIndex = spots.findIndex(s => s.id === id);
    if (spotIndex !== -1) {
      const spotReviews = reviews.filter(r => r.spotId === id);
      const totalRating = spotReviews.reduce((sum, r) => sum + r.rating, 0);
      spots[spotIndex].reviewsCount = spotReviews.length;
      spots[spotIndex].rating = parseFloat((totalRating / spotReviews.length).toFixed(1));
      await db.saveSpots(spots);
    }

    res.status(201).json(newReview);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add review' });
  }
});


// ==========================================
// Socket.io Real-Time Messaging
// ==========================================

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // When a user enters a chat with a specific target
  socket.on('join_room', ({ userId, room }) => {
    socket.join(room);
    console.log(`User ${userId} joined room: ${room}`);
  });

  // Register user for background notification delivery
  socket.on('register_user', (username) => {
    if (username) {
      socket.join(`user-${username}`);
      console.log(`Socket ${socket.id} registered to user notification channel: user-${username}`);
    }
  });

  // When a user sends a message
  socket.on('send_message', async (messageData) => {
    const { senderId, senderName, receiverName, content, room, isInvite, spotName, inviteTime, photo, voice } = messageData;
    
    try {
      const messages = await db.getMessages();
      const isGroup = room.startsWith('group-');

      const newMessage = {
        id: 'msg-' + Date.now(),
        senderId,
        senderName,
        receiverName: isGroup ? null : receiverName,
        groupId: isGroup ? room : null,
        content,
        room,
        isInvite: !!isInvite,
        spotName: spotName || null,
        inviteTime: inviteTime || null,
        photo: photo || null,
        voice: voice || null,
        date: new Date().toISOString()
      };

      messages.push(newMessage);
      await db.saveMessages(messages);

      // Emit to room (real-time chat for multiple active users)
      io.to(room).emit('message_received', newMessage);

      // Send to recipient(s) user notification rooms for background alerts
      if (isGroup) {
        const groups = await db.getGroups();
        const group = groups.find(g => g.id === room);
        if (group && Array.isArray(group.members)) {
          group.members.forEach(member => {
            if (member.toLowerCase() !== senderName.toLowerCase()) {
              io.to(`user-${member}`).emit('message_notification', newMessage);
            }
          });
        }
      } else if (receiverName) {
        io.to(`user-${receiverName}`).emit('message_notification', newMessage);
      }
    } catch (error) {
      console.error('Socket error saving message:', error);
    }
  });

  // Retrieve chat history for a specific room
  socket.on('get_history', async (room, callback) => {
    try {
      const messages = await db.getMessages();
      const roomMessages = messages.filter(m => m.room === room);
      callback(roomMessages);
    } catch (error) {
      console.error('Error fetching chat history:', error);
      callback([]);
    }
  });

  // Edit a message
  socket.on('edit_message', async ({ id, content, inviteTime, room }) => {
    try {
      const messages = await db.getMessages();
      const idx = messages.findIndex(m => m.id === id);
      if (idx !== -1) {
        messages[idx].content = content;
        if (inviteTime !== undefined) {
          messages[idx].inviteTime = inviteTime;
        }
        messages[idx].isEdited = true;
        messages[idx].editedAt = new Date().toISOString();
        await db.saveMessages(messages);

        io.to(room).emit('message_edited', messages[idx]);
      }
    } catch (error) {
      console.error('Socket error editing message:', error);
    }
  });

  // Delete a message
  socket.on('delete_message', async ({ id, room }) => {
    try {
      let messages = await db.getMessages();
      const msgToDelete = messages.find(m => m.id === id);
      if (msgToDelete) {
        messages = messages.filter(m => m.id !== id);
        await db.saveMessages(messages);
        
        io.to(room).emit('message_deleted', { id });
      }
    } catch (error) {
      console.error('Socket error deleting message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Start Express + Socket server
httpServer.listen(PORT, () => {
  console.log(`Calisthenics Finder backend running on port ${PORT}`);
});
