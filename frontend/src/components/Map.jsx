import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Locate, MessageSquare, Star, Plus, MapPin, ChevronRight, Share2, Check, Camera } from 'lucide-react';

export default function Map({
  socket,
  user,
  spots,
  selectedSpot,
  setSelectedSpot,
  userLocation,
  setUserLocation,
  onMapClickRegister
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const userMarkerRef = useRef(null);
  
  const [distanceSortedSpots, setDistanceSortedSpots] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);

  // Invite Friends Modal States
  const [friends, setFriends] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState([]); // selected usernames
  const [inviteTime, setInviteTime] = useState('18:00');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Map Search Autocomplete State
  const [mapSearchFocused, setMapSearchFocused] = useState(false);

  // Mark as Going States
  const [showGoingModal, setShowGoingModal] = useState(false);
  const [goingTime, setGoingTime] = useState('18:00');
  const [goingSuccess, setGoingSuccess] = useState(false);

  // Navigation States
  const [isNavigating, setIsNavigating] = useState(false);
  const [routeData, setRouteData] = useState(null);
  const [fetchingRoute, setFetchingRoute] = useState(false);
  const routePolylineRef = useRef(null);

  // Place Photos States
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activeLightboxImage, setActiveLightboxImage] = useState(null);

  // Reset navigation when selectedSpot changes or is cleared
  useEffect(() => {
    if (routePolylineRef.current && mapRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
    setIsNavigating(false);
    setRouteData(null);
    setFetchingRoute(false);
  }, [selectedSpot]);

  const spotsRef = useRef(spots);
  const setSelectedSpotRef = useRef(setSelectedSpot);
  const onMapClickRegisterRef = useRef(onMapClickRegister);

  useEffect(() => {
    spotsRef.current = spots;
    setSelectedSpotRef.current = setSelectedSpot;
    onMapClickRegisterRef.current = onMapClickRegister;
  }, [spots, setSelectedSpot, onMapClickRegister]);

  // Egypt Bounding Box Filter (Latitude ~22 to 32, Longitude ~24 to 36)
  const egyptOnlySpots = spots.filter(s => 
    s.lat >= 21.0 && s.lat <= 32.5 && s.lng >= 24.0 && s.lng <= 36.5
  );

  // Fetch Friends List
  useEffect(() => {
    if (user) {
      fetch(`http://localhost:5000/api/friends/list?username=${user.username}`)
        .then(res => res.json())
        .then(data => setFriends(data))
        .catch(err => console.error('Failed to fetch friends list:', err));
    }
  }, [user, showInviteModal]);

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
      const sorted = [...egyptOnlySpots].map(spot => {
        const dist = calculateDistance(userLocation[0], userLocation[1], spot.lat, spot.lng);
        return { ...spot, distance: dist };
      }).sort((a, b) => a.distance - b.distance);
      setDistanceSortedSpots(sorted);
    } else {
      setDistanceSortedSpots(egyptOnlySpots);
    }
  }, [spots, userLocation]);

  // Fetch reviews for the selected spot
  useEffect(() => {
    if (selectedSpot) {
      const fetchReviews = async () => {
        try {
          const res = await fetch(`http://localhost:5000/api/spots/${selectedSpot.id}/reviews`);
          if (res.ok) {
            const data = await res.json();
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
      // Egypt limits
      const initialCenter = [30.0444, 31.2357]; // Cairo
      const initialZoom = 6;
      const egyptBounds = L.latLngBounds([22.0, 24.5], [32.0, 36.0]);

      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        maxBounds: egyptBounds,
        maxBoundsViscosity: 1.0,
        minZoom: 5
      }).setView(initialCenter, initialZoom);

      // Add Esri World Street Map (English labels, styled with CSS dark filter)
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ',
        maxZoom: 19,
        className: 'dark-map-tiles'
      }).addTo(mapRef.current);

      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

      // Map Click Event - allows registering spot
      mapRef.current.on('click', (e) => {
        const { lat, lng } = e.latlng;
        
        // Find if there is a spot within 100 meters (0.1 km)
        const thresholdKm = 0.1; // 100 meters
        let closestSpot = null;
        let minDistance = Infinity;
        
        const currentSpots = spotsRef.current || [];
        currentSpots.forEach(spot => {
          const dist = calculateDistance(lat, lng, spot.lat, spot.lng);
          if (dist < minDistance) {
            minDistance = dist;
            closestSpot = spot;
          }
        });
        
        if (closestSpot && minDistance <= thresholdKm) {
          if (setSelectedSpotRef.current) {
            setSelectedSpotRef.current(closestSpot);
          }
          return;
        }
        
        const popupContent = document.createElement('div');
        popupContent.innerHTML = `
          <div style="text-align:center;">
            <p style="margin-bottom:8px;font-weight:600;font-size:0.85rem;color:black;">Register a spot here?</p>
            <button id="map-reg-btn" style="background:#06b6d4;color:#060911;border:none;padding:6px 12px;border-radius:4px;font-weight:700;font-size:0.8rem;cursor:pointer;">
              Add Spot Here
            </button>
          </div>
        `;

        L.popup()
          .setLatLng(e.latlng)
          .setContent(popupContent)
          .openOn(mapRef.current);

        setTimeout(() => {
          const btn = document.getElementById('map-reg-btn');
          if (btn) {
            btn.onclick = () => {
              mapRef.current.closePopup();
              if (onMapClickRegisterRef.current) {
                onMapClickRegisterRef.current({ lat, lng });
              }
            };
          }
        }, 100);
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update User Location Marker
  useEffect(() => {
    if (mapRef.current && userLocation) {
      // Check if location is inside Egypt
      if (userLocation[0] >= 21.0 && userLocation[0] <= 32.5 && userLocation[1] >= 24.0 && userLocation[1] <= 36.5) {
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
            .bindPopup('<b>You are here</b>')
            .on('click', (e) => {
              if (e.originalEvent) {
                e.originalEvent.stopPropagation();
              }
            });
        }

        mapRef.current.setView(userLocation, 14);
      }
    }
  }, [userLocation]);

  // Sync Markers for spots
  useEffect(() => {
    if (mapRef.current) {
      Object.values(markersRef.current).forEach(m => m.remove());
      markersRef.current = {};

      egyptOnlySpots.forEach(spot => {
        const spotIcon = L.divIcon({
          className: 'gym-marker-icon',
          html: `<div class="marker-pin"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18.5 5.5-1.5 1.5"/><path d="m5.5 18.5 1.5-1.5"/><path d="M8.5 5 5 8.5"/><path d="m19 15.5-3.5 3.5"/><path d="M14 3v4"/><path d="M10 21v-4"/><path d="M21 14h-4"/><path d="M3 10h4"/></svg></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32]
        });

        const marker = L.marker([spot.lat, spot.lng], { icon: spotIcon })
          .addTo(mapRef.current)
          .on('click', (e) => {
            if (e.originalEvent) {
              e.originalEvent.stopPropagation();
            }
            setSelectedSpot(spot);
          });
        
        marker.bindTooltip(spot.name, { direction: 'top', offset: [0, -30] });
        markersRef.current[spot.id] = marker;
      });
    }
  }, [spots]);

  // Animate Map Centering
  useEffect(() => {
    if (mapRef.current && selectedSpot) {
      mapRef.current.flyTo([selectedSpot.lat, selectedSpot.lng], 16, {
        duration: 1.2
      });
    }
  }, [selectedSpot]);

  const handleLocateUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
        },
        (error) => {
          alert('Geolocation failed: Please verify settings in your browser.');
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

    const found = egyptOnlySpots.find(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.city.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (found) {
      setSelectedSpot(found);
      setSearchQuery('');
    } else {
      alert(`No calisthenics spot found inside Egypt matching: "${searchQuery}"`);
    }
  };

  const handleAddReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.comment.trim()) return;

    setSubmittingReview(true);

    try {
      const res = await fetch(`http://localhost:5000/api/spots/${selectedSpot.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          rating: reviewForm.rating,
          comment: reviewForm.comment
        })
      });

      if (res.ok) {
        const newReview = await res.json();
        setReviews(prev => [newReview, ...prev]);
        setReviewForm({ rating: 5, comment: '' });
        
        // Refresh rating
        const allRes = await fetch(`http://localhost:5000/api/spots`);
        if (allRes.ok) {
          const allSpots = await allRes.json();
          const updated = allSpots.find(s => s.id === selectedSpot.id);
          if (updated) setSelectedSpot(updated);
        }
      }
    } catch (err) {
      console.error('Failed to submit review:', err);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Handle Multi-Friend Invite Submission
  const handleToggleFriendSelect = (fName) => {
    setSelectedFriends(prev => 
      prev.includes(fName) ? prev.filter(n => n !== fName) : [...prev, fName]
    );
  };

  const handleSendInvitations = () => {
    if (selectedFriends.length === 0 || !socket) return;

    const getRoomName = (u1, u2) => [u1, u2].sort().join('_');

    selectedFriends.forEach(friendName => {
      const roomName = getRoomName(user.username, friendName);
      
      // Join Room
      socket.emit('join_room', { userId: user.id, room: roomName });

      // Send Invite
      socket.emit('send_message', {
        senderId: user.id,
        senderName: user.username,
        receiverName: friendName,
        content: `Hey! I invite you to train at ${selectedSpot.name} at ${inviteTime}.`,
        room: roomName,
        isInvite: true,
        spotName: selectedSpot.name,
        inviteTime: inviteTime
      });
    });

    setInviteSuccess(true);
    setSelectedFriends([]);
    setTimeout(() => {
      setInviteSuccess(false);
      setShowInviteModal(false);
    }, 1500);
  };

  const handleMarkAsGoing = async () => {
    if (!user) return;
    try {
      const res = await fetch(`http://localhost:5000/api/spots/${selectedSpot.id}/going`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, time: goingTime })
      });

      if (res.ok) {
        setGoingSuccess(true);
        setTimeout(() => {
          setGoingSuccess(false);
          setShowGoingModal(false);
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to mark spot as going:', err);
    }
  };

  const handleStartNavigation = async () => {
    if (!userLocation || !selectedSpot) return;

    setFetchingRoute(true);
    const [startLat, startLng] = userLocation;
    const { lat: endLat, lng: endLng } = selectedSpot;

    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to fetch route');
      }
      const data = await res.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        alert('Could not find a route to this spot.');
        setFetchingRoute(false);
        return;
      }

      const route = data.routes[0];
      const geometry = route.geometry;

      const latlngs = geometry.coordinates.map(coord => [coord[1], coord[0]]);

      if (routePolylineRef.current && mapRef.current) {
        routePolylineRef.current.remove();
      }

      if (mapRef.current) {
        const polyline = L.polyline(latlngs, {
          color: '#06b6d4',
          weight: 5,
          opacity: 0.85,
          dashArray: '2, 8'
        }).addTo(mapRef.current);

        routePolylineRef.current = polyline;

        mapRef.current.fitBounds(polyline.getBounds(), {
          padding: [50, 50]
        });
      }

      const steps = [];
      if (route.legs && route.legs[0] && route.legs[0].steps) {
        route.legs[0].steps.forEach((step) => {
          let text = step.maneuver.instruction;
          if (!text) {
            const type = step.maneuver.type || '';
            const modifier = step.maneuver.modifier || '';
            const road = step.name ? `onto ${step.name}` : '';
            text = `${type.replace('-', ' ')} ${modifier.replace('-', ' ')} ${road}`.trim();
            if (text) {
              text = text.charAt(0).toUpperCase() + text.slice(1);
            } else {
              text = 'Continue';
            }
          }
          steps.push({
            instruction: text,
            distance: step.distance
          });
        });
      }

      setRouteData({
        distance: route.distance,
        duration: route.duration,
        steps: steps
      });
      setIsNavigating(true);
    } catch (err) {
      console.error('Error fetching navigation route:', err);
      alert('Error fetching navigation route: ' + err.message);
    } finally {
      setFetchingRoute(false);
    }
  };

  const handleEndNavigation = () => {
    if (routePolylineRef.current && mapRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
    setIsNavigating(false);
    setRouteData(null);
    setFetchingRoute(false);

    if (selectedSpot && mapRef.current) {
      mapRef.current.flyTo([selectedSpot.lat, selectedSpot.lng], 16, {
        duration: 1.2
      });
    }
  };

  const handleOpenGoogleMaps = () => {
    if (!userLocation || !selectedSpot) return;
    const [startLat, startLng] = userLocation;
    const { lat: endLat, lng: endLng } = selectedSpot;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${endLat},${endLng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  const formatRouteDistance = (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatRouteDuration = (seconds) => {
    const mins = Math.round(seconds / 60);
    if (mins < 60) {
      return `${mins} min${mins !== 1 ? 's' : ''}`;
    }
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs} hr${hrs !== 1 ? 's' : ''} ${remainingMins} min${remainingMins !== 1 ? 's' : ''}`;
  };

  const handleAddSpotPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Photo size exceeds 5MB limit.');
      return;
    }

    setUploadingPhoto(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 600;
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

        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

          const res = await fetch(`http://localhost:5000/api/spots/${selectedSpot.id}/photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photo: dataUrl })
          });

          if (res.ok) {
            const data = await res.json();
            setSelectedSpot(prev => ({ ...prev, photos: data.photos }));
          } else {
            alert('Failed to upload photo to server.');
          }
        } catch (err) {
          console.error('Failed to upload photo:', err);
          alert('Error uploading photo.');
        } finally {
          setUploadingPhoto(false);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="map-view-container">
      <div className="map-container-wrapper">
        <div className="map-search-overlay" style={{ position: 'absolute', zIndex: 1000, top: '20px', left: '20px', width: '320px' }}>
          <form onSubmit={handleSearchSubmit} className="map-search-card" style={{ marginBottom: 0 }}>
            <input
              type="text"
              placeholder="Search Egypt workout spots..."
              className="map-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setMapSearchFocused(true)}
              onBlur={() => setTimeout(() => setMapSearchFocused(false), 250)}
            />
            <button type="button" onClick={handleLocateUser} className="btn-locate" title="Locate Me">
              <Locate size={18} />
            </button>
          </form>

          {mapSearchFocused && searchQuery.trim().length > 0 && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              marginTop: '6px',
              maxHeight: '200px',
              overflowY: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {egyptOnlySpots
                .filter(s => 
                  s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  s.city.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map(spot => (
                  <div
                    key={spot.id}
                    onClick={() => {
                      setSelectedSpot(spot);
                      setSearchQuery('');
                    }}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <span style={{ fontWeight: '700' }}>{spot.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{spot.city}</span>
                  </div>
                ))}
              {egyptOnlySpots.filter(s => 
                s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.city.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && (
                <div style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  No matching spots found
                </div>
              )}
            </div>
          )}
        </div>

        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }}></div>
      </div>

      {/* Side panel */}
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
              {isNavigating && routeData ? (
                <div className="directions-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <h3 style={{ fontSize: '0.95rem', color: 'var(--accent-cyan)', fontWeight: 700, margin: 0 }}>
                      🚗 Navigation Directions
                    </h3>
                  </div>

                  {/* Summary Cards */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1, background: 'var(--bg-darker)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Distance</div>
                      <div style={{ fontSize: '1.15rem', color: 'white', fontWeight: 800 }}>
                        {formatRouteDistance(routeData.distance)}
                      </div>
                    </div>
                    <div style={{ flex: 1, background: 'var(--bg-darker)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Duration</div>
                      <div style={{ fontSize: '1.15rem', color: 'var(--accent-cyan)', fontWeight: 800 }}>
                        {formatRouteDuration(routeData.duration)}
                      </div>
                    </div>
                  </div>

                  {/* Step list */}
                  <div style={{
                    maxHeight: '260px',
                    overflowY: 'auto',
                    background: 'var(--bg-darker)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '8px'
                  }}>
                    {routeData.steps.map((step, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          gap: '12px',
                          padding: '10px 8px',
                          borderBottom: index === routeData.steps.length - 1 ? 'none' : '1px solid var(--border-color)'
                        }}
                      >
                        <div style={{
                          minWidth: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--accent-cyan)',
                          color: 'var(--accent-cyan)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}>
                          {index + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                            {step.instruction}
                          </div>
                          {step.distance > 0 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginTop: '2px', fontWeight: 600 }}>
                              In {formatRouteDistance(step.distance)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    <button
                      onClick={handleOpenGoogleMaps}
                      className="btn"
                      style={{
                        background: '#0f9d58',
                        color: 'white',
                        padding: '10px',
                        borderRadius: '6px',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      🗺️ Open Google Maps GPS
                    </button>
                    <button
                      onClick={handleEndNavigation}
                      className="btn btn-secondary"
                      style={{
                        padding: '10px',
                        fontSize: '0.85rem',
                        fontWeight: 700
                      }}
                    >
                      ❌ End Directions
                    </button>
                  </div>
                </div>
              ) : (
                <>
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

                  {/* Community Photos Gallery */}
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h3 className="details-section-title" style={{ margin: 0 }}>Community Photos</h3>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        color: 'var(--accent-cyan)',
                        fontWeight: '700',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        background: 'var(--bg-darker)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        transition: 'var(--transition-fast)'
                      }}>
                        <Camera size={12} /> Add Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAddSpotPhoto}
                          style={{ display: 'none' }}
                          disabled={uploadingPhoto}
                        />
                      </label>
                    </div>

                    {uploadingPhoto && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-darker)', padding: '8px', borderRadius: '6px', textAlign: 'center', marginBottom: '8px', border: '1px dashed var(--border-color)' }}>
                        Processing & Uploading photo...
                      </div>
                    )}

                    {selectedSpot.photos && selectedSpot.photos.length > 0 ? (
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        overflowX: 'auto',
                        paddingBottom: '8px',
                        scrollbarWidth: 'thin'
                      }}>
                        {selectedSpot.photos.map((ph, index) => (
                          <img
                            key={index}
                            src={ph}
                            alt={`${selectedSpot.name} user upload ${index + 1}`}
                            onClick={() => setActiveLightboxImage(ph)}
                            style={{
                              width: '70px',
                              height: '70px',
                              borderRadius: '6px',
                              objectFit: 'cover',
                              cursor: 'pointer',
                              border: '1px solid var(--border-color)',
                              flexShrink: 0,
                              transition: 'var(--transition-fast)'
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0' }}>
                        No community photos yet. Be the first to add one!
                      </p>
                    )}
                  </div>

                  {/* Friends going today list */}
                  <div style={{ marginTop: '16px', background: 'var(--bg-darker)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      👥 Training Today
                    </h4>
                    {(() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const friendNames = friends.map(f => f.name.toLowerCase());
                      const scheduledList = (selectedSpot.going || []).filter(g => 
                        g.date === todayStr && 
                        (g.username.toLowerCase() === user.username.toLowerCase() || friendNames.includes(g.username.toLowerCase()))
                      );
                      
                      const formatTime24To12 = (tStr) => {
                        if (!tStr) return '';
                        const [hStr, mStr] = tStr.split(':');
                        let h = parseInt(hStr);
                        const m = mStr || '00';
                        const period = h >= 12 ? 'PM' : 'AM';
                        if (h > 12) h -= 12;
                        if (h === 0) h = 12;
                        return `${h.toString().padStart(2, '0')}:${m} ${period}`;
                      };

                      return scheduledList.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {scheduledList.map((g, idx) => {
                            const isMe = g.username.toLowerCase() === user.username.toLowerCase();
                            return (
                              <div key={idx} style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: isMe ? '700' : '500', color: isMe ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                                  {isMe ? 'You' : `@${g.username}`}
                                </span>
                                <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>{formatTime24To12(g.time)}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>No friends scheduled for today yet.</p>
                      );
                    })()}
                  </div>

                  {/* Navigation Trigger Button */}
                  {userLocation && (
                    <button
                      onClick={handleStartNavigation}
                      className="btn btn-primary"
                      style={{
                        width: '100%',
                        marginBottom: '10px',
                        fontSize: '0.85rem',
                        padding: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: 'var(--accent-cyan)',
                        color: 'var(--bg-darker)',
                        fontWeight: 700
                      }}
                      disabled={fetchingRoute}
                    >
                      {fetchingRoute ? 'Calculating Route...' : '🚗 Get Directions'}
                    </button>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button 
                      onClick={() => setShowInviteModal(true)}
                      className="btn btn-secondary" 
                      style={{ flex: 1, fontSize: '0.85rem', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <Share2 size={14} /> Invite Friends
                    </button>
                    <button 
                      onClick={() => {
                        setGoingTime('18:00');
                        setShowGoingModal(true);
                      }}
                      className="btn btn-primary" 
                      style={{ flex: 1, fontSize: '0.85rem', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      💪 I'm Going
                    </button>
                  </div>

                  {/* Reviews */}
                  <div className="reviews-section" style={{ marginTop: '20px' }}>
                    <h3 className="details-section-title">
                      Reviews ({reviews.length})
                    </h3>

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
                        placeholder="Share your experience..."
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
                            {new Date(rev.date).toLocaleDateString()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                        No reviews yet. Be the first to review!
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="panel-header">
              <h2>Spots in Egypt</h2>
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

      {/* Invite Friends Modal Popup directly on map view */}
      {showInviteModal && selectedSpot && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Invite Friends to {selectedSpot.name}</h3>
              <button className="btn-close-modal" onClick={() => setShowInviteModal(false)}>✕</button>
            </div>

            {inviteSuccess ? (
              <div style={{ background: 'var(--accent-green-glow)', border: '1px solid var(--accent-green)', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', color: 'var(--bg-darker)' }}>
                  <Check size={20} />
                </div>
                <h4 style={{ color: 'white', marginBottom: '4px' }}>Invitations Sent!</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Check your Friend Zone chats to verify.</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                  Select which friends you want to invite:
                </p>

                <div className="friend-selector-list" style={{ maxHeight: '180px' }}>
                  {friends.length > 0 ? (
                    friends.map(friend => (
                      <div 
                        key={friend.id}
                        onClick={() => handleToggleFriendSelect(friend.name)}
                        className={`friend-select-item ${selectedFriends.includes(friend.name) ? 'selected' : ''}`}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {friend.photo ? (
                            <img 
                              src={friend.photo} 
                              alt={friend.name} 
                              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                            />
                          ) : (
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'var(--accent-cyan)', fontSize: '0.8rem' }}>
                              {friend.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{friend.name}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedFriends.includes(friend.name)}
                          onChange={() => {}} // handled by div click
                          style={{ accentColor: 'var(--accent-cyan)' }}
                        />
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                      You need to add friends first!
                    </p>
                  )}
                </div>

                {friends.length > 0 && (
                  <>
                    <div className="form-group">
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Select Time</label>
                      <CustomTimePicker
                        value={inviteTime}
                        onChange={setInviteTime}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                      <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowInviteModal(false)}>
                        Cancel
                      </button>
                      <button 
                        className="btn btn-primary" 
                        style={{ flex: 1 }}
                        onClick={handleSendInvitations}
                        disabled={selectedFriends.length === 0}
                      >
                        Send Invite
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Mark as Going Modal Popup */}
      {showGoingModal && selectedSpot && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '350px' }}>
            <div className="modal-header">
              <h3>Going to {selectedSpot.name}</h3>
              <button className="btn-close-modal" onClick={() => setShowGoingModal(false)}>✕</button>
            </div>

            {goingSuccess ? (
              <div style={{ background: 'var(--accent-green-glow)', border: '1px solid var(--accent-green)', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', color: 'var(--bg-darker)' }}>
                  <Check size={20} />
                </div>
                <h4 style={{ color: 'white', marginBottom: '4px' }}>Workout Plan Saved!</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Friends will see you're going today.</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                  Select the time you plan to train today:
                </p>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <CustomTimePicker
                    value={goingTime}
                    onChange={setGoingTime}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowGoingModal(false)}>
                    Cancel
                  </button>
                  <button 
                    className="btn btn-primary" 
                    style={{ flex: 1 }}
                    onClick={handleMarkAsGoing}
                  >
                    Confirm Going
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {activeLightboxImage && (
        <div 
          className="modal-overlay" 
          onClick={() => setActiveLightboxImage(null)}
          style={{ zIndex: 3000 }}
        >
          <div 
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setActiveLightboxImage(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid var(--border-color)',
                color: 'white',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>
            <img 
              src={activeLightboxImage} 
              alt="Community Upload Fullscreen" 
              style={{
                maxWidth: '90vw',
                maxHeight: '80vh',
                borderRadius: '8px',
                objectFit: 'contain',
                boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
                border: '1px solid var(--border-color)'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function CustomTimePicker({ value, onChange }) {
  // value is in format 'HH:MM' (24-hour time, e.g. '18:30')
  const parseTime = (timeStr) => {
    if (!timeStr) return { hour: '12', minute: '00', period: 'PM' };
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr);
    const m = mStr || '00';
    let period = 'AM';
    if (h >= 12) {
      period = 'PM';
      if (h > 12) h -= 12;
    }
    if (h === 0) h = 12;
    return { 
      hour: h.toString(), 
      minute: m, 
      period 
    };
  };

  const { hour, minute, period } = parseTime(value);

  const handleSelectChange = (newHour, newMinute, newPeriod) => {
    let h = parseInt(newHour);
    if (newPeriod === 'PM') {
      if (h < 12) h += 12;
    } else {
      if (h === 12) h = 0;
    }
    const hStr = h.toString().padStart(2, '0');
    const mStr = newMinute.padStart(2, '0');
    onChange(`${hStr}:${mStr}`);
  };

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <select 
        value={hour} 
        onChange={(e) => handleSelectChange(e.target.value, minute, period)}
        className="input-field"
        style={{ flex: 1, padding: '8px', background: 'var(--bg-darker)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px' }}
      >
        {Array.from({ length: 12 }, (_, i) => (i + 1).toString()).map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>:</span>
      <select 
        value={minute} 
        onChange={(e) => handleSelectChange(hour, e.target.value, period)}
        className="input-field"
        style={{ flex: 1, padding: '8px', background: 'var(--bg-darker)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px' }}
      >
        {['00', '15', '30', '45'].map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select 
        value={period} 
        onChange={(e) => handleSelectChange(hour, minute, e.target.value)}
        className="input-field"
        style={{ flex: 1, padding: '8px', background: 'var(--bg-darker)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px' }}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
