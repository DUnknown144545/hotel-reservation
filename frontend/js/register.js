
    // Password strength indicator
    const passwordInput = document.getElementById('password');
    const strengthIndicator = document.getElementById('passwordStrength');

    passwordInput.addEventListener('input', function() {
      const password = this.value;
      if (password.length === 0) {
        strengthIndicator.classList.remove('show');
        return;
      }

      strengthIndicator.classList.add('show');
      
      if (password.length < 6) {
        strengthIndicator.textContent = '⚠️ Too short';
        strengthIndicator.className = 'password-strength show weak';
      } else if (password.length < 10) {
        strengthIndicator.textContent = '✓ Good password';
        strengthIndicator.className = 'password-strength show medium';
      } else {
        strengthIndicator.textContent = '✓ Strong password';
        strengthIndicator.className = 'password-strength show strong';
      }
    });

    async function register() {
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();
      const confirmPassword = document.getElementById("confirmPassword").value.trim();
      const role = document.getElementById("role").value;

      if (!username || !password || !confirmPassword) {
        alert("Please fill in all fields");
        return;
      }

      if (password !== confirmPassword) {
        alert("Passwords do not match");
        return;
      }

      if (password.length < 6) {
        alert("Password must be at least 6 characters long");
        return;
      }

      try {
        const response = await fetch('http://localhost:3000/api/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, password, role })
        });

        const data = await response.json();

        if (data.success) {
          alert(`Registered successfully as ${role}! Please login.`);
          window.location.href = "index.html";
        } else {
          alert(data.message);
        }
      } catch (error) {
        console.error('Registration error:', error);
        alert("Connection error. Make sure the server is running.");
      }
    }

    document.addEventListener('keypress', function (event) {
      if (event.key === 'Enter') {
        register();
      }
    });