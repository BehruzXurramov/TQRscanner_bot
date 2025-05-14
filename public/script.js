// Initialize Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.expand();
} else {
  console.warn("Not running in Telegram WebApp");
}

// DOM elements
const initScreen = document.getElementById("init-screen");
const startButton = document.getElementById("start-button");
const scannerContainer = document.getElementById("scanner-container");
const video = document.getElementById("video");
const scanLine = document.getElementById("scan-line");
const errorMessage = document.getElementById("error-message");
const resultContainer = document.getElementById("result-container");
const result = document.getElementById("result");
const copyButton = document.getElementById("copy-button");
const sendButton = document.getElementById("send-button");
const rescanButton = document.getElementById("rescan-button");
const successMessage = document.getElementById("success-message");
const permissionHelp = document.getElementById("permission-help");

// State variables
let stream = null;
let scanning = false;
let animationFrameId = null;
let scannedData = null;
let lastScanTime = 0;
const scanInterval = 200; // ms between scans

// Initialize the app
function init() {
  // Check if we're in Telegram WebApp
  if (!tg) {
    showError("This app is designed to run within Telegram");
    return;
  }

  // Set theme colors
  document.body.style.backgroundColor = tg.themeParams.bg_color || "#ffffff";
  document.body.style.color = tg.themeParams.text_color || "#000000";

  // Set up event listeners
  startButton.addEventListener("click", startScanner);
  copyButton.addEventListener("click", copyToClipboard);
  sendButton.addEventListener("click", sendToUser);
  rescanButton.addEventListener("click", startScanner);

  // Check camera support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError("Camera access is not supported in this browser");
    return;
  }

  // Handle back button in Telegram
  if (tg?.BackButton) {
    tg.BackButton.onClick(() => {
      if (scannerContainer.style.display === "block") {
        stopScanner();
        showRescanButton();
      } else {
        tg.close();
      }
    });
  }
}

// Start the QR scanner
async function startScanner() {
  // Hide other elements and show scanner
  initScreen.style.display = "none";
  resultContainer.style.display = "none";
  copyButton.style.display = "none";
  sendButton.style.display = "none";
  rescanButton.style.display = "none";
  hideError();
  permissionHelp.style.display = "none";

  scannerContainer.style.display = "block";
  scanLine.style.display = "block";

  try {
    // Stop any existing stream
    if (stream) {
      stopScanner();
    }

    // Show loading state
    startButton.disabled = true;
    startButton.innerHTML =
      '<i class="fas fa-qrcode"></i> Starting Camera <span class="loading"></span>';

    // Get camera access
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    video.srcObject = stream;
    await video.play();

    scanning = true;
    scannedData = null;
    lastScanTime = 0;

    // Reset button state
    startButton.disabled = false;
    startButton.innerHTML = '<i class="fas fa-qrcode"></i> Start Scanner';

    // Start scanning loop
    scanQRCode();
  } catch (err) {
    console.error("Camera error:", err);

    // Reset button state
    startButton.disabled = false;
    startButton.innerHTML = '<i class="fas fa-qrcode"></i> Start Scanner';
    permissionHelp.style.display = "block";

    if (err.name === "NotAllowedError") {
      showError("Camera access denied. Please allow camera permissions.");
    } else if (err.name === "NotFoundError") {
      showError("No camera found on this device.");
    } else {
      showError("Could not access camera. Please try again.");
    }
    showRescanButton();
    scanLine.style.display = "none";
  }
}

// Stop the QR scanner
function stopScanner() {
  scanning = false;

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Remove any existing canvas elements
  document.querySelectorAll("canvas").forEach((canvas) => canvas.remove());

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
  }

  scanLine.style.display = "none";
}

// Scan for QR codes in video stream
function scanQRCode() {
  if (!scanning) return;

  const now = Date.now();
  if (now - lastScanTime < scanInterval) {
    animationFrameId = requestAnimationFrame(scanQRCode);
    return;
  }
  lastScanTime = now;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code) {
      scannedData = code.data;
      showResult(scannedData);
      stopScanner();
      return;
    }
  }

  animationFrameId = requestAnimationFrame(scanQRCode);
}

// Show the scanning result
function showResult(data) {
  result.textContent = data;
  scannerContainer.style.display = "none";
  resultContainer.style.display = "block";
  copyButton.style.display = "flex";
  sendButton.style.display = "flex";
  rescanButton.style.display = "flex";

  // Show back button in Telegram
  if (tg?.BackButton) {
    tg.BackButton.show();
  }
}

// Show rescan button
function showRescanButton() {
  initScreen.style.display = "flex";
  scannerContainer.style.display = "none";

  // Hide back button if we're on initial screen
  if (tg?.BackButton) {
    tg.BackButton.hide();
  }
}

// Copy result to clipboard
async function copyToClipboard() {
  if (!scannedData) return;

  try {
    await navigator.clipboard.writeText(scannedData);
    showSuccess("Copied to clipboard!");
  } catch (err) {
    console.error("Copy error:", err);
    showError("Failed to copy to clipboard");
  }
}

// Send result to user via bot
function sendToUser() {
  if (!scannedData) return;

  if (!tg?.initDataUnsafe?.user?.id) {
    showError("Unable to identify user");
    return;
  }

  showSuccess("Sending...");
  sendButton.disabled = true;
  sendButton.innerHTML =
    '<i class="fab fa-telegram"></i> Sending... <span class="loading"></span>';

  fetch(`https://l-go.uz/sendtouser`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: tg.initDataUnsafe.user.id,
      data: scannedData,
    }),
  })
    .then((response) => {
      sendButton.disabled = false;
      sendButton.innerHTML = '<i class="fab fa-telegram"></i> Send to Telegram';

      if (!response.ok) throw new Error("Network response was not ok");
      showSuccess("Sent to Bot!");
      hideError()
    })
    .catch((err) => {
      console.error("Send error:", err);
      sendButton.disabled = false;
      sendButton.innerHTML = '<i class="fab fa-telegram"></i> Send to Telegram';
      showError("Failed to send data");
    });
}

// Show success message
function showSuccess(message) {
  successMessage.textContent = message;
  successMessage.style.display = "block";
  setTimeout(() => {
    successMessage.style.display = "none";
  }, 2000);
}

// Show error message
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = "block";
}

// Hide error message
function hideError() {
  errorMessage.style.display = "none";
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", init);
