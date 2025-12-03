const API_URL = "http://localhost:3000/api";
const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");

if (!user || user.role !== "Admin") {
  alert("Access denied. Admin only.");
  window.location.href = "index.html";
}

document.getElementById("adminName").innerText = user.username || "Admin";

// central apiFetch that automatically includes x-user-id and handles JSON errors
async function apiFetch(url, options = {}) {
  options = options || {};
  options.headers = options.headers || {};
  options.headers["x-user-id"] = user.id;
  // default JSON content-type for non-FormData bodies
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !options.headers["Content-Type"]
  ) {
    options.headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, options);
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    // try JSON error body first
    try {
      const json = ct.includes("application/json") ? await res.json() : null;
      throw new Error(
        json && json.message ? json.message : `HTTP ${res.status}`
      );
    } catch (err) {
      const text = await res.text().catch(() => "<no body>");
      throw new Error(`HTTP ${res.status} - ${text}`);
    }
  }
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

// Initialize on DOM loaded
document.addEventListener("DOMContentLoaded", () => {
  loadDashboardStats();
  generateCalendar();
  loadReports();
});

function showSection(id, el) {
  document
    .querySelectorAll("section")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document
    .querySelectorAll(".sidebar a")
    .forEach((a) => a.classList.remove("active"));
  if (el) el.classList.add("active");

  if (id === "users") loadUsers();
  if (id === "rooms") loadRooms();
  if (id === "bookings") loadAllBookings();
  if (id === "reports") loadReports();
}

function logout() {
  localStorage.removeItem("loggedInUser");
  window.location.href = "index.html";
}

// Dashboard Stats
async function loadDashboardStats() {
  try {
    const data = await apiFetch(`${API_URL}/dashboard/stats`);
    if (data && data.success && data.stats) {
      document.getElementById("stat-total-rooms").textContent =
        data.stats.total_rooms ?? 0;
      document.getElementById("stat-occupied").textContent =
        data.stats.occupied_rooms ?? 0;
      document.getElementById("stat-guests").textContent =
        data.stats.current_guests ?? 0;
      document.getElementById("stat-revenue").textContent =
        "₱ " + (parseFloat(data.stats.monthly_revenue) || 0).toFixed(2);
    }
  } catch (error) {
    console.error("Error loading dashboard stats:", error);
  }
}

// User Management
async function loadUsers() {
  const container = document.getElementById("users-container");
  container.innerHTML = '<div class="loading">Loading users...</div>';

  try {
    const data = await apiFetch(`${API_URL}/users`);
    if (data && data.success) {
      displayUsers(data.users);
    } else {
      container.innerHTML =
        '<div class="empty-state"><i class="fa-solid fa-exclamation-circle"></i><p>Error loading users</p></div>';
    }
  } catch (error) {
    console.error("Error loading users:", error);
    container.innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-exclamation-circle"></i><p>Network error</p></div>';
  }
}

function displayUsers(users) {
  const container = document.getElementById("users-container");
  if (!users || users.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-users"></i><p>No users found</p></div>';
    return;
  }

  let html = `
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th>Registered</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
      `;

  users.forEach((u) => {
    const status = u.status || "Pending";
    const statusClass = `status-${status.toLowerCase()}`;
    const registeredDate = u.created_at
      ? new Date(u.created_at).toLocaleDateString()
      : "-";

    let actions = "";
    if (u.role !== "Admin") {
      if (status === "Pending") {
        actions = `
              <button class="action-btn btn-accept" onclick="updateUserStatus(${u.id}, 'Accepted')">
                <i class="fa-solid fa-check"></i> Accept
              </button>
              <button class="action-btn btn-decline" onclick="updateUserStatus(${u.id}, 'Declined')">
                <i class="fa-solid fa-times"></i> Decline
              </button>
            `;
      } else if (status === "Declined") {
        actions = `
              <button class="action-btn btn-accept" onclick="updateUserStatus(${u.id}, 'Accepted')">
                <i class="fa-solid fa-check"></i> Accept
              </button>
            `;
      } else {
        actions = `
              <button class="action-btn btn-decline" onclick="updateUserStatus(${u.id}, 'Declined')">
                <i class="fa-solid fa-ban"></i> Decline
              </button>
            `;
      }
    } else {
      actions = '<span style="color: #999;">Admin Account</span>';
    }

    html += `
          <tr>
            <td><strong>#${u.id}</strong></td>
            <td>${u.username}</td>
            <td><i class="fa-solid fa-user"></i> ${u.role}</td>
            <td><span class="status-badge ${statusClass}">${status}</span></td>
            <td>${registeredDate}</td>
            <td>${actions}</td>
          </tr>
        `;
  });

  html += "</tbody></table>";
  container.innerHTML = html;
}

async function updateUserStatus(userId, status) {
  const confirmMsg = `Are you sure you want to ${status.toLowerCase()} this user?`;
  if (!confirm(confirmMsg)) return;

  try {
    const data = await apiFetch(`${API_URL}/users/status/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });

    if (data && data.success) {
      alert(data.message);
      loadUsers();
    } else {
      alert(data.message || "Failed updating status");
    }
  } catch (error) {
    console.error("Error updating user status:", error);
    alert("Error updating user status");
  }
}

// Room Management
async function loadRooms() {
  const container = document.getElementById("rooms-container");
  container.innerHTML = '<div class="loading">Loading rooms...</div>';

  try {
    const data = await apiFetch(`${API_URL}/rooms`);
    if (data && data.success) {
      displayRooms(data.rooms);
    } else {
      container.innerHTML =
        '<div class="empty-state"><i class="fa-solid fa-exclamation-circle"></i><p>Error loading rooms</p></div>';
    }
  } catch (error) {
    console.error("Error loading rooms:", error);
    container.innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-exclamation-circle"></i><p>Network error</p></div>';
  }
}

function displayRooms(rooms) {
  const container = document.getElementById("rooms-container");
  if (!rooms || rooms.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-bed"></i><p>No rooms found</p></div>';
    return;
  }

  let html = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Room No.</th>
              <th>Type</th>
              <th>Price/Night</th>
              <th>Status</th>
              <th>Capacity</th>
              <th>Floor</th>
              <th>Size (sqm)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
      `;

  rooms.forEach((room) => {
    const status = room.status || "Available";
    const statusClass =
      status === "Available"
        ? "status-accepted"
        : status === "Occupied"
        ? "status-pending"
        : "status-declined";
    const roomData = JSON.stringify(room).replace(/"/g, "&quot;");

    html += `
          <tr>
            <td><strong>${room.room_number}</strong></td>
            <td>${room.room_type}</td>
            <td>${parseFloat(room.price || 0).toFixed(2)}</td>
            <td><span class="status-badge ${statusClass}">${status}</span></td>
            <td>${room.capacity || "-"}</td>
            <td>${room.floor_number || "-"}</td>
            <td>${room.size_sqm || "-"}</td>
            <td>
              <button class="action-btn btn-view" onclick='editRoom(${roomData})'>
                <i class="fa-solid fa-edit"></i> Edit
              </button>
              <button class="action-btn btn-decline" onclick="deleteRoom(${
                room.id
              }, '${room.room_number}')">
                <i class="fa-solid fa-trash"></i> Delete
              </button>
            </td>
          </tr>
        `;
  });

  html += "</tbody></table>";
  container.innerHTML = html;
}

function openAddRoomModal() {
  document.getElementById("roomModalTitle").textContent = "Add New Room";
  document.getElementById("roomForm").reset();
  document.getElementById("roomId").value = "";
  document.getElementById("roomImagePreview").style.display = "none";
  document.getElementById("roomModal").style.display = "block";
}

function editRoom(room) {
  document.getElementById("roomModalTitle").textContent =
    "Edit Room " + (room.room_number || "");
  document.getElementById("roomId").value = room.id || "";
  document.getElementById("roomNumber").value = room.room_number || "";
  document.getElementById("roomType").value = room.room_type || "";
  document.getElementById("roomPrice").value = room.price || "";
  document.getElementById("roomStatus").value = room.status || "Available";
  document.getElementById("roomCapacity").value = room.capacity || "";
  document.getElementById("roomFloor").value = room.floor_number || "";
  document.getElementById("roomSize").value = room.size_sqm || "";
  document.getElementById("roomDescription").value = room.description || "";
  document.getElementById("roomAmenities").value = room.amenities || "";
  document.getElementById("roomImage").value =
    room.image_data || room.image_url || "";

  if (room.image_data || room.image_url) {
    document.getElementById("roomImagePreview").src =
      room.image_data || room.image_url;
    document.getElementById("roomImagePreview").style.display = "block";
  } else {
    document.getElementById("roomImagePreview").style.display = "none";
  }

  document.getElementById("roomModal").style.display = "block";
}

function closeRoomModal() {
  document.getElementById("roomModal").style.display = "none";
}

async function saveRoom(event) {
  event.preventDefault();

  const roomId = document.getElementById("roomId").value;
  const roomData = {
    room_number: document.getElementById("roomNumber").value,
    room_type: document.getElementById("roomType").value,
    price: parseFloat(document.getElementById("roomPrice").value) || 0,
    status: document.getElementById("roomStatus").value,
    capacity: document.getElementById("roomCapacity").value || null,
    floor_number: document.getElementById("roomFloor").value || null,
    size_sqm: document.getElementById("roomSize").value || null,
    description: document.getElementById("roomDescription").value || null,
    amenities: document.getElementById("roomAmenities").value || null,
    image_data: document.getElementById("roomImage").value || null,
  };

  try {
    const url = roomId ? `${API_URL}/rooms/${roomId}` : `${API_URL}/rooms`;
    const method = roomId ? "PUT" : "POST";

    const data = await apiFetch(url, {
      method,
      body: JSON.stringify(roomData),
    });
    if (data && data.success) {
      alert(data.message);
      closeRoomModal();
      loadRooms();
      loadDashboardStats();
    } else {
      alert(data.message || "Error saving room");
    }
  } catch (error) {
    console.error("Error saving room:", error);
    alert("Error saving room. Please try again.");
  }
}

async function deleteRoom(roomId, roomNumber) {
  if (!confirm(`Are you sure you want to delete Room ${roomNumber}?`)) return;

  try {
    const data = await apiFetch(`${API_URL}/rooms/${roomId}`, {
      method: "DELETE",
    });
    if (data && data.success) {
      alert(data.message);
      loadRooms();
      loadDashboardStats();
    } else {
      alert(data.message || "Error deleting room");
    }
  } catch (error) {
    console.error("Error deleting room:", error);
    alert("Error deleting room. Please try again.");
  }
}

// Image preview
document.addEventListener("DOMContentLoaded", function () {
  const imageInput = document.getElementById("roomImage");
  if (imageInput) {
    imageInput.addEventListener("input", function () {
      const preview = document.getElementById("roomImagePreview");
      if (this.value) {
        preview.src = this.value;
        preview.style.display = "block";
        preview.onerror = function () {
          this.style.display = "none";
        };
      } else {
        preview.style.display = "none";
      }
    });
  }
});

// All Bookings
async function loadAllBookings() {
  const container = document.getElementById("bookings-container");
  container.innerHTML = '<div class="loading">Loading bookings...</div>';

  try {
    const data = await apiFetch(`${API_URL}/bookings`);
    if (data && data.success) {
      displayAllBookings(data.bookings);
    } else {
      container.innerHTML =
        '<div class="empty-state"><i class="fa-solid fa-calendar-xmark"></i><p>Error loading bookings</p></div>';
    }
  } catch (error) {
    console.error("Error loading bookings:", error);
    container.innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-exclamation-circle"></i><p>Network error</p></div>';
  }
}

function displayAllBookings(bookings) {
  const container = document.getElementById("bookings-container");
  if (!bookings || bookings.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-calendar"></i><p>No bookings found</p></div>';
    return;
  }

  let html = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>Guest Name</th>
              <th>Room</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Payment</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
      `;

  bookings.forEach((booking) => {
    const status = booking.status || "Pending";
    const paymentStatus = booking.payment_status || "Unpaid";

    html += `
          <tr>
            <td><strong>#${booking.id}</strong></td>
            <td>${booking.guest_name || "-"}</td>
            <td>${booking.room_number || "N/A"} (${
      booking.room_type || "-"
    })</td>
            <td>${
              booking.checkin_date
                ? new Date(booking.checkin_date).toLocaleDateString()
                : "-"
            }</td>
            <td>${
              booking.checkout_date
                ? new Date(booking.checkout_date).toLocaleDateString()
                : "-"
            }</td>
            <td><span class="status-badge ${
              paymentStatus === "Paid" ? "status-accepted" : "status-pending"
            }">${paymentStatus}</span></td>
            <td><span class="status-badge ${
              status === "Checked In"
                ? "status-accepted"
                : status === "Pending"
                ? "status-pending"
                : "status-declined"
            }">${status}</span></td>
          </tr>
        `;
  });

  html += "</tbody></table>";
  container.innerHTML = html;
}

// Reports
async function loadReports() {
  try {
    const [bookingsData, usersData, statsData] = await Promise.all([
      apiFetch(`${API_URL}/bookings`),
      apiFetch(`${API_URL}/users`),
      apiFetch(`${API_URL}/dashboard/stats`),
    ]);

    if (bookingsData && bookingsData.success) {
      document.getElementById("report-bookings").textContent =
        bookingsData.bookings.length;
    }

    if (usersData && usersData.success) {
      document.getElementById("report-users").textContent =
        usersData.users.length;
    }

    if (statsData && statsData.success) {
      const total = Number(statsData.stats.total_rooms) || 0;
      const occ = Number(statsData.stats.occupied_rooms) || 0;
      const occupancyRate = total === 0 ? 0 : ((occ / total) * 100).toFixed(1);
      document.getElementById("report-occupancy").textContent =
        occupancyRate + "%";
    }

    // Load average rating for Reports (global)
    await loadAverageRating();
  } catch (error) {
    console.error("Error loading reports:", error);
  }
}

// Fetch and render average rating (global)
async function loadAverageRating() {
  try {
    const res = await apiFetch(`${API_URL}/ratings/summary`);
    if (!res || !res.success) {
      document.getElementById("report-rating").textContent = "- / 5";
      document.getElementById("report-rating-stars").innerHTML = "";
      return;
    }

    const summary = res.summary || { count: 0, avg_rating: null };
    const avg = summary.avg_rating
      ? Number(summary.avg_rating).toFixed(1)
      : "-";
    document.getElementById("report-rating").textContent = `${avg} / 5`;

    // render simple star icons (rounded to nearest 0.5)
    const starsContainer = document.getElementById("report-rating-stars");
    starsContainer.innerHTML = "";
    if (summary.avg_rating) {
      const value = Math.round(Number(summary.avg_rating) * 2) / 2; // nearest 0.5
      const fullStars = Math.floor(value);
      const halfStar = value - fullStars === 0.5;
      let starsHtml = "";
      for (let i = 0; i < fullStars; i++)
        starsHtml += '<i class="fa-solid fa-star"></i>';
      if (halfStar) starsHtml += '<i class="fa-solid fa-star-half-stroke"></i>';
      for (let i = fullStars + (halfStar ? 1 : 0); i < 5; i++)
        starsHtml += '<i class="fa-regular fa-star"></i>';
      starsContainer.innerHTML = `<div style="color:#f1c40f; font-size:12px;">${starsHtml}</div>`;
    } else {
      starsContainer.innerHTML =
        '<small style="color:#777;">No ratings yet</small>';
    }
  } catch (err) {
    console.error("Error loading average rating:", err);
    document.getElementById("report-rating").textContent = "- / 5";
    document.getElementById("report-rating-stars").innerHTML = "";
  }
}

// Calendar
function generateCalendar() {
  const today = new Date();
  const month = today.getMonth();
  const year = today.getFullYear();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  document.getElementById(
    "calendarTitle"
  ).innerText = `${monthNames[month]} ${year}`;

  const tbody = document.getElementById("calendarBody");
  tbody.innerHTML = "";

  let date = 1;
  for (let i = 0; i < 6; i++) {
    const row = document.createElement("tr");
    for (let j = 0; j < 7; j++) {
      const cell = document.createElement("td");
      if (i === 0 && j < startDay) {
        cell.textContent = "";
      } else if (date > totalDays) {
        cell.textContent = "";
      } else {
        cell.textContent = date;
        if (date === today.getDate()) {
          cell.classList.add("today");
        }
        date++;
      }
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }
}
