/* script.js
   Updated: adds demo login, localStorage session, and logout handling.
   Also contains render logic for admin, receptionist, guest pages.
*/

const sample = {
  // (same sample data as before)
  admin: {
    totals: { guests: 125, roomsOccupied: '68 / 100', revenue: '₱87,500', pending: 5 },
    bookings: [
      { id: 'B00125', guest: 'Maria Lopez', room: '205', checkin: '2025-10-21', checkout: '2025-10-24', status: 'Checked Out' },
      { id: 'B00126', guest: 'John Cruz', room: '309', checkin: '2025-10-22', checkout: '2025-10-26', status: 'Active' },
      { id: 'B00127', guest: 'Kim Santos', room: '110', checkin: '2025-10-23', checkout: '2025-10-25', status: 'Reserved' },
    ],
    users: [
      { id: 'U001', name: 'Anna Ramos', role: 'Receptionist', status: 'Active' },
      { id: 'U002', name: 'Jeff Tan', role: 'Admin', status: 'Active' },
      { id: 'U003', name: 'Liza Robles', role: 'Guest', status: 'Inactive' },
    ],
    payments: [
      { txn: 'TXN001', guest: 'Maria Lopez', amount: '₱5,000', mode: 'GCash', status: 'Paid' },
      { txn: 'TXN002', guest: 'Kim Santos', amount: '₱3,500', mode: 'Cash', status: 'Pending' },
    ],
  },

  receptionist: {
    summary: { todayBookings: 15, available: 32, checkedIn: 12, pending: 3 },
    reservations: [
      { id: 'R0007', guest: 'Miguel Reyes', type: 'Deluxe', checkin: '2025-10-25', checkout: '2025-10-28', status: 'Confirmed' },
      { id: 'R0008', guest: 'Julia Santos', type: 'Standard', checkin: '2025-10-24', checkout: '2025-10-26', status: 'Pending' },
    ],
    historyList: [
      'Maria Lopez — Checked Out (Room 205)',
      'John Cruz — Checked In (Room 309)',
      'Kim Santos — Reserved (Room 110)'
    ],
    guests: [
      { id: 'G001', name: 'Maria Lopez', contact: '09171234567', email: 'maria@gmail.com', nationality: 'Filipino' },
      { id: 'G002', name: 'John Cruz', contact: '09981234567', email: 'johnc@yahoo.com', nationality: 'Filipino' },
    ],
    rooms: [
      { no: '101', type: 'Standard', rate: '₱2,500', status: 'Available' },
      { no: '102', type: 'Deluxe', rate: '₱3,500', status: 'Occupied' },
      { no: '103', type: 'Suite', rate: '₱5,000', status: 'Maintenance' },
    ],
    pendingPayments: [
      { id: 'P001', guest: 'John Cruz', amount: '₱3,500' },
      { id: 'P002', guest: 'Kim Santos', amount: '₱2,000' }
    ]
  },

  guest: {
    profile: { name: 'Maria Lopez', contact: '09171234567', email: 'maria@gmail.com', stays: 3, points: 150 },
    upcoming: { booking: 'Room 205 — 2025-10-25' },
    rooms: [
      { type: 'Standard', desc: '1 Bed, TV, AC', price: '₱2,500', status: 'Available' },
      { type: 'Deluxe', desc: '2 Beds, Mini-bar', price: '₱3,500', status: 'Available' },
      { type: 'Suite', desc: 'King Bed, Balcony', price: '₱5,000', status: 'Available' }
    ],
    payments: [
      { booking: 'B00126', amount: '₱3,500', mode: 'GCash', status: 'Pending' },
      { booking: 'B00127', amount: '₱5,000', mode: 'Credit Card', status: 'Paid' }
    ]
  }
};

/* Demo "users" for login (username/password are arbitrary for demo) */
const demoUsers = [
  { username: 'admin', password: 'admin', role: 'admin', displayName: 'System Admin' },
  { username: 'reception', password: 'reception', role: 'receptionist', displayName: 'Front Desk' },
  { username: 'guest', password: 'guest', role: 'guest', displayName: 'Maria Lopez' }
];

/* ----------------------
   Authentication helpers
   ---------------------- */
function saveSession(user) {
  localStorage.setItem('hotel_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('hotel_user');
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem('hotel_user'));
  } catch (e) {
    return null;
  }
}

function redirectToRolePage(role) {
  if (role === 'admin') window.location.href = 'admin.html';
  else if (role === 'receptionist') window.location.href = 'receptionist.html';
  else if (role === 'guest') window.location.href = 'guest.html';
  else window.location.href = 'login.html';
}

/* ----------------------
   Navigation handling
   ---------------------- */
function setupNav(pageRootId) {
  const root = document.getElementById(pageRootId);
  if (!root) return;

  const navItems = document.querySelectorAll('.sidebar .nav li');
  navItems.forEach(li => {
    li.addEventListener('click', () => {
      const key = li.getAttribute('data-nav');

      // special-case logout: clear session + redirect to login
      if (key === 'logout') {
        clearSession();
        window.location.href = 'login.html';
        return;
      }

      navItems.forEach(i => i.classList.remove('active'));
      li.classList.add('active');

      const sections = root.querySelectorAll('.page-section');
      sections.forEach(s => s.classList.add('hidden'));

      const target = root.querySelector('#' + key);
      if (target) target.classList.remove('hidden');
    });
  });
}

/* ----------------------
   Render functions (same as before)
   ---------------------- */
function renderAdmin() {
  if (!document.getElementById('page-admin')) return;
  const d = sample.admin;
  document.getElementById('total-guests').textContent = d.totals.guests;
  document.getElementById('rooms-occupied').textContent = d.totals.roomsOccupied;
  document.getElementById('daily-revenue').textContent = d.totals.revenue;
  document.getElementById('pending-payments').textContent = d.totals.pending;

  const bTbody = document.querySelector('#admin-booking-table tbody');
  bTbody.innerHTML = '';
  d.bookings.forEach(b => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${b.id}</td><td>${b.guest}</td><td>${b.room}</td><td>${b.checkin}</td><td>${b.checkout}</td><td>${b.status}</td>`;
    bTbody.appendChild(tr);
  });

  const uTbody = document.querySelector('#admin-user-table tbody');
  uTbody.innerHTML = '';
  d.users.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${u.id}</td><td>${u.name}</td><td>${u.role}</td><td>${u.status}</td>`;
    uTbody.appendChild(tr);
  });

  const pTbody = document.querySelector('#admin-payment-table tbody');
  pTbody.innerHTML = '';
  d.payments.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.txn}</td><td>${p.guest}</td><td>${p.amount}</td><td>${p.mode}</td><td>${p.status}</td>`;
    pTbody.appendChild(tr);
  });

  setupNav('page-admin');
}

function renderReceptionist() {
  if (!document.getElementById('page-receptionist')) return;
  const r = sample.receptionist;
  document.getElementById('today-bookings').textContent = r.summary.todayBookings;
  document.getElementById('rooms-available').textContent = r.summary.available;
  document.getElementById('checked-in').textContent = r.summary.checkedIn;
  document.getElementById('checkins-pending').textContent = r.summary.pending;

  const resT = document.querySelector('#receptionist-reservation-table tbody');
  resT.innerHTML = '';
  r.reservations.forEach(x => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${x.id}</td><td>${x.guest}</td><td>${x.type}</td><td>${x.checkin}</td><td>${x.checkout}</td><td>${x.status}</td>`;
    resT.appendChild(tr);
  });

  const hist = document.getElementById('receptionist-history-list');
  hist.innerHTML = '';
  r.historyList.forEach(item => {
    const li = document.createElement('li'); li.textContent = item; hist.appendChild(li);
  });

  const guestTb = document.querySelector('#receptionist-guest-table tbody');
  guestTb.innerHTML = '';
  r.guests.forEach(g => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${g.id}</td><td>${g.name}</td><td>${g.contact}</td><td>${g.email}</td><td>${g.nationality}</td>`;
    guestTb.appendChild(tr);
  });

  const roomTb = document.querySelector('#receptionist-rooms-table tbody');
  roomTb.innerHTML = '';
  r.rooms.forEach(room => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${room.no}</td><td>${room.type}</td><td>${room.rate}</td><td>${room.status}</td>`;
    roomTb.appendChild(tr);
  });

  const payTb = document.querySelector('#receive-pay-table tbody');
  payTb.innerHTML = '';
  r.pendingPayments.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.id}</td><td>${p.guest}</td><td>${p.amount}</td><td><button class="btn" data-pid="${p.id}">Receive Payment</button></td>`;
    payTb.appendChild(tr);
  });

  // hook up receive payment action (rebind)
  document.querySelectorAll('#receive-pay-table .btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      alert('Payment received for ' + btn.dataset.pid);
      btn.textContent = 'Received';
      btn.disabled = true;
    });
  });

  setupNav('page-receptionist');
}

function renderGuest() {
  if (!document.getElementById('page-guest')) return;
  const g = sample.guest;
  document.getElementById('guest-upcoming').textContent = g.upcoming.booking;
  document.getElementById('guest-stays').textContent = g.profile.stays;
  document.getElementById('guest-points').textContent = g.profile.points;
  document.getElementById('guest-contact').textContent = g.profile.contact;
  document.getElementById('guest-email').textContent = g.profile.email;
  document.getElementById('guest-current-booking').textContent = 'Booking ID: B00126 — Room 205 — Active';

  const roomsT = document.querySelector('#guest-rooms-table tbody');
  roomsT.innerHTML = '';
  g.rooms.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.type}</td><td>${r.desc}</td><td>${r.price}</td><td>${r.status}</td>`;
    roomsT.appendChild(tr);
  });

  const payT = document.querySelector('#guest-payments-table tbody');
  payT.innerHTML = '';
  g.payments.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.booking}</td><td>${p.amount}</td><td>${p.mode}</td><td>${p.status}</td>`;
    payT.appendChild(tr);
  });

  // reservation select options
  const sel = document.getElementById('res-roomtype');
  if (sel) {
    sel.innerHTML = '';
    g.rooms.forEach(r => {
      const opt = document.createElement('option'); opt.value = r.type; opt.textContent = `${r.type} — ${r.price}`;
      sel.appendChild(opt);
    });

    const form = document.getElementById('reservation-form');
    if (form) {
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const rt = document.getElementById('res-roomtype').value;
        const ci = document.getElementById('res-checkin').value;
        const co = document.getElementById('res-checkout').value;
        const guests = document.getElementById('res-guests').value;
        const resResult = document.getElementById('res-result');
        if (!ci || !co) {
          resResult.textContent = 'Please choose check-in and check-out dates.';
          resResult.classList.remove('hidden');
          return;
        }
        resResult.textContent = `Reservation requested: ${rt} from ${ci} to ${co} for ${guests} guest(s). (This is a static demo.)`;
        resResult.classList.remove('hidden');
      });
    }
  }

  setupNav('page-guest');
}

/* ----------------------
   Login page handling
   ---------------------- */
function initLoginPage() {
  const form = document.getElementById('login-form');
  if (!form) return;

  const errBox = document.getElementById('login-error');
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const uname = document.getElementById('username').value.trim();
    const pwd = document.getElementById('password').value;
    const role = document.getElementById('role').value;

    // simple validation: match to demoUsers by username/password & role
    const match = demoUsers.find(u => u.username === uname && u.password === pwd && u.role === role);
    if (!match) {
      errBox.textContent = 'Invalid credentials for the selected role. Try demo usernames: admin/admin, reception/reception, guest/guest.';
      errBox.classList.remove('hidden');
      return;
    }

    // save a minimal session and redirect
    const sess = { username: match.username, role: match.role, displayName: match.displayName, loggedAt: Date.now() };
    saveSession(sess);
    redirectToRolePage(match.role);
  });

  // auto-fill demo if you want: (not required)
  document.getElementById('username').value = 'admin';
  document.getElementById('password').value = 'admin';
  document.getElementById('role').value = 'admin';
}

/* ----------------------
   Auto-redirect if already logged in
   ---------------------- */
function autoRedirectIfLoggedIn() {
  const s = getSession();
  if (!s) return;

  // If user is on login.html, redirect to their page
  if (window.location.pathname.endsWith('login.html') || window.location.pathname === '/' ) {
    redirectToRolePage(s.role);
  }
}

/* ----------------------
   Entry point
   ---------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // If on login page: init login
  initLoginPage();
  autoRedirectIfLoggedIn();

  // Render pages (only the ones present in DOM will run)
  renderAdmin();
  renderReceptionist();
  renderGuest();

  // small convenience: search inputs (demo: filters bookings by guest name)
  const adminSearch = document.getElementById('admin-search');
  if (adminSearch) {
    adminSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const rows = document.querySelectorAll('#admin-booking-table tbody tr');
      rows.forEach(r => {
        const txt = r.textContent.toLowerCase();
        r.style.display = txt.includes(q) ? '' : 'none';
      });
    });
  }

  const recSearch = document.getElementById('receptionist-search');
  if (recSearch) {
    recSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const rows = document.querySelectorAll('#receptionist-reservation-table tbody tr');
      rows.forEach(r => {
        const txt = r.textContent.toLowerCase();
        r.style.display = txt.includes(q) ? '' : 'none';
      });
    });
  }

  const guestSearch = document.getElementById('guest-search');
  if (guestSearch) {
    guestSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const rows = document.querySelectorAll('#guest-rooms-table tbody tr');
      rows.forEach(r => {
        const txt = r.textContent.toLowerCase();
        r.style.display = txt.includes(q) ? '' : 'none';
      });
    });
  }
});
