/* Enhanced Authentication System for Market Pulse Trading Platform
   Features: Client-side hashing, session management, demo accounts
   Note: This is for prototype/demo purposes only
*/

const USERS_KEY = "market_pulse_users";
const SESSION_KEY = "market_pulse_session";
const DEMO_USER_KEY = "market_pulse_demo";

// Utility Functions
async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch (error) {
    console.error("Error parsing users data:", error);
    return [];
  }
}

function setUsers(users) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (error) {
    console.error("Error saving users data:", error);
  }
}

function setSession(user) {
  try {
    const sessionData = {
      user: {
        fullName: user.fullName,
        email: user.email,
        isDemo: user.isDemo || false,
        loginTime: new Date().toISOString()
      },
      timestamp: Date.now()
    };
    
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    
    // Show success message with animation
    showSuccessMessage(user.isDemo ? "Demo account activated!" : `Welcome back, ${user.fullName}!`);
    
    // Redirect after short delay for better UX
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1200);
    
  } catch (error) {
    console.error("Error setting session:", error);
    alert("Session error. Please try again.");
  }
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  
  return {
    isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers,
    message: password.length < minLength 
      ? "Password must be at least 8 characters long"
      : !hasUpperCase || !hasLowerCase
      ? "Password must contain both uppercase and lowercase letters"
      : !hasNumbers
      ? "Password must contain at least one number"
      : ""
  };
}

function showSuccessMessage(message) {
  // Create success overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  
  const successBox = document.createElement('div');
  successBox.style.cssText = `
    background: white;
    padding: 32px;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    text-align: center;
    max-width: 320px;
    transform: scale(0.8);
    transition: transform 0.3s ease;
  `;
  
  successBox.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
    <h3 style="color: #10b981; font-size: 18px; font-weight: 600; margin: 0 0 8px 0;">${message}</h3>
    <p style="color: #6b7280; font-size: 14px; margin: 0;">Redirecting to dashboard...</p>
  `;
  
  overlay.appendChild(successBox);
  document.body.appendChild(overlay);
  
  // Animate in
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    successBox.style.transform = 'scale(1)';
  });
  
  // Remove after delay
  setTimeout(() => {
    overlay.style.opacity = '0';
    successBox.style.transform = 'scale(0.8)';
    setTimeout(() => overlay.remove(), 300);
  }, 1000);
}

function showError(message, inputId = null) {
  // Remove existing error
  const existingError = document.querySelector('.error-message');
  if (existingError) existingError.remove();
  
  // Create error message
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.style.cssText = `
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #dc2626;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    margin-bottom: 16px;
    animation: slideDown 0.3s ease;
  `;
  
  errorDiv.textContent = message;
  
  // Add error animation keyframes
  if (!document.querySelector('#error-animations')) {
    const style = document.createElement('style');
    style.id = 'error-animations';
    style.textContent = `
      @keyframes slideDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Insert error message
  const form = document.querySelector('form');
  form.insertBefore(errorDiv, form.firstChild);
  
  // Highlight problematic input
  if (inputId) {
    const input = document.getElementById(inputId);
    if (input) {
      input.style.borderColor = '#ef4444';
      input.focus();
      
      // Remove error styling on input
      const removeErrorStyling = () => {
        input.style.borderColor = '';
        input.removeEventListener('input', removeErrorStyling);
        if (errorDiv.parentNode) errorDiv.remove();
      };
      
      input.addEventListener('input', removeErrorStyling);
    }
  }
  
  // Auto-remove error after 5 seconds
  setTimeout(() => {
    if (errorDiv.parentNode) errorDiv.remove();
  }, 5000);
}

function addLoadingState(button, isLoading = true) {
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
        <path d="M21 12a9 9 0 11-6.219-8.56"/>
      </svg>
      Processing...
    `;
    
    // Add spin animation
    if (!document.querySelector('#loading-animations')) {
      const style = document.createElement('style');
      style.id = 'loading-animations';
      style.textContent = `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
}

// Login Form Handler
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    addLoadingState(submitBtn, true);
    
    try {
      const email = document.getElementById("email").value.trim().toLowerCase();
      const password = document.getElementById("password").value;
      
      // Validation
      if (!validateEmail(email)) {
        throw new Error("Please enter a valid email address");
      }
      
      if (!password) {
        throw new Error("Please enter your password");
      }
      
      // Check for demo credentials
      if (email === 'demo@marketpulse.com' && password === 'demo123456') {
        const demoUser = {
          fullName: 'Demo User',
          email: 'demo@marketpulse.com',
          isDemo: true
        };
        setSession(demoUser);
        return;
      }
      
      const users = getUsers();
      const user = users.find(u => u.email === email);
      
      if (!user) {
        throw new Error("Invalid email or password");
      }
      
      const passwordHash = await sha256(password);
      if (user.password !== passwordHash) {
        throw new Error("Invalid email or password");
      }
      
      setSession({
        fullName: user.fullName,
        email: user.email,
        isDemo: false
      });
      
    } catch (error) {
      showError(error.message, "email");
      addLoadingState(submitBtn, false);
    }
  });
}

// Signup Form Handler
const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    addLoadingState(submitBtn, true);
    
    try {
      const firstName = document.getElementById("firstName").value.trim();
      const lastName = document.getElementById("lastName").value.trim();
      const email = document.getElementById("sEmail").value.trim().toLowerCase();
      const password = document.getElementById("sPassword").value;
      const confirmPassword = document.getElementById("sConfirm").value;
      const termsAccepted = document.getElementById("terms").checked;
      
      // Validation
      if (!firstName || firstName.length < 2) {
        throw new Error("First name must be at least 2 characters long");
      }
      
      if (!lastName || lastName.length < 2) {
        throw new Error("Last name must be at least 2 characters long");
      }
      
      if (!validateEmail(email)) {
        throw new Error("Please enter a valid email address");
      }
      
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.message);
      }
      
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }
      
      if (!termsAccepted) {
        throw new Error("Please accept the Terms of Service and Privacy Policy");
      }
      
      const users = getUsers();
      if (users.some(u => u.email === email)) {
        throw new Error("An account with this email already exists");
      }
      
      // Create new user
      const passwordHash = await sha256(password);
      const newUser = {
        id: Date.now().toString(),
        fullName: `${firstName} ${lastName}`,
        firstName,
        lastName,
        email,
        password: passwordHash,
        createdAt: new Date().toISOString(),
        isVerified: true // Auto-verify for demo
      };
      
      users.push(newUser);
      setUsers(users);
      
      showSuccessMessage("Account created successfully!");
      
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1200);
      
    } catch (error) {
      showError(error.message);
      addLoadingState(submitBtn, false);
    }
  });
}

// Initialize demo data if needed
function initializeDemoData() {
  const users = getUsers();
  
  // Add demo user if not exists
  if (!users.some(u => u.email === 'demo@marketpulse.com')) {
    const demoUsers = [
      {
        id: 'demo1',
        fullName: 'Demo User',
        firstName: 'Demo',
        lastName: 'User',
        email: 'demo@marketpulse.com',
        password: '6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090', // demo123456
        createdAt: new Date().toISOString(),
        isDemo: true,
        isVerified: true
      }
    ];
    
    setUsers([...users, ...demoUsers]);
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  initializeDemoData();
  
  // Add form enhancements
  const inputs = document.querySelectorAll('.form-input');
  inputs.forEach(input => {
    // Real-time validation feedback
    input.addEventListener('input', function() {
      if (this.type === 'email' && this.value) {
        if (!validateEmail(this.value)) {
          this.style.borderColor = '#fbbf24';
        } else {
          this.style.borderColor = '#10b981';
        }
      }
      
      if (this.type === 'password' && this.value) {
        const validation = validatePassword(this.value);
        this.style.borderColor = validation.isValid ? '#10b981' : '#fbbf24';
      }
    });
    
    input.addEventListener('blur', function() {
      this.style.borderColor = '';
    });
  });
  
  // Password confirmation matching
  const passwordInput = document.getElementById('sPassword');
  const confirmInput = document.getElementById('sConfirm');
  
  if (passwordInput && confirmInput) {
    const checkPasswordMatch = () => {
      if (confirmInput.value && passwordInput.value !== confirmInput.value) {
        confirmInput.style.borderColor = '#ef4444';
      } else if (confirmInput.value) {
        confirmInput.style.borderColor = '#10b981';
      }
    };
    
    passwordInput.addEventListener('input', checkPasswordMatch);
    confirmInput.addEventListener('input', checkPasswordMatch);
  }
});