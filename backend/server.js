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
// Authentication Routes
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
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    await db.saveUsers(users);

    res.status(201).json({
      message: 'Registration successful',
      user: { id: newUser.id, username: newUser.username }
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
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
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

    // Auto-accept simulated database users for single-player testing
    const botDbUsers = ['CalisthenicsKing', 'BarWorkoutQueen', 'HandstandPro'];
    if (botDbUsers.includes(recipientUser.username)) {
      setTimeout(async () => {
        try {
          const freshUsers = await db.getUsers();
          const sU = freshUsers.find(u => u.username.toLowerCase() === sender.toLowerCase());
          const rU = freshUsers.find(u => u.username.toLowerCase() === recipient.toLowerCase());
          
          if (sU && rU) {
            sU.friends = sU.friends || [];
            sU.sentRequests = sU.sentRequests || [];
            rU.friends = rU.friends || [];
            rU.incomingRequests = rU.incomingRequests || [];

            if (!sU.friends.includes(rU.username)) sU.friends.push(rU.username);
            if (!rU.friends.includes(sU.username)) rU.friends.push(sU.username);

            sU.sentRequests = sU.sentRequests.filter(name => name !== rU.username);
            rU.incomingRequests = rU.incomingRequests.filter(name => name !== sU.username);

            await db.saveUsers(freshUsers);

            // Broadcast acceptance
            io.emit('friend_request_event', {
              type: 'request_accepted',
              from: rU.username,
              to: sU.username
            });
          }
        } catch (e) {
          console.error('Auto-accept error:', e);
        }
      }, 4000);
    }

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

// Get active friends list (user-specific list merged with default bots)
app.get('/api/friends/list', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const users = await db.getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    
    // Seeded bot friends (always available to talk to)
    const bots = [
      { id: 'f1', name: 'Alex', status: 'online', statusText: 'Online • Advanced Calisthenics' },
      { id: 'f2', name: 'Jordan', status: 'offline', statusText: 'Offline • Handstand Specialist' },
      { id: 'f3', name: 'Sarah', status: 'training', statusText: 'Training • Muscle Beach' },
      { id: 'f4', name: 'Marcus', status: 'online', statusText: 'Online • Beginner Athlete' }
    ];

    if (!user) return res.json(bots);
    
    const dbFriendsNames = user.friends || [];
    
    // Create friend cards for db friends (mark as online for simplicity)
    const dbFriends = dbFriendsNames
      .filter(fName => !bots.some(b => b.name === fName)) // avoid duplicate bots
      .map((fName, idx) => {
        return {
          id: `db-f-${idx}-${fName}`,
          name: fName,
          status: 'online',
          statusText: 'Online • Training Partner'
        };
      });

    res.json([...bots, ...dbFriends]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch friends list' });
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
// Socket.io Real-Time Messaging & Bot Simulation
// ==========================================

const BOT_RESPONSES = {
  Alex: [
    "Awesome! Pull-up bars are my favorite. I'll show you my muscle-up technique.",
    "Make sure to warm up your rotators. What time are we meeting?",
    "Nice! Let's do some weighted dips and pullups today.",
    "Perfect! Just checked the map, looks like a great spot."
  ],
  Jordan: [
    "Perfect. I need to practice my handstands. The floor there is flat right?",
    "Sounds great. I'll bring the gymnastics rings just in case.",
    "Let's train! I'm planning to work on front lever progressions today.",
    "Sure! Let's do a quick flexibility session first."
  ],
  Marcus: [
    "I'm in! Can you help me with my dip form? Still trying to unlock 10 clean reps.",
    "Let's go. Is there a Swedish wall there? Need to practice my leg raises.",
    "I'll join. Need to get a solid workout in today.",
    "Excellent! Let's train hard today."
  ],
  Sarah: [
    "Yes! Love that park. Meet you there in a bit.",
    "Count me in. Let's do some core conditioning today.",
    "Awesome. Make sure to bring water, it gets pretty warm under the sun.",
    "Perfect. I will show you my handstand-walk progression!"
  ]
};

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // When a user enters a chat with a specific target
  socket.on('join_room', ({ userId, room }) => {
    socket.join(room);
    console.log(`User ${userId} joined room: ${room}`);
  });

  // When a user sends a message
  socket.on('send_message', async (messageData) => {
    const { senderId, senderName, receiverName, content, room, isInvite, spotName, inviteTime } = messageData;
    
    try {
      const messages = await db.getMessages();
      const newMessage = {
        id: 'msg-' + Date.now(),
        senderId,
        senderName,
        receiverName,
        content,
        room,
        isInvite: !!isInvite,
        spotName: spotName || null,
        inviteTime: inviteTime || null,
        date: new Date().toISOString()
      };

      messages.push(newMessage);
      await db.saveMessages(messages);

      // Emit to room (real-time chat for multiple active users)
      io.to(room).emit('message_received', newMessage);

      // Simulated automated friend response (if messaging a bot)
      const bots = ['Alex', 'Jordan', 'Marcus', 'Sarah'];
      if (bots.includes(receiverName) && senderName !== receiverName) {
        // Trigger simulated typing indicator after a short delay
        setTimeout(() => {
          io.to(room).emit('typing_status', { username: receiverName, isTyping: true });
          
          // Trigger actual response
          setTimeout(async () => {
            io.to(room).emit('typing_status', { username: receiverName, isTyping: false });

            let replyContent = "";
            if (isInvite) {
              replyContent = `Hey ${senderName}! Count me in! I'll meet you at ${spotName} at ${inviteTime || 'the scheduled time'}. Let's get it! 💪`;
            } else {
              const responses = BOT_RESPONSES[receiverName];
              replyContent = responses[Math.floor(Math.random() * responses.length)];
            }

            const botMessage = {
              id: 'msg-' + (Date.now() + 1),
              senderId: 'bot-' + receiverName,
              senderName: receiverName,
              receiverName: senderName,
              content: replyContent,
              room,
              isInvite: false,
              spotName: null,
              inviteTime: null,
              date: new Date().toISOString()
            };

            const updatedMessages = await db.getMessages();
            updatedMessages.push(botMessage);
            await db.saveMessages(updatedMessages);

            io.to(room).emit('message_received', botMessage);
          }, 1500); // Wait 1.5s typing
        }, 800); // Start typing after 0.8s
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

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Start Express + Socket server
httpServer.listen(PORT, () => {
  console.log(`Calisthenics Finder backend running on port ${PORT}`);
});
