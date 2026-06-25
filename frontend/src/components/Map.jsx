import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Locate, MessageSquare, Star, Plus, MapPin, ChevronRight, Share2 } from 'lucide-react';

export default function Map({
  spots,
  selectedSpot,
  setSelectedSpot,
  userLocation,
  setUserLocation,
  onMapClickRegister,
  onInviteFriends
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const userMarkerRef = useRef(null);
  
  const [distanceSortedSpots, setDistanceSortedSpots] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);

  // Haversine formula to calculate distance in km
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  // Sort spots by distance if user location is available
  useEffect(() => {
    if (userLocation) {
      const sorted = [...spots].map(spot => {
        const dist = calculateDistance(userLocation[0], userLocation[1], spot.lat, spot.lng);
        return { ...spot, distance: dist };
      }).sort((a, b) => a.distance - b.distance);
      setDistanceSortedSpots(sorted);
    } else {
      setDistanceSortedSpots(spots);
    }
  }, [spots, userLocation]);

  // Fetch reviews for the selected spot
  useEffect(() => {
    if (selectedSpot) {
      const fetchReviews = async () => {
        try {
          const res = await fetch(`http://localhost:5000/api/spots/${selectedSpot.id}/reviews`);
          if (res.ok) {
            const data = await res.ok ? await res.json() : [];
            setReviews(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
          }
        } catch (err) {
          console.error('Error fetching reviews:', err);
        }
      };
      fetchReviews();
      setReviewForm({ rating: 5, comment: '' });
    }
  }, [selectedSpot]);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      // Default center (Zamalek, Cairo or standard lat/lng)
      const initialCenter = userLocation || [30.0596, 31.2241];
      const initialZoom = userLocation ? 14 : 12;

      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false // Custom placement later
      }).setView(initialCenter, initialZoom);

      // Add CartoDB Dark Matter tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20
      }).addTo(mapRef.current);

      // Re-add Zoom control at bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

      // Map Click Event - allows registering spot
      mapRef.current.on('click', (e) => {
        const { lat, lng } = e.latlng;
        
        // Show temporary marker with registry options
        const popupContent = document.createElement('div');
        popupContent.innerHTML = `
          <div style="text-align:center;">
            <p style="margin-bottom:8px;font-weight:600;font-size:0.85rem;">Register a spot at this location?</p>
            <button id="map-reg-btn" style="background:#06b6d4;color:#060911;border:none;padding:6px 12px;border-radius:4px;font-weight:700;font-size:0.8rem;cursor:pointer;">
              Add Spot Here
            </button>
          </div>
        `;

        const tempMarker = L.popup()
          .setLatLng(e.latlng)
          .setContent(popupContent)
          .openOn(mapRef.current);

        // Bind button click
        setTimeout(() => {
          const btn = document.getElementById('map-reg-btn');
          if (btn) {
            btn.onclick = () => {
              mapRef.current.closePopup();
              if (onMapClickRegister) {
                onMapClickRegister({ lat, lng });
              }
            };
          }
        }, 100);
      });
    }

    return () => {
      // Clean up map on unmount
      if (mapRef.current) {
        // We do not destroy directly to keep it caching, or we can destroy if required.
        // For Single-page React Apps, destroying on unmount is safe.
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update User Location Marker
  useEffect(() => {
    if (mapRef.current) {
      if (userLocation) {
        const userIcon = L.divIcon({
          className: 'gym-marker-icon',
          html: `<div class="user-marker-pin"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng(userLocation);
        } else {
          userMarkerRef.current = L.marker(userLocation, { icon: userIcon })
            .addTo(mapRef.current)
            .bindPopup('<b>You are here</b>');
        }

        // Center map to user location on initial locate
        mapRef.current.setView(userLocation, 14);
      }
    }
  }, [userLocation]);

  // Sync Markers for spots
  useEffect(() => {
    if (mapRef.current) {
      // Clear old markers first
      Object.values(markersRef.current).forEach(m => m.remove());
      markersRef.current = {};

      // Draw new markers
      spots.forEach(spot => {
        const spotIcon = L.divIcon({
          className: 'gym-marker-icon',
          html: `<div class="marker-pin"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18.5 5.5-1.5 1.5"/><path d="m5.5 18.5 1.5-1.5"/><path d="M8.5 5 5 8.5"/><path d="m19 15.5-3.5 3.5"/><path d="M14 3v4"/><path d="M10 21v-4"/><path d="M21 14h-4"/><path d="M3 10h4"/></svg></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32]
        });

        const marker = L.marker([spot.lat, spot.lng], { icon: spotIcon })
          .addTo(mapRef.current)
          .on('click', () => {
            setSelectedSpot(spot);
          });
        
        // Bind basic hover tooltip
        marker.bindTooltip(spot.name, { direction: 'top', offset: [0, -30] });

        markersRef.current[spot.id] = marker;
      });
    }
  }, [spots]);

  // Animate Map Centering to Selected Spot
  useEffect(() => {
    if (mapRef.current && selectedSpot) {
      mapRef.current.flyTo([selectedSpot.lat, selectedSpot.lng], 16, {
        duration: 1.2
      });

      // Open Marker popup if exists
      const marker = markersRef.current[selectedSpot.id];
      if (marker) {
        // Highlight it slightly
      }
    }
  }, [selectedSpot]);

  // Request browser geolocation
  const handleLocateUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
        },
        (error) => {
          alert('Geolocation failed: Please verify permission settings in your browser.');
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Filter spots matching city or name
    const found = spots.find(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.city.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (found) {
      setSelectedSpot(found);
      setSearchQuery('');
    } else {
      alert(`No calisthenics spot found matching: "${searchQuery}"`);
    }
  };

  const handleAddReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.comment.trim()) return;

    setSubmittingReview(true);
    const userString = localStorage.getItem('calisthenics_user');
    const userObj = JSON.parse(userString);

    try {
      const res = await fetch(`http://localhost:5000/api/spots/${selectedSpot.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userObj.username,
          rating: reviewForm.rating,
          comment: reviewForm.comment
        })
      });

      if (res.ok) {
        const newReview = await res.json();
        setReviews(prev => [newReview, ...prev]);
        setReviewForm({ rating: 5, comment: '' });
        
        // Refresh the selectedSpot's rating in parent state
        // We will refetch spots in parent App
        if (onSuccessReviewSubmit) {
          onSuccessReviewSubmit();
        }
      }
    } catch (err) {
      console.error('Failed to submit review:', err);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Callback to refresh spot data in parent state after a review is submitted
  const onSuccessReviewSubmit = async () => {
    // We let App component know to update spots
    // Quick fix: Fetch updated spot to reflect rating
    try {
      const res = await fetch(`http://localhost:5000/api/spots`);
      if (res.ok) {
        const allSpots = await res.json();
        const updated = allSpots.find(s => s.id === selectedSpot.id);
        if (updated) {
          setSelectedSpot(updated);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="map-view-container">
      {/* Map display */}
      <div className="map-container-wrapper">
        
        {/* Floating Search Bar */}
        <div className="map-search-overlay">
          <form onSubmit={handleSearchSubmit} className="map-search-card">
            <input
              type="text"
              placeholder="Search spots by name or city..."
              className="map-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="button" onClick={handleLocateUser} className="btn-locate" title="Locate Me">
              <Locate size={18} />
            </button>
          </form>
        </div>

        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }}></div>
      </div>

      {/* Side panel: Shows list of spots OR details of selected spot */}
      <div className="map-list-panel">
        {selectedSpot ? (
          <div className="spot-details-panel">
            <div 
              className="details-header"
              style={{ backgroundImage: `url(${selectedSpot.image})` }}
            >
              <button className="btn-back-details" onClick={() => setSelectedSpot(null)}>
                &larr;
              </button>
              <div className="details-title-wrap">
                <div style={{ maxWidth: '75%' }}>
                  <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.25rem', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                    {selectedSpot.name}
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                    <MapPin size={12} /> {selectedSpot.city}
                  </p>
                </div>
                <div className="spot-card-rating" style={{ fontSize: '1rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                  <Star size={16} fill="#fbbf24" stroke="none" /> {selectedSpot.rating || 'N/A'}
                </div>
              </div>
            </div>

            <div className="details-content">
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {selectedSpot.description}
              </p>

              <div>
                <h3 className="details-section-title">Equipment Available</h3>
                {selectedSpot.equipment && selectedSpot.equipment.length > 0 ? (
                  <div className="equipment-tags">
                    {selectedSpot.equipment.map(eq => (
                      <span key={eq} className="equipment-tag">{eq}</span>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No equipment listed.</p>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  onClick={() => onInviteFriends(selectedSpot)}
                  className="btn btn-primary" 
                  style={{ flex: 1, fontSize: '0.9rem', padding: '10px' }}
                >
                  <Share2 size={16} /> Invite Friends
                </button>
              </div>

              {/* Reviews Section */}
              <div className="reviews-section" style={{ marginTop: '20px' }}>
                <h3 className="details-section-title">
                  Reviews ({reviews.length})
                </h3>

                {/* Review Form */}
                <form onSubmit={handleAddReview} className="add-review-form">
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>WRITE A REVIEW</h4>
                  <div className="star-rating-select">
                    {[1, 2, 3, 4, 5].map((stars) => (
                      <button
                        key={stars}
                        type="button"
                        className={`star-btn ${reviewForm.rating >= stars ? 'active' : ''}`}
                        onClick={() => setReviewForm(prev => ({ ...prev, rating: stars }))}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Share your experience at this park (bars quality, grip, lighting)..."
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                    className="input-field"
                    rows={2}
                    style={{ fontSize: '0.85rem', padding: '8px' }}
                    required
                  />
                  <button type="submit" className="btn btn-secondary" style={{ padding: '8px', fontSize: '0.85rem' }} disabled={submittingReview}>
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                </form>

                {/* Review list */}
                {reviews.length > 0 ? (
                  reviews.map(rev => (
                    <div key={rev.id} className="review-item">
                      <div className="review-item-header">
                        <span className="review-author">@{rev.username}</span>
                        <span className="review-stars">
                          {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                        </span>
                      </div>
                      <p className="review-comment">{rev.comment}</p>
                      <div className="review-date">
                        {new Date(rev.date).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                    No reviews yet. Be the first to review!
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="panel-header">
              <h2>Nearby Spots</h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {distanceSortedSpots.length} Found
              </span>
            </div>
            
            <div className="spots-list">
              {distanceSortedSpots.map(spot => (
                <div 
                  key={spot.id} 
                  className={`spot-card ${selectedSpot?.id === spot.id ? 'selected' : ''}`}
                  onClick={() => setSelectedSpot(spot)}
                >
                  <div className="spot-card-header">
                    <h3 className="spot-card-name">{spot.name}</h3>
                    <div className="spot-card-rating">
                      <Star size={14} fill="#fbbf24" stroke="none" />
                      <span>{spot.rating || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="spot-card-city">{spot.city}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {spot.distance !== undefined && (
                      <span className="spot-card-distance">
                        {spot.distance.toFixed(1)} km away
                      </span>
                    )}
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
                      Details <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
