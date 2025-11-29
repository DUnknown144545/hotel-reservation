
    async function login() {
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();
      const role = document.getElementById("role").value;

      if (!username || !password) {
        alert("Please fill in all fields");
        return;
      }

      try {
        const response = await fetch('http://localhost:3000/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, password, role })
        });

        const data = await response.json();

        if (data.success) {
          localStorage.setItem("loggedInUser", JSON.stringify(data.user));

          if (data.user.role === "Admin") {
            window.location.href = "admin.html";
          } else if (data.user.role === "Receptionist") {
            window.location.href = "receptionist.html";
          } else {
            window.location.href = "guest.html";
          }
        } else {
          alert(data.message);
        }
      } catch (error) {
        console.error('Login error:', error);
        alert("Connection error. Make sure the server is running.");
      }
    }

    document.addEventListener('keypress', function (event) {
      if (event.key === 'Enter') {
        login();
      }
    });
