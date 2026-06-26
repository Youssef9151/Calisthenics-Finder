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
  groups: path.join(DB_DIR, 'groups.json'),
};

// Initial calisthenics spots seed data (Egypt Only)
const SEED_SPOTS = [
  {
    id: 'spot-egypt-1',
    name: 'Zamalek Workout Park',
    city: 'Cairo',
    description: 'A beautiful riverside outdoor gym in Zamalek. Perfect for early morning workouts and sunset training.',
    lat: 30.0596,
    lng: 31.2241,
    equipment: ['Pull-up Bars', 'Parallel Bars', 'Dip Bars', 'Ab benches'],
    image: '/assets/spots/zamalek.jpg',
    rating: 0,
    reviewsCount: 0,
    going: []
  },
  {
    id: 'spot-egypt-2',
    name: 'Maadi Calisthenics Spot',
    city: 'Cairo',
    description: 'Vibrant training area in Maadi. Equipped with multiple-height bars and handles for calisthenics routines.',
    lat: 29.9602,
    lng: 31.2569,
    equipment: ['Pull-up Bars', 'Parallel Bars', 'Swedish Wall', 'Low Bars'],
    image: '/assets/spots/placeholder.jpg',
    rating: 0,
    reviewsCount: 0,
    going: []
  },
  {
    id: 'spot-egypt-3',
    name: 'Sporting Fitness Hub',
    city: 'Alexandria',
    description: 'Cool sea breeze training park in Alexandria Sporting. Perfect setup for bodyweight training.',
    lat: 31.2173,
    lng: 29.9328,
    equipment: ['Pull-up Bars', 'Parallel Bars', 'Dip Bars', 'Gymnastic Rings'],
    image: '/assets/spots/placeholder.jpg',
    rating: 0,
    reviewsCount: 0,
    going: []
  }
];

// Initial reviews seed data (Egypt Only)
const SEED_REVIEWS = [];

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
  },

  // Groups
  async getGroups() {
    return await readData('groups');
  },
  async saveGroups(groups) {
    return await writeData('groups', groups);
  }
};
