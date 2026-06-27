import React, { useState, useEffect } from 'react';
import { User, Dumbbell, Award, MapPin, MessageSquare, Calendar, ChevronRight, Edit2, Check } from 'lucide-react';

export default function Profile({ user, setUser, spots }) {
  const [stats, setStats] = useState({
    reviewsWritten: 0,
    spotsRegistered: 0,
    workoutStreak: 0
  });

  // Edit Profile States
  const [editMode, setEditMode] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(user.photo || '');
  const [age, setAge] = useState(user.age !== null ? user.age : '');
  const [level, setLevel] = useState(user.level || 'Beginner');
  const [place, setPlace] = useState(user.place || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Sync profile editing fields when user prop changes
  useEffect(() => {
    setPhotoUrl(user.photo || '');
    setAge(user.age !== null ? user.age : '');
    setLevel(user.level || 'Beginner');
    setPlace(user.place || '');
  }, [user]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Photo size exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to downscale
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Get compressed base64
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85); // 0.85 quality jpeg
          setPhotoUrl(dataUrl);
          setError('');
        } catch (err) {
          console.error('Failed to convert image to data URL:', err);
          setError('Failed to process image. Please try a different photo.');
        }
      };
      img.onerror = () => {
        setError('Failed to load image. Please make sure it is a valid image file.');
      };
      img.src = event.target.result;
    };
    reader.onerror = () => {
      setError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/spots`);
        if (response.ok) {
          const allSpots = await response.json();
          const userSpots = allSpots.filter(s => s.id.startsWith('spot-') && parseInt(s.id.split('-')[1]) > 1719330000000);
          
          let reviewCount = 0;
          for (const spot of allSpots) {
            const revRes = await fetch(`http://localhost:5000/api/spots/${spot.id}/reviews`);
            if (revRes.ok) {
              const reviews = await revRes.json();
              reviewCount += reviews.filter(r => r.username === user.username).length;
            }
          }
          
          setStats({
            spotsRegistered: userSpots.length,
            reviewsWritten: reviewCount,
            workoutStreak: 3
          });
        }
      } catch (err) {
        console.error('Error fetching user stats:', err);
      }
    };
    fetchStats();
  }, [user, spots]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const ageVal = age !== '' ? parseInt(age) : null;
    if (ageVal !== null && (isNaN(ageVal) || ageVal < 5 || ageVal > 120)) {
      setError('Please enter a valid age between 5 and 120.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          photo: photoUrl,
          age: ageVal,
          level,
          place
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        // Update session state
        localStorage.setItem('calisthenics_user', JSON.stringify(data.user));
        setUser(data.user);
        
        setTimeout(() => {
          setSuccess(false);
          setEditMode(false);
        }, 1200);
      } else {
        setError(data.error || 'Failed to update profile.');
      }
    } catch (err) {
      setError('Network error: Unable to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', overflowY: 'auto', height: '100%' }}>
      {/* Profile Info Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px', background: 'var(--bg-secondary)', padding: '30px', borderRadius: '16px', border: '1px solid var(--border-color)', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {user.photo ? (
            <img 
              src={user.photo} 
              alt={user.username}
              style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-cyan)', boxShadow: '0 0 12px var(--accent-cyan-glow)' }}
            />
          ) : (
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-green) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: '800', color: 'var(--bg-darker)' }}>
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '1.8rem', fontWeight: '800', marginBottom: '6px' }}>{user.username}</h1>
            <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', marginBottom: '4px' }}>
              <Award size={16} color="var(--accent-cyan)" /> {user.level || 'Beginner'} Athlete
              {user.age && <span style={{ color: 'var(--text-muted)' }}>• {user.age} Years Old</span>}
            </p>
            <p style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
              <MapPin size={14} color="var(--accent-green)" /> {user.place || 'Unknown Location'}
            </p>
          </div>
        </div>

        {!editMode && (
          <button 
            onClick={() => setEditMode(true)}
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <Edit2 size={14} /> Edit Profile
          </button>
        )}
      </div>

      {editMode ? (
        <div style={{ background: 'var(--bg-secondary)', padding: '30px', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.25rem', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Update Profile</h2>
          
          {success ? (
            <div style={{ background: 'var(--accent-green-glow)', border: '1px solid var(--accent-green)', padding: '16px', borderRadius: '8px', textAlign: 'center', margin: '20px 0' }}>
              <Check size={20} color="var(--accent-green)" style={{ marginInline: 'auto', marginBottom: '6px' }} />
              <span style={{ color: 'white', fontWeight: '600' }}>Changes saved successfully!</span>
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>Profile Photo</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', background: 'var(--bg-darker)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  {photoUrl ? (
                    <div style={{ position: 'relative' }}>
                      <img 
                        src={photoUrl} 
                        alt="Preview" 
                        style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-cyan)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setPhotoUrl('')}
                        style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--accent-red)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}
                        title="Remove photo"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label 
                      htmlFor="photo-upload" 
                      className="btn btn-secondary" 
                      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', width: 'auto', padding: '8px 16px', fontSize: '0.85rem', margin: 0 }}
                    >
                      Choose Image
                    </label>
                    <input 
                      type="file" 
                      id="photo-upload" 
                      accept="image/*" 
                      style={{ display: 'none' }}
                      onChange={handlePhotoChange}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      JPEG, PNG or JPG (Max 5MB)
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="age">Age</label>
                  <input 
                    type="number" 
                    id="age"
                    placeholder="e.g. 24"
                    className="input-field"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="level">Level</label>
                  <select 
                    id="level"
                    className="input-field"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    style={{ background: 'var(--bg-darker)' }}
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label htmlFor="place" style={{ fontSize: '0.9rem', fontWeight: '600' }}>Place / City</label>
                <input 
                  type="text" 
                  id="place"
                  placeholder="e.g. Heliopolis, Cairo"
                  className="input-field"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                />
              </div>

              {error && <div className="error-msg">{error}</div>}

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditMode(false)} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}

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
          <h3 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '4px' }}>{user.workoutStreak || 0} days</h3>
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
