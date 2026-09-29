import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
    auth,
    db
} from "./firebase-config.js";

const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authMessage = document.getElementById("authMessage");
const userNameTop = document.getElementById("userNameTop");
const logoutButton = document.getElementById("logoutButton");
const sosButton = document.getElementById("sosButton");
const sosCountdown = document.getElementById("sosCountdown");
const locationText = document.getElementById("locationText");
const batteryText = document.getElementById("batteryText");
const toast = document.getElementById("toast");

let holdTimer = null;
let holdSeconds = 0;
let currentUser = null;
let currentProfile = null;

function showAuthMessage(message) {
    authMessage.textContent = message;
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

function setScreen(isLoggedIn) {
    authScreen.classList.toggle("hidden", isLoggedIn);
    appScreen.classList.toggle("hidden", !isLoggedIn);
}

function formatTime(date) {
    return new Date(date).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getBatteryLevel() {
    if (navigator.getBattery) {
        return navigator.getBattery().then((battery) => {
            return Math.round(battery.level * 100);
        });
    }

    return Promise.resolve(75);
}

function getLocation() {
    if (!navigator.geolocation) {
        locationText.textContent = "Location unavailable";
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            locationText.textContent = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        },
        () => {
            locationText.textContent = "Location permission denied";
        }
    );
}

async function updateBatteryInfo() {
    const level = await getBatteryLevel();
    batteryText.textContent = `${level}%`;
}

async function createUserProfile(user, name, phone, email) {
    await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name,
        phone,
        email,
        createdAt: serverTimestamp(),
        online: true
    });
}

async function registerUser() {
    const name = document.getElementById("registerName").value.trim();
    const phone = document.getElementById("registerPhone").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;

    if (!name || !phone || !email || !password) {
        showAuthMessage("Please complete all fields.");
        return;
    }

    if (password.length < 6) {
        showAuthMessage("Password must be at least 6 characters.");
        return;
    }

    try {
        showAuthMessage("Creating your SaveMe account...");
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await createUserProfile(result.user, name, phone, email);
        showToast("Account created successfully.");
        registerForm.classList.add("hidden");
        loginForm.classList.remove("hidden");
    } catch (error) {
        showAuthMessage(error.message || "Unable to create account.");
    }
}

async function loginUser() {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
        showAuthMessage("Enter your email and password.");
        return;
    }

    try {
        showAuthMessage("Signing in...");
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showAuthMessage(error.message || "Login failed.");
    }
}

async function logoutUser() {
    await signOut(auth);
    showToast("Logged out.");
}

function startSOSHold() {
    clearInterval(holdTimer);
    holdSeconds = 0;
    sosCountdown.textContent = "Hold to activate...";

    holdTimer = setInterval(() => {
        holdSeconds += 1;
        sosCountdown.textContent = `${holdSeconds}s / 10s`;

        if (holdSeconds >= 10) {
            clearInterval(holdTimer);
            sosCountdown.textContent = "Emergency alert activated";
            showToast("SaveMe activated");
            triggerSOS();
        }
    }, 1000);
}

function stopSOSHold() {
    clearInterval(holdTimer);
    sosCountdown.textContent = "SaveMe is ready";
    holdSeconds = 0;
}

async function triggerSOS() {
    if (!currentUser) return;

    const location = locationText.textContent;
    const battery = batteryText.textContent;

    const alert = {
        userId: currentUser.uid,
        userName: currentProfile?.name || currentUser.email,
        latitude: location.includes(",") ? location.split(",")[0].trim() : "",
        longitude: location.includes(",") ? location.split(",")[1].trim() : "",
        battery: battery || "",
        createdAt: serverTimestamp()
    };

    await addDoc(collection(db, "sos_alerts"), alert);
}

function bindEvents() {
    document.getElementById("showRegisterButton").addEventListener("click", () => {
        loginForm.classList.add("hidden");
        registerForm.classList.remove("hidden");
        authMessage.textContent = "";
    });

    document.getElementById("showLoginButton").addEventListener("click", () => {
        registerForm.classList.add("hidden");
        loginForm.classList.remove("hidden");
        authMessage.textContent = "";
    });

    document.getElementById("registerButton").addEventListener("click", registerUser);
    document.getElementById("loginButton").addEventListener("click", loginUser);
    logoutButton.addEventListener("click", logoutUser);

    sosButton.addEventListener("mousedown", startSOSHold);
    sosButton.addEventListener("mouseup", stopSOSHold);
    sosButton.addEventListener("mouseleave", stopSOSHold);
    sosButton.addEventListener("touchstart", startSOSHold, { passive: true });
    sosButton.addEventListener("touchend", stopSOSHold, { passive: true });
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const profileDoc = await getDoc(doc(db, "users", user.uid));
        currentProfile = profileDoc.exists() ? profileDoc.data() : null;
        userNameTop.textContent = currentProfile?.name || "User";
        setScreen(true);
        getLocation();
        updateBatteryInfo();
    } else {
        currentUser = null;
        currentProfile = null;
        userNameTop.textContent = "User";
        setScreen(false);
    }
});

bindEvents();
