import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Check } from 'lucide-react';

const EQUIPMENT_OPTIONS = [
  'Pull-up Bars',
  'Parallel Bars',
  'Gymnastic Rings',
  'Dip Bars',
  'Monkey Bars',
  'Swedish Wall',
  'Low Bars',
  'Ab benches',
  'Climbing Ropes'
];

export default function RegisterSpot({ prefilledCoords, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    description: '',
    lat: '',
    lng: '',
    equipment: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // If the user clicked the map to pin-point, prefill coordinates!
  useEffect(() => {
    if (prefilledCoords) {
      setFormData(prev => ({
        ...prev,
        lat: prefilledCoords.lat.toFixed(6),
        lng: prefilledCoords.lng.toFixed(6)
      }));
    }
  }, [prefilledCoords]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (eqName) => {
    setFormData(prev => {
      const exists = prev.equipment.includes(eqName);
      if (exists) {
        return { ...prev, equipment: prev.equipment.filter(e => e !== eqName) };
      } else {
        return { ...prev, equipment: [...prev.equipment, eqName] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.name.trim() || !formData.lat || !formData.lng) {
      setError('Spot name and coordinates (Latitude/Longitude) are required.');
      return;
    }

    const latVal = parseFloat(formData.lat);
    const lngVal = parseFloat(formData.lng);

    if (isNaN(latVal) || latVal < -90 || latVal > 90) {
      setError('Latitude must be a valid number between -90 and 90.');
      return;
    }
    if (isNaN(lngVal) || lngVal < -180 || lngVal > 180) {
      setError('Longitude must be a valid number between -180 and 180.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/spots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          lat: latVal,
          lng: lngVal
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setFormData({
          name: '',
          city: '',
          description: '',
          lat: '',
          lng: '',
          equipment: []
        });
        setTimeout(() => {
          setSuccess(false);
          if (onSuccess) onSuccess(data);
        }, 1500);
      } else {
        setError(data.error || 'Failed to register the spot.');
      }
    } catch (err) {
      setError('Network error: Unable to reach the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-view-container">
      <h1>Register Unregistered Spot</h1>
      <p>Discovered a park or outdoor gym that isn't on our map yet? Add it below so the community can train there!</p>

      {success ? (
        <div style={{ background: 'var(--accent-green-glow)', border: '1px solid var(--accent-green)', padding: '30px', borderRadius: '12px', textAlign: 'center', margin: '40px 0' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', color: 'var(--bg-darker)' }}>
            <Check size={24} />
          </div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'white' }}>Spot Registered Successfully!</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Redirecting you to the Map...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ background: 'var(--bg-secondary)', padding: '30px', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="form-group">
            <label htmlFor="name">Spot Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g. Riverside Calisthenics Hub"
              className="input-field"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="city">City / Region</label>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city}
              onChange={handleInputChange}
              placeholder="e.g. London"
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Tell others about the place (e.g. shade, rubber floor, park hours)..."
              className="input-field"
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="lat-lng-group">
            <div className="form-group">
              <label htmlFor="lat">Latitude *</label>
              <input
                type="number"
                step="any"
                id="lat"
                name="lat"
                value={formData.lat}
                onChange={handleInputChange}
                placeholder="e.g. 51.540600"
                className="input-field"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="lng">Longitude *</label>
              <input
                type="number"
                step="any"
                id="lng"
                name="lng"
                value={formData.lng}
                onChange={handleInputChange}
                placeholder="e.g. -0.161000"
                className="input-field"
                required
              />
            </div>
          </div>

          <p className="coordinate-helper-text">
            💡 **Tip**: You can also navigate to the **Map Explorer** tab and click anywhere on the map to automatically pin-point and grab coordinates!
          </p>

          <div className="form-group">
            <label>Available Equipment</label>
            <div className="checkbox-grid">
              {EQUIPMENT_OPTIONS.map((eqName) => (
                <label key={eqName} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.equipment.includes(eqName)}
                    onChange={() => handleCheckboxChange(eqName)}
                  />
                  <span>{eqName}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }} disabled={loading}>
            {loading ? 'Registering...' : <><Plus size={18} /> Register Spot</>}
          </button>

        </form>
      )}
    </div>
  );
}
