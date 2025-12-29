const logEl = document.getElementById("status-log");
const accXEl = document.getElementById("acc-x");
const accYEl = document.getElementById("acc-y");
const accZEl = document.getElementById("acc-z");
const gyroAEl = document.getElementById("gyro-a");
const gyroBEl = document.getElementById("gyro-b");
const gyroCEl = document.getElementById("gyro-c");
const oriEl = document.getElementById("ori");
const batLevelEl = document.getElementById("bat-level");
const batChargingEl = document.getElementById("bat-charging");
const batBarEl = document.getElementById("bat-bar");
const latEl = document.getElementById("lat");
const lonEl = document.getElementById("lon");
const accGpsEl = document.getElementById("acc");
const compassArrow = document.querySelector(".compass-arrow");
const startBtn = document.getElementById("start-sensors");

function logStatus(msg) {
    logEl.textContent = msg;
}

// ACCELEROMETRE & ORIENTATION
function startMotionListeners() {
    window.addEventListener("devicemotion", (e) => {
        const acc = e.acceleration || e.accelerationIncludingGravity;
        if (acc) {
            accXEl.textContent = (acc.x || 0).toFixed(2);
            accYEl.textContent = (acc.y || 0).toFixed(2);
            accZEl.textContent = (acc.z || 0).toFixed(2);
        }
    });

    window.addEventListener("deviceorientation", (e) => {
        if (e.alpha != null) {
            gyroAEl.textContent = e.alpha.toFixed(2);
            gyroBEl.textContent = e.beta?.toFixed(2);
            gyroCEl.textContent = e.gamma?.toFixed(2);

            oriEl.textContent = e.alpha.toFixed(0);
            compassArrow.style.transform = `rotate(${e.alpha}deg)`;
        }
    });

    logStatus("Capteurs de mouvement activés.");
}

// Permissions (nécessaires sur certains navigateurs)
async function requestMotionPermissionIfNeeded() {
    const dm = window.DeviceMotionEvent;
    const dor = window.DeviceOrientationEvent;

    try {
        if (dm && typeof dm.requestPermission === "function") {
            const res = await dm.requestPermission();
            if (res !== "granted") {
                logStatus("Permission mouvement refusée.");
                return;
            }
        }
        if (dor && typeof dor.requestPermission === "function") {
            const res2 = await dor.requestPermission();
            if (res2 !== "granted") {
                logStatus("Permission orientation refusée.");
                return;
            }
        }
        startMotionListeners();
    } catch (err) {
        logStatus("Erreur permission capteurs: " + err);
    }
}

// BATTERIE
if (navigator.getBattery) {
    navigator.getBattery().then((battery) => {
        function updateBattery() {
            const pct = Math.round(battery.level * 100);
            batLevelEl.textContent = pct;
            batChargingEl.textContent = battery.charging ? "En charge" : "Sur batterie";
            batBarEl.style.width = pct + "%";
        }
        updateBattery();
        battery.addEventListener("levelchange", updateBattery);
        battery.addEventListener("chargingchange", updateBattery);
    }).catch(() => {
        batLevelEl.textContent = "--";
        batChargingEl.textContent = "Non dispo";
    });
} else {
    batLevelEl.textContent = "--";
    batChargingEl.textContent = "Non supporté";
}

// GPS
function startGPS() {
    if (!("geolocation" in navigator)) {
        logStatus("GPS non supporté.");
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const c = pos.coords;
            latEl.textContent = c.latitude.toFixed(5);
            lonEl.textContent = c.longitude.toFixed(5);
            accGpsEl.textContent = c.accuracy.toFixed(1);
            logStatus("GPS OK.");
        },
        (err) => {
            logStatus("Erreur GPS: " + err.message);
        },
        {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 10000
        }
    );
}

// Bouton d’activation + rebond forcé
startBtn.addEventListener("click", () => {
    // Effet rebond visuel très visible
    startBtn.style.animation = "none";
    // Forcer le recalcul pour relancer l’animation
    void startBtn.offsetWidth;
    startBtn.style.animation = "cyber-bounce 0.35s ease-out";

    logStatus("Demande de permissions capteurs…");
    requestMotionPermissionIfNeeded().then(() => {
        startGPS();
    });
});