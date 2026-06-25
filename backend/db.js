import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, 'db');

const FILES = {
  users: path.join(DB_DIR, 'users.json'),
  spots: path.join(DB_DIR, 'spots.json'),
  reviews: path.join(DB_DIR, 'reviews.json'),
  messages: path.join(DB_DIR, 'messages.json'),
};

// Initial calisthenics spots seed data
const SEED_SPOTS = [
  {
    id: 'spot-1',
    name: 'Central Park Calisthenics Gym',
    city: 'New York',
    description: 'A famous outdoor workout spot in the heart of Central Park. Has top-tier bars and a great fitness community.',
    lat: 40.785091,
    lng: -73.968285,
    equipment: ['Pull-up Bars', 'Parallel Bars', 'Dip Bars', 'Monkey Bars', 'Swedish Wall'],
    image: '/assets/spots/central_park.jpg',
    rating: 4.8,
    reviewsCount: 3
  },
  {
    id: 'spot-2',
    name: 'Primrose Hill Workout Park',
    city: 'London',
    description: 'Great calisthenics setup with scenic views of London. Very active local community with weekend jams.',
    lat: 51.5406,
    lng: -0.1610,
    equipment: ['Pull-up Bars', 'Parallel Bars', 'Gymnastic Rings', 'Low Bars'],
    image: '/assets/spots/primrose_hill.jpg',
    rating: 4.6,
    reviewsCount: 2
  },
  {
    id: 'spot-3',
    name: 'Muscle Beach Outdoor Gym',
    city: 'Los Angeles',
    description: 'The legendary fitness hotspot at Santa Monica beach. Features full metal frame rigs, ropes, and rings.',
    lat: 34.0093,
    lng: -118.4969,
    equipment: ['Pull-up Bars', 'Parallel Bars', 'Gymnastic Rings', 'Climbing Ropes', 'Dip Bars'],
    image: '/assets/spots/muscle_beach.jpg',
    rating: 4.9,
    reviewsCount: 4
  },
  {
    id: 'spot-4',
    name: 'Zamalek Workout Park',
    city: 'Cairo',
    description: 'A beautiful riverside outdoor gym in Zamalek. Perfect for early morning workouts and sunset training.',
    lat: 30.0596,
    lng: 31.2241,
    equipment: ['Pull-up Bars', 'Parallel Bars', 'Dip Bars', 'Ab benches'],
    image: '/assets/spots/zamalek.jpg',
    rating: 4.5,
    reviewsCount: 2
  },
  {
    id: 'spot-5',
    name: 'Bondi Beach Gym',
    city: 'Sydney',
    description: 'Iconic beachfront outdoor training area. Features multiple height bars right next to the ocean.',
    lat: -33.8915,
    lng: 151.2767,
    equipment: ['Pull-up Bars', 'Parallel Bars', 'Gymnastic Rings', 'Dip Bars', 'Monkey Bars'],
    image: '/assets/spots/bondi_beach.jpg',
    rating: 4.7,
    reviewsCount: 3
  }
];

// Initial reviews seed data
const SEED_REVIEWS = [
  {
    id: 'rev-1',
    spotId: 'spot-1',
    username: 'Marcus_Bars',
    rating: 5,
    comment: 'Best park in NY! The high bars are perfect for freestyle and weighted pull-ups. Highly recommend!',
    date: '2026-06-20T10:30:00.000Z'
  },
  {
    id: 'rev-2',
    spotId: 'spot-1',
    username: 'Sarah_Handstands',
    rating: 4,
    comment: 'Amazing community here. The floor is rubberized which is great for handstands, though it gets crowded after 5 PM.',
    date: '2026-06-22T14:15:00.000Z'
  },
  {
    id: 'rev-3',
    spotId: 'spot-1',
    username: 'Alex_Calisthenics',
    rating: 5,
    comment: 'The bars are solid and have excellent grip. Meets all my daily workout needs.',
    date: '2026-06-23T18:00:00.000Z'
  },
  {
    id: 'rev-4',
    spotId: 'spot-2',
    username: 'Jordan_Freestyle',
    rating: 4,
    comment: 'Great view of London while working out! The bars are a bit thick but overall fantastic setup.',
    date: '2026-06-21T09:00:00.000Z'
  },
  {
    id: 'rev-5',
    spotId: 'spot-2',
    username: 'Sarah_Handstands',
    rating: 5,
    comment: 'Super peaceful in the mornings. There are gymnastics rings here which are rare for public parks!',
    date: '2026-06-24T07:45:00.000Z'
  },
  {
    id: 'rev-6',
    spotId: 'spot-3',
    username: 'Marcus_Bars',
    rating: 5,
    comment: 'Absolutely legendary. Every calisthenics athlete should visit this place at least once. Equipment is rugged and well-maintained.',
    date: '2026-06-18T16:20:00.000Z'
  },
  {
    id: 'rev-7',
    spotId: 'spot-3',
    username: 'Jordan_Freestyle',
    rating: 5,
    comment: 'Ropes and rings are in great condition. Training in the sea breeze is incomparable.',
    date: '2026-06-19T11:10:00.000Z'
  },
  {
    id: 'rev-8',
    spotId: 'spot-3',
    username: 'Alex_Calisthenics',
    rating: 4,
    comment: 'Amazing, but expect lots of tourists taking photos. Best to go early morning.',
    date: '2026-06-22T08:00:00.000Z'
  },
  {
    id: 'rev-9',
    spotId: 'spot-3',
    username: 'BarFlow99',
    rating: 5,
    comment: 'Incredible atmosphere. Met some of the best athletes here.',
    date: '2026-06-24T19:30:00.000Z'
  },
  {
    id: 'rev-10',
    spotId: 'spot-4',
    username: 'NileAthlete',
    rating: 4,
    comment: 'Beautiful workout spot next to the Nile. Good parallel bars, clean surroundings.',
    date: '2026-06-15T18:00:00.000Z'
  },
  {
    id: 'rev-11',
    spotId: 'spot-4',
    username: 'Alex_Calisthenics',
    rating: 5,
    comment: 'Great bars and friendly crowd. Usually easy to find free space to train.',
    date: '2026-06-23T19:00:00.000Z'
  },
  {
    id: 'rev-12',
    spotId: 'spot-5',
    username: 'AussieBarStar',
    rating: 5,
    comment: 'Training with a view of Bondi Beach is unbeatable. Strong dip bars and high pull-up bars.',
    date: '2026-06-17T06:30:00.000Z'
  },
  {
    id: 'rev-13',
    spotId: 'spot-5',
    username: 'Marcus_Bars',
    rating: 4,
    comment: 'Equipment gets hot in the midday sun, but it has everything you need. Awesome crowd!',
    date: '2026-06-21T15:00:00.000Z'
  },
  {
    id: 'rev-14',
    spotId: 'spot-5',
    username: 'Sarah_Handstands',
    rating: 5,
    comment: 'My favorite training spot in Sydney. Clean, safe, and right by the beach.',
    date: '2026-06-24T10:00:00.000Z'
  }
];

// Initial users seed data (password is "123456")
const SEED_USERS = [
  {
    id: 'user-king',
    username: 'CalisthenicsKing',
    password: '$2a$10$hB3s8sVqFfC5Wz.Y9oK6K.iJmU8N3NlIeL1Z.XmN/5V4J0c1qfA4.', // bcrypt hash of "123456"
    friends: ['Alex', 'Jordan', 'Sarah', 'Marcus'],
    sentRequests: [],
    incomingRequests: [],
    createdAt: '2026-06-25T00:00:00.000Z'
  },
  {
    id: 'user-queen',
    username: 'BarWorkoutQueen',
    password: '$2a$10$hB3s8sVqFfC5Wz.Y9oK6K.iJmU8N3NlIeL1Z.XmN/5V4J0c1qfA4.',
    friends: ['Sarah'],
    sentRequests: [],
    incomingRequests: [],
    createdAt: '2026-06-25T00:00:00.000Z'
  },
  {
    id: 'user-pro',
    username: 'HandstandPro',
    password: '$2a$10$hB3s8sVqFfC5Wz.Y9oK6K.iJmU8N3NlIeL1Z.XmN/5V4J0c1qfA4.',
    friends: ['Jordan'],
    sentRequests: [],
    incomingRequests: [],
    createdAt: '2026-06-25T00:00:00.000Z'
  }
];

// Helper to ensure files exist and are loaded
async function initDB() {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    
    // Ensure each file exists with at least empty array
    for (const [key, filePath] of Object.entries(FILES)) {
      try {
        await fs.access(filePath);
      } catch {
        // File does not exist, initialize it
        if (key === 'spots') {
          await fs.writeFile(filePath, JSON.stringify(SEED_SPOTS, null, 2));
        } else if (key === 'reviews') {
          await fs.writeFile(filePath, JSON.stringify(SEED_REVIEWS, null, 2));
        } else if (key === 'users') {
          await fs.writeFile(filePath, JSON.stringify(SEED_USERS, null, 2));
        } else {
          await fs.writeFile(filePath, JSON.stringify([], null, 2));
        }
      }
    }
  } catch (error) {
    console.error('Error initializing database files:', error);
  }
}

// Read database
async function readData(key) {
  await initDB();
  const filePath = FILES[key];
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading ${key} database:`, error);
    return [];
  }
}

// Write database
async function writeData(key, data) {
  await initDB();
  const filePath = FILES[key];
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing ${key} database:`, error);
    return false;
  }
}

export default {
  // Users
  async getUsers() {
    return await readData('users');
  },
  async saveUsers(users) {
    return await writeData('users', users);
  },

  // Spots
  async getSpots() {
    return await readData('spots');
  },
  async saveSpots(spots) {
    return await writeData('spots', spots);
  },

  // Reviews
  async getReviews() {
    return await readData('reviews');
  },
  async saveReviews(reviews) {
    return await writeData('reviews', reviews);
  },

  // Messages
  async getMessages() {
    return await readData('messages');
  },
  async saveMessages(messages) {
    return await writeData('messages', messages);
  }
};
