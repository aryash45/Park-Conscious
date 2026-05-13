const DEFAULT_LOCATION = { lat: 28.644800, lng: 77.216721 };
// Dynamic API URL: uses relative /api/parking on production (Vercel),
// falls back to http://localhost:5050 when running locally without the node server on port 80.
function getParkingApiUrl() {
    const isLocalFile = window.location.protocol === 'file:';
    if (isLocalFile) return './assets/data/parkings.json';
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const isBuildServer = window.location.port === '3000';
    if (isLocal && !isBuildServer) return 'http://localhost:5050/api/parking';
    return '/api/parking';
}

let map, userMarker, parkingData = [], markers = [], infoWindow;
let userPosition = { ...DEFAULT_LOCATION }; 
let dataLoaded = false;
let isochronePolygon = null;
let isochroneBounds = null; // Pre-calculated bounds for fast filtering
let currentDriveTime = 10;
let abortController = null; // For cancelling stale requests
let debounceTimer = null;

function toRad(deg) { return deg * Math.PI / 180; }
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371.0;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function saveBooking(booking) {
    const bookings = loadBookings();
    // Add a unique local ID if missing
    if (!booking.id && !booking._id) {
        booking.id = 'LOCAL-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }
    booking.createdAt = new Date().toISOString();
    bookings.push(booking);
    localStorage.setItem('park_conscious_parking_data', JSON.stringify(bookings));
}

function loadBookings() {
    const s = localStorage.getItem('park_conscious_parking_data');
    if (!s) return [];
    try {
        const parsed = JSON.parse(s);
        // Filter out any invalid/corrupted data that isn't a parking booking
        return parsed.filter(b => b.locationName || b.parkingId);
    } catch (e) {
        return [];
    }
}

async function loadParkingData() {
    try {
        const url = getParkingApiUrl();
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('API failed: ' + resp.status);
        parkingData = await resp.json();
        parkingData = parkingData.map(p => ({
            ...p,
            Latitude: Number(p.Latitude),
            Longitude: Number(p.Longitude),
            PricePerHour: p.PricePerHour !== undefined ? Number(p.PricePerHour) : null,
            TotalSlots: p.TotalSlots !== undefined ? Number(p.TotalSlots) : null
        }));
    } catch (e) {
        console.warn('API unavailable, falling back to local JSON:', e);
        try {
            const resp = await fetch('./assets/data/parkings.json');
            parkingData = await resp.json();
            parkingData = parkingData.map(p => ({
                ...p,
                Latitude: Number(p.Latitude),
                Longitude: Number(p.Longitude),
            }));
        } catch (e2) {
            console.error('Fallback also failed:', e2);
            parkingData = [];
        }
    }
    dataLoaded = true;
    if (map) fetchIsochroneAndRender();
}

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: DEFAULT_LOCATION,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false
    });
    infoWindow = new google.maps.InfoWindow();

    map.addListener('click', () => { infoWindow.close(); });

    document.getElementById('locate-btn').addEventListener('click', () => getUserLocation(true));
    const slider = document.getElementById('drive-time-slider');
    const display = document.getElementById('drive-time-display');
    if (slider) {
        slider.addEventListener('input', (e) => {
            if (display) display.innerText = `${e.target.value} min drive`;
        });
        slider.addEventListener('change', (e) => {
            currentDriveTime = Number(e.target.value);
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchIsochroneAndRender();
            }, 250);
        });
    }

    const input = document.getElementById('autocomplete-input');
    if (input) {
        const autocomplete = new google.maps.places.Autocomplete(input);
        autocomplete.setFields(['place_id', 'geometry', 'formatted_address', 'name']);
        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (place && place.geometry && place.geometry.location) {
                const loc = place.geometry.location;
                userPosition = { lat: loc.lat(), lng: loc.lng() };
                map.setCenter(userPosition);
                map.setZoom(14);
                putUserMarker();
                fetchIsochroneAndRender();
            }
        });
    }
    
    getUserLocation(false);
    if (dataLoaded) fetchIsochroneAndRender();

    const tabNearby = document.getElementById('tab-nearby');
    const tabBookings = document.getElementById('tab-bookings');

    if (tabNearby && tabBookings) {
        tabNearby.addEventListener('click', () => {
            tabNearby.classList.add('border-[#00C39A]', 'text-[#00C39A]');
            tabNearby.classList.remove('border-transparent', 'text-slate-500');
            tabBookings.classList.remove('border-[#00C39A]', 'text-[#00C39A]');
            tabBookings.classList.add('border-transparent', 'text-slate-500');
            const filters = document.querySelector('.p-4.border-b .flex.justify-between');
            if (filters) filters.style.display = 'flex';
            fetchIsochroneAndRender();
        });

        tabBookings.addEventListener('click', () => {
            tabBookings.classList.add('border-[#00C39A]', 'text-[#00C39A]');
            tabBookings.classList.remove('border-transparent', 'text-slate-500');
            tabNearby.classList.remove('border-[#00C39A]', 'text-[#00C39A]');
            tabNearby.classList.add('border-transparent', 'text-slate-500');
            const filters = document.querySelector('.p-4.border-b .flex.justify-between');
            if (filters) filters.style.display = 'none';
            renderBookingsList();
        });
    }
}

async function boot() {
    await loadParkingData();
}

function putUserMarker() {
    if (!userPosition) return;
    if (userMarker) userMarker.setMap(null);
    userMarker = new google.maps.Marker({
        position: userPosition,
        map,
        title: 'You are here',
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#00C39A',
            fillOpacity: 1,
            strokeWeight: 3,
            strokeColor: '#fff'
        }
    });
}

function renderMarkers(list) {
    const oldMarkers = [...markers];
    markers = [];
    list.forEach(item => {
        const pos = { lat: item.Latitude, lng: item.Longitude };
        const marker = new google.maps.Marker({
            position: pos,
            map,
            title: item.Location,
            optimized: true
        });
        marker.addListener('click', () => {
            map.panTo(pos);
            map.setZoom(16);
            showInfoWindow(item, marker);
        });
        markers.push(marker);
    });
    setTimeout(() => {
        oldMarkers.forEach(m => m.setMap(null));
    }, 10);
}

function showInfoWindow(item, marker) {
    const content = `
    <div style="font-family:'Inter', sans-serif; color:#0f172a; padding:4px;">
        <strong style="font-size:16px; display:block; margin-bottom:4px; font-family:'Outfit',sans-serif;">${escapeHtml(item.Location)}</strong>
        <div style="color:#64748b; font-size:13px; margin-bottom:8px;">${escapeHtml(item.Type || '')}</div>
        <div style="font-weight:600; color:#00C39A; margin-bottom:8px; font-size:14px;">${item.PricePerHour ? '₹' + item.PricePerHour + '/hr' : 'Contact'}</div>
        <button id="iw-book-${item.ID}" style="background:#0F172A; color:white; border:none; padding:8px 14px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; width:100%;">Book Spot</button>
    </div>`;
    infoWindow.setContent(content);
    infoWindow.open(map, marker);
    google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
        const btn = document.getElementById(`iw-book-${item.ID}`);
        if (btn) btn.addEventListener('click', () => openBookingModal(item));
    });
}

function renderNearby() {
    if (!userPosition || !dataLoaded) {
        const listEl = document.getElementById('results-list');
        if (listEl && !dataLoaded) listEl.innerHTML = '<div class="text-center p-6 text-slate-400 text-sm font-medium italic animate-pulse">Syncing smart data...</div>';
        return;
    }
    const enriched = parkingData.map(p => {
        const d = haversineDistance(userPosition.lat, userPosition.lng, p.Latitude, p.Longitude);
        return { ...p, distance_km: d };
    });
    let filtered;
    if (isochronePolygon && isochroneBounds) {
        filtered = enriched.filter(p => {
            const latLng = new google.maps.LatLng(p.Latitude, p.Longitude);
            if (!isochroneBounds.contains(latLng)) return false;
            return google.maps.geometry.poly.containsLocation(latLng, isochronePolygon);
        });
    } else {
        const fallbackRadius = currentDriveTime / 2;
        filtered = enriched.filter(p => p.distance_km <= fallbackRadius);
    }
    filtered.sort((a, b) => a.distance_km - b.distance_km);
    const results = filtered.slice(0, 30);
    const listEl = document.getElementById('results-list');
    listEl.innerHTML = '';
    if (results.length === 0) {
        listEl.innerHTML = '<div class="text-center p-6 text-slate-400 font-medium">No spots found in this radius.</div>';
    } else {
        results.forEach(p => {
            const el = document.createElement('div');
            el.className = 'glass-card rounded-xl p-4 cursor-pointer relative group';
            el.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-bold text-slate-900 text-base">${escapeHtml(p.Location)}</h4>
                        <div class="text-xs text-slate-500">${escapeHtml(p.Authority || '')}</div>
                    </div>
                    <div class="bg-[#00C39A]/10 text-[#00C39A] text-xs px-2 py-1 rounded font-bold">
                        ${(p.distance_km).toFixed(1)} km
                    </div>
                </div>
                <div class="flex items-center gap-4 my-3 text-sm">
                    <div class="flex items-center text-slate-700">
                        <span class="font-bold mr-1">${p.PricePerHour ? '₹' + p.PricePerHour : 'Contact'}</span>
                        <span class="text-slate-400 text-xs font-medium">/hr</span>
                    </div>
                    <div class="flex items-center text-slate-600">
                        <span class="w-2 h-2 rounded-full bg-emerald-400 mr-2 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
                        <span class="text-xs font-medium">${p.TotalSlots ? p.TotalSlots + ' slots' : 'Open'}</span>
                    </div>
                </div>
                <button class="book-btn w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg mt-1" data-id="${p.ID}">
                    Book Now
                </button>
            `;
            listEl.appendChild(el);
            el.addEventListener('click', (e) => {
                if (!e.target.classList.contains('book-btn')) {
                    map.panTo({ lat: p.Latitude, lng: p.Longitude });
                    map.setZoom(16);
                }
            });
            el.querySelector('.book-btn').addEventListener('click', (ev) => {
                ev.stopPropagation();
                openBookingModal(p);
            });
        });
    }
    document.getElementById('results-count').innerText = results.length;
    renderMarkers(results);
}

async function renderBookingsList() {
    const listEl = document.getElementById('results-list');
    listEl.innerHTML = '<div class="text-center p-6 text-slate-400 text-sm font-medium italic">Syncing with server...</div>';
    const userStr = localStorage.getItem('park_user');
    if (!userStr) {
        listEl.innerHTML = `
            <div class="flex flex-col items-center justify-center p-12 text-center space-y-6">
                <div class="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center shadow-inner">
                    <svg class="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <div>
                    <h3 class="text-xl font-black text-slate-900 mb-2">Login Required</h3>
                    <p class="text-slate-500 text-sm max-w-[200px] mx-auto font-medium leading-relaxed italic">Sign in to sync your bookings across devices & view your tickets.</p>
                </div>
                <a href="login.html" class="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10">Login Now</a>
            </div>`;
        return;
    }
    let bookings = [];
    try {
        const user = JSON.parse(userStr);
        const resp = await fetch(`/api/bookings/${user.id}`);
        if (resp.ok) {
            let apiBookings = await resp.json();
            // STRICT FILTER: Only keep bookings that have a parkingId
            apiBookings = apiBookings.filter(b => b.parkingId || b.locationName);
            
            const localBookings = loadBookings();
            // Merge but prioritize API data (simple de-dupe by id)
            const seen = new Set(apiBookings.map(b => b._id || b.id));
            bookings = [...apiBookings, ...localBookings.filter(b => !seen.has(b.id))];
        } else {
            bookings = loadBookings();
        }
    } catch (err) {
        bookings = loadBookings();
    }
    listEl.innerHTML = '';
    if (bookings.length === 0) {
        listEl.innerHTML = '<div class="text-center p-6 text-slate-400 text-sm font-medium">No active bookings found.</div>';
    } else {
        bookings.sort((a,b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)).forEach(b => {
            const el = document.createElement('div');
            el.className = 'glass-card rounded-xl p-4 mb-3 border-l-4 border-l-[#00C39A]';
            const bookingId = b._id || b.id || 'N/A';
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${bookingId}`;
            const locName = b.locationName || 'Unknown Spot';
            
            el.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-bold text-slate-900 text-base">${escapeHtml(locName)}</h4>
                        <div class="text-[10px] text-slate-400 font-mono tracking-tighter uppercase">Ref: ${bookingId}</div>
                    </div>
                    <div class="text-right">
                         <div class="text-[#00C39A] font-bold text-sm">₹${b.amount}</div>
                    </div>
                </div>
                <div class="flex items-center gap-3 mt-2">
                    <img src="${qrUrl}" alt="QR" class="w-16 h-16 rounded border border-slate-100 shadow-sm">
                    <div class="space-y-1">
                        <div class="text-[10px] text-slate-900 font-black uppercase tracking-widest">${b.startTime} - ${b.endTime}</div>
                        <div class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Plate: ${escapeHtml(b.license || 'N/A')}</div>
                    </div>
                </div>`;
            listEl.appendChild(el);
        });
    }
}

function openBookingModal(item) {
    const userStr = localStorage.getItem('park_user');
    if (!userStr) { alert('Please login to book.'); window.location.href = 'login.html'; return; }
    const user = JSON.parse(userStr);
    const modalRoot = document.getElementById('modal-root');
    modalRoot.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="bg-white border border-slate-100 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
            <div class="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 class="text-xl font-black text-slate-900">${escapeHtml(item.Location)}</h3>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-900"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <div class="p-6 space-y-5">
                <div class="grid grid-cols-2 gap-4">
                    <input id="start-time" type="time" value="09:00" class="border border-slate-200 rounded p-2 text-center">
                    <input id="end-time" type="time" value="10:00" class="border border-slate-200 rounded p-2 text-center">
                </div>
                <input id="vehicle-number" type="text" placeholder="VEHICLE NUMBER" class="w-full border border-slate-200 rounded p-3 text-center font-bold uppercase">
                <div class="bg-slate-50 p-4 rounded-xl flex justify-between items-center">
                    <span class="text-sm font-bold text-slate-500 uppercase">Estimate</span>
                    <span id="total-fare" class="text-2xl font-black text-slate-900">₹0</span>
                </div>
                <button id="confirm-book" class="w-full py-4 rounded-xl bg-slate-900 text-white font-bold text-lg hover:bg-slate-800 transition-all">Confirm Booking</button>
            </div>
        </div>
    </div>`;

    function compute() {
        const start = document.getElementById('start-time').value;
        const end = document.getElementById('end-time').value;
        let hrs = 1;
        if (start && end) {
            const [sh, sm] = start.split(':').map(Number); const [eh, em] = end.split(':').map(Number);
            hrs = Math.max(1, Math.ceil(eh + em/60 - (sh + sm/60)));
        }
        document.getElementById('total-fare').innerText = item.PricePerHour ? '₹' + (item.PricePerHour * hrs) : 'N/A';
    }
    document.getElementById('start-time').addEventListener('change', compute);
    document.getElementById('end-time').addEventListener('change', compute);
    document.getElementById('confirm-book').addEventListener('click', async () => {
        const btn = document.getElementById('confirm-book');
        const vNum = document.getElementById('vehicle-number').value.trim();
        if (!vNum) { alert('Vehicle number required'); return; }
        btn.innerText = 'Booking...'; btn.disabled = true;
        const bData = {
            action: "park", // Fixed: Added action for Python Engine
            parkingId: item.ID, 
            locationName: item.Location, 
            userId: user.id, 
            license: vNum, 
            amount: document.getElementById('total-fare').innerText.replace('₹', ''),
            startTime: document.getElementById('start-time').value, 
            endTime: document.getElementById('end-time').value
        };
        try {
            const resp = await fetch('/api/engine/allocator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bData) });
            const data = await resp.json();
            if (resp.ok && data.success) {
                const bId = data.booking_id;
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${bId}`;
                
                modalRoot.innerHTML = `
                <div class="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div class="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in-up">
                        <div class="bg-[#00C39A] p-6 text-center">
                            <div class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                            </div>
                            <h3 class="text-white font-black text-xl tracking-tight uppercase">Booking Confirmed</h3>
                        </div>
                        <div class="p-6 space-y-6">
                            <div class="text-center">
                                <img src="${qrUrl}" class="mx-auto w-40 h-40 rounded-xl border-4 border-slate-50 shadow-sm mb-2">
                                <div class="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-widest">REF: ${bId}</div>
                            </div>
                            
                            <div class="border-t border-dashed border-slate-200 pt-6">
                                <div class="flex justify-between mb-4">
                                    <div>
                                        <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Location</div>
                                        <div class="text-sm font-bold text-slate-900">${escapeHtml(item.Location)}</div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount</div>
                                        <div class="text-sm font-black text-[#00C39A]">₹${bData.amount}</div>
                                    </div>
                                </div>
                                <div class="flex justify-between">
                                    <div>
                                        <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vehicle</div>
                                        <div class="text-sm font-bold text-slate-900 uppercase">${escapeHtml(bData.license)}</div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Time Slot</div>
                                        <div class="text-sm font-bold text-slate-900">${bData.startTime} - ${bData.endTime}</div>
                                    </div>
                                </div>
                            </div>

                            <button onclick="location.reload()" class="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm tracking-widest uppercase hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 mt-2">Done</button>
                        </div>
                    </div>
                </div>`;
            } else { alert('Failed: ' + data.message); btn.innerText = 'Confirm'; btn.disabled = false; }
        } catch (e) { alert('Server error. Saved locally.'); saveBooking(bData); location.reload(); }
    });
    compute();
}

function closeModal() { document.getElementById('modal-root').innerHTML = ''; }
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

function getUserLocation(requirePrompt) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            map.setCenter(userPosition);
            putUserMarker();
            fetchIsochroneAndRender();
        }, () => { fetchIsochroneAndRender(); });
    } else { fetchIsochroneAndRender(); }
}

async function fetchIsochroneAndRender() {
    if (!userPosition || !map) return;
    if (abortController) abortController.abort();
    abortController = new AbortController();
    renderNearby();
    const apiUrl = window.PARK_CONFIG?.getDmieUrl ? window.PARK_CONFIG.getDmieUrl() : 'https://dmie.parkconscious.in/api/v1';
    try {
        const resp = await fetch(`${apiUrl}/isochrone`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: userPosition.lat, lng: userPosition.lng, minutes: currentDriveTime }),
            signal: abortController.signal
        });
        if (resp.ok) {
            const geojson = await resp.json();
            if (geojson) {
                map.data.forEach(f => map.data.remove(f));
                map.data.addGeoJson(geojson);
                map.data.setStyle({ fillColor: '#00C39A', fillOpacity: 0.3, strokeColor: '#00C39A', strokeWeight: 2, clickable: false });
                let coords;
                if (geojson.features?.[0]) {
                    const geom = geojson.features[0].geometry;
                    coords = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
                }
                if (coords) {
                    const paths = coords.map(c => ({ lat: c[1], lng: c[0] }));
                    if (isochronePolygon) isochronePolygon.setMap(null);
                    isochronePolygon = new google.maps.Polygon({ paths: paths });
                    isochroneBounds = new google.maps.LatLngBounds();
                    paths.forEach(p => isochroneBounds.extend(p));
                    map.fitBounds(isochroneBounds);
                }
            }
        }
    } catch (e) { if (e.name !== 'AbortError') console.warn("Isochrone failed", e); }
    renderNearby();
}

loadParkingData();
window.initMap = initMap;
