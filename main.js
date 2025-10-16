/******** UI EVENTS ********/
function closeOrderModal() { 
  const modal = document.getElementById("order-modal");
  if(modal) {
    modal.style.opacity = "0";
    setTimeout(() => {
      modal.classList.add("hidden");
      modal.style.opacity = "1";
    }, 200);
  }
}

function openOrderModal() {
  const modal = document.getElementById("order-modal");
  if(!modal) return;
  
  // Reset form
  const mPair = $("#m-pair");
  const quickPair = $("#quick-pair");
  
  if(mPair && quickPair) {
    mPair.value = quickPair.value || "BTCUSDT";
  }
  
  $("#m-type").value = "MARKET";
  $("#m-price-wrap")?.classList.add("hidden");
  
  ["m-price", "m-sl", "m-tp"].forEach(id => {
    const el = $(id);
    if(el) el.value = "";
  });
  
  const amountEl = $("#m-amount");
  const levEl = $("#m-lev");
  if(amountEl) amountEl.value = "5000";
  if(levEl) levEl.value = "5";
  
  modal.classList.remove("hidden");
  modal.style.opacity = "0";
  setTimeout(() => {
    modal.style.opacity = "1";
  }, 10);
}

// Enhanced event listeners with better UX
document.getElementById("open-order-modal")?.addEventListener("click", openOrderModal);
document.getElementById("modal-close")?.addEventListener("click", closeOrderModal);
document.getElementById("modal-cancel")?.addEventListener("click", closeOrderModal);

document.getElementById("m-type")?.addEventListener("change", (e) => {
  const priceWrap = $("#m-price-wrap");
  if(priceWrap) {
    priceWrap.classList.toggle("hidden", e.target.value === "MARKET");
  }
});

document.getElementById("place-order")?.addEventListener("click", (e) => {
  // Add loading state
  const btn = e.target;
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <div style="width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      Placing...
    </div>
  `;
  
  setTimeout(() => {
    placeOrder();
    btn.disabled = false;
    btn.innerHTML = originalText;
  }, 500);
});

// Enhanced click handlers
document.addEventListener("click", (e) => {
  // Close position buttons
  const closeBtn = e.target.closest("button.close-btn");
  if(closeBtn) {
    const id = Number(closeBtn.dataset.close);
    const position = state.positions.find(p => p.id === id);
    if(position) {
      const confirmText = `Close position #${id} (${humanLabel(position.pair)})?`;
      if(confirm(confirmText)) {
        closeBtn.style.transform = "scale(0.95)";
        setTimeout(() => {
          closeBtn.style.transform = "scale(1)";
          closePosition(id, 100, "Manual", false);
        }, 150);
      }
    }
  }
  
  // Partial close buttons
  const partialBtn = e.target.closest("button.close-partial");
  if(partialBtn) {
    const id = Number(partialBtn.dataset.id);
    const row = partialBtn.closest("tr");
    const sel = row?.querySelector(".pctSel");
    const val = Number(sel?.value || 50);
    
    partialBtn.style.transform = "scale(0.95)";
    setTimeout(() => {
      partialBtn.style.transform = "scale(1)";
      closePosition(id, val, "Partial Close", false);
    }, 150);
  }
  
  // Cancel order buttons
  const cancelBtn = e.target.closest("button[data-cancel]");
  if(cancelBtn) {
    const oid = Number(cancelBtn.dataset.cancel);
    const order = state.pending.find(o => o.oid === oid);
    if(order && confirm(`Cancel ${order.type} order for ${humanLabel(order.pair)}?`)) {
      const idx = state.pending.findIndex(o => o.oid === oid);
      if(idx !== -1) { 
        state.pending.splice(idx, 1); 
        save(); 
        showNotification("Order Cancelled", `${order.type} order cancelled`, "info");
      }
    }
  }
});

// Enhanced portfolio actions
document.getElementById("reset-portfolio")?.addEventListener("click", () => {
  const confirmText = "⚠️ This will reset your portfolio to $100,000 and clear all positions, orders, and history. This cannot be undone. Are you sure?";
  if(!confirm(confirmText)) return;
  
  // Close all websocket connections
  priceConnections.forEach(ws => {
    try { ws.close(); } catch(e) {}
  });
  priceConnections.clear();
  
  state = {balance: 100000, positions: [], pending: [], history: []};
  nextPosId = 1;
  nextOrderId = 1;
  save();
  
  showNotification("Portfolio Reset", "Portfolio reset to $100,000", "success");
  
  // Reinitialize connections
  setTimeout(() => {
    initCrypto();
  }, 1000);
});

document.getElementById("clear-history")?.addEventListener("click", () => {
  if(!confirm("Clear entire order history? This cannot be undone.")) return;
  
  state.history = [];
  save();
  showNotification("History Cleared", "All order history removed", "info");
});

document.getElementById("logout")?.addEventListener("click", () => {
  if(confirm("Are you sure you want to logout?")) {
    // Close connections
    priceConnections.forEach(ws => {
      try { ws.close(); } catch(e) {}
    });
    localStorage.removeItem("auth_user_demo");
    showNotification("Logged Out", "See you next time!", "info");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1000);
  }
});

document.getElementById("quick-pair")?.addEventListener("change", (e) => {
  loadTradingViewFor(e.target.value);
});

/******** ENHANCED ENGINE ********/
let tickCount = 0;

function tick() {
  tickCount++;
  
  // Update position P&L with smooth animations
  state.positions.forEach(p => {
    const cell = document.querySelector(`#positions-table tr[data-pid="${p.id}"] .pl-cell`);
    if(!cell) return;
    
    const C = getCurrentPriceById(p.pair);
    const {pl, pct} = pnlFor(p, C);
    
    // Add flash effect on significant changes
    const oldPL = parseFloat(cell.textContent.split('/')[0].replace(/[$,\s]/g, '')) || 0;
    const isSignificantChange = Math.abs(pl - oldPL) > Math.abs(oldPL * 0.01); // 1% change
    
    if(isSignificantChange) {
      cell.style.background = pl > oldPL ? 'var(--success-bg)' : 'var(--danger-bg)';
      setTimeout(() => {
        cell.style.background = '';
      }, 800);
    }
    
    cell.textContent = `${pl.toFixed(2)} / ${pct.toFixed(2)}%`;
    cell.style.color = pl >= 0 ? 'var(--success)' : 'var(--danger)';
  });
  
  renderMetrics();
  autoCloseChecks();
  processPending();
  evalAlerts();
  
  // Periodic connection health check
  if(tickCount % 30 === 0) {
    checkConnectionHealth();
  }
}

function checkConnectionHealth() {
  let deadConnections = 0;
  priceConnections.forEach((ws, symbol) => {
    if(ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      deadConnections++;
      // Attempt reconnection
      setTimeout(() => {
        try {
          const newWs = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`);
          priceConnections.set(symbol, newWs);
          setupWebSocketHandlers(newWs, symbol);
        } catch(e) {
          console.log("Reconnection failed:", e);
        }
      }, Math.random() * 5000); // Staggered reconnection
    }
  });
  
  if(deadConnections > 0) {
    console.log(`Reconnecting ${deadConnections} dead connections`);
  }
}

function setupWebSocketHandlers(ws, symbol) {
  const tb = $("#crypto-table tbody");
  
  ws.onmessage = (ev) => {
    try {
      const d = JSON.parse(ev.data);
      const price = parseFloat(d.c);
      const chg = parseFloat(d.P);
      const row = tb?.querySelector(`tr[data-feed="${symbol}"]`);
      
      if(!row) return;
      
      const priceCell = row.children[1];
      const changeCell = row.children[2];
      
      // Enhanced price animation
      const oldPrice = parseFloat(priceCell.textContent.replace(/[$,]/g, "")) || 0;
      const isUp = price > oldPrice;
      const isDown = price < oldPrice;
      
      if(isUp || isDown && oldPrice > 0) {
        row.style.background = isUp ? "var(--success-bg)" : "var(--danger-bg)";
        row.style.transform = "scale(1.01)";
        setTimeout(() => {
          row.style.background = "";
          row.style.transform = "scale(1)";
        }, 600);
      }
      
      priceCell.textContent = `${fmtUSD(price)}`;
      changeCell.textContent = `${isFinite(chg) ? chg.toFixed(2) : "0.00"}%`;
      changeCell.className = chg >= 0 ? "pl-pos" : "pl-neg";
      
    } catch(err) {
      console.log("Price update error:", err);
    }
  };
  
  ws.onerror = () => {
    const row = tb?.querySelector(`tr[data-feed="${symbol}"]`);
    if(row) {
      const indicator = row.querySelector("div div");
      if(indicator) {
        indicator.style.background = "var(--danger)";
        indicator.style.animation = "none";
      }
    }
  };
}

/******** NEWS ********/
async function loadNews() {
  const list = $("#news-list");
  if(!list) return;
  
  showLoading(list, "Loading market news...");
  
  try {
    const res = await fetch("https://min-api.cryptocompare.com/data/v2/news/?lang=EN", {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if(!res.ok) throw new Error("News API error");
    
    const data = await res.json();
    const items = (data.Data || []).slice(0, 6);
    
    if(items.length === 0) throw new Error("No news items");
    
    list.innerHTML = "";
    items.forEach((n, index) => {
      const li = document.createElement("li");
      li.style.opacity = "0";
      li.style.transform = "translateY(10px)";
      li.innerHTML = `
        <div style="width: 8px; height: 8px; background: var(--primary); border-radius: 50%; margin-top: 0.5rem; flex-shrink: 0;"></div>
        <div>
          <a href="${n.url}" target="_blank" rel="noopener" style="display: block; margin-bottom: 0.25rem; line-height: 1.4;">
            ${n.title}
          </a>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">
            ${new Date(n.published_on * 1000).toLocaleDateString()}
          </div>
        </div>
      `;
      list.appendChild(li);
      
      // Animate in
      setTimeout(() => {
        li.style.transition = "all 0.3s ease";
        li.style.opacity = "1";
        li.style.transform = "translateY(0)";
      }, index * 100);
    });
    
  } catch(err) {
    console.log("News loading failed:", err);
    list.innerHTML = `
      <li style="padding: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); margin-bottom: 0.5rem;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
          </svg>
          <span style="font-weight: 600;">Market Headlines</span>
        </div>
        <div style="font-size: 0.875rem; line-height: 1.5;">
          • Bitcoin and major cryptocurrencies show mixed trading signals<br>
          • US Dollar maintains strength against major forex pairs<br>
          • Federal Reserve policy decisions continue to impact global markets<br>
          • Institutional adoption of crypto assets accelerates
        </div>
      </li>
    `;
  }
}

/******** ALERTS ********/
function renderAlerts() {
  const ul = $("#alerts-list");
  if(!ul) return;
  
  if(alerts.length === 0) {
    ul.innerHTML = `
      <li style="padding: 1rem; text-align: center; color: var(--text-muted); border: 1px dashed var(--border); border-radius: var(--radius);">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 0.5rem;">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <div>No active alerts</div>
      </li>
    `;
    return;
  }
  
  ul.innerHTML = "";
  alerts.forEach((a, idx) => {
    const li = document.createElement("li");
    li.style.opacity = "0";
    li.style.transform = "translateY(5px)";
    
    const conditionColor = a.cond === "above" ? "var(--success)" : "var(--danger)";
    const repeatBadge = a.repeat === "once" ? "Once" : "Repeat";
    
    li.innerHTML = `
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
          <span style="font-weight: 600;">${humanLabel(a.pair)}</span>
          <span style="background: ${conditionColor}20; color: ${conditionColor}; padding: 0.125rem 0.375rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
            ${a.cond} ${a.price}
          </span>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">
          ${repeatBadge} • Created ${new Date().toLocaleDateString()}
        </div>
      </div>
      <button data-del-alert="${idx}" style="background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger); border-radius: 4px; padding: 0.25rem 0.5rem; font-size: 0.75rem; cursor: pointer;" title="Delete alert">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;
    ul.appendChild(li);
    
    // Animate in
    setTimeout(() => {
      li.style.transition = "all 0.2s ease";
      li.style.opacity = "1";
      li.style.transform = "translateY(0)";
    }, idx * 50);
  });
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-del-alert]");
  if(!b) return;
  
  const idx = Number(b.dataset.delAlert);
  const alert = alerts[idx];
  if(alert && confirm(`Delete alert for ${humanLabel(alert.pair)}?`)) {
    alerts.splice(idx, 1);
    saveAlerts();
    showNotification("Alert Deleted", `Alert for ${humanLabel(alert.pair)} removed`, "info");
  }
});

function openAlertsModal() { 
  const modal = document.getElementById("alerts-modal");
  if(modal) {
    modal.classList.remove("hidden");
    modal.style.opacity = "0";
    setTimeout(() => {
      modal.style.opacity = "1";
    }, 10);
  }
}

function closeAlertsModal() { 
  const modal = document.getElementById("alerts-modal");
  if(modal) {
    modal.style.opacity = "0";
    setTimeout(() => {
      modal.classList.add("hidden");
      modal.style.opacity = "1";
    }, 200);
  }
}

document.getElementById("open-alerts")?.addEventListener("click", openAlertsModal);
document.getElementById("alerts-close")?.addEventListener("click", closeAlertsModal);
document.getElementById("clear-alerts")?.addEventListener("click", () => {
  if(!confirm("Clear all price alerts?")) return;
  alerts = []; 
  saveAlerts();
  showNotification("Alerts Cleared", "All alerts removed", "info");
});

document.getElementById("add-alert")?.addEventListener("click", () => {
  const pair = $("#a-pair")?.value;
  const cond = $("#a-cond")?.value;
  const price = Number($("#a-price")?.value);
  const repeat = $("#a-repeat")?.value;
  
  if(!price || price <= 0) { 
    showNotification("Invalid Alert", "Enter a valid price", "error");
    return; 
  }
  
  alerts.push({pair, cond, price, repeat});
  saveAlerts();
  
  // Clear form
  const priceInput = $("#a-price");
  if(priceInput) priceInput.value = "";
  
  showNotification("Alert Added", `${humanLabel(pair)} ${cond} ${price}`, "success");
});

function evalAlerts() {
  alerts.forEach((a, idx) => {
    const c = getCurrentPriceById(a.pair); 
    if(!c) return;
    
    let triggered = false;
    if(a.cond === "above" && c >= a.price) triggered = true;
    if(a.cond === "below" && c <= a.price) triggered = true;
    
    if(triggered) {
      showNotification(
        "🔔 Price Alert", 
        `${humanLabel(a.pair)} ${a.cond === "above" ? "crossed above" : "crossed below"} ${a.price}`, 
        "warning", 
        8000
      );
      
      if(a.repeat === "once") { 
        alerts.splice(idx, 1); 
        saveAlerts(); 
      }
    }
  });
}

/******** ENHANCED TOAST SYSTEM ********/
// Override the original toast function with our enhanced version
function toast(title, msg) {
  showNotification(title, msg, "info");
}

/******** INITIALIZATION ********/
function init() {
  // Show loading screen
  const shell = $(".shell");
  if(shell) {
    shell.style.opacity = "0";
  }
  
  console.log("🚀 Initializing Pro Trader Dashboard...");
  
  buildWatchlist();
  initCrypto();
  fetchForex();
  populateSelectors();
  renderAll();
  renderAlerts();
  loadTradingViewFor("BTCUSDT");
  loadNews();
  
  // Start the engine
  setInterval(fetchForex, 60_000); // FX updates every minute
  setInterval(tick, 1_000); // Main tick every second
  
  // Fade in the interface
  setTimeout(() => {
    if(shell) {
      shell.style.transition = "opacity 0.5s ease";
      shell.style.opacity = "1";
    }
    
    showNotification(
      "🎯 Welcome to Pro Trader", 
      "Dashboard initialized successfully", 
      "success", 
      5000
    );
  }, 1500);
  
  console.log("✅ Dashboard ready!");
}

// Enhanced DOMContentLoaded with error handling
document.addEventListener("DOMContentLoaded", () => {
  try {
    init();
  } catch(error) {
    console.error("Initialization error:", error);
    showNotification(
      "Initialization Error", 
      "Some features may not work properly", 
      "error"
    );
  }
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  priceConnections.forEach(ws => {
    try { ws.close(); } catch(e) {}
  });
});

// Add error boundary for uncaught errors
window.addEventListener("error", (e) => {
  console.error("Runtime error:", e.error);
  showNotification("Error", "An unexpected error occurred", "error");
});

console.log("📈 Pro Trader Dashboard loaded successfully!");/******** AUTH GUARD ********/
(function guard(){
  const u = JSON.parse(localStorage.getItem("auth_user_demo") || "null");
  if(!u){ 
    window.location.href = "login.html"; 
    return; 
  }
  document.addEventListener("DOMContentLoaded", ()=> {
    const nm = document.getElementById("user-name");
    if(nm) {
      nm.textContent = u.fullName || u.email || "User";
      // Add welcome animation
      nm.style.opacity = "0";
      setTimeout(() => {
        nm.style.transition = "opacity 0.3s ease";
        nm.style.opacity = "1";
      }, 500);
    }
  });
})();

/******** THEME ********/
(function themeInit(){
  const key = "pt_theme";
  const saved = localStorage.getItem(key) || "dark";
  const html = document.documentElement;
  
  html.setAttribute("data-theme", saved);
  
  // Enhanced theme toggle with animation
  const themeToggle = document.getElementById("theme-toggle");
  if(themeToggle) {
    // Update icon based on theme
    function updateThemeIcon(theme) {
      const isDark = theme === "dark";
      themeToggle.innerHTML = isDark 
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
           </svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <circle cx="12" cy="12" r="5"></circle>
             <line x1="12" y1="1" x2="12" y2="3"></line>
             <line x1="12" y1="21" x2="12" y2="23"></line>
             <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
             <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
             <line x1="1" y1="12" x2="3" y2="12"></line>
             <line x1="21" y1="12" x2="23" y2="12"></line>
             <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
             <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
           </svg>`;
    }
    
    updateThemeIcon(saved);
    
    themeToggle.addEventListener("click", ()=>{
      const cur = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
      
      // Add transition class for smooth theme change
      html.style.transition = "all 0.3s ease";
      html.setAttribute("data-theme", cur);
      localStorage.setItem(key, cur);
      updateThemeIcon(cur);
      
      // Remove transition after change
      setTimeout(() => {
        html.style.transition = "";
      }, 300);
      
      showNotification("Theme Changed", `Switched to ${cur} mode`, "success");
    });
  }
})();

/******** ENHANCED NOTIFICATIONS ********/
function showNotification(title, message, type = "info", duration = 4000) {
  const toaster = document.getElementById("toaster");
  const notification = document.createElement("div");
  
  notification.className = `toast ${type}`;
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem;">
      <div class="icon">
        ${getNotificationIcon(type)}
      </div>
      <div style="flex: 1;">
        <div class="title">${title}</div>
        <div>${message}</div>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0.25rem;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `;
  
  // Add animation styles
  notification.style.transform = "translateX(400px)";
  notification.style.opacity = "0";
  
  toaster.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
    notification.style.transform = "translateX(0)";
    notification.style.opacity = "1";
  }, 10);
  
  // Auto remove
  setTimeout(() => {
    notification.style.transform = "translateX(400px)";
    notification.style.opacity = "0";
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

function getNotificationIcon(type) {
  const icons = {
    success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2">
                <polyline points="20,6 9,17 4,12"></polyline>
              </svg>`,
    error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>`,
    warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>`,
    info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2">
             <circle cx="12" cy="12" r="10"></circle>
             <path d="M12 16v-4"></path>
             <path d="M12 8h.01"></path>
           </svg>`
  };
  return icons[type] || icons.info;
}

/******** CONFIG ********/
// Crypto (Binance)
const cryptoMarkets = [
  { display:"BTC / USDT", feed:"BTCUSDT", tv:"BINANCE:BTCUSDT" },
  { display:"ETH / USDT", feed:"ETHUSDT", tv:"BINANCE:ETHUSDT" },
  { display:"BNB / USDT", feed:"BNBUSDT", tv:"BINANCE:BNBUSDT" },
  { display:"XRP / USDT", feed:"XRPUSDT", tv:"BINANCE:XRPUSDT" },
  { display:"SOL / USDT", feed:"SOLUSDT", tv:"BINANCE:SOLUSDT" },
  { display:"ADA / USDT", feed:"ADAUSDT", tv:"BINANCE:ADAUSDT" },
  { display:"DOGE / USDT", feed:"DOGEUSDT", tv:"BINANCE:DOGEUSDT" },
  { display:"MATIC / USDT", feed:"MATICUSDT", tv:"BINANCE:MATICUSDT" },
  { display:"DOT / USDT", feed:"DOTUSDT", tv:"BINANCE:DOTUSDT" },
  { display:"LTC / USDT", feed:"LTCUSDT", tv:"BINANCE:LTCUSDT" }
];

// Forex pairs
const forexPairs = ["EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","NZDUSD","USDCAD","EURGBP","EURJPY","GBPJPY"];

const STORAGE_KEY = "pt_state_orders_v4";
const ALERTS_KEY = "pt_alerts_v1";
const LIQUIDATION_LEVEL = 50; // %

/******** STATE ********/
let state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { 
  balance: 100000, 
  positions: [], 
  pending: [], 
  history: [] 
};
let nextPosId = state.positions.reduce((m,p) => Math.max(m, p.id), 0) + 1;
let nextOrderId = state.pending.reduce((m,o) => Math.max(m, o.oid), 0) + 1;
let alerts = JSON.parse(localStorage.getItem(ALERTS_KEY) || "[]");

// Enhanced selectors
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function save() { 
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); 
  renderAll(); 
}

function saveAlerts() { 
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts)); 
  renderAlerts(); 
}

function fmtUSD(n) { 
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }); 
}

function nowStr() { 
  return new Date().toLocaleString(); 
}

function humanLabel(code) {
  const m = cryptoMarkets.find(x => x.feed === code);
  if(m) return m.display;
  return `${code.slice(0,3)} / ${code.slice(3,6)}`;
}

/******** ENHANCED LOADING STATES ********/
function showLoading(element, message = "Loading...") {
  if(typeof element === "string") element = $(element);
  if(!element) return;
  
  element.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; padding: 2rem; gap: 0.75rem; color: var(--text-muted);">
      <div style="width: 20px; height: 20px; border: 2px solid var(--border); border-top: 2px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite;"></div>
      ${message}
    </div>
  `;
  
  // Add spin animation if not exists
  if(!document.querySelector("#spin-style")) {
    const style = document.createElement("style");
    style.id = "spin-style";
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}

function hideLoading(element) {
  if(typeof element === "string") element = $(element);
  if(!element) return;
  element.innerHTML = "";
}

/******** TABS ********/
document.addEventListener("click", (e) => {
  const b = e.target.closest(".tab-btn");
  if(!b) return;
  
  // Add smooth transition
  const currentPane = document.querySelector(".tab-pane.active");
  const targetPane = document.getElementById(b.dataset.tab);
  
  if(currentPane) {
    currentPane.style.opacity = "0";
    setTimeout(() => {
      $$(".tab-btn").forEach(x => x.classList.remove("active"));
      $$(".tab-pane").forEach(x => x.classList.remove("active"));
      
      b.classList.add("active");
      targetPane.classList.add("active");
      targetPane.style.opacity = "0";
      setTimeout(() => {
        targetPane.style.transition = "opacity 0.2s ease";
        targetPane.style.opacity = "1";
      }, 10);
    }, 100);
  }
});

/******** WATCHLIST + SEARCH ********/
function buildWatchlist() {
  const wl = $("#watchlist");
  if(!wl) return;
  
  showLoading(wl, "Loading watchlist...");
  
  setTimeout(() => {
    wl.innerHTML = "";
    const all = [
      ...cryptoMarkets.map(m => ({id: m.feed, label: m.display, type: "crypto"})),
      ...forexPairs.map(p => ({id: p, label: `${p.slice(0,3)} / ${p.slice(3,6)}`, type: "forex"}))
    ];
    
    all.forEach((x, index) => {
      const li = document.createElement("li");
      li.style.opacity = "0";
      li.style.transform = "translateY(10px)";
      li.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 0.75rem; padding: 0.25rem 0.5rem; background: var(--${x.type === 'crypto' ? 'primary' : 'secondary'}); color: white; border-radius: 4px; text-transform: uppercase; font-weight: 600;">
            ${x.type}
          </span>
          <span>${x.label}</span>
        </div>
        <button data-sym="${x.id}" style="padding: 0.5rem 0.75rem; background: var(--primary); color: white; border: none; border-radius: 6px; font-size: 0.75rem; font-weight: 500; transition: all 0.2s ease;">
          Chart
        </button>
      `;
      wl.appendChild(li);
      
      // Animate in with stagger
      setTimeout(() => {
        li.style.transition = "all 0.3s ease";
        li.style.opacity = "1";
        li.style.transform = "translateY(0)";
      }, index * 50);
    });
  }, 300);
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest('#watchlist button[data-sym]');
  if(!btn) return;
  
  const sym = btn.dataset.sym;
  
  // Add button feedback
  btn.style.transform = "scale(0.95)";
  setTimeout(() => {
    btn.style.transform = "scale(1)";
  }, 150);
  
  loadTradingViewFor(sym);
  const quickPair = $("#quick-pair");
  if(quickPair) quickPair.value = sym;
  
  showNotification("Chart Updated", `Now viewing ${humanLabel(sym)}`, "success", 2000);
});

// Enhanced search with debouncing
let searchTimeout;
$("#global-search")?.addEventListener("input", (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim().toLowerCase();
  
  if(!query) {
    // Reset watchlist
    buildWatchlist();
    return;
  }
  
  searchTimeout = setTimeout(() => {
    const wl = $("#watchlist");
    const all = [
      ...cryptoMarkets.map(m => ({id: m.feed, label: m.display, type: "crypto"})),
      ...forexPairs.map(p => ({id: p, label: `${p.slice(0,3)} / ${p.slice(3,6)}`, type: "forex"}))
    ];
    
    const filtered = all.filter(x => 
      x.label.toLowerCase().includes(query) || 
      x.id.toLowerCase().includes(query)
    );
    
    wl.innerHTML = "";
    
    if(filtered.length === 0) {
      wl.innerHTML = `
        <li style="padding: 1rem; text-align: center; color: var(--text-muted); border: 1px dashed var(--border); border-radius: var(--radius);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 0.5rem;">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="M21 21l-4.35-4.35"></path>
          </svg>
          <div>No pairs found for "${query}"</div>
        </li>
      `;
      return;
    }
    
    filtered.forEach(x => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 0.75rem; padding: 0.25rem 0.5rem; background: var(--${x.type === 'crypto' ? 'primary' : 'secondary'}); color: white; border-radius: 4px; text-transform: uppercase; font-weight: 600;">
            ${x.type}
          </span>
          <span>${x.label}</span>
        </div>
        <button data-sym="${x.id}">Chart</button>
      `;
      wl.appendChild(li);
    });
  }, 300);
});

$("#global-search")?.addEventListener("keydown", (e) => {
  if(e.key !== "Enter") return;
  
  const v = e.target.value.trim().toUpperCase().replace(/\W/g, "");
  if(!v) return;
  
  const crypto = cryptoMarkets.find(m => m.feed === v);
  if(crypto || forexPairs.includes(v)) {
    loadTradingViewFor(v);
    const quickPair = $("#quick-pair");
    if(quickPair) quickPair.value = v;
    showNotification("Chart Loaded", `${humanLabel(v)} chart loaded`, "success");
  } else {
    showNotification("Pair Not Found", `${v} is not available in this demo`, "warning");
  }
});

/******** ENHANCED TRADINGVIEW ********/
let currentTVWidget = null;

function loadTradingViewFor(symbol) {
  let tvSymbol;
  const cm = cryptoMarkets.find(m => m.feed === symbol);
  if(cm) tvSymbol = cm.tv; 
  else tvSymbol = `FX_IDC:${symbol}`;
  
  const container = $("#tradingview_chart");
  if(!container) return;
  
  // Show loading state
  showLoading(container, "Loading chart...");
  
  setTimeout(() => {
    // Destroy existing widget
    if(currentTVWidget) {
      try {
        currentTVWidget.remove();
      } catch(e) {
        console.log("Widget cleanup:", e);
      }
    }
    
    container.innerHTML = "";
    
    try {
      currentTVWidget = new TradingView.widget({
        container_id: "tradingview_chart",
        width: "100%",
        height: 540,
        symbol: tvSymbol,
        interval: "1",
        timezone: "Etc/UTC",
        theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
        style: "1",
        locale: "en",
        enable_publishing: false,
        hide_side_toolbar: false,
        allow_symbol_change: true,
        studies: [
          "Volume@tv-basicstudies"
        ],
        loading_screen: { 
          backgroundColor: "var(--card)",
          foregroundColor: "var(--primary)"
        }
      });
    } catch(error) {
      container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 540px; color: var(--text-muted); flex-direction: column; gap: 1rem;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <div>Chart loading failed</div>
          <button onclick="loadTradingViewFor('${symbol}')" style="padding: 0.5rem 1rem; background: var(--primary); color: white; border: none; border-radius: 6px;">
            Retry
          </button>
        </div>
      `;
    }
  }, 500);
}

/******** ENHANCED PRICES ********/
const priceConnections = new Map();

function initCrypto() {
  const tb = $("#crypto-table tbody");
  if(!tb) return;
  
  showLoading(tb, "Connecting to markets...");
  
  setTimeout(() => {
    tb.innerHTML = "";
    let connected = 0;
    const total = cryptoMarkets.length;
    
    cryptoMarkets.forEach((m, index) => {
      const tr = document.createElement("tr");
      tr.dataset.feed = m.feed;
      tr.innerHTML = `
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <div style="width: 8px; height: 8px; background: var(--warning); border-radius: 50%; animation: pulse 2s infinite;"></div>
            ${m.display}
          </div>
        </td>
        <td>$0.00</td>
        <td>0.00%</td>
      `;
      tb.appendChild(tr);
      
      // Create WebSocket connection
      try {
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${m.feed.toLowerCase()}@ticker`);
        priceConnections.set(m.feed, ws);
        
        ws.onopen = () => {
          connected++;
          const indicator = tr.querySelector("div div");
          if(indicator) {
            indicator.style.background = "var(--success)";
            indicator.style.animation = "none";
          }
          
          if(connected === total) {
            showNotification("Market Data", "Connected to all crypto feeds", "success", 3000);
          }
        };
        
        ws.onmessage = (ev) => {
          try {
            const d = JSON.parse(ev.data);
            const price = parseFloat(d.c);
            const chg = parseFloat(d.P);
            const row = tb.querySelector(`tr[data-feed="${m.feed}"]`);
            
            if(!row) return;
            
            const priceCell = row.children[1];
            const changeCell = row.children[2];
            
            // Add price animation
            const oldPrice = parseFloat(priceCell.textContent.replace(/[$,]/g, "")) || 0;
            const isUp = price > oldPrice;
            const isDown = price < oldPrice;
            
            if(isUp || isDown) {
              row.style.background = isUp ? "var(--success-bg)" : "var(--danger-bg)";
              setTimeout(() => {
                row.style.background = "";
              }, 1000);
            }
            
            priceCell.textContent = `$${fmtUSD(price)}`;
            changeCell.textContent = `${isFinite(chg) ? chg.toFixed(2) : "0.00"}%`;
            changeCell.className = chg >= 0 ? "pl-pos" : "pl-neg";
          } catch(err) {
            console.log("Price update error:", err);
          }
        };
        
        ws.onerror = () => {
          const indicator = tr.querySelector("div div");
          if(indicator) {
            indicator.style.background = "var(--danger)";
            indicator.style.animation = "none";
          }
        };
        
        ws.onclose = () => {
          const indicator = tr.querySelector("div div");
          if(indicator) {
            indicator.style.background = "var(--secondary)";
            indicator.style.animation = "none";
          }
        };
        
      } catch(error) {
        console.log("WebSocket creation failed:", error);
      }
    });
  }, 800);
}

async function fetchForex() {
  const tb = $("#forex-table tbody");
  if(!tb) return;
  
  showLoading(tb, "Loading forex rates...");
  
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();
    
    if(data.result !== "success") throw new Error("FX feed error");
    
    const R = data.rates;
    const px = {
      EURUSD: 1/R.EUR, GBPUSD: 1/R.GBP, AUDUSD: 1/R.AUD, NZDUSD: 1/R.NZD,
      USDCAD: R.CAD, USDJPY: R.JPY, USDCHF: R.CHF,
      EURGBP: (1/R.EUR)/(1/R.GBP), EURJPY: (1/R.EUR)*R.JPY, GBPJPY:(1/R.GBP)*R.JPY
    };
    
    tb.innerHTML = "";
    
    forexPairs.forEach((p, index) => {
      const d = p.endsWith("JPY") ? 3 : 5;
      const tr = document.createElement("tr");
      tr.dataset.symbol = p;
      tr.style.opacity = "0";
      tr.style.transform = "translateY(10px)";
      tr.innerHTML = `
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <div style="width: 8px; height: 8px; background: var(--success); border-radius: 50%;"></div>
            ${p.slice(0,3)} / ${p.slice(3,6)}
          </div>
        </td>
        <td>${Number(px[p] || 0).toFixed(d)}</td>
      `;
      tb.appendChild(tr);
      
      // Animate in
      setTimeout(() => {
        tr.style.transition = "all 0.3s ease";
        tr.style.opacity = "1";
        tr.style.transform = "translateY(0)";
      }, index * 100);
    });
    
    showNotification("Forex Data", "Exchange rates updated successfully", "success", 2000);
    
  } catch(err) {
    console.error("Forex fetch error:", err);
    tb.innerHTML = `
      <tr>
        <td colspan="2" style="text-align: center; padding: 2rem; color: var(--danger);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 0.5rem;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <div>Failed to load forex data</div>
          <button onclick="fetchForex()" style="margin-top: 0.5rem; padding: 0.5rem 1rem; background: var(--primary); color: white; border: none; border-radius: 6px;">
            Retry
          </button>
        </td>
      </tr>
    `;
  }
}

function getCurrentPriceById(id) {
  const c = document.querySelector(`#crypto-table tr[data-feed="${id}"]`);
  if(c) return parseFloat(c.children[1].textContent.replace(/[$,]/g, ""));
  
  const f = document.querySelector(`#forex-table tr[data-symbol="${id}"]`);
  if(f) return parseFloat(f.children[1].textContent);
  
  return null;
}

// Add this debug version of pnlFor function:
function pnlFor(pos, current) {
  const E = pos.entry, C = current, A = pos.amountUSD;
  if(!E || !C) return {pl: 0, pct: 0};
  
  let pl, pct;
  if(pos.side === "BUY") { 
    pct = (C/E - 1) * 100; 
    pl = A * (pct/100); 
  } else { 
    pct = (E/C - 1) * 100; 
    pl = A * (pct/100); 
  }
  console.log(`pnlFor DEBUG - Position ${pos.id}: Entry=${E}, Current=${C}, Side=${pos.side}, Amount=${A}, PL=${pl}, PCT=${pct}`);
  
  return {pl, pct}; 
}
  


function accountNumbers() {
  const unreal = state.positions.reduce((s, p) => s + pnlFor(p, getCurrentPriceById(p.pair)).pl, 0);
  const usedMargin = state.positions.reduce((s, p) => s + p.marginUsed, 0);
  const equity = state.balance + unreal;
  const freeMargin = equity - usedMargin;
  const marginLevel = usedMargin > 0 ? (equity/usedMargin) * 100 : Infinity;
  
  return {unreal, usedMargin, equity, freeMargin, marginLevel};
}

/******** ENHANCED RENDER ********/
function populateSelectors() {
  const quick = $("#quick-pair");
  const msel = $("#m-pair");
  const asel = $("#a-pair");
  
  [quick, msel, asel].forEach(el => { 
    if(!el) return; 
    el.innerHTML = ""; 
  });
  
  cryptoMarkets.forEach(m => {
    const option = `<option value="${m.feed}">${m.display}</option>`;
    if(quick) quick.insertAdjacentHTML("beforeend", option);
    if(msel) msel.insertAdjacentHTML("beforeend", option);
    if(asel) asel.insertAdjacentHTML("beforeend", option);
  });
  
  forexPairs.forEach(p => {
    const label = `${p.slice(0,3)} / ${p.slice(3,6)}`;
    const option = `<option value="${p}">${label}</option>`;
    if(quick) quick.insertAdjacentHTML("beforeend", option);
    if(msel) msel.insertAdjacentHTML("beforeend", option);
    if(asel) asel.insertAdjacentHTML("beforeend", option);
  });
  
  if(quick) quick.value = "BTCUSDT";
  if(msel) msel.value = "BTCUSDT";
  if(asel) asel.value = "BTCUSDT";
}

function renderPositions() {
  const tb = $("#positions-table tbody");
  if(!tb) return;
  
  if(state.positions.length === 0) {
    tb.innerHTML = `
      <tr>
        <td colspan="13" style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 1rem;">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
            <line x1="9" y1="9" x2="9.01" y2="9"></line>
            <line x1="15" y1="9" x2="15.01" y2="9"></line>
          </svg>
          <div style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">No Open Positions</div>
          <div>Open your first position to start trading</div>
          <button onclick="document.getElementById('open-order-modal').click()" style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: var(--primary); color: white; border: none; border-radius: 8px; font-weight: 600;">
            Place Order
          </button>
        </td>
      </tr>
    `;
    return;
  }
  
  tb.innerHTML = "";
  state.positions.forEach((p, index) => {
    const C = getCurrentPriceById(p.pair);
    const {pl, pct} = pnlFor(p, C);
    const tr = document.createElement("tr");
    tr.dataset.pid = p.id;
    tr.style.opacity = "0";
    tr.style.transform = "translateY(10px)";
    
    const sideColor = p.side === "BUY" ? "var(--success)" : "var(--danger)";
    const plColor = pl >= 0 ? "var(--success)" : "var(--danger)";
    
    tr.innerHTML = `
      <td style="font-weight: 600;">#${p.id}</td>
      <td>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 0.75rem; padding: 0.25rem 0.5rem; background: ${sideColor}; color: white; border-radius: 4px; font-weight: 600;">
            ${p.side}
          </span>
          ${humanLabel(p.pair)}
        </div>
      </td>
      <td>${p.side}</td>
      <td>${p.entry.toFixed(6)}</td>
      <td>
        <span style="background: var(--primary-light); color: var(--primary); padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: 600;">
          ${p.leverage}x
        </span>
      </td>
      <td>${fmtUSD(p.amountUSD)}</td>
      <td>${fmtUSD(p.marginUsed)}</td>
      <td>${p.units.toFixed(8)}</td>
      <td>${p.slPrice || "—"}</td>
      <td>${p.tpPrice || "—"}</td>
      <td class="pl-cell" style="color: ${plColor}; font-weight: 600;">
        ${pl.toFixed(2)} / ${pct.toFixed(2)}%
      </td>
      <td>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <select class="small-input pctSel">
            <option value="25">25%</option>
            <option value="50" selected>50%</option>
            <option value="75">75%</option>
            <option value="100">100%</option>
          </select>
          <button class="close-partial" data-id="${p.id}">Close</button>
        </div>
      </td>
      <td>
        <button class="close-btn" data-close="${p.id}" title="Close entire position">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </td>
    `;
    tb.appendChild(tr);
    
    // Animate in with stagger
    setTimeout(() => {
      tr.style.transition = "all 0.3s ease";
      tr.style.opacity = "1";
      tr.style.transform = "translateY(0)";
    }, index * 100);
  });
}

function renderPending() {
  const tb = $("#pending-table tbody");
  if(!tb) return;
  
  if(state.pending.length === 0) {
    tb.innerHTML = `
      <tr>
        <td colspan="11" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 0.5rem;">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 6v6"></path>
          </svg>
          <div>No pending orders</div>
        </td>
      </tr>
    `;
    return;
  }
  
  tb.innerHTML = "";
  state.pending.forEach((o, index) => {
    const tr = document.createElement("tr");
    tr.dataset.oid = o.oid;
    tr.style.opacity = "0";
    tr.style.transform = "translateY(10px)";
    
    const statusColor = o.status === "PENDING" ? "var(--warning)" : 
                       o.status?.includes("FILLED") ? "var(--success)" : "var(--danger)";
    const sideColor = o.side === "BUY" ? "var(--success)" : "var(--danger)";
    
    tr.innerHTML = `
      <td style="font-weight: 600;">#${o.oid}</td>
      <td>${humanLabel(o.pair)}</td>
      <td>
        <span style="background: var(--secondary); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
          ${o.type}
        </span>
      </td>
      <td>
        <span style="background: ${sideColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
          ${o.side}
        </span>
      </td>
      <td>${o.type === 'MARKET' ? '—' : o.triggerPrice}</td>
      <td>
        <span style="background: var(--primary-light); color: var(--primary); padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: 600;">
          ${o.leverage}x
        </span>
      </td>
      <td>${fmtUSD(o.amountUSD)}</td>
      <td>${o.slPrice || "—"}</td>
      <td>${o.tpPrice || "—"}</td>
      <td>
        <span style="background: ${statusColor}20; color: ${statusColor}; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
          ${o.status || 'PENDING'}
        </span>
      </td>
      <td>
        <button class="danger" data-cancel="${o.oid}" title="Cancel order">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          Cancel
        </button>
      </td>
    `;
    tb.appendChild(tr);
    
    // Animate in
    setTimeout(() => {
      tr.style.transition = "all 0.3s ease";
      tr.style.opacity = "1";
      tr.style.transform = "translateY(0)";
    }, index * 100);
  });
}

function renderHistory() {
  const tb = $("#history-table tbody");
  if(!tb) return;
  
  if(state.history.length === 0) {
    tb.innerHTML = `
      <tr>
        <td colspan="14" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 0.5rem;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
          </svg>
          <div>No trading history</div>
        </td>
      </tr>
    `;
    return;
  }
  
  tb.innerHTML = "";
  [...state.history].reverse().slice(0, 50).forEach((h, index) => {
    const tr = document.createElement("tr");
    tr.style.opacity = "0";
    tr.style.transform = "translateY(10px)";
    
    const plColor = h.realizedPL >= 0 ? "var(--success)" : "var(--danger)";
    const sideColor = h.side === "BUY" ? "var(--success)" : "var(--danger)";
    const reasonColor = h.reason === "TP" ? "var(--success)" : 
                       h.reason === "SL" ? "var(--danger)" :
                       h.reason === "Liquidation" ? "var(--warning)" : "var(--primary)";
    
    tr.innerHTML = `
      <td style="font-size: 0.875rem;">${h.time}</td>
      <td>${humanLabel(h.pair)}</td>
      <td>
        <span style="background: var(--secondary); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">
          ${h.type}
        </span>
      </td>
      <td>
        <span style="background: ${sideColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">
          ${h.side}
        </span>
      </td>
      <td>${h.entry.toFixed(6)}</td>
      <td>${h.exit.toFixed(6)}</td>
      <td>
        <span style="background: var(--primary-light); color: var(--primary); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">
          ${h.leverage}x
        </span>
      </td>
      <td>${fmtUSD(h.amountUSD)}</td>
      <td>${fmtUSD(h.marginUsed)}</td>
      <td>${h.units.toFixed(8)}</td>
      <td style="color: ${plColor}; font-weight: 600;">${h.realizedPL.toFixed(2)}</td>
      <td style="color: ${plColor}; font-weight: 600;">${h.realizedPct.toFixed(2)}%</td>
      <td>
        <span style="background: ${reasonColor}20; color: ${reasonColor}; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
          ${h.reason}
        </span>
      </td>
      <td>${h.closedPct}%</td>
    `;
    tb.appendChild(tr);
    
    // Animate in
    setTimeout(() => {
      tr.style.transition = "all 0.3s ease";
      tr.style.opacity = "1";
      tr.style.transform = "translateY(0)";
    }, index * 50);
  });
}

function renderMetrics() {
  const {unreal, usedMargin, equity, freeMargin, marginLevel} = accountNumbers();
  
  // Enhanced metric updates with animations
  const metrics = [
    {id: "balance", value: state.balance},
    {id: "unrealized", value: unreal},
    {id: "equity", value: equity},
    {id: "used-margin", value: usedMargin},
    {id: "free-margin", value: freeMargin}
  ];
  
  metrics.forEach(({id, value}) => {
    const el = $(`#${id}`);
    if(!el) return;
    
    const oldValue = parseFloat(el.textContent.replace(/[,$]/g, "")) || 0;
    const newValue = value;
    const isChange = Math.abs(oldValue - newValue) > 0.01;
    
    if(isChange) {
      el.style.transform = "scale(1.05)";
      el.style.color = newValue > oldValue ? "var(--success)" : newValue < oldValue ? "var(--danger)" : "";
      setTimeout(() => {
        el.style.transform = "scale(1)";
        el.style.color = "";
      }, 300);
    }
    
    el.textContent = fmtUSD(newValue);
  });
  
  // Margin level with warning colors
  const marginEl = $("#margin-level");
  if(marginEl) {
    const marginText = isFinite(marginLevel) ? `${marginLevel.toFixed(2)}%` : "∞";
    marginEl.textContent = marginText;
    
    if(isFinite(marginLevel)) {
      if(marginLevel < 100) {
        marginEl.style.color = "var(--danger)";
      } else if(marginLevel < 200) {
        marginEl.style.color = "var(--warning)";
      } else {
        marginEl.style.color = "var(--success)";
      }
    } else {
      marginEl.style.color = "";
    }
  }
}

function renderAll() { 
  renderMetrics(); 
  renderPositions(); 
  renderPending(); 
  renderHistory(); 
}

/******** ENHANCED ORDERS ********/
function freeMarginNow() { 
  const {equity, usedMargin} = accountNumbers(); 
  return equity - usedMargin; 
}

function executePosition({pair, side, entry, amountUSD, leverage, slPrice, tpPrice, type}) {
  const commission = Math.max(0.5, amountUSD * 0.0004);
  const spreadBps = 0.0002;
  // Apply spread to entry price
  const entryAdj = side === "BUY" ? entry * (1 + spreadBps) : entry * (1 - spreadBps);
  const reqMargin = amountUSD / leverage;
  
  if(reqMargin > freeMarginNow()) { 
    showNotification("Order Rejected", `Insufficient margin. Need ${fmtUSD(reqMargin)}`, "error");
    return false; 
  }
  
  const units = amountUSD / entryAdj;
  state.balance -= commission;
  
  state.positions.push({
    id: nextPosId++, 
    pair, 
    side, 
    entry: entryAdj, 
    amountUSD, 
    units, 
    leverage,
    marginUsed: reqMargin, 
    slPrice, 
    tpPrice, 
    openedAt: nowStr()
  });
  
  showNotification(
    "Order Filled", 
    `${side} ${humanLabel(pair)} @ ${entryAdj.toFixed(6)}`, 
    "success"
  );
  
  save(); 
  return true;
}

function placeOrder() {
  const pair = $("#m-pair")?.value;
  const side = $("#m-side")?.value;
  const type = $("#m-type")?.value;
  const price = Number($("#m-price")?.value) || null;
  const amountUSD = Math.max(1, Number($("#m-amount")?.value) || 0);
  const leverage = Math.max(1, Number($("#m-lev")?.value) || 1);
  const slPrice = Number($("#m-sl")?.value) || null;
  const tpPrice = Number($("#m-tp")?.value) || null;
  
  if(type !== "MARKET" && price == null) { 
    showNotification("Invalid Order", "Enter a trigger price for limit/stop orders", "error");
    return; 
  }
  
  if(type === "MARKET") {
    const C = getCurrentPriceById(pair); 
    if(!C) { 
      showNotification("Price Error", "Price not available yet. Try again.", "error");
      return; 
    }
    
    if(executePosition({pair, side, entry: C, amountUSD, leverage, slPrice, tpPrice, type})) {
      closeOrderModal();
    }
  } else {
    state.pending.push({ 
      oid: nextOrderId++, 
      pair, 
      side, 
      type, 
      triggerPrice: price, 
      amountUSD, 
      leverage, 
      slPrice, 
      tpPrice, 
      placedAt: nowStr(), 
      status: "PENDING" 
    });
    
    showNotification(
      "Order Placed", 
      `${type} ${side} ${humanLabel(pair)} @ ${price}`, 
      "success"
    );
    
    save(); 
    closeOrderModal();
  }
}

/******** PENDING / SLTP / CLOSE ********/
function shouldTrigger(order, current) {
  if(order.type === "MARKET") return true;
  if(current == null) return false;
  
  const t = order.triggerPrice;
  if(order.type === "LIMIT") {
    if(order.side === "BUY") return current <= t;
    if(order.side === "SELL") return current >= t;
  }
  if(order.type === "STOP") {
    if(order.side === "BUY") return current >= t;
    if(order.side === "SELL") return current <= t;
  }
  return false;
}

function processPending() {
  let triggered = 0;
  
  for(const o of state.pending) {
    if(o.status !== "PENDING") continue;
    
    const C = getCurrentPriceById(o.pair);
    if(!shouldTrigger(o, C)) continue;
    
    const ok = executePosition({
      pair: o.pair,
      side: o.side,
      entry: C,
      amountUSD: o.amountUSD,
      leverage: o.leverage,
      slPrice: o.slPrice,
      tpPrice: o.tpPrice,
      type: o.type
    });
    
    o.status = ok ? `FILLED @ ${C.toFixed(6)}` : "AWAITING MARGIN";
    triggered++;
  }
  
  state.pending = state.pending.filter(o => o.status === "PENDING" || o.status === "AWAITING MARGIN");
  
  if(triggered > 0) {
    save();
  }
}

function autoCloseChecks() {
  const toClose = [];
  
  state.positions.forEach(p => {
    const C = getCurrentPriceById(p.pair); 
    if(!C) return;
    
    // Take Profit
    if(p.tpPrice != null) {
      if(p.side === "BUY" && C >= p.tpPrice) toClose.push({id: p.id, reason: "TP", pct: 100});
      if(p.side === "SELL" && C <= p.tpPrice) toClose.push({id: p.id, reason: "TP", pct: 100});
    }
    
    // Stop Loss
    if(p.slPrice != null) {
      if(p.side === "BUY" && C <= p.slPrice) toClose.push({id: p.id, reason: "SL", pct: 100});
      if(p.side === "SELL" && C >= p.slPrice) toClose.push({id: p.id, reason: "SL", pct: 100});
    }
  });
  
  toClose.forEach(x => closePosition(x.id, x.pct, x.reason, false));
  
  // Margin liquidation
  let {marginLevel} = accountNumbers();
  if(isFinite(marginLevel) && marginLevel < LIQUIDATION_LEVEL) {
    const ranked = state.positions.map(p => ({
      id: p.id, 
      pl: pnlFor(p, getCurrentPriceById(p.pair)).pl
    })).sort((a,b) => a.pl - b.pl);
    
    for(const r of ranked) {
      const live = state.positions.find(z => z.id === r.id); 
      if(!live) continue;
      
      closePosition(r.id, 100, "Liquidation", false);
      marginLevel = accountNumbers().marginLevel;
      
      if(!isFinite(marginLevel) || marginLevel >= LIQUIDATION_LEVEL) break;
    }
    
    showNotification(
      "⚠️ Margin Call", 
      "Positions liquidated due to low margin level", 
      "warning", 
      6000
    );
  }
}
// Keep the same closePosition function but let's also check the table display:
function closePosition(id, percent = 100, reason = "Manual", askConfirm = true) {
  const i = state.positions.findIndex(p => p.id === id); 
  if(i === -1) return;
  
  const p = state.positions[i];
  const pct = Math.min(100, Math.max(1, Number(percent) || 100));
  
  // BEFORE closing - check what's displayed in the table
  const tableRow = document.querySelector(`#positions-table tr[data-pid="${p.id}"] .pl-cell`);
  const displayedText = tableRow ? tableRow.textContent : "N/A";
  console.log("=== CLOSE POSITION DEBUG ===");
  console.log("Text shown in table:", displayedText);
  
  if(askConfirm && pct === 100) { 
    if(!confirm(`Close position #${id} (${humanLabel(p.pair)})?`)) return; 
  }
  
  const C = getCurrentPriceById(p.pair); 
  if(!C) { 
    showNotification("Close Error", "Current price not available", "error");
    return; 
  }
  
  // Calculate using pnlFor
  const displayedPL = pnlFor(p, C);
  console.log("Position:", p);
  console.log("Current Price:", C);
  console.log("pnlFor result:", displayedPL);
  
  const portion = pct / 100;
  const commission = Math.max(0.5, p.amountUSD * portion * 0.0004);
  const grossPL = displayedPL.pl * portion;
  const realizedPL = grossPL - commission;
  
  console.log("Portion:", portion, "Commission:", commission);
  console.log("Gross P&L:", grossPL, "Realized P&L:", realizedPL);
  console.log("===========================");
  
  state.balance += realizedPL;
  
  state.history.push({
    time: nowStr(), 
    pair: p.pair, 
    type: "MARKET", 
    side: p.side, 
    entry: p.entry, 
    exit: C,
    leverage: p.leverage,
    amountUSD: p.amountUSD * portion, 
    marginUsed: p.marginUsed * portion, 
    units: p.units * portion,
    realizedPL, 
    realizedPct: displayedPL.pct, 
    reason, 
    closedPct: pct
  });
  
  if(pct >= 99.999) { 
    state.positions.splice(i, 1); 
  } else {
    p.amountUSD *= (1 - portion); 
    p.units *= (1 - portion); 
    p.marginUsed *= (1 - portion);
  }
  
  save();
  
  const plText = realizedPL >= 0 ? `+${realizedPL.toFixed(2)}` : `${realizedPL.toFixed(2)}`;
  showNotification(
    "Position Closed", 
    `${reason}: ${humanLabel(p.pair)} ${pct}% - $${plText}`, 
    realizedPL >= 0 ? "success" : "error"
  );
}
  // Navigation functionality
    document.addEventListener('DOMContentLoaded', function() {
      const navItems = document.querySelectorAll('.nav-item');
      const sections = {
        'markets': document.getElementById('markets-section'),
        'trading': document.getElementById('trading-section'),
        'settings': document.getElementById('settings-section')
      };
      
      const sidebarCards = {
        'markets': [
          document.querySelector('.market-watch-card'),
          document.querySelector('.market-news-card')
        ],
        'trading': [
          document.querySelector('.trading-metrics-card'),
          document.querySelector('.trading-actions-card')
        ],
        'settings': []
      };

      function showSection(sectionName) {
        // Hide all sections
        Object.values(sections).forEach(section => {
          if (section) section.style.display = 'none';
        });
        
        // Hide all sidebar cards
        Object.values(sidebarCards).flat().forEach(card => {
          if (card) card.style.display = 'none';
        });
        
        // Show selected section
        if (sections[sectionName]) {
          sections[sectionName].style.display = 'block';
        }
        
        // Show relevant sidebar cards
        if (sidebarCards[sectionName]) {
          sidebarCards[sectionName].forEach(card => {
            if (card) card.style.display = 'block';
          });
        }
        
        // Update active nav item
        navItems.forEach(item => item.classList.remove('active'));
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
      }

      // Add click handlers to nav items
      navItems.forEach(item => {
        item.addEventListener('click', function() {
          const section = this.getAttribute('data-section');
          showSection(section);
        });
      });

      // Initialize with markets section
      showSection('markets');

      // Settings functionality
      const settingsElements = {
        theme: document.getElementById('theme-setting'),
        currency: document.getElementById('currency-setting'),
        decimal: document.getElementById('decimal-setting'),
        defaultLeverage: document.getElementById('default-leverage'),
        defaultPosition: document.getElementById('default-position'),
        soundAlerts: document.getElementById('sound-alerts'),
        autoCloseSL: document.getElementById('auto-close-sl'),
        maxRisk: document.getElementById('max-risk'),
        dailyLimit: document.getElementById('daily-limit'),
        maxPositions: document.getElementById('max-positions')
      };

      // Load settings from localStorage if available
      Object.keys(settingsElements).forEach(key => {
        const element = settingsElements[key];
        const savedValue = localStorage.getItem(`setting_${key}`);
        if (savedValue && element) {
          if (element.type === 'checkbox') {
            element.checked = savedValue === 'true';
          } else {
            element.value = savedValue;
          }
        }
      });

      // Save settings on change
      Object.keys(settingsElements).forEach(key => {
        const element = settingsElements[key];
        if (element) {
          element.addEventListener('change', function() {
            const value = element.type === 'checkbox' ? element.checked : element.value;
            localStorage.setItem(`setting_${key}`, value);
            
            // Apply theme immediately
            if (key === 'theme') {
              document.documentElement.setAttribute('data-theme', value);
            }
          });
        }
      });

      // Export data functionality
      document.getElementById('export-data')?.addEventListener('click', function() {
        const data = {
          positions: JSON.parse(localStorage.getItem('positions') || '[]'),
          history: JSON.parse(localStorage.getItem('orderHistory') || '[]'),
          alerts: JSON.parse(localStorage.getItem('alerts') || '[]'),
          settings: {}
        };
        
        // Collect settings
        Object.keys(settingsElements).forEach(key => {
          data.settings[key] = localStorage.getItem(`setting_${key}`);
        });

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pro-trader-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });

      // Clear all data functionality
      document.getElementById('clear-all-data')?.addEventListener('click', function() {
        if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
          localStorage.clear();
          location.reload();
        }
      });
    });
    