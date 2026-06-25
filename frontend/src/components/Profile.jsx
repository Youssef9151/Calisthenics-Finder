import React, { useState, useEffect } from 'react';
import { User, Dumbbell, Award, MapPin, MessageSquare, Star } from 'lucide-react';

export default function Profile({ user, spots }) {
  const [stats, setStats] = useState({
    reviewsWritten: 0,
    spotsRegistered: 0,
    trainingLevel: 'Bronze Athlete',
    workoutStreak: 3
  });

  useEffect(() => {
    // Calculate how many spots this user has registered
    // For demo simplicity, we can fetch reviews written by this user
    const fetchStats = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/spots`);
        if (response.ok) {
          const allSpots = await response.json();
          // Filter spots that were added recently or mock registration count
          const userSpots = allSpots.filter(s => s.id.startsWith('spot-') && parseInt(s.id.split('-')[1]) > 1719330000000);
          
          // Let's get reviews
          let reviewCount = 0;
          for (const spot of allSpots) {
            const revRes = await fetch(`http://localhost:5000/api/spots/${spot.id}/reviews`);
            if (revRes.ok) {
              const reviews = await revRes.json();
              reviewCount += reviews.filter(r => r.username === user.username).length;
            }
          }
          
          setStats(prev => ({
            ...prev,
            spotsRegistered: userSpots.length,
            reviewsWritten: reviewCount,
            trainingLevel: reviewCount > 5 ? 'Gold Athlete' : (reviewCount > 2 ? 'Silver Athlete' : 'Bronze Athlete')
          }));
        }
      } catch (err) {
        console.error('Error fetching user stats:', err);
      }
    };
    fetchStats();
  }, [user, spots]);

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '40px', background: 'var(--bg-secondary)', padding: '30px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-green) 100%)', display: 'flex', alignItems: 'center', justifycontent: 'center', fontSize: '2.5rem', fontWeight: '800', color: 'var(--bg-darker)' }}>
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', fontWeight: '800', marginBottom: '6px' }}>{user.username}</h1>
          <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={16} color="var(--accent-cyan)" /> {stats.trainingLevel}
          </p>
        </div>
      </div>

      <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Your Training Stats</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <MessageSquare size={28} color="var(--accent-cyan)" style={{ marginBottom: '12px', marginInline: 'auto' }} />
          <h3 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '4px' }}>{stats.reviewsWritten}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Reviews Written</p>
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <MapPin size={28} color="var(--accent-green)" style={{ marginBottom: '12px', marginInline: 'auto' }} />
          <h3 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '4px' }}>{stats.spotsRegistered}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Spots Registered</p>
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <Dumbbell size={28} color="#fbbf24" style={{ marginBottom: '12px', marginInline: 'auto' }} />
          <h3 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '4px' }}>{stats.workoutStreak} days</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Workout Streak</p>
        </div>
      </div>

      <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Daily Motivation</h2>
      <div style={{ background: 'linear-gradient(135deg, var(--bg-secondary) 0%, rgba(6, 182, 212, 0.05) 100%)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border-color)', position: 'relative' }}>
        <p style={{ fontSize: '1.1rem', fontStyle: 'italic', lineHeight: '1.6', marginBottom: '12px', color: 'var(--text-primary)' }}>
          "The bar does not lie. It is exactly as heavy today as it was yesterday. The only variable that changes is your resolve."
        </p>
        <span style={{ color: 'var(--accent-cyan)', fontWeight: '600', fontSize: '0.9rem' }}>— Calisthenics Brotherhood</span>
      </div>
    </div>
  );
}
